import { createApp } from './app';
import { loadConfig } from './config/env';
import { connectDatabase, disconnectDatabase } from './infrastructure/prisma/client';
import { connectRedis, disconnectRedis } from './infrastructure/redis/client';
import { logger } from './common/logging/logger';

const config = loadConfig();
const app = createApp();

let server: ReturnType<typeof app.listen> | null = null;

async function start(): Promise<void> {
  try {
    await connectDatabase();
    await connectRedis();

    server = app.listen(config.PORT, () => {
      logger.info(
        {
          port: config.PORT,
          env: config.NODE_ENV,
        },
        'Server started successfully'
      );
    });

    server.on('error', (error) => {
      logger.error({ error }, 'Server error');
      process.exit(1);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await disconnectRedis();
        await disconnectDatabase();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});

void start();
