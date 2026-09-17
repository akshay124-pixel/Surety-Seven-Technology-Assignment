import axios, { AxiosError, AxiosInstance } from 'axios';
import { getConfig } from '../../config/env';
import { logger } from '../../common/logging/logger';

const config = getConfig();

export interface NotificationPayload {
  eventId: string;
  eventType: string;
  applicationId: string;
  decision: string;
  score: number;
}

export enum NotificationErrorType {
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export class NotificationClientError extends Error {
  constructor(
    public readonly type: NotificationErrorType,
    message: string,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'NotificationClientError';
  }
}

export class NotificationClient {
  private client: AxiosInstance;
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = config.DOWNSTREAM_API_URL;
    this.timeout = config.DOWNSTREAM_API_TIMEOUT_MS;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async sendNotification(payload: NotificationPayload, requestId: string): Promise<void> {
    const log = logger.child({
      requestId,
      eventId: payload.eventId,
      operation: 'sendNotification',
    });

    try {
      log.info('Sending downstream notification');

      await this.client.post('', payload, {
        headers: {
          'X-Request-Id': requestId,
          'X-Event-Id': payload.eventId,
        },
      });

      log.info('Notification sent successfully');
    } catch (error) {
      const clientError = this.mapError(error);
      log.error(
        {
          errorType: clientError.type,
          isRetryable: clientError.isRetryable,
          message: clientError.message,
        },
        'Error sending notification'
      );
      throw clientError;
    }
  }

  private mapError(error: unknown): NotificationClientError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return new NotificationClientError(
          NotificationErrorType.TIMEOUT,
          `Request to downstream API timed out after ${this.timeout}ms`,
          true
        );
      }

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        return new NotificationClientError(
          NotificationErrorType.NETWORK_ERROR,
          'Unable to connect to downstream API',
          true
        );
      }

      if (axiosError.response) {
        const status = axiosError.response.status;

        if (status >= 500) {
          return new NotificationClientError(
            NotificationErrorType.SERVER_ERROR,
            `Downstream API returned ${status} error`,
            true
          );
        }

        if (status >= 400) {
          return new NotificationClientError(
            NotificationErrorType.CLIENT_ERROR,
            `Downstream API returned ${status} status`,
            false
          );
        }
      }
    }

    return new NotificationClientError(
      NotificationErrorType.UNKNOWN,
      error instanceof Error ? error.message : 'Unknown error occurred',
      false
    );
  }
}
