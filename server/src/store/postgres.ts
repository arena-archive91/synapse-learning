import pg from 'pg';
import type { Plan } from '../config';
import type { Account, UsageWindow } from './accounts';
import type { StoredLibrary } from './libraryStore';
import type { StoredSession } from './sessionStore';

const { Pool } = pg;

export interface LibraryRepository {
  getLibrary(accountId: string): Promise<StoredLibrary>;
  saveLibrary(accountId: string, data: Omit<StoredLibrary, 'updatedAt'>): Promise<StoredLibrary>;
}

export function createPostgresLibraryRepo(databaseUrl: string): LibraryRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async getLibrary(accountId: string): Promise<StoredLibrary> {
      const res = await pool.query<{ payload: StoredLibrary; updated_at: Date }>(
        'SELECT payload, updated_at FROM account_libraries WHERE account_id = $1',
        [accountId],
      );
      if (res.rowCount === 0) {
        return {
          uploadedFiles: [],
          glossaryEntries: [],
          generatedCourses: [],
          updatedAt: new Date().toISOString(),
        };
      }
      const row = res.rows[0]!;
      return {
        ...(row.payload as Omit<StoredLibrary, 'updatedAt'>),
        updatedAt: row.updated_at.toISOString(),
      };
    },

    async saveLibrary(
      accountId: string,
      data: Omit<StoredLibrary, 'updatedAt'>,
    ): Promise<StoredLibrary> {
      const updatedAt = new Date().toISOString();
      await pool.query(
        `INSERT INTO account_libraries (account_id, payload, updated_at)
         VALUES ($1, $2::jsonb, $3::timestamptz)
         ON CONFLICT (account_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
        [accountId, JSON.stringify(data), updatedAt],
      );
      return { ...data, updatedAt };
    },
  };
}

/** Returns null when DATABASE_URL is unset — caller uses in-memory store. */
export function createLibraryRepo(databaseUrl: string | undefined): LibraryRepository | null {
  if (!databaseUrl?.trim()) return null;
  return createPostgresLibraryRepo(databaseUrl.trim());
}

export interface SessionRepository {
  getSession(accountId: string): Promise<StoredSession>;
  saveSession(accountId: string, data: Omit<StoredSession, 'updatedAt'>): Promise<StoredSession>;
}

export function createPostgresSessionRepo(databaseUrl: string): SessionRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  const emptySession = (): StoredSession => ({
    learnerModel: null,
    dashboardStats: null,
    tasks: [],
    xp: 0,
    betaMastery: [],
    firstAttemptKeys: [],
    openMistakes: [],
    activities: [],
    userSettings: null,
    updatedAt: new Date().toISOString(),
  });

  return {
    async getSession(accountId: string): Promise<StoredSession> {
      const res = await pool.query<{ payload: StoredSession; updated_at: Date }>(
        'SELECT payload, updated_at FROM account_sessions WHERE account_id = $1',
        [accountId],
      );
      if (res.rowCount === 0) return emptySession();
      const row = res.rows[0]!;
      return {
        ...(row.payload as Omit<StoredSession, 'updatedAt'>),
        updatedAt: row.updated_at.toISOString(),
      };
    },

    async saveSession(
      accountId: string,
      data: Omit<StoredSession, 'updatedAt'>,
    ): Promise<StoredSession> {
      const updatedAt = new Date().toISOString();
      await pool.query(
        `INSERT INTO account_sessions (account_id, payload, updated_at)
         VALUES ($1, $2::jsonb, $3::timestamptz)
         ON CONFLICT (account_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
        [accountId, JSON.stringify(data), updatedAt],
      );
      return { ...data, updatedAt };
    },
  };
}

export function createSessionRepo(databaseUrl: string | undefined): SessionRepository | null {
  if (!databaseUrl?.trim()) return null;
  return createPostgresSessionRepo(databaseUrl.trim());
}

export interface AccountRepository {
  findById(id: string): Promise<Account | undefined>;
  findByEmail(email: string): Promise<Account | undefined>;
  findByStripeCustomerId(customerId: string): Promise<Account | undefined>;
  create(account: Account): Promise<Account>;
  setPlan(accountId: string, plan: Plan, stripeCustomerId?: string): Promise<Account | undefined>;
  saveUsage(accountId: string, usage: UsageWindow): Promise<void>;
  updatePassword(accountId: string, passwordHash: string, salt: string): Promise<boolean>;
  accountStats(): Promise<{ total: number; byPlan: Record<Plan, number> }>;
}

function rowToAccount(row: {
  id: string;
  email: string;
  plan: string;
  password_hash: string;
  salt: string;
  stripe_customer_id: string | null;
  usage: UsageWindow;
  created_at: Date;
}): Account {
  return {
    id: row.id,
    email: row.email,
    plan: row.plan as Plan,
    passwordHash: row.password_hash,
    salt: row.salt,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    usage: row.usage,
    createdAt: row.created_at.toISOString(),
  };
}

type AccountRow = {
  id: string;
  email: string;
  plan: string;
  password_hash: string;
  salt: string;
  stripe_customer_id: string | null;
  usage: UsageWindow;
  created_at: Date;
};

export function createPostgresAccountRepo(databaseUrl: string): AccountRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async findById(id: string): Promise<Account | undefined> {
      const res = await pool.query<AccountRow>('SELECT * FROM accounts WHERE id = $1', [id]);
      return res.rowCount ? rowToAccount(res.rows[0]!) : undefined;
    },

    async findByEmail(email: string): Promise<Account | undefined> {
      const res = await pool.query<AccountRow>(
        'SELECT * FROM accounts WHERE email = $1',
        [email.trim().toLowerCase()],
      );
      return res.rowCount ? rowToAccount(res.rows[0]!) : undefined;
    },

    async findByStripeCustomerId(customerId: string): Promise<Account | undefined> {
      const res = await pool.query<AccountRow>(
        'SELECT * FROM accounts WHERE stripe_customer_id = $1',
        [customerId],
      );
      return res.rowCount ? rowToAccount(res.rows[0]!) : undefined;
    },

    async create(account: Account): Promise<Account> {
      await pool.query(
        `INSERT INTO accounts (id, email, plan, password_hash, salt, stripe_customer_id, usage, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz)`,
        [
          account.id,
          account.email,
          account.plan,
          account.passwordHash,
          account.salt,
          account.stripeCustomerId ?? null,
          JSON.stringify(account.usage),
          account.createdAt,
        ],
      );
      return account;
    },

    async setPlan(accountId: string, plan: Plan, stripeCustomerId?: string): Promise<Account | undefined> {
      const res = await pool.query<AccountRow>(
        `UPDATE accounts
         SET plan = $2,
             stripe_customer_id = COALESCE($3, stripe_customer_id)
         WHERE id = $1
         RETURNING *`,
        [accountId, plan, stripeCustomerId ?? null],
      );
      return res.rowCount ? rowToAccount(res.rows[0]!) : undefined;
    },

    async saveUsage(accountId: string, usage: UsageWindow): Promise<void> {
      await pool.query('UPDATE accounts SET usage = $2::jsonb WHERE id = $1', [
        accountId,
        JSON.stringify(usage),
      ]);
    },

    async updatePassword(accountId: string, passwordHash: string, salt: string): Promise<boolean> {
      const res = await pool.query(
        'UPDATE accounts SET password_hash = $2, salt = $3 WHERE id = $1',
        [accountId, passwordHash, salt],
      );
      return (res.rowCount ?? 0) > 0;
    },

    async accountStats(): Promise<{ total: number; byPlan: Record<Plan, number> }> {
      const res = await pool.query<{ plan: Plan; count: string }>(
        'SELECT plan, COUNT(*)::text AS count FROM accounts GROUP BY plan',
      );
      const byPlan: Record<Plan, number> = { free: 0, pro: 0, team: 0 };
      for (const row of res.rows) {
        byPlan[row.plan] = Number(row.count);
      }
      return { total: Object.values(byPlan).reduce((a, b) => a + b, 0), byPlan };
    },
  };
}

export function createAccountRepo(databaseUrl: string | undefined): AccountRepository | null {
  if (!databaseUrl?.trim()) return null;
  return createPostgresAccountRepo(databaseUrl.trim());
}

export type StoredTokenKind = 'refresh' | 'password_reset';

export interface TokenRepository {
  issueToken(accountId: string, tokenHash: string, kind: StoredTokenKind, expiresAt: Date): Promise<void>;
  consumeToken(tokenHash: string, kind: StoredTokenKind): Promise<string | null>;
  revokeTokensForAccount(accountId: string): Promise<void>;
  purgeExpiredTokens(): Promise<void>;
}

export function createPostgresTokenRepo(databaseUrl: string): TokenRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async issueToken(accountId, tokenHash, kind, expiresAt) {
      await pool.query(
        `INSERT INTO auth_tokens (token_hash, account_id, kind, expires_at)
         VALUES ($1, $2, $3, $4::timestamptz)`,
        [tokenHash, accountId, kind, expiresAt.toISOString()],
      );
    },

    async consumeToken(tokenHash, kind) {
      const res = await pool.query<{ account_id: string }>(
        `DELETE FROM auth_tokens
         WHERE token_hash = $1 AND kind = $2 AND expires_at > NOW()
         RETURNING account_id`,
        [tokenHash, kind],
      );
      return res.rowCount ? res.rows[0]!.account_id : null;
    },

    async revokeTokensForAccount(accountId) {
      await pool.query('DELETE FROM auth_tokens WHERE account_id = $1', [accountId]);
    },

    async purgeExpiredTokens() {
      await pool.query('DELETE FROM auth_tokens WHERE expires_at <= NOW()');
    },
  };
}

export function createTokenRepo(databaseUrl: string | undefined): TokenRepository | null {
  if (!databaseUrl?.trim()) return null;
  return createPostgresTokenRepo(databaseUrl.trim());
}
