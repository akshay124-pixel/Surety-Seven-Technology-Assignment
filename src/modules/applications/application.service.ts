import { ApplicationRepository } from './application.repository';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { QueueService } from '../../infrastructure/queues/queue.service';
import { logger } from '../../common/logging/logger';
import { generateId } from '../../common/utils/hash';
import { NotFoundError } from '../../common/errors/AppError';
import { CreateApplicationInput } from './application.schemas';
import {
  CreateApplicationResponse,
  ApplicationResponse,
  ApplicationStatus,
  BondType,
  DecisionFactorResponse,
  ApplicantSnapshotResponse,
} from './application.types';
import { Decimal } from '@prisma/client/runtime/library';

export class ApplicationService {
  private repository: ApplicationRepository;
  private idempotencyService: IdempotencyService;
  private queueService: QueueService;

  constructor() {
    this.repository = new ApplicationRepository();
    this.idempotencyService = new IdempotencyService();
    this.queueService = new QueueService();
  }

  async createApplication(
    input: CreateApplicationInput,
    idempotencyKey: string | undefined,
    requestId: string
  ): Promise<CreateApplicationResponse> {
    const log = logger.child({ requestId, operation: 'createApplication' });

    if (idempotencyKey) {
      const cached = await this.idempotencyService.checkIdempotency(
        idempotencyKey,
        input,
        requestId
      );

      if (cached) {
        log.info({ applicationId: cached.applicationId }, 'Returning cached response');
        return cached;
      }
    }

    const applicationId = generateId('APP');
    log.info({ applicationId }, 'Creating new application');

    const application = await this.repository.create({
      applicationId,
      applicantId: input.applicantId,
      bondType: input.bondType,
      bondAmount: input.bondAmount,
      effectiveDate: new Date(input.effectiveDate),
      obligeeName: input.obligee.name,
    });

    await this.queueService.enqueueEvaluation({
      applicationId: application.applicationId,
      applicantId: application.applicantId,
      bondAmount: Number(application.bondAmount),
      requestId,
    });

    log.info({ applicationId }, 'Application created and evaluation enqueued');

    const response: CreateApplicationResponse = {
      applicationId: application.applicationId,
      status: application.status as ApplicationStatus,
      requestId,
    };

    if (idempotencyKey) {
      await this.idempotencyService.saveIdempotency(idempotencyKey, input, response, requestId);
    }

    return response;
  }

  async getApplication(applicationId: string, requestId: string): Promise<ApplicationResponse> {
    const log = logger.child({ requestId, applicationId, operation: 'getApplication' });

    const application = await this.repository.findByApplicationId(applicationId);

    if (!application) {
      log.warn('Application not found');
      throw new NotFoundError('Application', applicationId);
    }

    log.info({ status: application.status }, 'Application found');

    return {
      applicationId: application.applicationId,
      status: application.status as ApplicationStatus,
      applicantId: application.applicantId,
      bondType: application.bondType as unknown as BondType,
      bondAmount: Number(application.bondAmount),
      effectiveDate: application.effectiveDate.toISOString().split('T')[0],
      obligeeName: application.obligeeName,
      score: application.score,
      decision: application.decision,
      applicant: application.applicantSnapshot
        ? this.mapApplicantSnapshot(application.applicantSnapshot)
        : null,
      decisionFactors: application.decisionFactors.map(this.mapDecisionFactor),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  }

  private mapApplicantSnapshot(snapshot: {
    applicantId: string;
    annualRevenue: Decimal;
    yearsInBusiness: number;
    creditScore: number;
    existingExposure: Decimal;
  }): ApplicantSnapshotResponse {
    return {
      applicantId: snapshot.applicantId,
      annualRevenue: Number(snapshot.annualRevenue),
      yearsInBusiness: snapshot.yearsInBusiness,
      creditScore: snapshot.creditScore,
      existingExposure: Number(snapshot.existingExposure),
    };
  }

  private mapDecisionFactor(factor: {
    factor: string;
    inputValue: string;
    points: number;
    explanation: string;
  }): DecisionFactorResponse {
    return {
      factor: factor.factor,
      value: factor.inputValue,
      points: factor.points,
      explanation: factor.explanation,
    };
  }
}
