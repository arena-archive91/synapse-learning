import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { createAccountRepo } from './postgres';
import type { Plan } from '../config';

/**
 * Account + usage store. Uses Postgres when DATABASE_URL is set; otherwise in-memory.
 */

export interface UsageWindow {
  /** Calendar month key, e.g. "2026-06". Usage resets when the month changes. */
  month: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
}

export interface Account {
  id: string;
  email: string;
  plan: Plan;
  passwordHash: string; // scrypt hash, hex
  salt: string; // hex
  createdAt: string;
  usage: UsageWindow;
  stripeCustomerId?: string;
}

const accounts = new Map<string, Account>();
const byEmail = new Map<string, string>();
const pgRepo = createAccountRepo(config.databaseUrl);

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function freshWindow(): UsageWindow {
  return { month: currentMonth(), requests: 0, promptTokens: 0, completionTokens: 0 };
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function buildAccount(email: string, password: string, plan: Plan = 'free'): Account {
  const normalized = email.trim().toLowerCase();
  const salt = randomBytes(16).toString('hex');
  return {
    id: randomUUID(),
    email: normalized,
    plan,
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
    usage: freshWindow(),
  };
}

/** Roll the usage window when the calendar month changes. */
function ensureMonth(account: Account): void {
  if (account.usage.month !== currentMonth()) account.usage = freshWindow();
}

export function verifyPassword(account: Account, password: string): boolean {
  const candidate = hashPassword(password, account.salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(account.passwordHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function getUsage(account: Account): UsageWindow {
  ensureMonth(account);
  return account.usage;
}

function applyUsageDelta(account: Account, promptTokens: number, completionTokens: number): UsageWindow {
  ensureMonth(account);
  account.usage.requests += 1;
  account.usage.promptTokens += Math.max(0, promptTokens);
  account.usage.completionTokens += Math.max(0, completionTokens);
  return account.usage;
}

/** Shared anonymous account — never persisted to Postgres. */
let anon: Account | null = null;
export function anonymousAccount(): Account {
  if (!anon) {
    anon = {
      id: 'anonymous',
      email: 'anonymous@local',
      plan: 'free',
      passwordHash: '',
      salt: '',
      createdAt: new Date().toISOString(),
      usage: freshWindow(),
    };
  }
  ensureMonth(anon);
  return anon;
}

export async function createAccountAsync(
  email: string,
  password: string,
  plan: Plan = 'free',
): Promise<Account> {
  if (pgRepo) {
    const normalized = email.trim().toLowerCase();
    if (await pgRepo.findByEmail(normalized)) throw new Error('Email already registered');
    return pgRepo.create(buildAccount(email, password, plan));
  }
  const normalized = email.trim().toLowerCase();
  if (byEmail.has(normalized)) throw new Error('Email already registered');
  const account = buildAccount(email, password, plan);
  accounts.set(account.id, account);
  byEmail.set(normalized, account.id);
  return account;
}

export async function findByEmailAsync(email: string): Promise<Account | undefined> {
  if (pgRepo) return pgRepo.findByEmail(email);
  const id = byEmail.get(email.trim().toLowerCase());
  return id ? accounts.get(id) : undefined;
}

export async function findByIdAsync(id: string): Promise<Account | undefined> {
  if (id === 'anonymous') return anonymousAccount();
  if (pgRepo) return pgRepo.findById(id);
  return accounts.get(id);
}

export async function findByStripeCustomerIdAsync(customerId: string): Promise<Account | undefined> {
  if (pgRepo) return pgRepo.findByStripeCustomerId(customerId);
  for (const account of accounts.values()) {
    if (account.stripeCustomerId === customerId) return account;
  }
  return undefined;
}

export async function setPlanAsync(
  accountId: string,
  plan: Plan,
  stripeCustomerId?: string,
): Promise<Account | undefined> {
  if (accountId === 'anonymous') return undefined;
  if (pgRepo) return pgRepo.setPlan(accountId, plan, stripeCustomerId);
  const account = accounts.get(accountId);
  if (!account) return undefined;
  account.plan = plan;
  if (stripeCustomerId) account.stripeCustomerId = stripeCustomerId;
  return account;
}

export async function addUsageAsync(
  account: Account,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  if (account.id === 'anonymous' && !pgRepo) {
    applyUsageDelta(account, promptTokens, completionTokens);
    return;
  }
  if (pgRepo && account.id !== 'anonymous') {
    ensureMonth(account);
    account.usage.requests += 1;
    account.usage.promptTokens += Math.max(0, promptTokens);
    account.usage.completionTokens += Math.max(0, completionTokens);
    await pgRepo.saveUsage(account.id, account.usage);
    return;
  }
  applyUsageDelta(account, promptTokens, completionTokens);
}

export async function accountStatsAsync(): Promise<{ total: number; byPlan: Record<Plan, number> }> {
  if (pgRepo) {
    const stats = await pgRepo.accountStats();
    return { ...stats, total: stats.total + 1, byPlan: { ...stats.byPlan, free: stats.byPlan.free + 1 } };
  }
  const byPlan: Record<Plan, number> = { free: 0, pro: 0, team: 0 };
  for (const account of accounts.values()) byPlan[account.plan] += 1;
  if (anon) byPlan[anon.plan] += 1;
  return { total: accounts.size + (anon ? 1 : 0), byPlan };
}

/** @deprecated Use createAccountAsync when DATABASE_URL may be set. */
export function createAccount(email: string, password: string, plan: Plan = 'free'): Account {
  if (pgRepo) throw new Error('Use createAccountAsync when DATABASE_URL is configured');
  const normalized = email.trim().toLowerCase();
  if (byEmail.has(normalized)) throw new Error('Email already registered');
  const account = buildAccount(email, password, plan);
  accounts.set(account.id, account);
  byEmail.set(normalized, account.id);
  return account;
}

/** @deprecated Use findByEmailAsync when DATABASE_URL may be set. */
export function findByEmail(email: string): Account | undefined {
  if (pgRepo) throw new Error('Use findByEmailAsync when DATABASE_URL is configured');
  const id = byEmail.get(email.trim().toLowerCase());
  return id ? accounts.get(id) : undefined;
}

/** @deprecated Use findByIdAsync when DATABASE_URL may be set. */
export function findById(id: string): Account | undefined {
  if (pgRepo) throw new Error('Use findByIdAsync when DATABASE_URL is configured');
  return accounts.get(id);
}

/** @deprecated Use findByStripeCustomerIdAsync when DATABASE_URL may be set. */
export function findByStripeCustomerId(customerId: string): Account | undefined {
  if (pgRepo) throw new Error('Use findByStripeCustomerIdAsync when DATABASE_URL is configured');
  for (const account of accounts.values()) {
    if (account.stripeCustomerId === customerId) return account;
  }
  return undefined;
}

/** @deprecated Use setPlanAsync when DATABASE_URL may be set. */
export function setPlan(accountId: string, plan: Plan, stripeCustomerId?: string): Account | undefined {
  if (pgRepo) throw new Error('Use setPlanAsync when DATABASE_URL is configured');
  const account = accounts.get(accountId);
  if (!account || account.id === 'anonymous') return undefined;
  account.plan = plan;
  if (stripeCustomerId) account.stripeCustomerId = stripeCustomerId;
  return account;
}

/** @deprecated Use addUsageAsync when DATABASE_URL may be set. */
export function addUsage(account: Account, promptTokens: number, completionTokens: number): void {
  if (pgRepo) throw new Error('Use addUsageAsync when DATABASE_URL is configured');
  applyUsageDelta(account, promptTokens, completionTokens);
}

/** @deprecated Use accountStatsAsync when DATABASE_URL may be set. */
export function accountStats(): { total: number; byPlan: Record<Plan, number> } {
  if (pgRepo) throw new Error('Use accountStatsAsync when DATABASE_URL is configured');
  const byPlan: Record<Plan, number> = { free: 0, pro: 0, team: 0 };
  for (const account of accounts.values()) byPlan[account.plan] += 1;
  if (anon) byPlan[anon.plan] += 1;
  return { total: accounts.size + (anon ? 1 : 0), byPlan };
}

export async function updatePasswordAsync(accountId: string, password: string): Promise<boolean> {
  if (accountId === 'anonymous') return false;
  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  if (pgRepo) {
    const res = await pgRepo.updatePassword(accountId, passwordHash, salt);
    return Boolean(res);
  }

  const account = accounts.get(accountId);
  if (!account) return false;
  account.salt = salt;
  account.passwordHash = passwordHash;
  return true;
}
