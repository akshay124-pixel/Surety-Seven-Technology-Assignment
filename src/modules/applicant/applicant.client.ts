import axios, { AxiosError, AxiosInstance } from 'axios';
import { z } from 'zod';
import { getConfig } from '../../config/env';
import { logger } from '../../common/logging/logger';
import { ApplicantInfo, ApplicantClientError, ApplicantErrorType } from './applicant.types';

const config = getConfig();

const applicantResponseSchema = z.object({
  applicantId: z.string(),
  annualRevenue: z.number().positive(),
  yearsInBusiness: z.number().int().nonnegative(),
  creditScore: z.number().int().min(300).max(850),
  existingExposure: z.number().nonnegative(),
});

export class ApplicantClient {
  private client: AxiosInstance;
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;

  constructor() {
    this.baseURL = config.APPLICANT_API_URL;
    this.timeout = config.APPLICANT_API_TIMEOUT_MS;
    this.maxRetries = config.APPLICANT_API_MAX_RETRIES;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getApplicantInfo(applicantId: string, requestId: string): Promise<ApplicantInfo> {
    const log = logger.child({ requestId, applicantId, operation: 'getApplicantInfo' });

    let lastError: ApplicantClientError | null = null;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      attempt++;

      try {
        log.info({ attempt, maxRetries: this.maxRetries }, 'Fetching applicant info');

        const response = await this.client.get(`/${applicantId}`, {
          headers: {
            'X-Request-Id': requestId,
          },
        });

        const validatedData = applicantResponseSchema.parse(response.data);

        log.info('Successfully fetched applicant info');
        return validatedData;
      } catch (error) {
        const clientError = this.mapError(error, applicantId);
        lastError = clientError;

        log.warn(
          {
            attempt,
            errorType: clientError.type,
            isRetryable: clientError.isRetryable,
            message: clientError.message,
          },
          'Error fetching applicant info'
        );

        if (!clientError.isRetryable || attempt > this.maxRetries) {
          break;
        }

        const backoffMs = this.calculateBackoff(attempt);
        log.debug({ backoffMs }, 'Retrying after backoff');
        await this.sleep(backoffMs);
      }
    }

    log.error(
      {
        attempts: attempt,
        errorType: lastError?.type,
      },
      'Failed to fetch applicant info after retries'
    );

    throw lastError;
  }

  private mapError(error: unknown, applicantId: string): ApplicantClientError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return new ApplicantClientError(
          ApplicantErrorType.TIMEOUT,
          `Request to Applicant API timed out after ${this.timeout}ms`,
          true
        );
      }

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        return new ApplicantClientError(
          ApplicantErrorType.NETWORK_ERROR,
          'Unable to connect to Applicant API',
          true
        );
      }

      if (axiosError.response) {
        const status = axiosError.response.status;

        if (status === 404) {
          return new ApplicantClientError(
            ApplicantErrorType.NOT_FOUND,
            `Applicant ${applicantId} not found`,
            false
          );
        }

        if (status >= 500) {
          return new ApplicantClientError(
            ApplicantErrorType.SERVER_ERROR,
            `Applicant API returned ${status} error`,
            true
          );
        }

        return new ApplicantClientError(
          ApplicantErrorType.UNKNOWN,
          `Applicant API returned ${status} status`,
          false
        );
      }
    }

    if (error instanceof z.ZodError) {
      return new ApplicantClientError(
        ApplicantErrorType.MALFORMED_RESPONSE,
        'Applicant API returned invalid data format',
        false
      );
    }

    return new ApplicantClientError(
      ApplicantErrorType.UNKNOWN,
      error instanceof Error ? error.message : 'Unknown error occurred',
      false
    );
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000;
    const maxDelay = 10000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 500;
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
