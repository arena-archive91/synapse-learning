import { config } from '../config';
import { createSessionRepo } from './postgres';

/** Client session blob — mirrors local `session-v2` persistence. */
export type StoredSession = {
  learnerModel: unknown;
  dashboardStats: unknown;
  tasks: unknown[];
  xp: number;
  betaMastery: unknown[];
  firstAttemptKeys: string[];
  openMistakes: unknown[];
  activities: unknown[];
  userSettings: unknown;
  updatedAt: string;
};

const memory = new Map<string, StoredSession>();
const pgRepo = createSessionRepo(config.databaseUrl);

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

export function getSession(accountId: string): StoredSession {
  if (pgRepo) throw new Error('Use getSessionAsync when DATABASE_URL is configured');
  return memory.get(accountId) ?? emptySession();
}

export async function getSessionAsync(accountId: string): Promise<StoredSession> {
  if (pgRepo) return pgRepo.getSession(accountId);
  return getSession(accountId);
}

export function saveSession(
  accountId: string,
  data: Omit<StoredSession, 'updatedAt'>,
): StoredSession {
  if (pgRepo) throw new Error('Use saveSessionAsync when DATABASE_URL is configured');
  const saved: StoredSession = { ...data, updatedAt: new Date().toISOString() };
  memory.set(accountId, saved);
  return saved;
}

export async function saveSessionAsync(
  accountId: string,
  data: Omit<StoredSession, 'updatedAt'>,
): Promise<StoredSession> {
  if (pgRepo) return pgRepo.saveSession(accountId, data);
  return saveSession(accountId, data);
}
