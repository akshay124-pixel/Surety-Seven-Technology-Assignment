export interface ApplicantData {
  annualRevenue: number;
  yearsInBusiness: number;
  creditScore: number;
  existingExposure: number;
}

export interface ApplicationData {
  bondAmount: number;
}

export interface UnderwritingInput {
  applicant: ApplicantData;
  application: ApplicationData;
}

export interface DecisionFactor {
  factor: string;
  value: string | number;
  rule: string;
  points: number;
  explanation: string;
}

export interface UnderwritingResult {
  score: number;
  decision: 'APPROVE' | 'REFER' | 'DECLINE';
  factors: DecisionFactor[];
}

export enum UnderwritingFactorType {
  CREDIT_SCORE = 'CREDIT_SCORE',
  YEARS_IN_BUSINESS = 'YEARS_IN_BUSINESS',
  BOND_TO_REVENUE_RATIO = 'BOND_TO_REVENUE_RATIO',
  EXPOSURE_TO_REVENUE_RATIO = 'EXPOSURE_TO_REVENUE_RATIO',
}
