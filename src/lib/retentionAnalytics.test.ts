import { describe, expect, it } from 'vitest';
import { retentionCurveFromActivities, computeRetentionRate, weeklyMasteryFromActivities } from './retentionAnalytics';
import { categorizeSkillNodes, skillNodeFromTopic } from './skillNodes';
import type { ActivityItem } from '../types';

describe('retentionAnalytics', () => {
  it('computes retention rate from quiz events', () => {
    const acts: ActivityItem[] = [
      { id: '1', type: 'quiz_passed', description: 'ok', timestamp: '2026-06-01T10:00:00Z', xp: 10 },
      { id: '2', type: 'quiz_failed', description: 'miss', timestamp: '2026-06-01T11:00:00Z' },
      { id: '3', type: 'review_done', description: 'review', timestamp: '2026-06-02T10:00:00Z', xp: 5 },
    ];
    expect(computeRetentionRate(acts)).toBeCloseTo(2 / 3, 2);
  });

  it('builds retention curve points when enough events exist', () => {
    const acts: ActivityItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      type: i % 2 === 0 ? 'quiz_passed' as const : 'quiz_failed' as const,
      description: 'q',
      timestamp: `2026-06-0${(i % 5) + 1}T10:00:00Z`,
    }));
    const curve = retentionCurveFromActivities(acts);
    expect(curve[0]?.retention).toBe(100);
    expect(curve.length).toBeGreaterThan(3);
  });

  it('returns weekly mastery array of length 7', () => {
    const weekly = weeklyMasteryFromActivities([]);
    expect(weekly).toHaveLength(7);
  });
});

describe('skillNodes', () => {
  it('categorizes mastery bands', () => {
    const nodes = [
      skillNodeFromTopic({ id: 't1', title: 'A', description: '', lessons: [], mastery: 85, prerequisites: [], order: 1, isLocked: false, estimatedMinutes: 10, conceptCount: 1, retentionPrediction: 80 }, 'c1'),
      skillNodeFromTopic({ id: 't2', title: 'B', description: '', lessons: [], mastery: 30, prerequisites: [], order: 2, isLocked: false, estimatedMinutes: 10, conceptCount: 1, retentionPrediction: 40 }, 'c1'),
    ];
    const bands = categorizeSkillNodes(nodes);
    expect(bands.strongAreas).toHaveLength(1);
    expect(bands.weakAreas).toHaveLength(1);
  });
});
