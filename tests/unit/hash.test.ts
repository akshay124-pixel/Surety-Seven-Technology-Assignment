import { hashRequest, generateId } from '../../src/common/utils/hash';

describe('Hash Utilities', () => {
  describe('hashRequest', () => {
    it('should generate consistent hash for same data', () => {
      const data = { applicantId: 'COMP-123', bondAmount: 500000 };
      
      const hash1 = hashRequest(data);
      const hash2 = hashRequest(data);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different data', () => {
      const data1 = { applicantId: 'COMP-123', bondAmount: 500000 };
      const data2 = { applicantId: 'COMP-456', bondAmount: 500000 };
      
      const hash1 = hashRequest(data1);
      const hash2 = hashRequest(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate same hash regardless of key order', () => {
      const data1 = { applicantId: 'COMP-123', bondAmount: 500000 };
      const data2 = { bondAmount: 500000, applicantId: 'COMP-123' };
      
      const hash1 = hashRequest(data1);
      const hash2 = hashRequest(data2);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different values', () => {
      const data1 = { applicantId: 'COMP-123', bondAmount: 500000 };
      const data2 = { applicantId: 'COMP-123', bondAmount: 600000 };
      
      const hash1 = hashRequest(data1);
      const hash2 = hashRequest(data2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateId('APP');
      
      expect(id).toMatch(/^APP-/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId('APP');
      const id2 = generateId('APP');
      
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs in uppercase', () => {
      const id = generateId('app');
      
      expect(id).toMatch(/^APP-[A-Z0-9]+$/);
    });
  });
});
