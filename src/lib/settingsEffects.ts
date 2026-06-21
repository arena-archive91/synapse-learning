import type { AgentMode, UserSettings } from '../types';
import { t as ti18n, type I18nKey } from './i18n';

/** Map user teaching preferences → default agent mode */
export function settingsToAgentMode(settings: UserSettings): AgentMode {
  if (settings.teachingStyle === 'socratic') return 'socratic';
  if (settings.teachingStyle === 'direct') return 'direct';
  if (settings.explanationDepth === 'beginner') return 'beginner';
  if (settings.challengeLevel === 'high-challenge') return 'exam-coach';
  return 'direct';
}

export function shouldShowDiagrams(settings: UserSettings): boolean {
  return settings.diagramFrequency !== 'minimal';
}

export function lessonStepCount(settings: UserSettings): number {
  switch (settings.lessonLength) {
    case 'short': return 5;
    case 'long': return 7;
    default: return 6;
  }
}

export function passThreshold(settings: UserSettings): number {
  return settings.masteryThreshold;
}

export function agentTonePrefix(settings: UserSettings): string {
  if (settings.feedbackTone === 'gentle') return 'Take your time — ';
  if (settings.feedbackTone === 'strict') return 'Be precise — ';
  return '';
}

/** @deprecated use i18n.ts directly */
export function t(key: string, lang: UserSettings['language']): string {
  return ti18n(key as I18nKey, lang);
}
