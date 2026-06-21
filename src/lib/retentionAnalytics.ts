import type { ActivityItem, LearnerModel } from '../types';
import type { PrerequisiteRepair } from './pedagogy';

const CURVE_DAYS = [0, 1, 3, 7, 14, 21, 30] as const;

/** Forgetting curve derived from quiz/review success rate in the activity log. */
export function retentionCurveFromActivities(
  activities: ActivityItem[],
): { day: number; retention: number }[] {
  const events = activities.filter(
    (a) => a.type === 'quiz_passed' || a.type === 'quiz_failed' || a.type === 'review_done',
  );
  if (events.length < 2) {
    return CURVE_DAYS.map((day) => ({ day, retention: day === 0 ? 100 : 0 }));
  }

  const successes = events.filter((e) => e.type === 'quiz_passed' || e.type === 'review_done').length;
  const passRate = successes / events.length;
  const base = Math.round(passRate * 100);
  const decay = passRate >= 0.8 ? 0.88 : passRate >= 0.6 ? 0.9 : 0.93;

  return CURVE_DAYS.map((day) => ({
    day,
    retention: day === 0 ? 100 : Math.max(8, Math.round(base * decay ** day)),
  }));
}

/** Last 7 calendar days — mastery proxy from completed tasks + passed quizzes. */
export function weeklyMasteryFromActivities(activities: ActivityItem[]): number[] {
  const days: number[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayActs = activities.filter((a) => a.timestamp.slice(0, 10) === key);
    const passed = dayActs.filter((a) => a.type === 'quiz_passed' || a.type === 'review_done').length;
    const failed = dayActs.filter((a) => a.type === 'quiz_failed').length;
    const completed = dayActs.filter((a) => a.type === 'task_complete' || a.type === 'lesson_complete').length;
    const score = passed * 15 + completed * 8 - failed * 10;
    days.push(Math.max(0, Math.min(100, score)));
  }
  return days;
}

export function computeRetentionRate(activities: ActivityItem[]): number {
  const events = activities.filter(
    (a) => a.type === 'quiz_passed' || a.type === 'quiz_failed' || a.type === 'review_done',
  );
  if (events.length === 0) return 0;
  const ok = events.filter((e) => e.type === 'quiz_passed' || e.type === 'review_done').length;
  return ok / events.length;
}

export function adaptiveRecommendations(
  model: LearnerModel,
  activities: ActivityItem[],
  repairs: PrerequisiteRepair[],
): string[] {
  const tips: string[] = [];
  const retention = computeRetentionRate(activities);

  if (retention > 0 && retention < 0.65) {
    tips.push('Your recent quiz/review accuracy is below 65% — schedule shorter, more frequent review sessions.');
  }
  if (retention >= 0.85 && activities.length >= 5) {
    tips.push('Strong recall this week — interleave harder transfer questions from your uploaded notes.');
  }
  for (const r of repairs.slice(0, 2)) {
    tips.push(`Repair prerequisite "${r.prerequisite}" before "${r.concept}" (detected from mastery graph).`);
  }
  if (model.weakAreas.length > 0) {
    const w = model.weakAreas[0]!;
    tips.push(`Focus next on "${w.concept}" (${w.mastery}% mastery) from your generated course.`);
  }
  const recentStudy = activities.filter((a) => a.type === 'study_time').length;
  if (recentStudy === 0 && activities.length > 0) {
    tips.push('No timed focus sessions logged recently — use the workspace timer to track deliberate practice.');
  }
  if (model.retrievalPerformance < 0.55 && model.totalSessions >= 3) {
    tips.push('Retrieval practice (flashcards, exam prep) gives the highest leverage for your profile right now.');
  }
  return tips.slice(0, 5);
}
