import { Queue } from 'bullmq';
import { redis } from '../redis/client';
import { logger } from '../../common/logging/logger';

export interface EvaluationJobData {
  applicationId: string;
  applicantId: string;
  bondAmount: number;
  requestId: string;
}

export interface NotificationJobData {
  eventId: string;
  requestId: string;
}

export class QueueService {
  private evaluationQueue: Queue<EvaluationJobData>;
  private notificationQueue: Queue<NotificationJobData>;

  constructor() {
    this.evaluationQueue = new Queue<EvaluationJobData>('application-evaluation', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    this.notificationQueue = new Queue<NotificationJobData>('downstream-notification', {
      connection: redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    this.evaluationQueue.on('error', (error) => {
      logger.error({ error: error.message, queue: 'evaluation' }, 'Queue error');
    });

    this.notificationQueue.on('error', (error) => {
      logger.error({ error: error.message, queue: 'notification' }, 'Queue error');
    });

    logger.info('Queue service initialized');
  }

  async enqueueEvaluation(data: EvaluationJobData): Promise<void> {
    await this.evaluationQueue.add('evaluate-application', data, {
      jobId: data.applicationId,
    });

    logger.info(
      { applicationId: data.applicationId, requestId: data.requestId },
      'Evaluation job enqueued'
    );
  }

  async enqueueNotification(data: NotificationJobData): Promise<void> {
    await this.notificationQueue.add('send-notification', data, {
      jobId: data.eventId,
    });

    logger.info({ eventId: data.eventId, requestId: data.requestId }, 'Notification job enqueued');
  }

  getEvaluationQueue(): Queue<EvaluationJobData> {
    return this.evaluationQueue;
  }

  getNotificationQueue(): Queue<NotificationJobData> {
    return this.notificationQueue;
  }

  async close(): Promise<void> {
    await this.evaluationQueue.close();
    await this.notificationQueue.close();
    logger.info('Queues closed');
  }
}
