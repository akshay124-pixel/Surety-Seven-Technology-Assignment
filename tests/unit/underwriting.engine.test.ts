import { UnderwritingEngine } from '../../src/modules/underwriting/underwriting.engine';
import { UnderwritingInput } from '../../src/modules/underwriting/underwriting.types';

describe('UnderwritingEngine', () => {
  let engine: UnderwritingEngine;

  beforeEach(() => {
    engine = new UnderwritingEngine();
  });

  describe('Credit Score Rules', () => {
    it('should award 30 points for credit score >= 750', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const creditFactor = result.factors.find((f) => f.factor === 'CREDIT_SCORE');
      
      expect(creditFactor?.points).toBe(30);
    });

    it('should award 30 points for credit score > 750', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 800,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const creditFactor = result.factors.find((f) => f.factor === 'CREDIT_SCORE');
      
      expect(creditFactor?.points).toBe(30);
    });

    it('should award 20 points for credit score 700-749', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 700,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const creditFactor = result.factors.find((f) => f.factor === 'CREDIT_SCORE');
      
      expect(creditFactor?.points).toBe(20);
    });

    it('should award 20 points for credit score 749', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 749,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const creditFactor = result.factors.find((f) => f.factor === 'CREDIT_SCORE');
      
      expect(creditFactor?.points).toBe(20);
    });

    it('should award 5 points for credit score < 700', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 699,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const creditFactor = result.factors.find((f) => f.factor === 'CREDIT_SCORE');
      
      expect(creditFactor?.points).toBe(5);
    });
  });

  describe('Years in Business Rules', () => {
    it('should award 20 points for yearsInBusiness >= 5', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const factor = result.factors.find((f) => f.factor === 'YEARS_IN_BUSINESS');
      
      expect(factor?.points).toBe(20);
    });

    it('should award 10 points for yearsInBusiness < 5', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 4,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const factor = result.factors.find((f) => f.factor === 'YEARS_IN_BUSINESS');
      
      expect(factor?.points).toBe(10);
    });
  });

  describe('Bond to Revenue Ratio Rules', () => {
    it('should award 30 points when bond is exactly 10% of revenue', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 1000000,
        },
      };

      const result = engine.evaluate(input);
      const factor = result.factors.find((f) => f.factor === 'BOND_TO_REVENUE_RATIO');
      
      expect(factor?.points).toBe(30);
    });

    it('should award 30 points when bond is < 10% of revenue', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const factor = result.factors.find((f) => f.factor === 'BOND_TO_REVENUE_RATIO');
      
      expect(factor?.points).toBe(30);
    });

    it('should award 10 points when bond is > 10% of revenue', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1000000,
        },
        application: {
          bondAmount: 1500000,
        },
      };

      const result = engine.evaluate(input);
      const factor = result.factors.find((f) => f.factor === 'BOND_TO_REVENUE_RATIO');
      
      expect(factor?.points).toBe(10);
    });
  });

  describe('Exposure to Revenue Ratio Rules', () => {
    it('should award 20 points when exposure is < 20% of revenue', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1500000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const factor = result.factors.find((f) => f.factor === 'EXPOSURE_TO_REVENUE_RATIO');
      
      expect(factor?.points).toBe(20);
    });

    it('should award 5 points when exposure is exactly 20% of revenue', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 2000000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const factor = result.factors.find((f) => f.factor === 'EXPOSURE_TO_REVENUE_RATIO');
      
      expect(factor?.points).toBe(5);
    });

    it('should award 5 points when exposure is > 20% of revenue', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 2500000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      const factor = result.factors.find((f) => f.factor === 'EXPOSURE_TO_REVENUE_RATIO');
      
      expect(factor?.points).toBe(5);
    });
  });

  describe('Decision Logic', () => {
    it('should APPROVE when score >= 80', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 760,
          yearsInBusiness: 8,
          annualRevenue: 12000000,
          existingExposure: 1500000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      
      expect(result.score).toBe(100);
      expect(result.decision).toBe('APPROVE');
    });

    it('should APPROVE when score is exactly 80', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 750,
          yearsInBusiness: 5,
          annualRevenue: 10000000,
          existingExposure: 1500000,
        },
        application: {
          bondAmount: 1000000,
        },
      };

      const result = engine.evaluate(input);
      
      expect(result.score).toBe(80);
      expect(result.decision).toBe('APPROVE');
    });

    it('should REFER when score is between 50-79', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 720,
          yearsInBusiness: 3,
          annualRevenue: 5000000,
          existingExposure: 800000,
        },
        application: {
          bondAmount: 1000000,
        },
      };

      const result = engine.evaluate(input);
      
      expect(result.score).toBe(55);
      expect(result.decision).toBe('REFER');
    });

    it('should DECLINE when score < 50', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 650,
          yearsInBusiness: 2,
          annualRevenue: 2000000,
          existingExposure: 600000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      
      expect(result.score).toBe(45);
      expect(result.decision).toBe('DECLINE');
    });
  });

  describe('Complete Evaluation', () => {
    it('should include all factors in the result', () => {
      const input: UnderwritingInput = {
        applicant: {
          creditScore: 760,
          yearsInBusiness: 8,
          annualRevenue: 12000000,
          existingExposure: 1500000,
        },
        application: {
          bondAmount: 500000,
        },
      };

      const result = engine.evaluate(input);
      
      expect(result.factors).toHaveLength(4);
      expect(result.factors.map((f) => f.factor)).toEqual([
        'CREDIT_SCORE',
        'YEARS_IN_BUSINESS',
        'BOND_TO_REVENUE_RATIO',
        'EXPOSURE_TO_REVENUE_RATIO',
      ]);
      
      result.factors.forEach((factor) => {
        expect(factor).toHaveProperty('factor');
        expect(factor).toHaveProperty('value');
        expect(factor).toHaveProperty('rule');
        expect(factor).toHaveProperty('points');
        expect(factor).toHaveProperty('explanation');
      });
    });
  });
});
