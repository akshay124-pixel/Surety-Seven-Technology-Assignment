import { createApplicationSchema } from '../../src/modules/applications/application.schemas';
import { BondType } from '../../src/modules/applications/application.types';

describe('Application Schemas', () => {
  describe('createApplicationSchema', () => {
    const validData = {
      applicantId: 'COMP-123',
      bondType: BondType.CONTRACT,
      bondAmount: 500000,
      effectiveDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      obligee: {
        name: 'ABC Construction LLC',
      },
    };

    it('should validate correct application data', () => {
      const result = createApplicationSchema.safeParse(validData);
      
      expect(result.success).toBe(true);
    });

    it('should reject missing applicantId', () => {
      const data = { ...validData };
      delete (data as Partial<typeof validData>).applicantId;
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should reject empty applicantId', () => {
      const data = { ...validData, applicantId: '' };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid bondType', () => {
      const data = { ...validData, bondType: 'INVALID' };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should reject negative bondAmount', () => {
      const data = { ...validData, bondAmount: -1000 };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should reject zero bondAmount', () => {
      const data = { ...validData, bondAmount: 0 };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should reject bondAmount exceeding maximum', () => {
      const data = { ...validData, bondAmount: 200000000 };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const data = { ...validData, effectiveDate: 'not-a-date' };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should reject past effectiveDate', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const data = { ...validData, effectiveDate: yesterday };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should accept today as effectiveDate', () => {
      const today = new Date().toISOString().split('T')[0];
      const data = { ...validData, effectiveDate: today };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(true);
    });

    it('should reject empty obligee name', () => {
      const data = { ...validData, obligee: { name: '' } };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });

    it('should reject obligee name that is too long', () => {
      const data = { ...validData, obligee: { name: 'A'.repeat(201) } };
      
      const result = createApplicationSchema.safeParse(data);
      
      expect(result.success).toBe(false);
    });
  });
});
