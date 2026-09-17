import { prisma } from '../../infrastructure/prisma/client';
import { Prisma, OutboxEvent } from '@prisma/client';
import { logger } from '../../common/logging/logger';
import { generateId } from '../../common/utils/hash';
import { OutboxEventStatus, OutboxEventType, ApplicationDecisionedPayload } from './outbox.types';

export class OutboxService {
  async createEventInTransaction(
    tx: Prisma.TransactionClient,
    eventType: OutboxEventType,
    applicationId: string,
    payload: ApplicationDecisionedPayload
  ): Promise<OutboxEvent> {
    const eventId = generateId('EVT');

    return tx.outboxEvent.create({
      data: {
        eventId,
        eventType,
        applicationId,
        payload: payload as unknown as Prisma.JsonObject,
        status: OutboxEventStatus.PENDING,
        availableAt: new Date(),
      },
    });
  }

  async getPendingEvents(limit: number = 10): Promise<OutboxEvent[]> {
    return prisma.outboxEvent.findMany({
      where: {
        status: OutboxEventStatus.PENDING,
        availableAt: {
          lte: new Date(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
    });
  }

  async markProcessing(eventId: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { eventId },
      data: {
        status: OutboxEventStatus.PROCESSING,
      },
    });
  }

  async markDelivered(eventId: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { eventId },
      data: {
        status: OutboxEventStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    logger.info({ eventId }, 'Outbox event marked as delivered');
  }

  async markFailed(eventId: string, error: string, retryAfterMs: number = 0): Promise<void> {
    const availableAt = new Date(Date.now() + retryAfterMs);

    await prisma.outboxEvent.update({
      where: { eventId },
      data: {
        status: retryAfterMs > 0 ? OutboxEventStatus.PENDING : OutboxEventStatus.FAILED,
        attempts: {
          increment: 1,
        },
        lastError: error,
        availableAt,
      },
    });

    logger.warn(
      { eventId, error, retryAfterMs, status: retryAfterMs > 0 ? 'PENDING' : 'FAILED' },
      'Outbox event marked as failed'
    );
  }

  async getEventByEventId(eventId: string): Promise<OutboxEvent | null> {
    return prisma.outboxEvent.findUnique({
      where: { eventId },
    });
  }
}
