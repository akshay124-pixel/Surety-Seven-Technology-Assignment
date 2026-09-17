import { UnderwritingInput, UnderwritingResult, DecisionFactor } from './underwriting.types';
import {
  CreditScoreRule,
  YearsInBusinessRule,
  BondToRevenueRatioRule,
  ExposureToRevenueRatioRule,
  UnderwritingRule,
} from './underwriting.rules';

export class UnderwritingEngine {
  private rules: UnderwritingRule[];

  constructor() {
    this.rules = [
      new CreditScoreRule(),
      new YearsInBusinessRule(),
      new BondToRevenueRatioRule(),
      new ExposureToRevenueRatioRule(),
    ];
  }

  evaluate(input: UnderwritingInput): UnderwritingResult {
    const factors: DecisionFactor[] = [];
    let totalScore = 0;

    for (const rule of this.rules) {
      const factor = rule.evaluate(input.applicant, input.application);
      factors.push(factor);
      totalScore += factor.points;
    }

    const decision = this.determineDecision(totalScore);

    return {
      score: totalScore,
      decision,
      factors,
    };
  }

  private determineDecision(score: number): 'APPROVE' | 'REFER' | 'DECLINE' {
    if (score >= 80) {
      return 'APPROVE';
    } else if (score >= 50) {
      return 'REFER';
    } else {
      return 'DECLINE';
    }
  }
}
