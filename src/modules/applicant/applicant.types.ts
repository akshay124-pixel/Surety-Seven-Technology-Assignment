export interface ApplicantInfo {
  applicantId: string;
  annualRevenue: number;
  yearsInBusiness: number;
  creditScore: number;
  existingExposure: number;
}

export enum ApplicantErrorType {
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  MALFORMED_RESPONSE = 'MALFORMED_RESPONSE',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}

export class ApplicantClientError extends Error {
  constructor(
    public readonly type: ApplicantErrorType,
    message: string,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ApplicantClientError';
  }
}
