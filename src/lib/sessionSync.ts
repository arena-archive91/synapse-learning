import type {
  ActivityItem,
  DashboardStats,
  LearnerModel,
  MistakeRecord,
  UserSettings,
} from '../types';
import type { BetaMastery } from './pedagogy';
import { loadJson } from './persistence';

const SESSION_KEY = 'session-v2';

export type LocalSession = {
  learnerModel: LearnerModel;
  dashboardStats: DashboardStats;
  tasks: unknown[];
  xp: number;
  betaMastery: BetaMastery[];
  firstAttemptKeys: string[];
  openMistakes: MistakeRecord[];
  activities: ActivityItem[];
  userSettings: UserSettings;
};

export function loadLocalSession(): Partial<LocalSession> {
  return loadJson<Partial<LocalSession>>(SESSION_KEY, {});
}

/** Remote wins on conflict when updatedAt is newer than local snapshot. */
export function mergeSessions(local: Partial<LocalSession>, remote: Partial<LocalSession>): LocalSession {
  const localUpdated = (local as { updatedAt?: string }).updatedAt;
  const remoteUpdated = (remote as { updatedAt?: string }).updatedAt;
  const preferRemote =
    remoteUpdated && localUpdated
      ? new Date(remoteUpdated).getTime() > new Date(localUpdated).getTime()
      : Boolean(remoteUpdated && !localUpdated);

  const pick = <T>(localVal: T | undefined, remoteVal: T | undefined): T | undefined =>
    preferRemote ? (remoteVal ?? localVal) : (localVal ?? remoteVal);

  return {
    learnerModel: pick(local.learnerModel, remote.learnerModel) as LearnerModel,
    dashboardStats: pick(local.dashboardStats, remote.dashboardStats) as DashboardStats,
    tasks: (pick(local.tasks, remote.tasks) ?? []) as unknown[],
    xp: pick(local.xp, remote.xp) ?? 0,
    betaMastery: (pick(local.betaMastery, remote.betaMastery) ?? []) as BetaMastery[],
    firstAttemptKeys: (pick(local.firstAttemptKeys, remote.firstAttemptKeys) ?? []) as string[],
    openMistakes: (pick(local.openMistakes, remote.openMistakes) ?? []) as MistakeRecord[],
    activities: (pick(local.activities, remote.activities) ?? []) as ActivityItem[],
    userSettings: pick(local.userSettings, remote.userSettings) as UserSettings,
  };
}

export function localSessionToRemote(session: Partial<LocalSession>): Omit<LocalSession, never> {
  return {
    learnerModel: session.learnerModel as LearnerModel,
    dashboardStats: session.dashboardStats as DashboardStats,
    tasks: session.tasks ?? [],
    xp: session.xp ?? 0,
    betaMastery: session.betaMastery ?? [],
    firstAttemptKeys: session.firstAttemptKeys ?? [],
    openMistakes: session.openMistakes ?? [],
    activities: session.activities ?? [],
    userSettings: session.userSettings as UserSettings,
  };
}

export function remoteSessionToLocal(remote: {
  learnerModel?: unknown;
  dashboardStats?: unknown;
  tasks?: unknown[];
  xp?: number;
  betaMastery?: unknown[];
  firstAttemptKeys?: string[];
  openMistakes?: unknown[];
  activities?: unknown[];
  userSettings?: unknown;
  updatedAt?: string;
}): Partial<LocalSession> & { updatedAt?: string } {
  return {
    learnerModel: remote.learnerModel as LearnerModel | undefined,
    dashboardStats: remote.dashboardStats as DashboardStats | undefined,
    tasks: remote.tasks,
    xp: remote.xp,
    betaMastery: remote.betaMastery as BetaMastery[] | undefined,
    firstAttemptKeys: remote.firstAttemptKeys,
    openMistakes: remote.openMistakes as MistakeRecord[] | undefined,
    activities: remote.activities as ActivityItem[] | undefined,
    userSettings: remote.userSettings as UserSettings | undefined,
    updatedAt: remote.updatedAt,
  };
}
