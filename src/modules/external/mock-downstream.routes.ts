import { Router, Request, Response } from 'express';
import { logger } from '../../common/logging/logger';

const router = Router();

const deliveredEvents = new Set<string>();

router.post('', async (req: Request, res: Response) => {
  const { eventId, eventType, applicationId, decision, score } = req.body;
  const log = logger.child({ requestId: req.id, eventId, api: 'mock-downstream' });

  log.info({ eventType, applicationId, decision, score }, 'Mock downstream API request received');

  if (eventId && deliveredEvents.has(eventId)) {
    log.info('Duplicate event detected, returning success (idempotent)');
    res.status(200).json({ status: 'accepted', message: 'Event already processed' });
    return;
  }

  if (applicationId && applicationId.includes('DOWNSTREAM-500')) {
    log.info('Simulating 500 error');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  if (applicationId && applicationId.includes('DOWNSTREAM-TIMEOUT')) {
    log.info('Simulating timeout (no response)');
    await new Promise(() => {});
    return;
  }

  if (applicationId && applicationId.includes('DOWNSTREAM-SLOW')) {
    log.info('Simulating slow response (4s delay)');
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  if (eventId) {
    deliveredEvents.add(eventId);
  }

  log.info('Event accepted successfully');
  res.status(200).json({
    status: 'accepted',
    eventId,
    message: 'Event processed successfully',
  });
});

router.get('/delivered', (_req: Request, res: Response) => {
  res.status(200).json({
    count: deliveredEvents.size,
    eventIds: Array.from(deliveredEvents),
  });
});

router.delete('/delivered', (_req: Request, res: Response) => {
  const count = deliveredEvents.size;
  deliveredEvents.clear();
  logger.info({ count }, 'Cleared delivered events');
  res.status(200).json({ cleared: count });
});

export default router;
