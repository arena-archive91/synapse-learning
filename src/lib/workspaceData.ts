import type { LearnerModel, DashboardStats, Task } from '../types';
import { findPendingTask } from './taskFlows';

export function buildMiniDashboardProps(
  learnerModel: LearnerModel,
  dashboardStats: Pick<DashboardStats, 'streak' | 'reviewsDue'>,
  tasks: Task[],
  onStartTask?: (taskId: string) => void,
  courseName?: string,
) {
  const weakSpots = learnerModel.weakAreas.slice(0, 5).map((s) => ({
    concept: s.concept,
    mastery: s.mastery,
    course: courseName ?? 'Your course',
  }));

  const pendingReviews = tasks.filter((t) => t.isSpacedRepetition && t.status === 'pending');
  const nextPending = findPendingTask(tasks, () => true);

  const nextActions = [
    ...pendingReviews.slice(0, 2).map((t) => ({
      label: `Review: ${t.title.split('—')[0]?.trim() ?? t.title}`,
      type: 'review' as const,
      minutes: t.estimatedMinutes,
      xp: t.xpReward,
      taskId: t.id,
    })),
    ...learnerModel.weakAreas.slice(0, 2).map((s, i) => ({
      label: `Practice: ${s.concept}`,
      type: 'practice' as const,
      minutes: 12 + i * 3,
      xp: 35,
      taskId: nextPending?.id,
    })),
  ].slice(0, 4);

  const conceptsMastered = [
    ...learnerModel.strongAreas,
    ...learnerModel.almostKnown.filter((s) => s.mastery >= 60),
  ].length;

  return {
    readiness: Math.round(learnerModel.overallMastery),
    streak: dashboardStats.streak,
    reviewsDue: dashboardStats.reviewsDue,
    weakSpots,
    nextActions,
    conceptsMastered,
    totalConcepts: Math.max(conceptsMastered + learnerModel.weakAreas.length + 20, 100),
    onStartTask,
  };
}

export function buildConceptMapNodes(
  conceptBars: { concept: string; mastery: number }[],
  _focusConcept?: string,
) {
  // Deprecated: concept map is built from uploaded notes via workspaceNoteContent.
  void conceptBars;
  void _focusConcept;
  return [];
}

export function buildCompareRows(_concept: string): [string, string, string][] {
  return [];
}

export function leitnerCardsFromSpacing(
  _spacingIntervals: LearnerModel['spacingIntervals'],
  _concept?: string,
): { front: string; back: string }[] {
  return [];
}

export function readerTextFromUploads(
  _uploadedFiles: { name: string; extractedText?: string; extractedTopics?: string[] }[],
  _concept: string,
): string {
  return '';
}
