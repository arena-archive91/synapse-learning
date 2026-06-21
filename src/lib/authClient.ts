import type { UserSettings } from '../types';

export type AuthSession = {
  token: string;
  refreshToken?: string;
  email: string;
  plan?: 'free' | 'pro' | 'team';
};

function proxyBase(settings: UserSettings): string {
  return (settings.authProxyBase ?? settings.llmProxyUrl ?? 'http://localhost:8787')
    .replace(/\/v1\/?$/, '')
    .replace(/\/$/, '');
}

export async function authRegister(
  email: string,
  password: string,
  settings: UserSettings,
): Promise<AuthSession> {
  const res = await fetch(`${proxyBase(settings)}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as {
    token: string;
    refreshToken?: string;
    email?: string;
    plan?: string;
    account?: { email?: string; plan?: string };
  };
  const plan = (data.plan ?? data.account?.plan) as AuthSession['plan'];
  return {
    token: data.token,
    refreshToken: data.refreshToken,
    email: data.email ?? data.account?.email ?? email,
    plan: plan ?? 'free',
  };
}

export async function authLogin(
  email: string,
  password: string,
  settings: UserSettings,
): Promise<AuthSession> {
  const res = await fetch(`${proxyBase(settings)}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as {
    token: string;
    refreshToken?: string;
    email?: string;
    plan?: string;
    account?: { email?: string; plan?: string };
  };
  const plan = (data.plan ?? data.account?.plan) as AuthSession['plan'];
  return {
    token: data.token,
    refreshToken: data.refreshToken,
    email: data.email ?? data.account?.email ?? email,
    plan: plan ?? 'free',
  };
}

export async function authMe(
  token: string,
  settings: UserSettings,
): Promise<{ email: string; plan: 'free' | 'pro' | 'team' }> {
  const res = await fetch(`${proxyBase(settings)}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { account?: { email?: string; plan?: string } };
  return {
    email: data.account?.email ?? '',
    plan: (data.account?.plan as 'free' | 'pro' | 'team') ?? 'free',
  };
}

export type RemoteLibrary = {
  uploadedFiles: unknown[];
  glossaryEntries: unknown[];
  generatedCourses: unknown[];
  updatedAt: string;
};

export async function fetchRemoteLibrary(token: string, settings: UserSettings): Promise<RemoteLibrary> {
  const res = await fetch(`${proxyBase(settings)}/v1/library`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<RemoteLibrary>;
}

export async function pushRemoteLibrary(
  token: string,
  settings: UserSettings,
  library: Omit<RemoteLibrary, 'updatedAt'>,
): Promise<RemoteLibrary> {
  const res = await fetch(`${proxyBase(settings)}/v1/library`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(library),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<RemoteLibrary>;
}

export type RemoteSession = {
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

export async function fetchRemoteSession(token: string, settings: UserSettings): Promise<RemoteSession> {
  const res = await fetch(`${proxyBase(settings)}/v1/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<RemoteSession>;
}

export async function pushRemoteSession(
  token: string,
  settings: UserSettings,
  session: Omit<RemoteSession, 'updatedAt'>,
): Promise<RemoteSession> {
  const res = await fetch(`${proxyBase(settings)}/v1/session`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(session),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<RemoteSession>;
}

export async function createCheckoutSession(
  token: string,
  settings: UserSettings,
  plan: 'pro' | 'team',
  urls?: { successUrl?: string; cancelUrl?: string },
): Promise<{ url: string | null; sessionId: string }> {
  const res = await fetch(`${proxyBase(settings)}/v1/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan, ...urls }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ url: string | null; sessionId: string }>;
}

export async function fetchBillingStatus(settings: UserSettings): Promise<{
  enabled: boolean;
  webhookConfigured: boolean;
  plans: string[];
}> {
  const res = await fetch(`${proxyBase(settings)}/v1/billing/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ enabled: boolean; webhookConfigured: boolean; plans: string[] }>;
}

export async function authRefresh(
  refreshToken: string,
  settings: UserSettings,
): Promise<{ token: string; refreshToken?: string }> {
  const res = await fetch(`${proxyBase(settings)}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { token: string; refreshToken?: string };
  return { token: data.token, refreshToken: data.refreshToken };
}

export async function authForgotPassword(
  email: string,
  settings: UserSettings,
): Promise<{ ok: boolean; resetToken?: string }> {
  const res = await fetch(`${proxyBase(settings)}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; resetToken?: string }>;
}

export async function fetchTeacherDashboard(token: string, settings: UserSettings) {
  const res = await fetch(`${proxyBase(settings)}/v1/teacher/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function ocrPages(
  token: string | undefined,
  settings: UserSettings,
  pages: string[],
  pageCount?: number,
  languages = 'eng+ell',
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;
  const res = await fetch(`${proxyBase(settings)}/v1/ocr/pages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pages, pageCount, languages }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ text: string; pageCount: number; ocrUsed: boolean }>;
}

export async function ragQuery(
  token: string | undefined,
  settings: UserSettings,
  query: string,
  chunks: { id: string; text: string }[],
  topK = 5,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;
  const res = await fetch(`${proxyBase(settings)}/v1/rag/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, chunks, topK }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ results: { id: string; text: string; score: number }[] }>;
}
