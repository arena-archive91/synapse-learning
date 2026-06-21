import type { ActivityItem } from '../types';
import { createActivity } from '../lib/activityLog';

/** Demo-only seed activities — not used in production paths. */
export const SEED_ACTIVITIES: ActivityItem[] = [
  createActivity('quiz_passed', 'Scored 4/5 on Elasticity quiz', 30),
  createActivity('lesson_complete', 'Completed "Cournot Competition" lesson', 50),
  createActivity('review_done', 'Reviewed Supply & Demand flashcards', 15),
  createActivity('streak', '12-day study streak! 🔥'),
  createActivity('mastery_up', 'NumPy Arrays mastery → 82%'),
  createActivity('mistake_fixed', 'Fixed misconception: Elasticity formula', 25),
].map((a, i) => ({
  ...a,
  timestamp: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
}));
