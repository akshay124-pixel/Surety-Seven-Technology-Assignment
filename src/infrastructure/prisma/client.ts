import { PrismaClient } from '@prisma/client';
import { logger } from '../../common/logging/logger';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('query', (e) => {
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Database query');
  }
});

prisma.$on('error', (e) => {
  logger.error({ error: e.message }, 'Database error');
});

prisma.$on('warn', (e) => {
  logger.warn({ message: e.message }, 'Database warning');
});

export { prisma };

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
