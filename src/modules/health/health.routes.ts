import { Router, Request, Response } from 'express';
import { prisma } from '../../infrastructure/prisma/client';
import { redis } from '../../infrastructure/redis/client';
import { logger } from '../../common/logging/logger';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.get('/ready', async (req: Request, res: Response) => {
  const log = logger.child({ requestId: req.id, operation: 'readiness' });
  const checks: Record<string, { status: string; message?: string }> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'connected' };
  } catch (error) {
    checks.database = {
      status: 'disconnected',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    log.error({ error }, 'Database check failed');
  }

  try {
    await redis.ping();
    checks.redis = { status: 'connected' };
  } catch (error) {
    checks.redis = {
      status: 'disconnected',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    log.error({ error }, 'Redis check failed');
  }

  const allHealthy = Object.values(checks).every((check) => check.status === 'connected');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
