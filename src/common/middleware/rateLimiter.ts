import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config/env';

const config = getConfig();

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = config.RATE_LIMIT_WINDOW_MS;
  const maxRequests = config.RATE_LIMIT_MAX_REQUESTS;

  let entry = rateLimitStore.get(clientId);

  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(clientId, entry);
  }

  entry.count++;

  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

  if (entry.count > maxRequests) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
      requestId: req.id,
    });
    return;
  }

  next();
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);
