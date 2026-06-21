import type { Course, LearnerModel, SkillNode, Topic } from '../types';
import type { BetaMastery } from './pedagogy';

/** Normalize a concept label for matching: lowercase, strip punctuation, collapse spaces. */
function normLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token set for Jaccard similarity (drops short stop-ish tokens). */
function tokenSet(label: string): Set<string> {
  const stop = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'for', 'in', 'on', 'is', 'are']);
  const out = new Set<string>();
  for (const w of normLabel(label).split(' ')) {
    if (w.length >= 3 && !stop.has(w)) out.add(w);
  }
  return out;
}

/** Jaccard similarity in [0,1] of two token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * True when two concept labels refer to the same skill.
 * Replaces the earlier `slice(0, 8)` prefix collisions ("marginal cost" vs
 * "marginal benefit", "consumer" vs "consumer surplus", etc.) with a proper
 * normalized exact / token-Jaccard match.
 */
export function isSameConcept(a: string, b: string, threshold = 0.7): boolean {
  const na = normLabel(a);
  const nb = normLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // single-token concepts: require an exact match (avoid "elasticity" matching "price elasticity")
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return false;
  return jaccard(ta, tb) >= threshold;
}

export function skillNodeFromTopic(topic: Topic, courseId: string): SkillNode {
  return {
    concept: topic.title,
    courseId,
    mastery: topic.mastery ?? 0,
    lastPracticed: '',
    retentionPrediction: topic.retentionPrediction ?? 50,
    practiceCount: 0,
    averageResponseTime: 0,
    errorRate: 0,
  };
}

export function categorizeSkillNodes(nodes: SkillNode[]): {
  strongAreas: SkillNode[];
  weakAreas: SkillNode[];
  almostKnown: SkillNode[];
} {
  return {
    strongAreas: nodes.filter((n) => n.mastery >= 80),
    almostKnown: nodes.filter((n) => n.mastery >= 60 && n.mastery < 80),
    weakAreas: nodes.filter((n) => n.mastery < 60),
  };
}

export function mergeSkillNodesFromCourse(lm: LearnerModel, course: Course): LearnerModel {
  const existing = new Map<string, SkillNode>();
  for (const s of [...lm.strongAreas, ...lm.weakAreas, ...lm.almostKnown]) {
    existing.set(`${s.courseId}:${s.concept}`, s);
  }
  for (const topic of course.topics) {
    const key = `${course.id}:${topic.title}`;
    if (!existing.has(key)) {
      existing.set(key, skillNodeFromTopic(topic, course.id));
    }
  }
  const bands = categorizeSkillNodes([...existing.values()]);
  return { ...lm, ...bands };
}

export function applySkillUpdate(lm: LearnerModel, updated: SkillNode): LearnerModel {
  const map = new Map<string, SkillNode>();
  for (const s of [...lm.strongAreas, ...lm.weakAreas, ...lm.almostKnown]) {
    map.set(`${s.courseId}:${s.concept}`, s);
  }
  map.set(`${updated.courseId}:${updated.concept}`, updated);
  const bands = categorizeSkillNodes([...map.values()]);
  return { ...lm, ...bands };
}

export function findSkillForConcept(
  lm: LearnerModel,
  concept: string,
  courseId?: string,
): SkillNode | undefined {
  const all = [...lm.strongAreas, ...lm.weakAreas, ...lm.almostKnown];
  const pool = courseId ? all.filter((s) => s.courseId === courseId) : all;
  // Prefer exact normalized match, then a Jaccard-similarity match.
  const target = normLabel(concept);
  const exact = pool.find((s) => normLabel(s.concept) === target);
  if (exact) return exact;
  const targetTokens = tokenSet(concept);
  let best: { node: SkillNode; score: number } | null = null;
  for (const s of pool) {
    const score = jaccard(targetTokens, tokenSet(s.concept));
    if (score >= 0.7 && (!best || score > best.score)) best = { node: s, score };
  }
  return best?.node;
}

export function ensureSkillNode(
  lm: LearnerModel,
  concept: string,
  courseId: string,
): SkillNode {
  return findSkillForConcept(lm, concept, courseId) ?? {
    concept,
    courseId,
    mastery: 0,
    lastPracticed: '',
    retentionPrediction: 50,
    practiceCount: 0,
    averageResponseTime: 0,
    errorRate: 0,
  };
}

export function initBetaFromCourse(course: Course): BetaMastery[] {
  const seen = new Set<string>();
  const out: BetaMastery[] = [];
  for (const topic of course.topics) {
    const concepts = topic.keyConcepts?.length ? topic.keyConcepts : [topic.title];
    for (const c of concepts.slice(0, 3)) {
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ concept: c, alpha: 1, beta: 1, firstAttempts: 0, importance: 1 });
    }
  }
  return out;
}

export function mergeBetaFromCourse(existing: BetaMastery[], course: Course): BetaMastery[] {
  const map = new Map(existing.map((b) => [b.concept.toLowerCase(), b]));
  for (const b of initBetaFromCourse(course)) {
    if (!map.has(b.concept.toLowerCase())) map.set(b.concept.toLowerCase(), b);
  }
  return [...map.values()];
}

export function updateCourseTopicMastery(
  courses: Course[],
  courseId: string,
  concept: string,
  masteryDelta: number,
  correct: boolean,
): Course[] {
  return courses.map((c) => {
    if (c.id !== courseId) return c;
    const topics = c.topics.map((t) => {
      const matches =
        isSameConcept(t.title, concept) ||
        (t.keyConcepts ?? []).some((k) => isSameConcept(k, concept));
      if (!matches) return t;
      const nextMastery = Math.max(0, Math.min(100, t.mastery + masteryDelta));
      return {
        ...t,
        mastery: nextMastery,
        retentionPrediction: correct
          ? Math.min(100, t.retentionPrediction + 4)
          : Math.max(0, t.retentionPrediction - 6),
      };
    });
    const avg = topics.length
      ? Math.round(topics.reduce((s, t) => s + t.mastery, 0) / topics.length)
      : 0;
    return { ...c, topics, mastery: avg };
  });
}

export function fsrsRatingToConfidence(rating: import('./pedagogy').FsrsRating): number {
  switch (rating) {
    case 'easy': return 92;
    case 'good': return 78;
    case 'hard': return 55;
    case 'again': return 30;
  }
}
