import type { Task, UserSettings } from '../types';
import type { Lang } from './i18n';
import { getTaskConcept } from './taskFlows';
import { lessonStepCount } from './settingsEffects';
import { shouldShowDemo } from './demoMode';
import { demoPracticeAnswer, demoQuizForConcept, demoWorkspaceStepsForConcept } from '../demo/domainContentDemo';
import {
  lessonStepLabel,
  genericQuizPlaceholder,
  genericWorkspaceSteps,
  type LessonStepDef,
  type LessonStepKey,
  type QuizDef,
} from './lessonTypes';

export type { LessonStepDef, LessonStepKey, QuizDef };

const ALL_STEP_KEYS: LessonStepKey[] = [
  'intro', 'explanation', 'example', 'misconception', 'practice', 'quiz', 'summary',
];

const SHORT_STEP_KEYS: LessonStepKey[] = [
  'intro', 'explanation', 'practice', 'quiz', 'summary',
];

export function buildLessonSteps(settings?: UserSettings): LessonStepDef[] {
  const lang: Lang = settings?.language ?? 'en';
  const count = settings ? lessonStepCount(settings) : 7;
  const keys = count <= 5 ? SHORT_STEP_KEYS : ALL_STEP_KEYS;
  return keys.map((key) => ({ key, label: lessonStepLabel(key, lang) }));
}

export function lessonKeyFromTask(task: Task | null | undefined, fallback = 'default-lesson'): string {
  if (!task) return fallback;
  return `lesson:${task.id}`;
}

export function workspaceLessonKey(task: Task | null | undefined): string {
  if (!task) return 'workspace:study';
  return `workspace:${task.id}`;
}

export function buildQuizForConcept(concept: string, lang?: Lang, settings?: UserSettings): QuizDef {
  const l = lang ?? 'en';
  if (settings && shouldShowDemo(settings)) return demoQuizForConcept(concept, l);
  return genericQuizPlaceholder(concept, l);
}

export function practiceAnswerForConcept(concept: string, settings?: UserSettings): number {
  if (settings && shouldShowDemo(settings)) return demoPracticeAnswer(concept);
  return 0;
}

export function buildWorkspaceSteps(concept: string, lang?: Lang, settings?: UserSettings): { title: string; type: string }[] {
  const l = lang ?? 'en';
  if (settings && shouldShowDemo(settings)) return demoWorkspaceStepsForConcept(concept, l);
  return genericWorkspaceSteps(concept, l);
}

export function getLessonTitle(task: Task | null | undefined, concept: string): string {
  if (task?.title) return getTaskConcept(task);
  return concept;
}
