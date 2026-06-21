import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function bucketKey(req: Request): string {
  const account = req.account?.id ?? 'anon';
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `${account}:${ip}`;
}

/**
 * Simple sliding-window rate limiter (requests per minute).
 * Returns 429 with Retry-After when exceeded.
 */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const limit = config.rateLimitRpm;
  const windowMs = 60_000;
  const key = bucketKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retrySec = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retrySec));
    res.status(429).json({ error: 'Rate limit exceeded', retryAfterSeconds: retrySec });
    return;
  }
  next();
}
