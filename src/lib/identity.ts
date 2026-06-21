/**
 * User identity helpers — production users start with a clean, neutral identity
 * (no demo "Alex Chen" leak), but can populate name/email from onboarding or
 * an authenticated session. XP-derived level keeps the avatar UI useful even
 * before a user has logged in.
 */
import type { User, UserSettings } from '../types';
import { shouldShowDemo } from './demoMode';
import { mockUser } from '../demo/mockData';

const PRODUCTION_DEFAULT_NAME = 'Learner';

/**
 * Map cumulative XP to a level. Slightly logarithmic (each level requires
 * progressively more XP) so the badge updates frequently early on, then
 * meaningfully thereafter. Pure function — easy to test.
 *   level = floor(0.1 * sqrt(xp)) + 1, clamped to [1, 99]
 */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  const lvl = Math.floor(0.1 * Math.sqrt(xp)) + 1;
  return Math.min(99, Math.max(1, lvl));
}

/** Derive a friendly display name from an email, e.g. "alex.chen@x.com" → "Alex Chen". */
export function nameFromEmail(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return PRODUCTION_DEFAULT_NAME;
  const local = email.split('@')[0] ?? '';
  if (!local) return PRODUCTION_DEFAULT_NAME;
  const cleaned = local.replace(/[._\-+0-9]+/g, ' ').trim();
  if (!cleaned) return PRODUCTION_DEFAULT_NAME;
  return cleaned
    .split(/\s+/)
    .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/**
 * Build the initial user object honouring `shouldShowDemo`:
 *   - demo on  → use the full mock identity (Alex Chen / Level 7)
 *   - demo off → seed a clean production identity, optionally populated from
 *     persisted XP, persisted email (auth), and a current heatmap-derived streak.
 */
export function buildInitialUser(args: {
  settings: UserSettings;
  persistedXp?: number;
  authEmail?: string;
  streak?: number;
}): User {
  const { settings, persistedXp, authEmail, streak } = args;
  if (shouldShowDemo(settings)) {
    return {
      ...mockUser,
      xp: persistedXp ?? mockUser.xp,
      settings,
    };
  }
  const xp = Math.max(0, Math.floor(persistedXp ?? 0));
  const email = (authEmail ?? settings.authEmail ?? '').trim();
  return {
    id: 'u1',
    name: email ? nameFromEmail(email) : PRODUCTION_DEFAULT_NAME,
    email,
    role: 'self-learner',
    segment: 'selflearner',
    streak: Math.max(0, Math.floor(streak ?? 0)),
    xp,
    level: levelFromXp(xp),
    joinedAt: new Date().toISOString().slice(0, 10),
    onboardingComplete: false,
    settings,
  };
}

/** Update name from email after a successful auth event, only when the
 *  current name is still the production placeholder (don't overwrite a
 *  display name the user has set). */
export function applyAuthIdentity(user: User, authEmail: string | undefined): User {
  if (!authEmail) return user;
  const next: User = { ...user, email: authEmail };
  if (!user.name || user.name === PRODUCTION_DEFAULT_NAME) {
    next.name = nameFromEmail(authEmail);
  }
  return next;
}
