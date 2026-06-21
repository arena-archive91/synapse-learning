import { Router } from 'express';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { getUsage } from '../store/accounts';

export const usageRouter = Router();

/** GET /v1/usage — current month's metering + remaining quota for the account. */
usageRouter.get('/usage', authenticate, (req, res) => {
  const account = req.account!;
  const usage = getUsage(account);
  const quota = config.quotas[account.plan] ?? config.quotas.free;
  const used = usage.promptTokens + usage.completionTokens;
  res.json({
    plan: account.plan,
    month: usage.month,
    requests: usage.requests,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: used,
    quota,
    remaining: Math.max(0, quota - used),
  });
});
