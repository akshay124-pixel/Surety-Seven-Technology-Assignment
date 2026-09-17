import {
  DecisionFactor,
  UnderwritingFactorType,
  ApplicantData,
  ApplicationData,
} from './underwriting.types';

export interface UnderwritingRule {
  evaluate(applicant: ApplicantData, application: ApplicationData): DecisionFactor;
}

export class CreditScoreRule implements UnderwritingRule {
  evaluate(applicant: ApplicantData): DecisionFactor {
    const { creditScore } = applicant;
    let points = 0;
    let rule = '';
    let explanation = '';

    if (creditScore >= 750) {
      points = 30;
      rule = 'creditScore >= 750';
      explanation = 'Excellent credit score (>= 750)';
    } else if (creditScore >= 700) {
      points = 20;
      rule = '700 <= creditScore < 750';
      explanation = 'Good credit score (700-749)';
    } else {
      points = 5;
      rule = 'creditScore < 700';
      explanation = 'Fair credit score (< 700)';
    }

    return {
      factor: UnderwritingFactorType.CREDIT_SCORE,
      value: creditScore,
      rule,
      points,
      explanation,
    };
  }
}

export class YearsInBusinessRule implements UnderwritingRule {
  evaluate(applicant: ApplicantData): DecisionFactor {
    const { yearsInBusiness } = applicant;
    let points = 0;
    let rule = '';
    let explanation = '';

    if (yearsInBusiness >= 5) {
      points = 20;
      rule = 'yearsInBusiness >= 5';
      explanation = 'Established business (>= 5 years)';
    } else {
      points = 10;
      rule = 'yearsInBusiness < 5';
      explanation = 'Newer business (< 5 years)';
    }

    return {
      factor: UnderwritingFactorType.YEARS_IN_BUSINESS,
      value: yearsInBusiness,
      rule,
      points,
      explanation,
    };
  }
}

export class BondToRevenueRatioRule implements UnderwritingRule {
  evaluate(applicant: ApplicantData, application: ApplicationData): DecisionFactor {
    const { annualRevenue } = applicant;
    const { bondAmount } = application;

    const ratio = (bondAmount / annualRevenue) * 100;
    let points = 0;
    let rule = '';
    let explanation = '';

    if (ratio <= 10) {
      points = 30;
      rule = 'bondAmount <= 10% of annualRevenue';
      explanation = `Low risk: Bond is ${ratio.toFixed(1)}% of annual revenue (<= 10%)`;
    } else {
      points = 10;
      rule = 'bondAmount > 10% of annualRevenue';
      explanation = `Higher risk: Bond is ${ratio.toFixed(1)}% of annual revenue (> 10%)`;
    }

    return {
      factor: UnderwritingFactorType.BOND_TO_REVENUE_RATIO,
      value: `${ratio.toFixed(2)}%`,
      rule,
      points,
      explanation,
    };
  }
}

export class ExposureToRevenueRatioRule implements UnderwritingRule {
  evaluate(applicant: ApplicantData): DecisionFactor {
    const { annualRevenue, existingExposure } = applicant;

    const ratio = (existingExposure / annualRevenue) * 100;
    let points = 0;
    let rule = '';
    let explanation = '';

    if (ratio < 20) {
      points = 20;
      rule = 'existingExposure < 20% of annualRevenue';
      explanation = `Low exposure: ${ratio.toFixed(1)}% of annual revenue (< 20%)`;
    } else {
      points = 5;
      rule = 'existingExposure >= 20% of annualRevenue';
      explanation = `Higher exposure: ${ratio.toFixed(1)}% of annual revenue (>= 20%)`;
    }

    return {
      factor: UnderwritingFactorType.EXPOSURE_TO_REVENUE_RATIO,
      value: `${ratio.toFixed(2)}%`,
      rule,
      points,
      explanation,
    };
  }
}
