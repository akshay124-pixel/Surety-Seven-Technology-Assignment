import { loadConfig } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../infrastructure/prisma/client';
import { connectRedis, disconnectRedis } from '../infrastructure/redis/client';
import { QueueService } from '../infrastructure/queues/queue.service';
import { EvaluationWorker } from './evaluation.worker';
import { NotificationWorker } from './notification.worker';
import { OutboxService } from '../modules/outbox/outbox.service';
import { logger } from '../common/logging/logger';

loadConfig();

let evaluationWorker: EvaluationWorker | null = null;
let notificationWorker: NotificationWorker | null = null;
let outboxPoller: NodeJS.Timeout | null = null;

async function start(): Promise<void> {
  try {
    await connectDatabase();
    await connectRedis();

    const queueService = new QueueService();
    evaluationWorker = new EvaluationWorker();
    notificationWorker = new NotificationWorker();

    const outboxService = new OutboxService();

    outboxPoller = setInterval(async () => {
      try {
        const events = await outboxService.getPendingEvents(20);

        for (const event of events) {
          await queueService.enqueueNotification({
            eventId: event.eventId,
            requestId: event.eventId,
          });
        }

        if (events.length > 0) {
          logger.debug({ count: events.length }, 'Polled outbox events');
        }
      } catch (error) {
        logger.error({ error }, 'Error polling outbox');
      }
    }, 5000);

    logger.info('Workers started successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to start workers');
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Worker shutdown signal received');

  if (outboxPoller) {
    clearInterval(outboxPoller);
  }

  try {
    if (evaluationWorker) {
      await evaluationWorker.close();
    }
    if (notificationWorker) {
      await notificationWorker.close();
    }
    await disconnectRedis();
    await disconnectDatabase();
    logger.info('Workers shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during worker shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection in worker');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception in worker');
  process.exit(1);
});

void start();
