import { Router, Request, Response } from 'express';
import { logger } from '../../common/logging/logger';

const router = Router();

const mockApplicants: Record<string, unknown> = {
  'COMP-123': {
    applicantId: 'COMP-123',
    annualRevenue: 12000000,
    yearsInBusiness: 8,
    creditScore: 760,
    existingExposure: 1500000,
  },
  'COMP-456': {
    applicantId: 'COMP-456',
    annualRevenue: 5000000,
    yearsInBusiness: 3,
    creditScore: 680,
    existingExposure: 800000,
  },
  'COMP-789': {
    applicantId: 'COMP-789',
    annualRevenue: 25000000,
    yearsInBusiness: 15,
    creditScore: 800,
    existingExposure: 3000000,
  },
  'COMP-LOW': {
    applicantId: 'COMP-LOW',
    annualRevenue: 2000000,
    yearsInBusiness: 2,
    creditScore: 650,
    existingExposure: 600000,
  },
};

router.get('/:applicantId', async (req: Request, res: Response) => {
  const { applicantId } = req.params;
  const log = logger.child({ requestId: req.id, applicantId, api: 'mock-applicant' });

  log.info('Mock applicant API request received');

  if (applicantId === 'COMP-TIMEOUT') {
    log.info('Simulating timeout (no response)');
    await new Promise(() => {});
    return;
  }

  if (applicantId === 'COMP-500') {
    log.info('Simulating 500 error');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  if (applicantId === 'COMP-MALFORMED') {
    log.info('Simulating malformed response');
    res.status(200).json({ invalid: 'data', missing: 'required fields' });
    return;
  }

  if (applicantId === 'COMP-SLOW') {
    log.info('Simulating slow response (3s delay)');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const applicant = mockApplicants[applicantId];

  if (!applicant) {
    log.info('Applicant not found');
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  log.info('Returning applicant data');
  res.status(200).json(applicant);
});

export default router;
