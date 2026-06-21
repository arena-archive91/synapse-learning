import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { anonymousAccount, findByIdAsync, type Account } from '../store/accounts';
import { consumeToken, issueToken } from '../store/tokenStore';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      account?: Account;
    }
  }
}

export function signAccessToken(accountId: string): string {
  return jwt.sign({ sub: accountId, typ: 'access' }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl as jwt.SignOptions['expiresIn'],
  });
}

/** @deprecated Use signAccessToken — kept for backward compatibility. */
export function signToken(accountId: string): string {
  return signAccessToken(accountId);
}

export async function signRefreshToken(accountId: string): Promise<string> {
  const ttlMs = config.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
  return issueToken(accountId, 'refresh', ttlMs);
}

export async function verifyRefreshToken(raw: string): Promise<string | null> {
  if (!raw.trim()) return null;
  return consumeToken(raw, 'refresh');
}

/**
 * Resolves the request's account from a Bearer JWT. When no token is present
 * and anonymous access is enabled, falls back to a shared anonymous account.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { sub?: string; typ?: string };
      if (payload.typ && payload.typ !== 'access') {
        res.status(401).json({ error: 'Invalid access token type' });
        return;
      }
      const account = payload.sub ? await findByIdAsync(payload.sub) : undefined;
      if (!account) {
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }
      req.account = account;
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
  }

  if (config.allowAnonymous) {
    req.account = anonymousAccount();
    next();
    return;
  }

  res.status(401).json({ error: 'Authentication required' });
}
