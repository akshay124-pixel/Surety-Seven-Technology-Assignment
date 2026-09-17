import { z } from 'zod';
import { BondType } from './application.types';

export const createApplicationSchema = z.object({
  applicantId: z.string().min(1, 'Applicant ID is required'),
  bondType: z.nativeEnum(BondType, {
    errorMap: () => ({ message: 'Invalid bond type' }),
  }),
  bondAmount: z
    .number()
    .positive('Bond amount must be positive')
    .max(100000000, 'Bond amount exceeds maximum'),
  effectiveDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), 'Invalid date format')
    .refine(
      (date) => new Date(date) >= new Date(new Date().setHours(0, 0, 0, 0)),
      'Effective date cannot be in the past'
    ),
  obligee: z.object({
    name: z.string().min(1, 'Obligee name is required').max(200, 'Obligee name too long'),
  }),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
