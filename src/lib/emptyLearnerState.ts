import type { DashboardStats, LearnerModel } from '../types';
import { heatmapFromActivities } from './activityAnalytics';
import type { ActivityItem } from '../types';

export function createEmptyLearnerModel(userId = 'u1', activities: ActivityItem[] = []): LearnerModel {
  return {
    userId,
    overallMastery: 0,
    totalStudyTime: 0,
    totalSessions: 0,
    averageSessionLength: 0,
    averageConfidence: 0,
    retentionRate: 0,
    strongAreas: [],
    weakAreas: [],
    almostKnown: [],
    misconceptions: [],
    learningVelocity: 1,
    cognitiveLoadPreference: 'medium',
    preferredSessionLength: 25,
    bestTimeOfDay: '',
    streakDays: 0,
    errorPatterns: [],
    spacingIntervals: [],
    confidenceCalibration: [],
    retrievalPerformance: 0,
    transferAbility: 0,
    helpSeekingRate: 0,
    persistenceScore: 0,
    interactionInsights: [],
    heatmapData: heatmapFromActivities(activities),
    weeklyMastery: [0],
  };
}

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  todayXP: 0,
  weeklyXP: 0,
  streak: 0,
  tasksToday: 0,
  tasksCompleted: 0,
  reviewsDue: 0,
  weakConcepts: 0,
  upcomingExams: 0,
  studyTimeToday: 0,
  studyTimeWeek: 0,
  masteryTrend: [0],
  conceptsMastered: 0,
  totalConcepts: 0,
  antiPassiveAlert: false,
};
