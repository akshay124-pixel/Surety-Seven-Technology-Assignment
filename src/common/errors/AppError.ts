export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, 409, details);
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string,
    public readonly isRetryable: boolean = false
  ) {
    super('EXTERNAL_SERVICE_ERROR', `${service}: ${message}`, 503);
    this.name = 'ExternalServiceError';
  }
}

export class TimeoutError extends AppError {
  constructor(service: string, timeoutMs: number) {
    super('TIMEOUT_ERROR', `Request to ${service} timed out after ${timeoutMs}ms`, 504);
    this.name = 'TimeoutError';
  }
}
