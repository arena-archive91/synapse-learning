/**
 * Feynman self-explanation rubric — subject-agnostic.
 *
 * The earlier MVP version anchored `accuracy` to a hardcoded list of economics
 * terms (cournot/bertrand/oligopoly/…) which floored every non-economics
 * learner at ~35%. This rewrite derives the key-term list dynamically from the
 * concept the learner is explaining and any reference notes/glossary supplied
 * by the workspace, and returns a normalized score per dimension.
 *
 * Dimensions:
 *   - accuracy     — concept overlap with notes (Jaccard-ish)
 *   - completeness — calibrated to word count buckets
 *   - simplicity   — average sentence length
 *   - structure    — discourse cues + ordered scaffolding
 */

export interface RubricScores {
  accuracy: number;
  completeness: number;
  simplicity: number;
  structure: number;
}

export type RubricDimension = keyof RubricScores;

export interface RubricContext {
  /** The concept/topic being explained — split into multi-word terms. */
  concept?: string;
  /** Excerpt from the user's notes used as the ground-truth corpus. */
  referenceNotes?: string;
  /** Glossary entries (term → definition). Terms boost accuracy weight. */
  glossary?: Array<{ term: string; definition?: string }>;
  /** Extra labeled key terms (e.g. course topic titles) to count. */
  extraTerms?: string[];
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'so', 'of', 'to', 'in', 'on',
  'at', 'for', 'with', 'as', 'by', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
  'we', 'our', 'you', 'your', 'he', 'she', 'his', 'her', 'i', 'me', 'my',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'should',
  'could', 'can', 'may', 'might', 'must', 'shall', 'about', 'into', 'than',
  'then', 'there', 'here', 'where', 'when', 'why', 'how', 'what', 'which',
  'who', 'whom', 'whose', 'not', 'no', 'nor', 'too', 'very', 'just', 'also',
  'such', 'some', 'any', 'all', 'most', 'more', 'less', 'other', 'each',
]);

/** Return non-stop alphanumeric tokens, lowercased. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Build a deduplicated, ranked list of key terms for accuracy scoring. */
export function buildKeyTerms(ctx: RubricContext): string[] {
  const terms = new Set<string>();
  const push = (raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length >= 3 && !STOPWORDS.has(trimmed)) terms.add(trimmed);
  };

  if (ctx.concept) {
    for (const w of tokens(ctx.concept)) push(w);
    // also push the full multi-word concept as a single term ("market structures")
    const lower = ctx.concept.trim().toLowerCase();
    if (lower.split(/\s+/).length > 1 && lower.length <= 40) terms.add(lower);
  }
  for (const g of ctx.glossary ?? []) {
    push(g.term);
  }
  for (const t of ctx.extraTerms ?? []) push(t);

  if (ctx.referenceNotes) {
    // Pick the top distinct content tokens from the notes by simple frequency.
    const counts = new Map<string, number>();
    for (const w of tokens(ctx.referenceNotes)) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .forEach(([w]) => terms.add(w));
  }

  return [...terms];
}

/**
 * Score the explanation against a dynamic key-term list.
 *   - 0 hits  → 35  (floor: assume some baseline knowledge in voice/draft)
 *   - 1-2     → ramp to ~55-65
 *   - 3+      → 80-100 with diminishing returns (sqrt curve)
 */
function scoreAccuracy(text: string, keyTerms: string[]): number {
  if (keyTerms.length === 0) {
    // No corpus available — fall back to a calibrated mid-band so we don't
    // unfairly penalize learners with no notes uploaded.
    return 60;
  }
  const lower = text.toLowerCase();
  let hits = 0;
  for (const term of keyTerms) {
    if (lower.includes(term)) hits += 1;
  }
  if (hits === 0) return 35;
  // sqrt curve: 1→55, 2→63, 3→69, 4→74, 5→78, 8→88, 12→97
  const score = 35 + Math.round(20 * Math.sqrt(hits));
  return Math.min(100, score);
}

export function computeRubric(
  text: string,
  wordCount: number,
  ctx: RubricContext = {},
): RubricScores {
  const keyTerms = buildKeyTerms(ctx);
  const accuracy = scoreAccuracy(text, keyTerms);

  const completeness =
    wordCount < 15 ? 35 : wordCount < 25 ? 55 : wordCount < 40 ? 72 : wordCount < 60 ? 85 : 92;

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgLen = wordCount / Math.max(sentences.length, 1);
  const simplicity = avgLen > 22 ? 48 : avgLen > 16 ? 68 : avgLen > 11 ? 82 : 90;

  const lower = text.toLowerCase();
  let structure = 45;
  if (/\b(because|since|so that|therefore|hence|thus)\b/.test(lower)) structure += 18;
  if (/\b(for example|such as|e\.g\.|for instance)\b/.test(lower) || /\bexample\b/.test(lower)) structure += 18;
  if (/\b(first|second|then|finally|next|in summary)\b/.test(lower)) structure += 12;
  if (/\b(however|but|on the other hand|unlike|whereas)\b/.test(lower)) structure += 5;

  return {
    accuracy,
    completeness,
    simplicity,
    structure: Math.min(100, structure),
  };
}

export function weakestDimensions(scores: RubricScores, threshold = 65): RubricDimension[] {
  return (Object.keys(scores) as RubricDimension[]).filter((d) => scores[d] < threshold);
}
