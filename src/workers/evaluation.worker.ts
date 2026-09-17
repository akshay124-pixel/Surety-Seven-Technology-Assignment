import { Worker, Job } from 'bullmq';
import { redis } from '../infrastructure/redis/client';
import { ApplicationRepository } from '../modules/applications/application.repository';
import { ApplicantClient } from '../modules/applicant/applicant.client';
import { UnderwritingEngine } from '../modules/underwriting/underwriting.engine';
import { OutboxService } from '../modules/outbox/outbox.service';
import { logger } from '../common/logging/logger';
import { ApplicationStatus } from '../modules/applications/application.types';
import { ApplicantClientError } from '../modules/applicant/applicant.types';
import { OutboxEventType } from '../modules/outbox/outbox.types';
import { EvaluationJobData } from '../infrastructure/queues/queue.service';
import { prisma } from '../infrastructure/prisma/client';
import { getConfig } from '../config/env';

const config = getConfig();

export class EvaluationWorker {
  private worker: Worker<EvaluationJobData>;
  private repository: ApplicationRepository;
  private applicantClient: ApplicantClient;
  private underwritingEngine: UnderwritingEngine;
  private outboxService: OutboxService;

  constructor() {
    this.repository = new ApplicationRepository();
    this.applicantClient = new ApplicantClient();
    this.underwritingEngine = new UnderwritingEngine();
    this.outboxService = new OutboxService();

    this.worker = new Worker<EvaluationJobData>(
      'application-evaluation',
      async (job) => this.processJob(job),
      {
        connection: redis,
        concurrency: config.QUEUE_EVALUATION_CONCURRENCY,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info(
        { jobId: job.id, applicationId: job.data.applicationId },
        'Evaluation job completed'
      );
    });

    this.worker.on('failed', (job, error) => {
      logger.error(
        { jobId: job?.id, applicationId: job?.data.applicationId, error: error.message },
        'Evaluation job failed'
      );
    });

    logger.info('Evaluation worker started');
  }

  private async processJob(job: Job<EvaluationJobData>): Promise<void> {
    const { applicationId, applicantId, bondAmount, requestId } = job.data;
    const log = logger.child({ requestId, applicationId, jobId: job.id });

    log.info('Processing evaluation job');

    try {
      await this.repository.updateStatus(applicationId, ApplicationStatus.EVALUATING);

      log.info({ applicantId }, 'Fetching applicant information');
      const applicantInfo = await this.applicantClient.getApplicantInfo(applicantId, requestId);

      await this.repository.saveApplicantSnapshot(applicationId, applicantInfo);
      log.info('Applicant snapshot saved');

      log.info('Running underwriting evaluation');
      const underwritingResult = this.underwritingEngine.evaluate({
        applicant: {
          annualRevenue: applicantInfo.annualRevenue,
          yearsInBusiness: applicantInfo.yearsInBusiness,
          creditScore: applicantInfo.creditScore,
          existingExposure: applicantInfo.existingExposure,
        },
        application: {
          bondAmount,
        },
      });

      log.info(
        {
          score: underwritingResult.score,
          decision: underwritingResult.decision,
        },
        'Underwriting completed'
      );

      await prisma.$transaction(async (tx) => {
        await this.repository.saveUnderwritingResult(applicationId, underwritingResult);

        await this.outboxService.createEventInTransaction(
          tx,
          OutboxEventType.APPLICATION_DECISIONED,
          applicationId,
          {
            applicationId,
            decision: underwritingResult.decision,
            score: underwritingResult.score,
          }
        );
      });

      log.info('Evaluation completed successfully');
    } catch (error) {
      log.error({ error }, 'Evaluation job error');

      if (error instanceof ApplicantClientError) {
        if (error.isRetryable) {
          log.warn({ errorType: error.type }, 'Retryable error, will retry');
          throw error;
        } else {
          log.error({ errorType: error.type }, 'Non-retryable error, marking as failed');

          await this.repository.updateStatus(
            applicationId,
            ApplicationStatus.FAILED,
            error.type,
            error.message
          );

          return;
        }
      }

      throw error;
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
    logger.info('Evaluation worker closed');
  }
}
