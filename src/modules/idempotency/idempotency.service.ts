import { prisma } from '../../infrastructure/prisma/client';
import { hashRequest } from '../../common/utils/hash';
import { ConflictError } from '../../common/errors/AppError';
import { logger } from '../../common/logging/logger';
import { CreateApplicationResponse } from '../applications/application.types';

export class IdempotencyService {
  private readonly TTL_HOURS = 24;

  async checkIdempotency(
    idempotencyKey: string,
    requestData: unknown,
    requestId: string
  ): Promise<CreateApplicationResponse | null> {
    const log = logger.child({ requestId, idempotencyKey, operation: 'checkIdempotency' });
    const requestHash = hashRequest(requestData);

    try {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      });

      if (!existing) {
        log.debug('No existing idempotency record found');
        return null;
      }

      if (existing.requestHash !== requestHash) {
        log.warn(
          { existingHash: existing.requestHash, newHash: requestHash },
          'Idempotency key conflict: different request payload'
        );
        throw new ConflictError('Idempotency key already used with different request data', {
          idempotencyKey,
        });
      }

      log.info({ applicationId: existing.applicationId }, 'Returning cached idempotent response');
      return existing.responseData as unknown as CreateApplicationResponse;
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      log.error({ error }, 'Error checking idempotency');
      throw error;
    }
  }

  async saveIdempotency(
    idempotencyKey: string,
    requestData: unknown,
    response: CreateApplicationResponse,
    requestId: string
  ): Promise<void> {
    const log = logger.child({ requestId, idempotencyKey, operation: 'saveIdempotency' });
    const requestHash = hashRequest(requestData);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TTL_HOURS);

    try {
      await prisma.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          requestHash,
          applicationId: response.applicationId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseData: response as any,
          expiresAt,
        },
      });

      log.info({ applicationId: response.applicationId }, 'Saved idempotency record');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        log.warn('Duplicate idempotency key detected (race condition handled)');
        return;
      }
      log.error({ error }, 'Error saving idempotency record');
      throw error;
    }
  }

  async cleanupExpired(): Promise<number> {
    const result = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Cleaned up expired idempotency records');
    }

    return result.count;
  }
}
