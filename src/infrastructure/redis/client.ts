import Redis from 'ioredis';
import { getConfig } from '../../config/env';
import { logger } from '../../common/logging/logger';

const config = getConfig();

export const redis = config.REDIS_URL
  ? new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  : new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  logger.error({ error: error.message }, 'Redis error');
});

redis.on('close', () => {
  logger.info('Redis connection closed');
});

export async function connectRedis(): Promise<void> {
  // Connection is handled automatically
  logger.info('Redis client initialized');
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis disconnected');
}
