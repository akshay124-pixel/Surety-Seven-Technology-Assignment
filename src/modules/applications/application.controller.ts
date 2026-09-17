import { Request, Response, NextFunction } from 'express';
import { ApplicationService } from './application.service';
import { createApplicationSchema } from './application.schemas';
import { logger } from '../../common/logging/logger';

export class ApplicationController {
  private service: ApplicationService;

  constructor() {
    this.service = new ApplicationService();
  }

  async createApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const log = logger.child({ requestId: req.id, operation: 'createApplication' });

      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      if (idempotencyKey) {
        log.info({ idempotencyKey }, 'Request includes idempotency key');
      }

      const validatedData = createApplicationSchema.parse(req.body);

      const response = await this.service.createApplication(validatedData, idempotencyKey, req.id);

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { applicationId } = req.params;

      const response = await this.service.getApplication(applicationId, req.id);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
