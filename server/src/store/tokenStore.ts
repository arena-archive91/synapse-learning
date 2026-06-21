import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config';
import { createTokenRepo } from './postgres';

export type StoredToken = {
  accountId: string;
  expiresAt: number;
  kind: 'refresh' | 'password_reset';
};

const tokens = new Map<string, StoredToken>();
const pgRepo = createTokenRepo(config.databaseUrl);

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function issueToken(
  accountId: string,
  kind: StoredToken['kind'],
  ttlMs: number,
): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ttlMs;
  const key = hashToken(raw);

  if (pgRepo) {
    await pgRepo.issueToken(accountId, key, kind, new Date(expiresAt));
    return raw;
  }

  tokens.set(key, { accountId, expiresAt, kind });
  return raw;
}

export async function consumeToken(raw: string, kind: StoredToken['kind']): Promise<string | null> {
  const key = hashToken(raw);

  if (pgRepo) {
    return pgRepo.consumeToken(key, kind);
  }

  const entry = tokens.get(key);
  if (!entry || entry.kind !== kind) return null;
  if (entry.expiresAt < Date.now()) {
    tokens.delete(key);
    return null;
  }
  tokens.delete(key);
  return entry.accountId;
}

export async function revokeTokensForAccount(accountId: string): Promise<void> {
  if (pgRepo) {
    await pgRepo.revokeTokensForAccount(accountId);
    return;
  }
  for (const [k, v] of tokens) {
    if (v.accountId === accountId) tokens.delete(k);
  }
}

/** Purge expired entries periodically. */
export async function purgeExpiredTokens(): Promise<void> {
  if (pgRepo) {
    await pgRepo.purgeExpiredTokens();
    return;
  }
  const now = Date.now();
  for (const [k, v] of tokens) {
    if (v.expiresAt < now) tokens.delete(k);
  }
}

setInterval(() => {
  purgeExpiredTokens().catch(() => undefined);
}, 60 * 60 * 1000).unref();
