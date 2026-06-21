import type { ActivityItem, HeatmapDay, LearnerModel } from '../types';

/** Build a 90-day study heatmap from real activity log entries. */
export function heatmapFromActivities(activities: ActivityItem[], days = 90): HeatmapDay[] {
  const byDate = new Map<string, HeatmapDay>();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDate.set(key, { date: key, minutes: 0, xp: 0, tasksCompleted: 0, conceptsReviewed: 0 });
  }

  for (const act of activities) {
    const key = act.timestamp.slice(0, 10);
    const row = byDate.get(key);
    if (!row) continue;
    if (act.type === 'study_time') {
      const m = parseInt(act.description.match(/(\d+)\s*min/)?.[1] ?? '0', 10);
      row.minutes += m;
    }
    if (act.xp) row.xp += act.xp;
    if (act.type === 'task_complete' || act.type === 'lesson_complete') row.tasksCompleted += 1;
    if (act.type === 'review_done' || act.type === 'quiz_passed') row.conceptsReviewed += 1;
  }

  return [...byDate.values()];
}

export function computeStreakFromHeatmap(heatmap: HeatmapDay[]): number {
  let streak = 0;
  const sorted = [...heatmap].sort((a, b) => b.date.localeCompare(a.date));
  for (const day of sorted) {
    if (day.minutes > 0 || day.tasksCompleted > 0) streak += 1;
    else break;
  }
  return streak;
}

export function syncLearnerHeatmap(lm: LearnerModel, activities: ActivityItem[]): LearnerModel {
  const heatmapData = heatmapFromActivities(activities);
  return {
    ...lm,
    heatmapData,
    streakDays: computeStreakFromHeatmap(heatmapData),
  };
}
