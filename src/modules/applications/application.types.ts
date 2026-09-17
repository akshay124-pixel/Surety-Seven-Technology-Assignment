export enum ApplicationStatus {
  PENDING = 'PENDING',
  EVALUATING = 'EVALUATING',
  APPROVED = 'APPROVED',
  REFERRED = 'REFERRED',
  DECLINED = 'DECLINED',
  FAILED = 'FAILED',
}

export enum BondType {
  CONTRACT = 'CONTRACT',
  COMMERCIAL = 'COMMERCIAL',
  COURT = 'COURT',
  FIDELITY = 'FIDELITY',
  LICENSE_PERMIT = 'LICENSE_PERMIT',
}

export interface CreateApplicationRequest {
  applicantId: string;
  bondType: BondType;
  bondAmount: number;
  effectiveDate: string;
  obligee: {
    name: string;
  };
}

export interface ApplicationResponse {
  applicationId: string;
  status: ApplicationStatus;
  applicantId: string;
  bondType: BondType;
  bondAmount: number;
  effectiveDate: string;
  obligeeName: string;
  score: number | null;
  decision: string | null;
  applicant: ApplicantSnapshotResponse | null;
  decisionFactors: DecisionFactorResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicantSnapshotResponse {
  applicantId: string;
  annualRevenue: number;
  yearsInBusiness: number;
  creditScore: number;
  existingExposure: number;
}

export interface DecisionFactorResponse {
  factor: string;
  value: string;
  points: number;
  explanation: string;
}

export interface CreateApplicationResponse {
  applicationId: string;
  status: ApplicationStatus;
  requestId: string;
}

export const STATE_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.PENDING]: [ApplicationStatus.EVALUATING, ApplicationStatus.FAILED],
  [ApplicationStatus.EVALUATING]: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REFERRED,
    ApplicationStatus.DECLINED,
    ApplicationStatus.FAILED,
  ],
  [ApplicationStatus.APPROVED]: [],
  [ApplicationStatus.REFERRED]: [],
  [ApplicationStatus.DECLINED]: [],
  [ApplicationStatus.FAILED]: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) || false;
}
