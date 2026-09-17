import { createHash } from 'crypto';

export function hashRequest(data: unknown): string {
  const normalized = JSON.stringify(data, Object.keys(data as object).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}${random}`.toUpperCase();
}
