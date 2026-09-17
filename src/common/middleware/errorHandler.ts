import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../logging/logger';
import { ZodError } from 'zod';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.id || 'unknown';

  if (err instanceof ZodError) {
    logger.warn(
      {
        requestId,
        errors: err.errors,
        path: req.path,
      },
      'Validation error'
    );

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      requestId,
    });
    return;
  }

  if (err instanceof AppError) {
    const logLevel = err.statusCode >= 500 ? 'error' : 'warn';

    logger[logLevel](
      {
        requestId,
        errorCode: err.code,
        statusCode: err.statusCode,
        message: err.message,
        details: err.details,
        stack: err.statusCode >= 500 ? err.stack : undefined,
      },
      'Application error'
    );

    const errorResponse: {
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
      requestId: string;
    } = {
      error: {
        code: err.code,
        message: err.message,
      },
      requestId,
    };

    if (err.details) {
      errorResponse.error.details = err.details;
    }

    res.status(err.statusCode).json(errorResponse);
    return;
  }

  logger.error(
    {
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
    },
    'Unexpected error'
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    requestId,
  });
}
