import type { LearnerModel, SkillNode, ConfidencePoint } from '../types';

export type MasteryBand = 'strong' | 'proficient' | 'developing' | 'weak';
export type CalibrationDirection = 'overconfident' | 'calibrated' | 'underconfident';
export type FsrsRating = 'again' | 'hard' | 'good' | 'easy';

export type BetaMastery = {
  concept: string;
  alpha: number;
  beta: number;
  firstAttempts: number;
  importance: number;
};

export type PrerequisiteRepair = {
  concept: string;
  prerequisite: string;
};

const DIFF_WEIGHT: Record<string, number> = {
  beginner: 0.8,
  intermediate: 1.0,
  advanced: 1.2,
  mixed: 1.0,
};

export function masteryBand(mastery: number): MasteryBand {
  if (mastery >= 80) return 'strong';
  if (mastery >= 60) return 'proficient';
  if (mastery >= 40) return 'developing';
  return 'weak';
}

export function bandColor(band: MasteryBand): string {
  switch (band) {
    case 'strong': return '#34d399';
    case 'proficient': return '#fbbf24';
    case 'developing': return '#22d3ee';
    case 'weak': return '#fb7185';
  }
}

/** Beta posterior mean α / (α + β) */
export function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

/** LearnAI-style mastery update — first attempts only */
export function updateBetaMastery(
  record: BetaMastery,
  correct: boolean,
  difficulty: string = 'intermediate',
): BetaMastery {
  const diffWeight = DIFF_WEIGHT[difficulty] ?? 1;
  const evidence = diffWeight;
  return {
    ...record,
    alpha: record.alpha + (correct ? evidence : 0),
    beta: record.beta + (correct ? 0 : evidence),
    firstAttempts: record.firstAttempts + 1,
  };
}

/** Exam readiness with evidence gate (LearnAI formula) */
export function computeExamReadiness(
  concepts: BetaMastery[],
  fallbackAccuracy: number,
  selfReliance: number,
  firstAttemptCount: number,
): number {
  if (firstAttemptCount < 5 || concepts.length === 0) {
    return Math.round(100 * (0.7 * fallbackAccuracy + 0.3 * selfReliance));
  }
  let num = 0;
  let den = 0;
  for (const c of concepts) {
    const mastery = betaMean(c.alpha, c.beta);
    const gate = Math.min(1, c.firstAttempts / 5);
    num += c.importance * mastery * gate;
    den += c.importance * gate;
  }
  return den > 0 ? Math.round(100 * num / den) : 0;
}

/** Calibration with direction (LearnAI) */
export function computeCalibration(points: ConfidencePoint[]): {
  score: number;
  direction: CalibrationDirection;
  avgConfidence: number;
  sampleSize: number;
} | null {
  if (points.length < 5) return null;
  const avgConfidence = points.reduce((s, p) => s + p.predicted, 0) / points.length;
  const accuracy = points.reduce((s, p) => s + p.actual, 0) / points.length;
  const gap = avgConfidence - accuracy;
  const score = Math.round((1 - Math.min(1, Math.abs(gap))) * 100);
  const direction: CalibrationDirection =
    gap > 0.1 ? 'overconfident' : gap < -0.1 ? 'underconfident' : 'calibrated';
  return { score, direction, avgConfidence: Math.round(avgConfidence * 100), sampleSize: points.length };
}

/** Prerequisite repair from concept graph */
export function computePrerequisiteRepairs(
  masteryByConcept: Record<string, number>,
  edges: { prerequisite: string; dependent: string }[],
  threshold = 0.4,
): PrerequisiteRepair[] {
  const repairs: PrerequisiteRepair[] = [];
  for (const { prerequisite, dependent } of edges) {
    const depM = (masteryByConcept[dependent] ?? 100) / 100;
    const preM = (masteryByConcept[prerequisite] ?? 100) / 100;
    if (depM < threshold && preM < threshold) {
      repairs.push({ concept: dependent, prerequisite });
    }
  }
  return repairs.slice(0, 2);
}

/** FSRS-lite interval from rating */
export function fsrsIntervalDays(
  stability: number,
  rating: FsrsRating,
  reviewCount: number,
): number {
  const multipliers: Record<FsrsRating, number> = {
    again: 0.4,
    hard: 0.85,
    good: 1.0,
    easy: 1.3,
  };
  const base = Math.max(1, stability * (reviewCount + 1));
  return Math.max(1, Math.round(base * multipliers[rating]));
}

export function computeReviewInterval(
  reviewCount: number,
  confidence: number,
  correct: boolean,
): number {
  if (!correct) return 1;
  const base = [1, 2, 4, 7, 14, 21, 30][Math.min(reviewCount, 6)] ?? 30;
  const confMod = confidence >= 80 ? 1.2 : confidence >= 60 ? 1.0 : 0.75;
  return Math.max(1, Math.round(base * confMod));
}

export function updateSkillMastery(skill: SkillNode, correct: boolean, _confidence: number): SkillNode {
  const delta = correct ? Math.min(12, 100 - skill.mastery) : -Math.min(15, skill.mastery);
  const mastery = Math.max(0, Math.min(100, skill.mastery + delta));
  return {
    ...skill,
    mastery,
    practiceCount: skill.practiceCount + 1,
    retentionPrediction: correct
      ? Math.min(100, skill.retentionPrediction + 4)
      : Math.max(0, skill.retentionPrediction - 8),
    errorRate: correct
      ? Math.max(0, skill.errorRate - 0.05)
      : Math.min(1, skill.errorRate + 0.1),
    lastPracticed: new Date().toISOString(),
    averageResponseTime: skill.averageResponseTime,
  };
}

export function computeOverallMastery(skills: SkillNode[]): number {
  if (skills.length === 0) return 0;
  return Math.round(skills.reduce((s, n) => s + n.mastery, 0) / skills.length);
}

export function computeCalibrationGap(points: ConfidencePoint[]): number {
  if (points.length === 0) return 0;
  return Math.round(
    points.reduce((s, p) => s + Math.abs(p.predicted - p.actual), 0) / points.length * 100,
  );
}

export function deriveInsights(
  model: LearnerModel,
  repairs: PrerequisiteRepair[] = [],
  calibration: ReturnType<typeof computeCalibration> = null,
): string[] {
  const insights: string[] = [];
  if (calibration?.direction === 'overconfident') {
    insights.push('You tend to be overconfident — rate lower before submitting answers.');
  }
  if (calibration?.direction === 'underconfident') {
    insights.push('You underestimate yourself — trust retrieval more on familiar topics.');
  }
  for (const r of repairs) {
    insights.push(`Strengthen "${r.prerequisite}" before tackling "${r.concept}".`);
  }
  if (model.weakAreas.length > 0 && repairs.length === 0) {
    insights.push(`Priority repair: ${model.weakAreas[0].concept} (${model.weakAreas[0].mastery}% mastery).`);
  }
  if (model.retrievalPerformance < 60) insights.push('Retrieval practice is your highest-leverage activity this week.');
  if (model.learningVelocity > 1.2) insights.push('Learning velocity is above average — interleave harder transfer questions.');
  return insights.length > 0 ? insights : model.interactionInsights;
}

/** Study plan blocks (LearnAI-style daily queue) */
export function buildStudyPlanBlocks(tasks: {
  category: string;
  status: string;
  priority: string;
  title: string;
  estimatedMinutes: number;
  isSpacedRepetition?: boolean;
}[]): { label: string; minutes: number; items: string[] }[] {
  const pending = tasks.filter((t) => t.status === 'pending');
  const mistakes = pending.filter((t) => t.category === 'fix').slice(0, 2);
  const reviews = pending.filter((t) => t.isSpacedRepetition).slice(0, 3);
  const weak = pending.filter((t) => t.category === 'learn' || t.priority === 'high').slice(0, 2);
  const blocks: { label: string; minutes: number; items: string[] }[] = [];
  if (mistakes.length) {
    blocks.push({
      label: 'Retry mistakes',
      minutes: mistakes.reduce((s, t) => s + t.estimatedMinutes, 0),
      items: mistakes.map((t) => t.title),
    });
  }
  if (reviews.length) {
    blocks.push({
      label: 'Spaced reviews',
      minutes: reviews.reduce((s, t) => s + t.estimatedMinutes, 0),
      items: reviews.map((t) => t.title),
    });
  }
  if (weak.length) {
    blocks.push({
      label: 'Weak concepts',
      minutes: weak.reduce((s, t) => s + t.estimatedMinutes, 0),
      items: weak.map((t) => t.title),
    });
  }
  return blocks;
}
