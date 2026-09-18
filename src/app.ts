import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/middleware/requestId';
import { rateLimiter } from './common/middleware/rateLimiter';
import { errorHandler } from './common/middleware/errorHandler';
import applicationRoutes from './modules/applications/application.routes';
import healthRoutes from './modules/health/health.routes';
import mockApplicantRoutes from './modules/external/mock-applicant.routes';
import mockDownstreamRoutes from './modules/external/mock-downstream.routes';
import { logger } from './common/logging/logger';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(requestIdMiddleware);
  app.use(rateLimiter);

  app.use((req, _res, next) => {
    logger.info(
      {
        requestId: req.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
      },
      'Incoming request'
    );
    next();
  });

  // Health and root routes (must come before other routes)
  app.use('/', healthRoutes);
  
  // Application routes
  app.use('/applications', applicationRoutes);
  
  // External mock routes
  app.use('/external/applicants', mockApplicantRoutes);
  app.use('/external/downstream/events', mockDownstreamRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  app.use(errorHandler);

  return app;
}
