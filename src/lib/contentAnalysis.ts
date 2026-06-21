/**
 * Offline content-recognition engine (v2).
 *
 * Turns raw extracted note text into a structured course outline — WITHOUT any
 * LLM or network call. This is the deterministic foundation of course creation:
 * it always runs (free, private, instant) and is what powers uploads when no API
 * key is configured. When an LLM key *is* present, `courseGenerator` produces a
 * richer outline and this engine is the graceful fallback.
 *
 * Algorithms (all client-side, dependency-free):
 *   1. Segmentation — sentence + heading-aware section splitting (EN/EL).
 *   2. Keyphrase extraction — RAKE (degree/frequency) blended with a TextRank
 *      (weighted PageRank over a word co-occurrence graph) for robust ranking.
 *   3. Concept normalization — stem-lite de-duplication so "firm"/"firms" and
 *      "market structure"/"market structures" collapse to one canonical concept.
 *   4. Definition + acronym mining — copula/colon patterns and "Full Term (FT)".
 *   5. Extractive summarization — TextRank over sentences for course + topic
 *      descriptions (real summaries, not just the first line).
 *   6. Learning-objective synthesis — per-topic objectives from its concepts.
 *   7. Prerequisite inference — a topic depends on an earlier one it references
 *      (by title or shared introduced concepts), not just sequential chaining.
 *
 * Output conforms to `GeneratedOutline`, so it feeds the exact same
 * `buildCourseFromOutline` path used by the LLM — one course model, two sources.
 */

import type { UserSettings } from '../types';
import type { GeneratedOutline, GeneratedTopic, GeneratedGlossaryEntry } from './courseGenerator';
import { filterConceptsForSection } from './conceptSectionBinding';
import { agglomerativeCluster, chooseClusterCount, groupByCluster, medoidIndex } from './embeddingCluster';
import { embedTexts } from './llmClient';
import { STOPWORDS, looksLikeHeading } from './rag';

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

/* ------------------------------------------------------------------ *
 * Segmentation
 * ------------------------------------------------------------------ */

/** Split text into sentences (EN/EL aware, tolerant of abbreviations). */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized.split(/(?<=[.!?;·])\s+(?=["“'(\[]?[\p{Lu}\p{N}])/u);
  return parts
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && /[\p{L}]/u.test(s));
}

export interface Section {
  heading?: string;
  text: string;
}

/** Strip leading numbering / bullets from a heading: "1.2 Foo" → "Foo". */
function cleanHeading(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\s*(?:\d+(?:\.\d+)*|chapter|κεφάλαιο|section|ενότητα|unit|module|part|μέρος)[).:\s-]*/i, '')
    .replace(/^[•\-–—*·\d.)\s]+/, '')
    .replace(/[:.]\s*$/, '')
    .trim();
}

/** Detect heading-delimited sections. Returns [] when the document is flat. */
export function detectSections(text: string): Section[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections: Section[] = [];
  let heading: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (heading || body.length > 0) sections.push({ heading, text: body });
    buffer = [];
  };

  for (const line of lines) {
    if (looksLikeHeading(line) && line.trim().length > 0) {
      flush();
      heading = cleanHeading(line) || line.trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections.filter((s) => s.text.length > 60 || (s.heading && s.text.length > 0));
}

/* ------------------------------------------------------------------ *
 * Tokenization helpers
 * ------------------------------------------------------------------ */

/**
 * Words that should terminate a keyphrase even though they aren't BM25
 * stopwords — relative pronouns, connectors, and high-frequency predicate verbs.
 * Kept local so it never affects retrieval scoring in `rag.ts`.
 */
const PHRASE_BREAKERS = new Set<string>([
  'where', 'when', 'which', 'who', 'whom', 'whose', 'that', 'whether', 'while',
  'because', 'however', 'therefore', 'thus', 'hence', 'alone', 'simultaneously',
  'controls', 'control', 'sets', 'describes', 'describe', 'prevent', 'prevents',
  'assumes', 'assume', 'measures', 'measure', 'dominated', 'choosing', 'choose',
  'improve', 'influence', 'sell', 'sells', 'greater', 'less', 'responsive', 'takers',
  'also', 'such', 'using', 'used', 'use', 'given', 'within', 'between', 'among',
  // High-frequency predicate verbs/adverbs that shouldn't sit inside a concept.
  'happens', 'happen', 'occurs', 'occur', 'optimizes', 'optimize', 'memorizes',
  'memorize', 'extends', 'extend', 'finds', 'find', 'composed', 'computes', 'compute',
  'computed', 'reduces', 'reduce', 'adjusting', 'adjust', 'adjusts', 'generalizing',
  'generalize', 'instead', 'learn', 'learns', 'learned', 'provides', 'provide',
  'through', 'efficiently', 'effectively', 'essentially', 'directly', 'simply',
  'clearly', 'across', 'toward', 'towards', 'via', 'into', 'onto', 'how', 'why', 'what', 'very',
  'όπου', 'όταν', 'οποίο', 'οποία', 'οποίος', 'επειδή', 'ώστε', 'καθώς', 'επίσης',
]);

function isContentWord(w: string): boolean {
  return w.length >= 2 && !STOPWORDS.has(w) && !PHRASE_BREAKERS.has(w) && !/^\d+$/.test(w);
}

/** Ordered content tokens (lowercased) for graph algorithms. */
function contentTokens(text: string, cap = 20000): string[] {
  const out: string[] = [];
  const matches = text.toLowerCase().matchAll(WORD_RE);
  for (const m of matches) {
    const w = m[0]!.replace(/^[-'’]+|[-'’]+$/g, '');
    if (w.length >= 3 && isContentWord(w)) out.push(w);
    if (out.length >= cap) break;
  }
  return out;
}

/** Stem-lite normalization for de-duplicating near-identical concepts. */
export function stemLite(word: string): string {
  let w = word.toLowerCase();
  if (/[a-z]/.test(w)) {
    if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`;
    else if (/(sses|shes|ches|xes|zes)$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) w = w.slice(0, -1);
    if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  } else {
    // Greek: strip a single common inflectional ending.
    w = w.replace(/(ς|ν|ου|ων|ας|ες|οι|η|ης|α)$/u, (m) => (w.length - m.length >= 3 ? '' : m));
  }
  return w;
}

/** Canonical key for a multi-word concept (order-preserving, stemmed). */
export function normalizeConcept(phrase: string): string {
  return phrase
    .toLowerCase()
    .split(/\s+/)
    .map(stemLite)
    .filter(Boolean)
    .join(' ');
}

/* ------------------------------------------------------------------ *
 * Keyphrase extraction: RAKE × TextRank
 * ------------------------------------------------------------------ */

export interface Keyphrase {
  phrase: string;
  score: number;
}

/** Build candidate phrases: maximal runs of content words between delimiters. */
function candidatePhrases(text: string): string[][] {
  const lower = text.toLowerCase();
  const segments = lower.split(/[^\p{L}\p{N}\s'’-]+/u);
  const phrases: string[][] = [];
  for (const seg of segments) {
    const words = seg.match(WORD_RE) ?? [];
    let cur: string[] = [];
    for (const raw of words) {
      const w = raw.replace(/^[-'’]+|[-'’]+$/g, '');
      if (isContentWord(w)) {
        cur.push(w);
      } else if (cur.length) {
        phrases.push(cur);
        cur = [];
      }
    }
    if (cur.length) phrases.push(cur);
  }
  return phrases;
}

/** RAKE word scores: degree/frequency over candidate phrases. */
function rakeWordScores(phrases: string[][]): Map<string, number> {
  const freq = new Map<string, number>();
  const degree = new Map<string, number>();
  for (const p of phrases) {
    for (const w of p) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      degree.set(w, (degree.get(w) ?? 0) + p.length);
    }
  }
  const scores = new Map<string, number>();
  for (const [w, f] of freq) scores.set(w, (degree.get(w) ?? 0) / Math.max(1, f));
  return scores;
}

/**
 * TextRank word importance: weighted PageRank over a co-occurrence graph built
 * with a sliding window. More globally-aware than RAKE's local statistics.
 */
function textRankWordScores(tokens: string[], window = 4): Map<string, number> {
  const adj = new Map<string, Map<string, number>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    const m = adj.get(a) ?? new Map<string, number>();
    m.set(b, (m.get(b) ?? 0) + 1);
    adj.set(a, m);
  };
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < Math.min(i + window, tokens.length); j++) {
      link(tokens[i]!, tokens[j]!);
      link(tokens[j]!, tokens[i]!);
    }
  }

  const nodes = [...adj.keys()];
  if (nodes.length === 0) return new Map();
  const outWeight = new Map<string, number>();
  for (const n of nodes) {
    let s = 0;
    for (const w of adj.get(n)!.values()) s += w;
    outWeight.set(n, s || 1);
  }

  const d = 0.85;
  let score = new Map(nodes.map((n) => [n, 1]));
  for (let iter = 0; iter < 25; iter++) {
    const next = new Map<string, number>();
    for (const v of nodes) {
      let sum = 0;
      // Sum contributions from neighbors u that link to v.
      for (const u of nodes) {
        const w = adj.get(u)?.get(v);
        if (w) sum += (w / outWeight.get(u)!) * score.get(u)!;
      }
      next.set(v, 1 - d + d * sum);
    }
    score = next;
  }
  return score;
}

/**
 * Rank keyphrases by blending normalized RAKE and TextRank phrase scores, with
 * mild boosts for multi-word specificity and heading membership. De-duplicates
 * by stemmed concept key so plurals/variants collapse.
 */
export function rankKeyphrases(text: string, max = 30, headingText = ''): Keyphrase[] {
  const phrases = candidatePhrases(text);
  if (phrases.length === 0) return [];

  const rake = rakeWordScores(phrases);
  const tr = textRankWordScores(contentTokens(text));

  const headingWords = new Set(
    (headingText.toLowerCase().match(WORD_RE) ?? []).filter(isContentWord),
  );

  const raw = new Map<string, { phrase: string; rake: number; tr: number }>();
  for (const p of phrases) {
    if (p.length > 3) continue;
    const phrase = p.join(' ');
    const key = normalizeConcept(phrase);
    if (!key) continue;
    const rakeScore = p.reduce((a, w) => a + (rake.get(w) ?? 0), 0);
    const trScore = p.reduce((a, w) => a + (tr.get(w) ?? 0), 0);
    const prev = raw.get(key);
    if (!prev || rakeScore > prev.rake) raw.set(key, { phrase, rake: rakeScore, tr: trScore });
  }

  const entries = [...raw.values()];
  if (entries.length === 0) return [];
  const maxRake = Math.max(...entries.map((e) => e.rake), 1);
  const maxTr = Math.max(...entries.map((e) => e.tr), 1);

  return entries
    .map((e) => {
      const words = e.phrase.split(/\s+/);
      let score = 0.5 * (e.rake / maxRake) + 0.5 * (e.tr / maxTr);
      if (words.length > 1) score *= 1.18;
      if (words.some((w) => headingWords.has(w))) score *= 1.4;
      return { phrase: e.phrase, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Backward-compatible RAKE-only extractor (kept for external callers/tests). */
export function extractKeyphrases(text: string, max = 30, headingText = ''): Keyphrase[] {
  return rankKeyphrases(text, max, headingText);
}

/** Title-case a lowercased phrase for display ("game theory" → "Game Theory"). */
export function titleCasePhrase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .map((w) => (w.length <= 2 && !/^\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/* ------------------------------------------------------------------ *
 * Definition + acronym mining
 * ------------------------------------------------------------------ */

const DEF_PATTERNS: RegExp[] = [
  /^(.{2,60}?)\s+(?:is|are|refers to|is defined as|is known as|means|is called|describes|denotes)\s+(.{15,240})/i,
  /^(.{2,60}?)\s+(?:είναι|ορίζεται ως|σημαίνει|ονομάζεται|καλείται|αναφέρεται σε|περιγράφει)\s+(.{15,240})/i,
];

function cleanTerm(raw: string): string {
  let t = raw.trim().replace(/^["“'(]+|["”')]+$/g, '').replace(/^[•\-–—*·\d.)\s]+/, '');
  const am = t.match(/\b(?:a|an|the|ένα|μια|ένας|το|η|ο)\b\s+(.+)$/i);
  if (am?.[1] && am[1].split(/\s+/).length <= 4) t = am[1];
  return t.trim();
}

function looksLikeTerm(term: string): boolean {
  const words = term.trim().split(/\s+/);
  if (words.length === 0 || words.length > 6) return false;
  if (term.length < 3 || term.length > 60) return false;
  const first = words[0]!.toLowerCase();
  if (STOPWORDS.has(first)) return false;
  return /[\p{L}]/u.test(term);
}

/** Extract "term — definition" pairs from sentences (copula + colon forms). */
export function extractDefinitions(text: string, max = 30): GeneratedGlossaryEntry[] {
  const sentences = splitSentences(text);
  const out: GeneratedGlossaryEntry[] = [];
  const seen = new Set<string>();

  const add = (term: string, definition: string) => {
    const t = cleanTerm(term);
    const dfn = definition.trim().replace(/\s+/g, ' ');
    if (!looksLikeTerm(t)) return;
    const k = normalizeConcept(t);
    if (!k || seen.has(k) || dfn.length < 12) return;
    seen.add(k);
    out.push({ term: t, definition: dfn.slice(0, 240) });
  };

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^\s*([^:]{3,60}):\s+(.{15,240})$/);
    if (m && looksLikeTerm(m[1]!) && m[1]!.split(/\s+/).length <= 6) add(m[1]!, m[2]!);
    if (out.length >= max) return out;
  }

  for (const s of sentences) {
    for (const re of DEF_PATTERNS) {
      const m = s.match(re);
      if (m && m[1]) {
        add(m[1], s);
        break;
      }
    }
    if (out.length >= max) break;
  }

  return out;
}

/** Extract "Full Term (FT)" / "FT (Full Term)" acronym pairs. */
export function extractAcronyms(text: string): GeneratedGlossaryEntry[] {
  const out: GeneratedGlossaryEntry[] = [];
  const seen = new Set<string>();
  const push = (acronym: string, full: string) => {
    const a = acronym.trim();
    const f = full.trim().replace(/\s+/g, ' ');
    if (a.length < 2 || a.length > 7 || f.length < 4 || seen.has(a)) return;
    // Sanity: acronym letters should roughly match the phrase's initials.
    const initials = f.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('');
    if (!initials.includes(a[0]!.toUpperCase())) return;
    seen.add(a);
    out.push({ term: a, definition: `${titleCasePhrase(f.toLowerCase())} (abbreviation).` });
  };
  for (const m of text.matchAll(/([\p{Lu}][\p{L}]+(?:\s+[\p{L}]+){0,4})\s*\(([\p{Lu}]{2,7})\)/gu)) {
    push(m[2]!, m[1]!);
  }
  for (const m of text.matchAll(/\b([\p{Lu}]{2,7})\s*\(([^)]{4,60})\)/gu)) {
    push(m[1]!, m[2]!);
  }
  return out.slice(0, 12);
}

/* ------------------------------------------------------------------ *
 * Extractive summarization (TextRank over sentences)
 * ------------------------------------------------------------------ */

export interface SummaryOptions {
  /** Sentences cap to keep TextRank tractable (default 120). */
  capSentences?: number;
  /**
   * Phrases (heading, glossary terms) that the summarizer should bias toward —
   * sentences containing these words get a teleport-vector boost. Replaces the
   * uniform restart of plain TextRank with a topic-aware one.
   */
  biasTerms?: string[];
  /**
   * Position prior — early-document sentences are slightly more likely to be
   * topic statements; default mild lead bias. Set to 0 to disable.
   */
  leadBias?: number;
  /**
   * Redundancy penalty (MMR-style λ). 1.0 = pure relevance, 0 = pure novelty.
   * Default 0.7 — picks high-scoring sentences that don't re-state each other.
   */
  mmrLambda?: number;
}

/**
 * Sentence-level extractive summarizer using **biased TextRank with MMR**.
 *
 *  - `biasTerms` build a teleport vector so sentences mentioning the topic
 *    title / key glossary terms attract more rank mass (vs. plain uniform
 *    TextRank that drifts toward whichever cluster is largest).
 *  - A small lead bias mimics how human writers put thesis statements early.
 *  - The top-K selection uses Maximal Marginal Relevance to avoid two top
 *    sentences that merely paraphrase each other (a frequent failure mode of
 *    plain TextRank on short topic bodies).
 */
export function extractiveSummary(text: string, n = 2, capOrOpts?: number | SummaryOptions): string[] {
  const opts: SummaryOptions = typeof capOrOpts === 'number' ? { capSentences: capOrOpts } : (capOrOpts ?? {});
  const capSentences = opts.capSentences ?? 120;
  const sentences = splitSentences(text).slice(0, capSentences);
  if (sentences.length <= n) return sentences;

  const tokenSets = sentences.map((s) => new Set(contentTokens(s)));
  const sim = (i: number, j: number) => {
    const a = tokenSets[i]!;
    const b = tokenSets[j]!;
    if (a.size === 0 || b.size === 0) return 0;
    let overlap = 0;
    for (const t of a) if (b.has(t)) overlap += 1;
    const denom = Math.log(a.size + 1) + Math.log(b.size + 1);
    return denom > 0 ? overlap / denom : 0;
  };

  const N = sentences.length;
  const weight: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const outSum = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const s = sim(i, j);
      weight[i]![j] = s;
      weight[j]![i] = s;
      outSum[i] += s;
      outSum[j] += s;
    }
  }

  // Build the teleport vector (topic-bias + lead-bias).
  const biasWords = new Set<string>();
  for (const phrase of opts.biasTerms ?? []) {
    for (const w of (phrase.toLowerCase().match(WORD_RE) ?? [])) {
      const stripped = w.replace(/^[-'’]+|[-'’]+$/g, '');
      if (stripped.length >= 3 && isContentWord(stripped)) biasWords.add(stripped);
    }
  }
  const leadBias = opts.leadBias ?? 0.15;
  const teleport = new Array<number>(N).fill(1);
  if (biasWords.size > 0) {
    for (let i = 0; i < N; i++) {
      let hits = 0;
      for (const t of tokenSets[i]!) if (biasWords.has(t)) hits += 1;
      teleport[i] = 1 + hits;
    }
  }
  if (leadBias > 0) {
    for (let i = 0; i < N; i++) teleport[i] *= 1 + leadBias * Math.exp(-i / Math.max(4, N / 4));
  }
  const teleportSum = teleport.reduce((a, b) => a + b, 0) || 1;
  const teleportNorm = teleport.map((t) => (t * N) / teleportSum); // mean = 1

  const d = 0.85;
  let score = new Array(N).fill(1);
  for (let iter = 0; iter < 25; iter++) {
    const next = new Array(N);
    for (let v = 0; v < N; v++) {
      let sum = 0;
      for (let u = 0; u < N; u++) {
        if (u !== v && weight[u]![v]! > 0 && outSum[u] > 0) {
          sum += (weight[u]![v]! / outSum[u]) * score[u]!;
        }
      }
      next[v] = (1 - d) * teleportNorm[v]! + d * sum;
    }
    score = next;
  }

  // MMR selection: pick high-scoring sentences that aren't similar to ones
  // already chosen. Keeps the summary informative on short topic bodies.
  const lambda = Math.min(1, Math.max(0, opts.mmrLambda ?? 0.7));
  const selected: number[] = [];
  const remaining = new Set<number>(Array.from({ length: N }, (_, i) => i));
  while (selected.length < n && remaining.size > 0) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    for (const i of remaining) {
      let maxSim = 0;
      for (const j of selected) {
        if (weight[i]![j]! > maxSim) maxSim = weight[i]![j]!;
      }
      const mmrScore = lambda * (score[i] ?? 0) - (1 - lambda) * maxSim;
      if (mmrScore > bestVal) {
        bestVal = mmrScore;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }

  return selected
    .sort((a, b) => a - b)
    .map((i) => sentences[i]!);
}

/* ------------------------------------------------------------------ *
 * Subject classification + difficulty
 * ------------------------------------------------------------------ */

const SUBJECT_LEXICON: { subject: string; terms: string[] }[] = [
  { subject: 'Economics', terms: ['supply', 'demand', 'elasticity', 'monopoly', 'oligopoly', 'market', 'price', 'cournot', 'bertrand', 'utility', 'gdp', 'inflation', 'equilibrium', 'welfare', 'ζήτηση', 'προσφορά', 'αγορά', 'τιμή'] },
  { subject: 'Programming', terms: ['function', 'variable', 'array', 'loop', 'class', 'python', 'pandas', 'numpy', 'algorithm', 'compiler', 'syntax', 'object', 'method', 'recursion', 'συνάρτηση', 'μεταβλητή', 'αλγόριθμος'] },
  { subject: 'Statistics', terms: ['probability', 'distribution', 'variance', 'regression', 'hypothesis', 'sample', 'mean', 'median', 'correlation', 'bayes', 'standard deviation', 'πιθανότητα', 'κατανομή', 'διασπορά'] },
  { subject: 'Mathematics', terms: ['theorem', 'integral', 'derivative', 'matrix', 'vector', 'equation', 'function', 'limit', 'proof', 'polynomial', 'ολοκλήρωμα', 'παράγωγος', 'εξίσωση', 'θεώρημα'] },
  { subject: 'Physics', terms: ['force', 'energy', 'velocity', 'momentum', 'quantum', 'mass', 'acceleration', 'electron', 'wave', 'particle', 'δύναμη', 'ενέργεια', 'ταχύτητα'] },
  { subject: 'Chemistry', terms: ['molecule', 'atom', 'reaction', 'bond', 'acid', 'electron', 'compound', 'ion', 'oxidation', 'mole', 'μόριο', 'άτομο', 'αντίδραση'] },
  { subject: 'Biology', terms: ['cell', 'protein', 'dna', 'gene', 'enzyme', 'organism', 'evolution', 'membrane', 'mitochondria', 'tissue', 'κύτταρο', 'γονίδιο', 'πρωτεΐνη'] },
  { subject: 'Philosophy', terms: ['ethics', 'epistemology', 'metaphysics', 'argument', 'truth', 'morality', 'logic', 'existence', 'knowledge', 'ηθική', 'γνώση', 'επιχείρημα'] },
  { subject: 'History', terms: ['war', 'empire', 'revolution', 'century', 'treaty', 'dynasty', 'civilization', 'colonial', 'πόλεμος', 'αυτοκρατορία', 'επανάσταση'] },
  { subject: 'Psychology', terms: ['behavior', 'cognition', 'memory', 'perception', 'emotion', 'conditioning', 'personality', 'stimulus', 'συμπεριφορά', 'μνήμη', 'αντίληψη'] },
  { subject: 'Law', terms: ['contract', 'liability', 'statute', 'tort', 'plaintiff', 'jurisdiction', 'defendant', 'legislation', 'νόμος', 'σύμβαση', 'ευθύνη'] },
  { subject: 'Medicine', terms: ['patient', 'diagnosis', 'symptom', 'treatment', 'disease', 'clinical', 'therapy', 'syndrome', 'ασθενής', 'διάγνωση', 'σύμπτωμα'] },
];

export function inferSubject(text: string): string {
  const lower = text.toLowerCase();
  let best = 'General Studies';
  let bestScore = 0;
  for (const { subject, terms } of SUBJECT_LEXICON) {
    let score = 0;
    for (const term of terms) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      score += (lower.match(re)?.length ?? 0);
    }
    if (score > bestScore) {
      bestScore = score;
      best = subject;
    }
  }
  return bestScore >= 2 ? best : 'General Studies';
}

export function estimateDifficulty(text: string): 'beginner' | 'intermediate' | 'advanced' {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 'intermediate';
  const words = text.match(WORD_RE) ?? [];
  const avgSentenceWords = words.length / sentences.length;
  const longWordRatio = words.filter((w) => w.length >= 9).length / Math.max(1, words.length);
  const formulaDensity = (text.match(/[=∑∫∂√≤≥≠→±×÷]|\b\d+\.\d+\b/g)?.length ?? 0) / Math.max(1, sentences.length);

  let score = 0;
  if (avgSentenceWords > 24) score += 2;
  else if (avgSentenceWords > 17) score += 1;
  if (longWordRatio > 0.22) score += 2;
  else if (longWordRatio > 0.14) score += 1;
  if (formulaDensity > 0.4) score += 1;

  if (score >= 4) return 'advanced';
  if (score >= 2) return 'intermediate';
  return 'beginner';
}

/* ------------------------------------------------------------------ *
 * Topic assembly
 * ------------------------------------------------------------------ */

function wordCount(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

function estimateMinutes(text: string): number {
  return Math.min(45, Math.max(8, Math.round((wordCount(text) / 130) * 6)));
}

/**
 * Bloom-aware objective synthesis.
 *
 * Picks one objective per Bloom level scaled to the topic's difficulty:
 *   - beginner    → Remember + Understand + Apply
 *   - intermediate → Understand + Apply + Analyze + Evaluate
 *   - advanced    → Apply + Analyze + Evaluate + Create
 *
 * Each level gets the **highest-importance concept** that hasn't been used yet,
 * so the four objectives don't all repeat the same word — they walk down the
 * concept list while walking up the cognitive ladder.
 */
function buildObjectives(
  concepts: string[],
  isGreek: boolean,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
): string[] {
  if (concepts.length === 0) return [];

  type Level = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  const ladderByDifficulty: Record<typeof difficulty, Level[]> = {
    beginner: ['remember', 'understand', 'apply'],
    intermediate: ['understand', 'apply', 'analyze', 'evaluate'],
    advanced: ['apply', 'analyze', 'evaluate', 'create'],
  };
  const ladder = ladderByDifficulty[difficulty];

  // Per-Bloom level templates. The placeholder {{c}} is the focus concept,
  // {{c2}} is the next-best concept (used only by Analyze/Evaluate/Create).
  const templates: Record<Level, { en: string; el: string }[]> = {
    remember: [
      { en: 'Define {{c}} in your own words.', el: 'Όρισε την έννοια «{{c}}» με δικά σου λόγια.' },
      { en: 'Recall the key properties of {{c}}.', el: 'Ανάκληση των βασικών ιδιοτήτων του «{{c}}».' },
    ],
    understand: [
      { en: 'Explain why {{c}} matters in this topic.', el: 'Εξήγησε γιατί το «{{c}}» έχει σημασία σε αυτό το θέμα.' },
      { en: 'Summarize how {{c}} works.', el: 'Συνόψισε πώς λειτουργεί το «{{c}}».' },
    ],
    apply: [
      { en: 'Apply {{c}} to a worked example from the notes.', el: 'Εφάρμοσε το «{{c}}» σε ένα παράδειγμα από τις σημειώσεις.' },
      { en: 'Use {{c}} to solve a practice problem.', el: 'Χρησιμοποίησε το «{{c}}» για να λύσεις ένα πρόβλημα εξάσκησης.' },
    ],
    analyze: [
      { en: 'Compare {{c}} with {{c2}}.', el: 'Σύγκρινε το «{{c}}» με το «{{c2}}».' },
      { en: 'Identify the assumptions behind {{c}}.', el: 'Εντόπισε τις παραδοχές πίσω από το «{{c}}».' },
    ],
    evaluate: [
      { en: 'Evaluate when {{c}} fails or breaks down.', el: 'Αξιολόγησε πότε το «{{c}}» αποτυγχάνει ή καταρρέει.' },
      { en: 'Critique a counter-argument to {{c}}.', el: 'Κριτίκαρε ένα αντεπιχείρημα στο «{{c}}».' },
    ],
    create: [
      { en: 'Design a new scenario where {{c}} interacts with {{c2}}.', el: 'Σχεδίασε ένα νέο σενάριο όπου το «{{c}}» αλληλεπιδρά με το «{{c2}}».' },
      { en: 'Synthesize {{c}} with {{c2}} into a unified explanation.', el: 'Σύνθεσε το «{{c}}» με το «{{c2}}» σε μια ενιαία εξήγηση.' },
    ],
  };

  const objectives: string[] = [];
  const usedConcepts = new Set<string>();
  ladder.forEach((level, idx) => {
    const focus = concepts.find((c) => !usedConcepts.has(c)) ?? concepts[idx % concepts.length]!;
    usedConcepts.add(focus);
    const support =
      concepts.find((c) => c !== focus && !usedConcepts.has(c)) ??
      concepts[(idx + 1) % concepts.length] ??
      focus;
    const choices = templates[level];
    const t = choices[idx % choices.length]!;
    const tpl = isGreek ? t.el : t.en;
    objectives.push(tpl.replace('{{c}}', focus).replace('{{c2}}', support));
  });

  return objectives;
}

interface WorkingTopic extends GeneratedTopic {
  _concepts: Set<string>; // normalized concept keys
  _text: string;
}

function topicFromSection(
  section: Section,
  isGreek: boolean,
  allSections: Section[],
  sectionIndex: number,
): WorkingTopic | null {
  const body = section.text;
  const headingPhrase = section.heading ? titleCasePhrase(section.heading.toLowerCase()) : '';
  const keyphrases = rankKeyphrases(body, 8, section.heading ?? '');

  // Normalize + de-dupe concepts, dropping any that merely repeat the title.
  const titleKey = normalizeConcept(headingPhrase);
  const seen = new Set<string>();
  const rawConcepts: string[] = [];
  for (const k of keyphrases) {
    const norm = normalizeConcept(k.phrase);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    rawConcepts.push(titleCasePhrase(k.phrase));
    if (rawConcepts.length >= 9) break;
  }

  const concepts = filterConceptsForSection(rawConcepts, sectionIndex, allSections).slice(0, 7);

  const title = headingPhrase || concepts[0] || '';
  if (!title) return null;
  if (concepts.length === 0 && body.length < 80) return null;

  const finalConcepts = concepts.length > 0 ? concepts : [title];
  const difficulty = estimateDifficulty(body);
  const summary = extractiveSummary(body, 1, {
    biasTerms: [title, ...finalConcepts.slice(0, 3)],
    leadBias: 0.18,
    mmrLambda: 0.7,
  })[0];
  return {
    title,
    description: (summary ? summary.slice(0, 200) : '') || (isGreek ? `Βασικές ιδέες για «${title}».` : `Key ideas covering ${title}.`),
    concepts: finalConcepts,
    prerequisites: [],
    difficulty,
    estimatedMinutes: estimateMinutes(body),
    objectives: buildObjectives(finalConcepts, isGreek, difficulty),
    _concepts: new Set([titleKey, ...seen].filter(Boolean)),
    _text: body,
  };
}

/** Cluster top keyphrases into topics by shared words when no clear sections. */
function topicsFromKeyphrases(text: string, isGreek: boolean): WorkingTopic[] {
  const ranked = rankKeyphrases(text, 28);
  if (ranked.length === 0) return [];

  const maxTopics = Math.min(6, Math.max(3, Math.floor(ranked.length / 4)));
  interface Seed { title: string; words: Set<string>; concepts: string[]; keys: Set<string> }
  const seeds: Seed[] = [];

  const wordsOf = (p: string) => new Set(p.split(/\s+/));
  const shares = (a: Set<string>, b: Set<string>) => [...b].some((w) => a.has(w));

  for (const { phrase } of ranked) {
    if (seeds.length >= maxTopics) break;
    const w = wordsOf(phrase);
    if (seeds.some((s) => shares(s.words, w))) continue;
    const display = titleCasePhrase(phrase);
    seeds.push({ title: display, words: w, concepts: [display], keys: new Set([normalizeConcept(phrase)]) });
  }
  if (seeds.length === 0) return [];

  for (const { phrase } of ranked) {
    const display = titleCasePhrase(phrase);
    if (seeds.some((s) => s.concepts.includes(display))) continue;
    const w = wordsOf(phrase);
    let target = seeds.find((s) => shares(s.words, w));
    if (!target) target = seeds.reduce((a, b) => (a.concepts.length <= b.concepts.length ? a : b));
    if (target.concepts.length < 8) {
      target.concepts.push(display);
      target.keys.add(normalizeConcept(phrase));
      w.forEach((x) => target!.words.add(x));
    }
  }

  const overall = estimateDifficulty(text);
  return seeds.map((s) => ({
    title: s.title,
    description: isGreek
      ? `Βασικές έννοιες: ${s.concepts.slice(0, 4).join(', ')}.`
      : `Core concepts: ${s.concepts.slice(0, 4).join(', ')}.`,
    concepts: s.concepts,
    prerequisites: [],
    difficulty: overall,
    estimatedMinutes: 18,
    objectives: buildObjectives(s.concepts, isGreek, overall),
    _concepts: s.keys,
    _text: s.concepts.join('. '),
  }));
}

/**
 * Infer prerequisites: a topic depends on an earlier topic it references — by
 * mentioning its title or sharing ≥2 introduced concepts. Falls back to the
 * immediately-preceding topic so the graph is never empty for ordered material.
 */
function inferPrerequisites(topics: WorkingTopic[]): void {
  topics.forEach((topic, i) => {
    if (i === 0) return;
    const text = topic._text.toLowerCase();
    const found: string[] = [];
    for (let j = 0; j < i; j++) {
      const prior = topics[j]!;
      const titleKey = normalizeConcept(prior.title);
      const mentionsTitle = titleKey.length > 2 && text.includes(prior.title.toLowerCase());
      let shared = 0;
      for (const c of prior._concepts) if (topic._concepts.has(c)) shared += 1;
      if (mentionsTitle || shared >= 2) found.push(prior.title);
    }
    const prereqs = (found.length > 0 ? found : [topics[i - 1]!.title]).slice(-2);
    topic.prerequisites = prereqs;
  });
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

function deriveTitle(text: string, fileNames: string[], subject: string): string {
  const fromFile = fileNames[0]?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (fromFile && fromFile.length >= 4 && !/^untitled/i.test(fromFile)) {
    return titleCasePhrase(fromFile.toLowerCase());
  }
  const top = rankKeyphrases(text, 1)[0];
  if (top) return `${subject}: ${titleCasePhrase(top.phrase)}`;
  return `${subject} Study Course`;
}

function rollupDifficulty(topics: GeneratedTopic[]): GeneratedOutline['difficulty'] {
  const set = new Set(topics.map((t) => t.difficulty));
  if (set.size > 1) return 'mixed';
  return [...set][0] ?? 'intermediate';
}

/** Strip internal working fields before returning the public outline shape. */
function finalizeTopic(t: WorkingTopic): GeneratedTopic {
  const { _concepts, _text, ...rest } = t;
  void _concepts;
  void _text;
  return rest;
}

function finalizeOutline(
  clean: string,
  fileNames: string[],
  settings: UserSettings | undefined,
  working: WorkingTopic[],
): GeneratedOutline {
  const isGreek = settings?.language === 'el';
  const subject = inferSubject(clean);
  inferPrerequisites(working);
  const topics = working.map(finalizeTopic);

  const glossary: GeneratedGlossaryEntry[] = [];
  const glossarySeen = new Set<string>();
  const addGlossary = (e: GeneratedGlossaryEntry) => {
    const k = normalizeConcept(e.term);
    if (!k || glossarySeen.has(k)) return;
    glossarySeen.add(k);
    glossary.push(e);
  };
  extractDefinitions(clean, 24).forEach(addGlossary);
  extractAcronyms(clean).forEach(addGlossary);
  if (glossary.length < 8) {
    const sentences = splitSentences(clean);
    for (const { phrase } of rankKeyphrases(clean, 18)) {
      if (glossary.length >= 14) break;
      if (phrase.split(/\s+/).length > 2) continue;
      const display = titleCasePhrase(phrase);
      const ctx = sentences.find((s) => s.toLowerCase().includes(phrase));
      addGlossary({
        term: display,
        definition: ctx ? ctx.slice(0, 220) : (isGreek ? `${display} — βασική έννοια από το υλικό σου.` : `${display} — a key concept identified in your material.`),
      });
    }
  }

  const courseTitle = deriveTitle(clean, fileNames, subject);
  const courseBias = [
    courseTitle,
    ...topics.slice(0, 3).map((t) => t.title),
    ...topics.flatMap((t) => t.concepts.slice(0, 2)),
  ];
  const summarySentences = extractiveSummary(clean, 2, {
    biasTerms: courseBias,
    leadBias: 0.12,
    mmrLambda: 0.65,
  });
  const summary = summarySentences.length > 0
    ? summarySentences.join(' ').slice(0, 320)
    : (isGreek
        ? `Αυτόματα δομημένο μάθημα ${subject.toLowerCase()} από το υλικό σου: ${topics.length} ενότητες, ${glossary.length} όροι.`
        : `Auto-structured ${subject.toLowerCase()} course from your material: ${topics.length} modules, ${glossary.length} key terms.`);

  return {
    title: courseTitle,
    subject,
    difficulty: rollupDifficulty(topics),
    summary,
    topics,
    glossary,
  };
}

/** Split flat documents into embeddable chunks when heading detection finds <2 sections. */
function sectionsForEmbedding(clean: string): Section[] {
  const sections = detectSections(clean);
  if (sections.length >= 2) return sections.slice(0, 14);

  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= 120);
  if (paras.length >= 2) {
    return paras.slice(0, 12).map((text) => ({ text }));
  }

  const sents = splitSentences(clean);
  const window = 5;
  const chunks: Section[] = [];
  for (let i = 0; i < sents.length; i += window) {
    const text = sents.slice(i, i + window).join(' ');
    if (text.length >= 80) chunks.push({ text });
  }
  return chunks.slice(0, 12);
}

/**
 * Semantic topic discovery via section/chunk embeddings + agglomerative clustering.
 * Returns null when embeddings are unavailable (caller keeps lexical pipeline).
 */
async function topicsFromEmbeddingClusters(
  clean: string,
  isGreek: boolean,
  settings?: UserSettings,
): Promise<WorkingTopic[] | null> {
  const sections = sectionsForEmbedding(clean);
  if (sections.length < 2) return null;

  const bodies = sections.map((s) => `${s.heading ?? ''}\n${s.text}`.trim().slice(0, 2500));
  const embeddings = await embedTexts(bodies, settings);
  if (!embeddings || embeddings.some((e) => e.length === 0)) return null;

  const k = chooseClusterCount(sections.length);
  const labels = agglomerativeCluster(embeddings, k);
  const groups = groupByCluster(labels);
  const working: WorkingTopic[] = [];

  for (const indices of groups.values()) {
    const clusterSections = indices.map((i) => sections[i]!);
    const body = clusterSections.map((s) => `${s.heading ?? ''}\n${s.text}`.trim()).join('\n\n');
    const mid = medoidIndex(embeddings, indices);
    const medoid = sections[mid]!;
    const synthetic: Section = {
      heading: medoid.heading ?? clusterSections.find((s) => s.heading)?.heading,
      text: body,
    };
    const topic = topicFromSection(synthetic, isGreek, sections, mid);
    if (topic) working.push(topic);
  }

  return working.length >= 2 ? working : null;
}

/**
 * Async outline builder: tries embedding-based semantic clustering first when a
 * proxy/API key is available, then falls back to the deterministic lexical engine.
 */
export async function analyzeContentToOutlineAsync(
  text: string,
  fileNames: string[],
  settings?: UserSettings,
): Promise<GeneratedOutline | null> {
  const clean = (text ?? '').trim();
  if (clean.length < 200) return null;

  const lexical = analyzeContentToOutline(text, fileNames, settings);
  const embeddedWorking = await topicsFromEmbeddingClusters(clean, settings?.language === 'el', settings);

  if (!embeddedWorking || embeddedWorking.length < 2) return lexical;

  const sections = detectSections(clean);
  const structuredDoc = sections.length >= 3;
  const lexicalTopicCount = lexical?.topics.length ?? 0;

  // Prefer embeddings for flat/unstructured notes; keep heading-based lexical for well-structured docs.
  if (structuredDoc && lexicalTopicCount >= embeddedWorking.length) return lexical;

  return finalizeOutline(clean, fileNames, settings, embeddedWorking);
}

/**
 * Produce a structured course outline purely from the material's content.
 * Returns null only when there's too little text to analyze meaningfully.
 */
export function analyzeContentToOutline(
  text: string,
  fileNames: string[],
  settings?: UserSettings,
): GeneratedOutline | null {
  const clean = (text ?? '').trim();
  if (clean.length < 200) return null;

  const isGreek = settings?.language === 'el';

  // 1) Prefer section-based topics when the document is structured.
  const sections = detectSections(clean);
  let working: WorkingTopic[] = [];
  if (sections.length >= 3) {
    for (let si = 0; si < sections.length; si++) {
      const topic = topicFromSection(sections[si]!, isGreek, sections, si);
      if (topic) working.push(topic);
      if (working.length >= 8) break;
    }
  }

  // 2) Fall back to keyphrase clustering for flat / unstructured notes.
  if (working.length < 3) {
    working = topicsFromKeyphrases(clean, isGreek);
  }
  if (working.length === 0) return null;

  return finalizeOutline(clean, fileNames, settings, working);
}
