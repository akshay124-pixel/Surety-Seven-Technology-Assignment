import { Worker, Job } from 'bullmq';
import { redis } from '../infrastructure/redis/client';
import { OutboxService } from '../modules/outbox/outbox.service';
import {
  NotificationClient,
  NotificationClientError,
} from '../modules/notifications/notification.client';
import { logger } from '../common/logging/logger';
import { NotificationJobData } from '../infrastructure/queues/queue.service';
import { getConfig } from '../config/env';

const config = getConfig();

export class NotificationWorker {
  private worker: Worker<NotificationJobData>;
  private outboxService: OutboxService;
  private notificationClient: NotificationClient;

  constructor() {
    this.outboxService = new OutboxService();
    this.notificationClient = new NotificationClient();

    this.worker = new Worker<NotificationJobData>(
      'downstream-notification',
      async (job) => this.processJob(job),
      {
        connection: redis,
        concurrency: config.QUEUE_NOTIFICATION_CONCURRENCY,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id, eventId: job.data.eventId }, 'Notification job completed');
    });

    this.worker.on('failed', (job, error) => {
      logger.error(
        { jobId: job?.id, eventId: job?.data.eventId, error: error.message },
        'Notification job failed'
      );
    });

    logger.info('Notification worker started');
  }

  private async processJob(job: Job<NotificationJobData>): Promise<void> {
    const { eventId, requestId } = job.data;
    const log = logger.child({ requestId, eventId, jobId: job.id });

    log.info('Processing notification job');

    try {
      const event = await this.outboxService.getEventByEventId(eventId);

      if (!event) {
        log.error('Event not found');
        return;
      }

      if (event.status === 'DELIVERED') {
        log.info('Event already delivered, skipping');
        return;
      }

      await this.outboxService.markProcessing(eventId);

      const payload = event.payload as {
        applicationId: string;
        decision: string;
        score: number;
      };

      await this.notificationClient.sendNotification(
        {
          eventId: event.eventId,
          eventType: event.eventType,
          applicationId: payload.applicationId,
          decision: payload.decision,
          score: payload.score,
        },
        requestId
      );

      await this.outboxService.markDelivered(eventId);
      log.info('Notification delivered successfully');
    } catch (error) {
      log.error({ error }, 'Notification job error');

      if (error instanceof NotificationClientError) {
        if (error.isRetryable) {
          const retryDelay = this.calculateRetryDelay(job.attemptsMade);
          await this.outboxService.markFailed(eventId, error.message, retryDelay);
          log.warn({ retryDelay }, 'Retryable error, will retry');
          throw error;
        } else {
          await this.outboxService.markFailed(eventId, error.message, 0);
          log.error('Non-retryable error, marking as permanently failed');
          return;
        }
      }

      throw error;
    }
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 5000;
    const maxDelay = 60000;
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  }

  async close(): Promise<void> {
    await this.worker.close();
    logger.info('Notification worker closed');
  }
}
