import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { getUsage } from '../store/accounts';

/** Total tokens consumed this month for the request's account. */
export function monthlyTokens(req: Request): number {
  if (!req.account) return 0;
  const u = getUsage(req.account);
  return u.promptTokens + u.completionTokens;
}

/** Rejects the request when the account has exhausted its monthly token quota. */
export function enforceQuota(req: Request, res: Response, next: NextFunction): void {
  const account = req.account;
  if (!account) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const quota = config.quotas[account.plan] ?? config.quotas.free;
  if (monthlyTokens(req) >= quota) {
    res.status(429).json({
      error: 'Monthly token quota exceeded',
      plan: account.plan,
      quota,
      upgrade: account.plan === 'free' ? 'Upgrade to pro for a higher quota.' : undefined,
    });
    return;
  }
  next();
}
