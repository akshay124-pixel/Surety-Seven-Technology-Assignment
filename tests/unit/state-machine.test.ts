import { ApplicationStatus, canTransition } from '../../src/modules/applications/application.types';

describe('Application State Machine', () => {
  describe('Valid Transitions', () => {
    it('should allow PENDING -> EVALUATING', () => {
      expect(canTransition(ApplicationStatus.PENDING, ApplicationStatus.EVALUATING)).toBe(true);
    });

    it('should allow PENDING -> FAILED', () => {
      expect(canTransition(ApplicationStatus.PENDING, ApplicationStatus.FAILED)).toBe(true);
    });

    it('should allow EVALUATING -> APPROVED', () => {
      expect(canTransition(ApplicationStatus.EVALUATING, ApplicationStatus.APPROVED)).toBe(true);
    });

    it('should allow EVALUATING -> REFERRED', () => {
      expect(canTransition(ApplicationStatus.EVALUATING, ApplicationStatus.REFERRED)).toBe(true);
    });

    it('should allow EVALUATING -> DECLINED', () => {
      expect(canTransition(ApplicationStatus.EVALUATING, ApplicationStatus.DECLINED)).toBe(true);
    });

    it('should allow EVALUATING -> FAILED', () => {
      expect(canTransition(ApplicationStatus.EVALUATING, ApplicationStatus.FAILED)).toBe(true);
    });
  });

  describe('Invalid Transitions', () => {
    it('should not allow PENDING -> APPROVED', () => {
      expect(canTransition(ApplicationStatus.PENDING, ApplicationStatus.APPROVED)).toBe(false);
    });

    it('should not allow APPROVED -> EVALUATING', () => {
      expect(canTransition(ApplicationStatus.APPROVED, ApplicationStatus.EVALUATING)).toBe(false);
    });

    it('should not allow APPROVED -> DECLINED', () => {
      expect(canTransition(ApplicationStatus.APPROVED, ApplicationStatus.DECLINED)).toBe(false);
    });

    it('should not allow DECLINED -> APPROVED', () => {
      expect(canTransition(ApplicationStatus.DECLINED, ApplicationStatus.APPROVED)).toBe(false);
    });

    it('should not allow REFERRED -> APPROVED', () => {
      expect(canTransition(ApplicationStatus.REFERRED, ApplicationStatus.APPROVED)).toBe(false);
    });

    it('should not allow FAILED -> any state', () => {
      expect(canTransition(ApplicationStatus.FAILED, ApplicationStatus.PENDING)).toBe(false);
      expect(canTransition(ApplicationStatus.FAILED, ApplicationStatus.EVALUATING)).toBe(false);
      expect(canTransition(ApplicationStatus.FAILED, ApplicationStatus.APPROVED)).toBe(false);
    });
  });

  describe('Terminal States', () => {
    it('APPROVED should be terminal', () => {
      const transitions = [
        ApplicationStatus.PENDING,
        ApplicationStatus.EVALUATING,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REFERRED,
        ApplicationStatus.DECLINED,
        ApplicationStatus.FAILED,
      ];

      transitions.forEach((status) => {
        expect(canTransition(ApplicationStatus.APPROVED, status)).toBe(false);
      });
    });

    it('REFERRED should be terminal', () => {
      const transitions = [
        ApplicationStatus.PENDING,
        ApplicationStatus.EVALUATING,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REFERRED,
        ApplicationStatus.DECLINED,
        ApplicationStatus.FAILED,
      ];

      transitions.forEach((status) => {
        expect(canTransition(ApplicationStatus.REFERRED, status)).toBe(false);
      });
    });

    it('DECLINED should be terminal', () => {
      const transitions = [
        ApplicationStatus.PENDING,
        ApplicationStatus.EVALUATING,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REFERRED,
        ApplicationStatus.DECLINED,
        ApplicationStatus.FAILED,
      ];

      transitions.forEach((status) => {
        expect(canTransition(ApplicationStatus.DECLINED, status)).toBe(false);
      });
    });

    it('FAILED should be terminal', () => {
      const transitions = [
        ApplicationStatus.PENDING,
        ApplicationStatus.EVALUATING,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REFERRED,
        ApplicationStatus.DECLINED,
        ApplicationStatus.FAILED,
      ];

      transitions.forEach((status) => {
        expect(canTransition(ApplicationStatus.FAILED, status)).toBe(false);
      });
    });
  });
});
