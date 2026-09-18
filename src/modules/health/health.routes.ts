import { Router, Request, Response } from 'express';
import { prisma } from '../../infrastructure/prisma/client';
import { redis } from '../../infrastructure/redis/client';
import { logger } from '../../common/logging/logger';

const router = Router();

// API root endpoint - serves as landing page for live demo
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'SuretySeven Surety Bond Application System',
    status: 'operational',
    message: 'API is running successfully',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      readiness: '/ready',
      applications: {
        create: 'POST /applications',
        retrieve: 'GET /applications/:applicationId',
      },
    },
    documentation: 'https://github.com/[repository]/README.md',
    timestamp: new Date().toISOString(),
  });
});

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
