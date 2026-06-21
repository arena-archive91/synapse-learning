/**
 * Note-grounded extractors for Study Workspace tools.
 * Every function operates only on user-uploaded material — no demo templates.
 */

import type { Lang } from './i18n';
import type { QuizDef } from './domainContent';
import type { GlossaryEntry, Topic, UploadedFile } from '../types';
import {
  detectSections,
  extractDefinitions,
  extractiveSummary,
  normalizeConcept,
  rankKeyphrases,
  splitSentences,
  titleCasePhrase,
} from './contentAnalysis';
import { buildCorpusFromChunks, chunkText, retrieve, tokenize, type SourceChunk } from './rag';

/* ------------------------------------------------------------------ *
 * Source gathering & relevance
 * ------------------------------------------------------------------ */

export function gatherAnalyzedText(files: UploadedFile[], courseId?: string): {
  text: string;
  fileNames: string[];
  hasSource: boolean;
} {
  const relevant = files.filter((f) => {
    if (f.status !== 'analyzed' && f.status !== 'processing') return false;
    const body = f.extractedText?.trim();
    if (!body || body.length < 40) return false;
    if (courseId && f.courseId && f.courseId !== courseId) return false;
    return true;
  });
  const text = relevant.map((f) => f.extractedText!.trim()).join('\n\n');
  return {
    text,
    fileNames: relevant.map((f) => f.name),
    hasSource: text.length >= 80,
  };
}

function conceptWords(concept: string): string[] {
  return concept
    .toLowerCase()
    .split(/[\s,/·–—-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

/**
 * Score how relevant a text chunk is to the session concept (0–1).
 *
 * Hybrid: a substring match is a strong signal (people overwhelmingly write
 * the concept verbatim in headings/definitions), but for the rest we now use
 * a BM25-style overlap so we don't over-reward stuffing or under-reward
 * paraphrases that share token weight with the concept.
 */
export function conceptRelevanceScore(text: string, concept: string): number {
  const lower = text.toLowerCase();
  const words = conceptWords(concept);
  if (words.length === 0) return 0;
  const phrase = concept.toLowerCase();
  const phraseHit = phrase.length > 4 && lower.includes(phrase) ? 0.5 : 0;
  // Token-overlap component: count distinct content tokens (drops stopwords / 1-char).
  const textTokens = new Set(tokenize(text));
  let hits = 0;
  for (const w of words) {
    if (textTokens.has(w) || lower.includes(w)) hits += 1;
  }
  const overlap = hits / words.length;
  return Math.min(1, overlap * 0.7 + phraseHit);
}

/**
 * Return the most concept-relevant excerpt from the full source text.
 *
 * Backed by the same BM25 corpus the Agent uses, so the workspace lesson,
 * Feynman reference, debate seed, and annotation context all see the same
 * "best slices" for the concept. Falls back to section-level heuristics for
 * very short inputs where chunking would over-fragment.
 */
export function relevantExcerpt(text: string, concept: string, maxChars = 10000): string {
  if (!text.trim()) return '';

  // Short documents: pre-BM25 path on whole sections (cheap + readable).
  if (text.length < 1500) {
    const sections = detectSections(text);
    type Chunk = { body: string; score: number };
    const chunks: Chunk[] = [];
    if (sections.length > 0) {
      for (const s of sections) {
        const body = (s.heading ? `${s.heading}\n\n` : '') + s.text;
        chunks.push({ body, score: conceptRelevanceScore(body, concept) });
      }
    } else {
      const paras = text.split(/\n{2,}/).filter((p) => p.trim().length > 40);
      for (const p of paras) chunks.push({ body: p.trim(), score: conceptRelevanceScore(p, concept) });
    }
    chunks.sort((a, b) => b.score - a.score);
    const picked: string[] = [];
    let len = 0;
    for (const c of chunks) {
      if (c.score < 0.1 && picked.length >= 2) break;
      if (len + c.body.length > maxChars) {
        const room = maxChars - len;
        if (room > 200) picked.push(c.body.slice(0, room) + '…');
        break;
      }
      picked.push(c.body);
      len += c.body.length;
      if (len >= maxChars) break;
    }
    return picked.length > 0 ? picked.join('\n\n') : text.slice(0, maxChars);
  }

  // Larger inputs: build a one-shot BM25 corpus over rag-style chunks and
  // pull the top hits for the concept query. We add a hard fallback so we
  // never return empty when the BM25 score is zero (e.g. truly novel query).
  const chunks = chunkText(text, 'note', 'note');
  const corpus = buildCorpusFromChunks(chunks);
  const k = Math.max(2, Math.min(10, Math.ceil(maxChars / 700)));
  const hits = retrieve(concept, corpus, k);
  if (hits.length === 0) {
    return text.slice(0, maxChars);
  }
  const picked: string[] = [];
  let len = 0;
  // Re-order hits by chunk index so the excerpt reads in document order.
  const ordered = hits.slice().sort((a, b) => a.chunk.charStart - b.chunk.charStart);
  for (const { chunk } of ordered) {
    const body = (chunk.heading ? `${chunk.heading}\n\n` : '') + chunk.text.trim();
    if (len + body.length > maxChars) {
      const room = maxChars - len;
      if (room > 200) picked.push(body.slice(0, room) + '…');
      break;
    }
    picked.push(body);
    len += body.length;
  }
  return picked.length > 0 ? picked.join('\n\n') : text.slice(0, maxChars);
}

/** Return the top-k BM25 hits for a concept against arbitrary text. */
export function topRelevantChunks(text: string, concept: string, k = 4): SourceChunk[] {
  if (!text.trim()) return [];
  const chunks = chunkText(text, 'note', 'note');
  const corpus = buildCorpusFromChunks(chunks);
  return retrieve(concept, corpus, k).map((h) => h.chunk);
}

export function findMatchingTopic(topics: Topic[], concept: string): Topic | undefined {
  const key = normalizeConcept(concept);
  return topics.find((t) => {
    const tk = normalizeConcept(t.title);
    if (tk === key || tk.includes(key) || key.includes(tk)) return true;
    return (t.keyConcepts ?? []).some((c) => {
      const ck = normalizeConcept(c);
      return ck === key || ck.includes(key) || key.includes(ck);
    });
  });
}

/* ------------------------------------------------------------------ *
 * Formulas
 * ------------------------------------------------------------------ */

export interface ExtractedFormula {
  id: string;
  name: string;
  formula: string;
}

const FORMULA_LINE =
  /(?:^|\n)\s*(?:Formula|Τύπος|Equation|Ισοδύναμο|Expression)?\s*:?\s*([A-Za-zΑ-Ωα-ω][A-Za-zΑ-Ωα-ω0-9_²³*+\-/()=.,%Δ\s]{4,80}=[A-Za-zΑ-Ωα-ω0-9_²³*+\-/().,%Δ\s]{2,80})/gim;

export function extractFormulas(text: string, concept?: string, max = 8): ExtractedFormula[] {
  const excerpt = concept ? relevantExcerpt(text, concept, 12000) : text;
  const out: ExtractedFormula[] = [];
  const seen = new Set<string>();

  const add = (raw: string, label?: string) => {
    const formula = raw.replace(/\s+/g, ' ').trim();
    if (formula.length < 5 || formula.length > 120) return;
    if (!/[=]/.test(formula) && !/\$/.test(formula)) return;
    const k = normalizeConcept(formula);
    if (seen.has(k)) return;
    seen.add(k);
    const name = label?.trim() || formula.split('=')[0]?.trim() || `Formula ${out.length + 1}`;
    out.push({ id: `nf-${out.length}`, name: name.slice(0, 48), formula });
  };

  for (const m of excerpt.matchAll(/\$\$?([^$]+)\$\$?/g)) {
    add(m[1]!.trim(), 'LaTeX');
    if (out.length >= max) return out;
  }

  for (const m of excerpt.matchAll(FORMULA_LINE)) {
    add(m[1]!);
    if (out.length >= max) return out;
  }

  for (const s of splitSentences(excerpt)) {
    if (!/[=]/.test(s) || s.length > 140) continue;
    const eq = s.match(/([A-Za-zΑ-Ω][A-Za-zΑ-Ω0-9_²³]*\s*=\s*[^.]{3,60})/);
    if (eq) add(eq[1]!, titleCasePhrase((concept ?? 'Key').toLowerCase()));
    if (out.length >= max) break;
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Comparisons (Σύγκριση tool)
 *
 * Three layers, in order of richness:
 *   1. Markdown comparison tables (| header | col-A | col-B |)        — structured.
 *   2. Sentence patterns ("X vs Y", "compared to", "unlike", "ενώ", …) — semi-structured.
 *   3. Glossary co-occurrence + definitions                            — fallback.
 * ------------------------------------------------------------------ */

const COMPARE_PATTERNS: RegExp[] = [
  /\b(.{4,50}?)\s+(?:vs\.?|versus|compared to|unlike|whereas|while|in contrast to|differs from)\s+(.{4,80}?)[.;]/gi,
  /\b(.{4,50}?)\s+(?:ενώ|αντίθετα|σε αντίθεση|σε σύγκριση με|διαφέρει από)\s+(.{4,80}?)[.;]/gi,
];

interface MarkdownTable {
  headers: string[];
  rows: string[][];
}

/**
 * Parse Markdown pipe tables out of a body of text.
 *
 * A valid Markdown table is: a header line, an alignment line containing only
 * `|`, `-`, and `:`, and one or more data rows. We tolerate optional leading
 * pipes and ignore any indentation. Lines that aren't part of a table flush
 * any in-progress block.
 */
function parseMarkdownTables(text: string): MarkdownTable[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const tables: MarkdownTable[] = [];
  let i = 0;

  const splitRow = (line: string): string[] | null => {
    const trimmed = line.trim();
    if (!trimmed.includes('|')) return null;
    const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
    const cells = inner.split('|').map((c) => c.trim());
    if (cells.length < 2) return null;
    return cells;
  };

  while (i < lines.length) {
    const headerCells = splitRow(lines[i] ?? '');
    const align = lines[i + 1]?.trim() ?? '';
    const isAlignRow = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(align);
    if (headerCells && isAlignRow && headerCells.length >= 2) {
      const headers = headerCells;
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length) {
        const row = splitRow(lines[i] ?? '');
        if (!row) break;
        // Pad/truncate to the header width.
        const padded = row.slice(0, headers.length);
        while (padded.length < headers.length) padded.push('');
        rows.push(padded);
        i++;
      }
      if (rows.length > 0) tables.push({ headers, rows });
      continue;
    }
    i++;
  }
  return tables;
}

/**
 * Convert a Markdown comparison table into `[dimension, left, right]` rows.
 *
 * A "comparison table" is one with at least 2 data columns; we treat the first
 * column as the dimension and the remaining columns as the things being
 * compared. For tables with >2 data columns we emit one row per
 * (dim, col_i, col_j) pair, capped to keep the UI usable.
 */
function rowsFromTable(t: MarkdownTable, conceptKey: string): [string, string, string][] {
  if (t.headers.length < 3 || t.rows.length === 0) return [];
  const dimHeader = t.headers[0]!.trim();
  const out: [string, string, string][] = [];
  for (const row of t.rows) {
    const dim = (row[0] ?? dimHeader).trim();
    if (!dim) continue;
    for (let i = 1; i < row.length; i++) {
      for (let j = i + 1; j < row.length; j++) {
        const left = (row[i] ?? '').trim();
        const right = (row[j] ?? '').trim();
        if (left.length < 2 || right.length < 2 || left === right) continue;
        const ai = (t.headers[i] ?? '').trim();
        const bj = (t.headers[j] ?? '').trim();
        const label = ai && bj ? `${dim} (${ai} vs ${bj})` : dim;
        out.push([label.slice(0, 80), left.slice(0, 100), right.slice(0, 100)]);
      }
    }
    if (out.length >= 8) break;
  }
  // Lightweight relevance bias: keep tables whose header or first cell mentions the concept.
  const concept = conceptKey.toLowerCase();
  if (concept) {
    const head = (dimHeader + ' ' + t.rows.map((r) => r[0] ?? '').join(' ')).toLowerCase();
    if (!head.includes(concept) && out.length > 4) return out.slice(0, 4);
  }
  return out;
}

export function extractComparisons(
  text: string,
  concept: string,
  glossary: GlossaryEntry[],
): [string, string, string][] {
  const excerpt = relevantExcerpt(text, concept, 14000);
  const rows: [string, string, string][] = [];
  const seen = new Set<string>();

  const push = (dim: string, a: string, b: string) => {
    const d = dim.trim().slice(0, 80);
    const left = a.trim().slice(0, 100);
    const right = b.trim().slice(0, 100);
    if (left.length < 2 || right.length < 2) return;
    const k = `${d}|${left}|${right}`;
    if (seen.has(k)) return;
    seen.add(k);
    rows.push([d || concept, left, right]);
  };

  // 1) Structured: Markdown comparison tables in the source notes.
  const tables = parseMarkdownTables(excerpt);
  for (const tbl of tables) {
    for (const r of rowsFromTable(tbl, concept)) {
      push(r[0], r[1], r[2]);
      if (rows.length >= 6) return rows;
    }
  }

  // 2) Semi-structured: explicit "X vs Y" / "ενώ" / "compared to" sentences.
  for (const re of COMPARE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of excerpt.matchAll(re)) {
      push('Comparison', m[1]!, m[2]!);
      if (rows.length >= 6) return rows;
    }
  }

  // 3) Glossary pairs that co-occur in the same sentence → implicit contrast rows.
  const sentences = splitSentences(excerpt);
  const terms = glossary
    .filter((g) => conceptRelevanceScore(g.definition + g.term, concept) > 0.2)
    .slice(0, 10);
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const a = terms[i]!;
      const b = terms[j]!;
      const shared = sentences.find(
        (s) => s.toLowerCase().includes(a.term.toLowerCase()) && s.toLowerCase().includes(b.term.toLowerCase()),
      );
      if (shared) {
        push(`${a.term} vs ${b.term}`, a.definition.slice(0, 80), b.definition.slice(0, 80));
      }
      if (rows.length >= 6) return rows;
    }
  }

  // Last resort: definitions from the excerpt as one-sided rows.
  if (rows.length === 0) {
    const defs = extractDefinitions(excerpt, 6).filter(
      (d) => conceptRelevanceScore(d.definition, concept) > 0.25,
    );
    for (const d of defs.slice(0, 4)) {
      push(d.term, d.definition.slice(0, 80), '—');
    }
  }

  return rows;
}

/* ------------------------------------------------------------------ *
 * Flashcards (Leitner)
 * ------------------------------------------------------------------ */

export function buildFlashcards(
  text: string,
  concept: string,
  glossary: GlossaryEntry[],
  lang: Lang,
): { front: string; back: string }[] {
  const excerpt = relevantExcerpt(text, concept, 12000);
  const cards: { front: string; back: string }[] = [];
  const seen = new Set<string>();

  const add = (front: string, back: string) => {
    const f = front.trim();
    const b = back.trim();
    if (f.length < 2 || b.length < 8) return;
    const k = normalizeConcept(f);
    if (seen.has(k)) return;
    seen.add(k);
    cards.push({ front: f, back: b.slice(0, 280) });
  };

  const scopedGlossary = glossary.filter(
    (g) => conceptRelevanceScore(g.term + ' ' + g.definition, concept) > 0.15,
  );
  for (const g of scopedGlossary.slice(0, 12)) {
    add(g.term, g.definition);
  }

  for (const d of extractDefinitions(excerpt, 10)) {
    add(d.term, d.definition);
  }

  const sentences = splitSentences(excerpt).filter((s) => conceptRelevanceScore(s, concept) > 0.3);
  for (const s of sentences.slice(0, 4)) {
    const words = conceptWords(concept);
    const hit = words.find((w) => s.toLowerCase().includes(w));
    if (hit) {
      add(
        lang === 'el' ? `Τι ισχύει για «${hit}»;` : `What is true about «${hit}»?`,
        s,
      );
    }
  }

  if (cards.length === 0 && concept) {
    const summary = extractiveSummary(excerpt, 1, { biasTerms: [concept] })[0];
    if (summary) {
      add(concept, summary);
    }
  }

  return cards.slice(0, 16);
}

/* ------------------------------------------------------------------ *
 * Quiz from notes
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Distractor selection
 * ------------------------------------------------------------------ */

const TERM_STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'for', 'in', 'on', 'is', 'are', 'this', 'that',
]);

function termTokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !TERM_STOP.has(w)) out.add(w);
  }
  return out;
}

function termJaccard(a: string, b: string): number {
  const A = termTokens(a);
  const B = termTokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Rank glossary terms by *near-miss* similarity to the correct answer:
 * shares some tokens (so it looks plausible) but is not the same concept.
 * The earlier MVP just took the first 3 entries, which produced trivially
 * obvious wrong answers. SBERT-style cosine would be better still, but is
 * gated on embeddings; this is a strong fully-offline default.
 */
export function rankDistractorTerms(
  glossary: GlossaryEntry[],
  correctTerm: string,
  count: number,
): string[] {
  const correctNorm = normalizeConcept(correctTerm);
  type Cand = { term: string; score: number; lengthDelta: number };
  const cands: Cand[] = [];
  for (const g of glossary) {
    const norm = normalizeConcept(g.term);
    if (!norm || norm === correctNorm) continue;
    const j = termJaccard(g.term, correctTerm);
    cands.push({ term: g.term, score: j, lengthDelta: Math.abs(g.term.length - correctTerm.length) });
  }
  // Sort: similarity first, then closer length (so options feel uniform)
  cands.sort((a, b) => (b.score - a.score) || (a.lengthDelta - b.lengthDelta));
  const out: string[] = [];
  const seen = new Set<string>([correctNorm]);
  for (const c of cands) {
    const k = normalizeConcept(c.term);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c.term);
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Rank sentence-shaped distractors:
 *   - prefer sentences that share at least one content token with the
 *     concept (so they're "in the neighbourhood")
 *   - but score lower if they overlap too closely with the correct sentence
 *   - cap by length similarity so we don't mix a 30-word and a 5-word option.
 */
export function rankDistractorSentences(
  candidates: string[],
  correct: string,
  concept: string,
  count: number,
): string[] {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const correctNorm = norm(correct);
  type Scored = { s: string; sim: number; lenDelta: number };
  const scored: Scored[] = [];
  for (const s of candidates) {
    const n = norm(s);
    if (n === correctNorm) continue;
    if (n.length < 25) continue;
    const conceptOverlap = termJaccard(s, concept);
    const correctOverlap = termJaccard(s, correct);
    const sim = conceptOverlap * 0.6 - correctOverlap * 0.4;
    if (sim <= 0) continue;
    scored.push({ s, sim, lenDelta: Math.abs(s.length - correct.length) });
  }
  scored.sort((a, b) => (b.sim - a.sim) || (a.lenDelta - b.lenDelta));
  return scored.slice(0, count).map((x) => x.s);
}

/**
 * Stable, deterministic option shuffling.
 *
 * The previous implementation used `Math.random` which (a) re-rendered the
 * options on every React render, breaking the user's reading flow, and (b)
 * had a bug where the MC variant always kept the correct answer at index 0
 * because we re-spread it as the first entry before shuffling the rest.
 *
 * We now derive a seed from the concept + the correct answer text so the
 * order is reproducible per question, and Fisher–Yates shuffle the *full*
 * options array (including the correct one).
 */
function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let state = seed >>> 0;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function buildMcQuizFromNotes(
  text: string,
  concept: string,
  glossary: GlossaryEntry[],
  lang: Lang,
): QuizDef | null {
  const excerpt = relevantExcerpt(text, concept, 10000);
  const sentences = splitSentences(excerpt).filter((s) => conceptRelevanceScore(s, concept) > 0.25);

  // Prefer cloze from glossary (P1 quality): pick the term most relevant to concept.
  const scopedTerms = glossary
    .map((g) => ({ g, rel: conceptRelevanceScore(g.term + ' ' + g.definition, concept) }))
    .filter((x) => x.rel > 0.2)
    .sort((a, b) => b.rel - a.rel)
    .slice(0, 5);
  for (const { g } of scopedTerms) {
    const escaped = g.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blanked = g.definition.replace(new RegExp(escaped, 'i'), '___');
    if (!blanked.includes('___') || blanked.length < 20) continue;
    const correct = g.term;
    const distractors = rankDistractorTerms(glossary, correct, 3);
    while (distractors.length < 3) {
      distractors.push(lang === 'el' ? 'Άσχετος όρος' : 'Unrelated term');
    }
    const options = [correct, ...distractors.slice(0, 3)];
    const shuffled = seededShuffle(options, seedFromString(`${concept}|${correct}`));
    return {
      question:
        lang === 'el'
          ? `Συμπλήρωσε τον όρο: ${blanked.slice(0, 120)}`
          : `Fill in the term: ${blanked.slice(0, 120)}`,
      options: shuffled,
      correctIndex: Math.max(0, shuffled.indexOf(correct)),
    };
  }

  if (sentences.length === 0) return null;

  const correct = sentences.sort((a, b) => b.length - a.length)[0]!;
  const question =
    lang === 'el'
      ? `Ποια πρόταση από τις σημειώσεις σου περιγράφει σωστά το «${concept}»;`
      : `Which statement from your notes best describes «${concept}»?`;

  const distractors: string[] = [];
  const otherDefs = glossary
    .filter((g) => g.definition && g.definition !== correct)
    .map((g) => `${g.term}: ${g.definition.slice(0, 90)}`);
  const nearGlossary = rankDistractorSentences(otherDefs, correct, concept, 2);
  distractors.push(...nearGlossary);
  const otherSentences = sentences.filter((s) => s !== correct).map((s) => s.slice(0, 120));
  const nearSentences = rankDistractorSentences(otherSentences, correct, concept, 3 - distractors.length);
  distractors.push(...nearSentences);

  while (distractors.length < 3) {
    distractors.push(
      lang === 'el' ? 'Δεν αναφέρεται στις σημειώσεις σου' : 'Not stated in your uploaded notes',
    );
  }

  const correctClipped = correct.slice(0, 140);
  const allOptions = [correctClipped, ...distractors.slice(0, 3).map((d) => d.slice(0, 140))];
  const shuffled = seededShuffle(allOptions, seedFromString(`${concept}|${correctClipped}`));
  const correctIndex = shuffled.indexOf(correctClipped);
  return { question, options: shuffled, correctIndex: correctIndex >= 0 ? correctIndex : 0 };
}

function buildMatchingQuizFromGlossary(
  glossary: GlossaryEntry[],
  concept: string,
  lang: Lang,
): QuizDef | null {
  const scoped = glossary
    .filter((g) => g.definition && g.definition.length >= 12)
    .map((g) => ({ g, rel: conceptRelevanceScore(g.term + ' ' + g.definition, concept) }))
    .filter((x) => x.rel > 0.15)
    .sort((a, b) => b.rel - a.rel)
    .slice(0, 4);
  if (scoped.length < 3) return null;

  const left = scoped.map(({ g }) => g.term.slice(0, 48));
  const right = scoped.map(({ g }) => g.definition.slice(0, 72));
  const shuffledRight = seededShuffle(right.map((r, i) => ({ r, i })), seedFromString(`${concept}|match`));
  const newRight = shuffledRight.map((x) => x.r);
  const pairs: [number, number][] = left.map((_, li) => {
    const origDef = right[li]!;
    const ri = newRight.indexOf(origDef);
    return [li, ri >= 0 ? ri : li];
  });

  return {
    kind: 'matching',
    question: lang === 'el'
      ? `Αντιστοίχισε τους όρους με τους ορισμούς από τις σημειώσεις σου για «${concept}».`
      : `Match each term to its definition from your notes on «${concept}».`,
    left,
    right: newRight,
    pairs,
  };
}

function buildOrderingQuizFromNotes(
  text: string,
  concept: string,
  lang: Lang,
): QuizDef | null {
  const excerpt = relevantExcerpt(text, concept, 12000);
  const sentences = splitSentences(excerpt)
    .filter((s) => s.length >= 40 && conceptRelevanceScore(s, concept) > 0.25)
    .slice(0, 4);
  if (sentences.length < 3) return null;

  const items = sentences.map((s) => s.slice(0, 100));
  const shuffledItems = seededShuffle(items, seedFromString(`${concept}|order`));
  const correctOrder = items.map((orig) => shuffledItems.indexOf(orig));

  return {
    kind: 'ordering',
    question: lang === 'el'
      ? `Βάλε τις προτάσεις από τις σημειώσεις σου στη σωστή λογική σειρά για «${concept}».`
      : `Put these sentences from your notes in the correct logical order for «${concept}».`,
    items: shuffledItems,
    correctOrder,
  };
}

function buildShortAnswerQuizFromGlossary(
  glossary: GlossaryEntry[],
  concept: string,
  lang: Lang,
): QuizDef | null {
  const hit = glossary
    .map((g) => ({ g, rel: conceptRelevanceScore(g.term + ' ' + g.definition, concept) }))
    .filter((x) => x.g.definition && x.g.definition.length >= 20 && x.rel > 0.25)
    .sort((a, b) => b.rel - a.rel)[0];
  if (!hit) return null;

  return {
    kind: 'short-answer',
    question: lang === 'el'
      ? `Ποιος όρος περιγράφεται: «${hit.g.definition.slice(0, 140)}»;`
      : `Which term is defined as: «${hit.g.definition.slice(0, 140)}»?`,
    acceptedAnswers: [hit.g.term, hit.g.term.toLowerCase()],
    hint: lang === 'el' ? 'Απάντησε με τον όρο από τις σημειώσεις σου.' : 'Answer with the term from your notes.',
  };
}

export function buildQuizFromNotes(
  text: string,
  concept: string,
  glossary: GlossaryEntry[],
  lang: Lang,
): QuizDef | null {
  const variant = seedFromString(`${concept}|quiz-kind`) % 4;
  const builders = [
    () => buildMatchingQuizFromGlossary(glossary, concept, lang),
    () => buildOrderingQuizFromNotes(text, concept, lang),
    () => buildShortAnswerQuizFromGlossary(glossary, concept, lang),
    () => buildMcQuizFromNotes(text, concept, glossary, lang),
  ];
  for (let i = 0; i < builders.length; i++) {
    const q = builders[(variant + i) % builders.length]!();
    if (q) return q;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Workspace step rail (from note sections)
 * ------------------------------------------------------------------ */

const STEP_TYPES_EN = ['Core Concept', 'Deep Dive', 'Key Insight', 'Practice', 'Quiz'];
const STEP_TYPES_EL = ['Βασική Έννοια', 'Εμβάθυνση', 'Βασική Ιδέα', 'Εξάσκηση', 'Κουίζ'];

/** Detect worked-example / numeric exercise sentences in the material. */
export function extractWorkedExamples(text: string, concept: string, max = 4): string[] {
  const excerpt = relevantExcerpt(text, concept, 14000);
  const markers = /\b(example|for instance|e\.g\.|suppose|given|calculate|solve|παράδειγμα|υποθέστε|δεδομέν|υπολογί)/i;
  return splitSentences(excerpt)
    .filter((s) => markers.test(s) && conceptRelevanceScore(s, concept) > 0.2)
    .slice(0, max);
}

export function buildWorkspaceStepsFromNotes(
  text: string,
  concept: string,
  lang: Lang,
): { title: string; type: string }[] | null {
  const excerpt = relevantExcerpt(text, concept, 16000);
  const sections = detectSections(excerpt).filter(
    (s) => conceptRelevanceScore((s.heading ?? '') + s.text, concept) > 0.2,
  );
  const types = lang === 'el' ? STEP_TYPES_EL : STEP_TYPES_EN;
  const quizStep = {
    title: lang === 'el' ? 'Έλεγχος Γνώσεων' : 'Knowledge Check',
    type: lang === 'el' ? 'Κουίζ' : 'Quiz',
  };

  if (sections.length >= 2) {
    const steps = sections.slice(0, 5).map((s, i) => ({
      title: (s.heading ?? titleCasePhrase(rankKeyphrases(s.text, 1)[0]?.phrase ?? concept)).slice(0, 42),
      type: types[Math.min(i, types.length - 2)] ?? types[0]!,
    }));
    const examples = extractWorkedExamples(excerpt, concept, 1);
    if (examples.length > 0 && steps.length < 5) {
      steps.push({
        title: (lang === 'el' ? 'Παράδειγμα: ' : 'Example: ') + examples[0]!.slice(0, 32) + '…',
        type: lang === 'el' ? 'Εξάσκηση' : 'Practice',
      });
    }
    return [...steps, quizStep];
  }

  const keyphrases = rankKeyphrases(excerpt, 5).filter((k) => conceptRelevanceScore(k.phrase, concept) > 0.1);
  if (keyphrases.length >= 2) {
    const steps = keyphrases.slice(0, 4).map((k, i) => ({
      title: titleCasePhrase(k.phrase).slice(0, 42),
      type: types[Math.min(i, types.length - 2)] ?? types[0]!,
    }));
    steps.push({
      title: lang === 'el' ? 'Εργαζόμενο Παράδειγμα' : 'Worked Example',
      type: lang === 'el' ? 'Εξάσκηση' : 'Practice',
    });
    return [...steps, quizStep];
  }

  const summaries = extractiveSummary(excerpt, 3, { biasTerms: [concept], leadBias: 0.1 });
  if (summaries.length >= 2) {
    return [
      ...summaries.slice(0, 4).map((s, i) => ({
        title: s.slice(0, 48) + (s.length > 48 ? '…' : ''),
        type: types[Math.min(i, types.length - 2)] ?? types[0]!,
      })),
      quizStep,
    ];
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Concept map from course outline
 * ------------------------------------------------------------------ */

export interface ConceptMapNode {
  id: string;
  label: string;
  mastery: number;
  type: 'concept' | 'formula' | 'definition' | 'theory';
  x: number;
  y: number;
  note?: string;
}

export interface ConceptMapEdge {
  from: string;
  to: string;
  relation: 'prerequisite' | 'related' | 'contrasts';
}

function slugify(label: string, i: number): string {
  const base = normalizeConcept(label).replace(/\s+/g, '-').slice(0, 24);
  return base || `n${i}`;
}

export function buildConceptMapFromCourse(
  topics: Topic[],
  glossary: GlossaryEntry[],
  conceptBars: { concept: string; mastery: number }[],
  focusConcept: string,
  sourceText?: string,
): { nodes: ConceptMapNode[]; edges: ConceptMapEdge[] } {
  if (topics.length === 0) {
    return { nodes: [], edges: [] };
  }

  const focusKey = normalizeConcept(focusConcept);
  const sorted = [...topics].sort((a, b) => a.order - b.order);
  const focusIdx = sorted.findIndex(
    (t) => normalizeConcept(t.title) === focusKey || conceptRelevanceScore(t.title, focusConcept) > 0.5,
  );
  const window = focusIdx >= 0
    ? sorted.slice(Math.max(0, focusIdx - 2), focusIdx + 4)
    : sorted.slice(0, 6);

  const nodes: ConceptMapNode[] = [];
  const idByTitle = new Map<string, string>();
  const cx = 320;
  const cy = 200;
  const radius = 140;

  window.forEach((t, i) => {
    const angle = (i / Math.max(window.length, 1)) * Math.PI * 1.6 - Math.PI * 0.3;
    const id = slugify(t.title, i);
    idByTitle.set(t.title, id);
    const match = conceptBars.find((b) => conceptRelevanceScore(b.concept, t.title) > 0.4);
    const isFocus = conceptRelevanceScore(t.title, focusConcept) > 0.45;
    nodes.push({
      id,
      label: t.title,
      type: 'concept',
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius * 0.7),
      mastery: match?.mastery ?? (isFocus ? 45 : 0),
      note: t.objectives?.[0]?.slice(0, 80),
    });
  });

  const edges: ConceptMapEdge[] = [];
  for (const t of window) {
    const toId = idByTitle.get(t.title);
    if (!toId) continue;
    for (const prereq of t.prerequisites ?? []) {
      const fromId = idByTitle.get(prereq);
      if (fromId && fromId !== toId) {
        edges.push({ from: fromId, to: toId, relation: 'prerequisite' });
      }
    }
  }

  // Add glossary terms linked to focus concept.
  const relatedTerms = glossary
    .filter((g) => conceptRelevanceScore(g.term + g.definition, focusConcept) > 0.25)
    .slice(0, 4);
  relatedTerms.forEach((g, i) => {
    const id = slugify(g.term, 100 + i);
    if (nodes.some((n) => n.id === id)) return;
    nodes.push({
      id,
      label: g.term,
      type: g.definition.includes('=') ? 'formula' : 'definition',
      x: 80 + i * 90,
      y: 360,
      mastery: 0,
      note: g.definition.slice(0, 60),
    });
    const focusNode = nodes.find((n) => conceptRelevanceScore(n.label, focusConcept) > 0.45);
    if (focusNode) edges.push({ from: focusNode.id, to: id, relation: 'related' });
  });

  if (sourceText?.trim()) {
    edges.push(...inferCooccurrenceEdges(sourceText, nodes, focusConcept, edges));
  }

  return { nodes, edges };
}

/**
 * Add `related` edges when node labels co-occur frequently in nearby
 * sentences. The previous implementation only checked the first occurrence
 * of each token (`indexOf`), so it would attach edges between any pair whose
 * first mentions happened to be in the same paragraph — even when the
 * concepts are unrelated elsewhere in the document.
 *
 * This rewrite slides a sentence window of size W=3 across the source and
 * counts how often each pair of node labels co-occur, then keeps only pairs
 * with a positive Pointwise Mutual Information (PMI) signal:
 *
 *     PMI(a,b) = log2( P(a,b) / (P(a) * P(b)) )
 *
 * The result: spurious "related" edges are suppressed, and pairs that
 * genuinely cluster in the text (e.g. "supply" & "demand", "force" &
 * "acceleration", "antibody" & "antigen") rise to the top.
 */
function inferCooccurrenceEdges(
  text: string,
  nodes: ConceptMapNode[],
  focusConcept: string,
  existing: ConceptMapEdge[],
): ConceptMapEdge[] {
  const excerpt = relevantExcerpt(text, focusConcept, 12000).toLowerCase();
  if (!excerpt.trim() || nodes.length < 2) return [];

  const sentences = splitSentences(excerpt);
  if (sentences.length < 2) return [];

  // Pre-compute, for each sentence, which nodes appear in it (label OR any of
  // its tokens, with the multi-word label treated as a phrase).
  const labelTokens = nodes.map((n) => ({ id: n.id, phrase: n.label.toLowerCase(), words: conceptWords(n.label) }));
  const presence: Set<string>[] = sentences.map((s) => {
    const lower = s.toLowerCase();
    const set = new Set<string>();
    for (const lt of labelTokens) {
      if (lt.phrase.length > 4 && lower.includes(lt.phrase)) {
        set.add(lt.id);
        continue;
      }
      // Require ≥ 1 of the multi-word label tokens present (drops 2-letter coincidences)
      if (lt.words.length === 0) continue;
      const hits = lt.words.filter((w) => w.length >= 4 && lower.includes(w)).length;
      if (hits >= Math.max(1, Math.ceil(lt.words.length / 2))) set.add(lt.id);
    }
    return set;
  });

  const W = 3; // sliding sentence window
  const total = Math.max(1, presence.length - W + 1);
  const single = new Map<string, number>();
  const pair = new Map<string, number>();
  for (let i = 0; i + W <= presence.length; i++) {
    const winSet = new Set<string>();
    for (let k = 0; k < W; k++) for (const id of presence[i + k]!) winSet.add(id);
    const ids = [...winSet];
    for (const id of ids) single.set(id, (single.get(id) ?? 0) + 1);
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const key = ids[a]! < ids[b]! ? `${ids[a]}|${ids[b]}` : `${ids[b]}|${ids[a]}`;
        pair.set(key, (pair.get(key) ?? 0) + 1);
      }
    }
  }

  const seen = new Set(existing.map((e) => `${e.from}|${e.to}|${e.relation}`));
  const out: ConceptMapEdge[] = [];
  type Scored = { a: string; b: string; pmi: number; count: number };
  const scored: Scored[] = [];
  for (const [pairKey, count] of pair) {
    if (count < 2) continue;
    const [a, b] = pairKey.split('|') as [string, string];
    const pa = (single.get(a) ?? 0) / total;
    const pb = (single.get(b) ?? 0) / total;
    const pab = count / total;
    if (pa === 0 || pb === 0) continue;
    const pmi = Math.log2(pab / (pa * pb));
    if (pmi <= 0) continue;
    scored.push({ a, b, pmi, count });
  }
  // Keep at most the top-N edges (cap to keep the map readable)
  scored.sort((x, y) => (y.pmi - x.pmi) || (y.count - x.count));
  const cap = Math.min(8, Math.max(3, Math.round(nodes.length * 0.6)));
  for (const s of scored.slice(0, cap)) {
    const key = `${s.a}|${s.b}|related`;
    const rev = `${s.b}|${s.a}|related`;
    if (seen.has(key) || seen.has(rev)) continue;
    seen.add(key);
    out.push({ from: s.a, to: s.b, relation: 'related' });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Debate tree from claims in notes
 * ------------------------------------------------------------------ */

export interface DebateNode {
  id: string;
  type: 'claim' | 'premise' | 'support' | 'refutation';
  text: string;
  x: number;
  y: number;
  expanded?: boolean;
  children?: DebateNode[];
}

/**
 * Claim mining heuristics.
 *
 * The previous implementation used a single "marker bag" per role and ranked
 * sentences only by concept-relevance — which conflated three different roles
 * (the central thesis, supporting evidence, and refuting counter-arguments)
 * and routinely picked the same sentence for both claim and premise.
 *
 * The new version scores each sentence on three independent axes and assigns
 * it to the role with the highest signal, with rule-based tie-breaking:
 *
 *   - **Claim score**: thesis/conclusion connectives ("therefore", "in
 *     conclusion", "we argue", "the main point", "άρα", "συνεπώς"…) and
 *     epistemic-strength modals ("must", "is", "always").
 *   - **Support score**: evidence connectives ("because", "since", "as
 *     shown by", "for example", "the data", "studies", "διότι", "επειδή"…)
 *     plus numerical density (citations / percentages / years).
 *   - **Refute score**: contrast connectives ("however", "but", "in
 *     contrast", "fails", "objection", "παρόλο", "αντιθέτως"…) and
 *     hedging modals ("may", "might", "rarely", "fails to").
 */
const CLAIM_CONNECTIVES = /\b(therefore|thus|hence|consequently|in conclusion|we (?:argue|claim|show|conclude)|the (?:key|main) point|overall|the central (?:claim|thesis)|άρα|συνεπώς|κατά συνέπεια|καταλήγουμε|υποστηρίζουμε|η κεντρική (?:θέση|ιδέα))\b/i;
const SUPPORT_CONNECTIVES = /\b(because|since|as shown by|for example|for instance|e\.?g\.?|evidence|the data|studies show|in particular|notably|specifically|διότι|επειδή|καθώς|όπως δείχνει|παράδειγμα|τα δεδομένα|μελέτες δείχνουν)\b/i;
const REFUTE_CONNECTIVES = /\b(however|but(?: also)?|although|yet|unless|except|on the contrary|in contrast|nevertheless|nonetheless|critics|objection|fails to|does not|cannot|μη|παρόλο|ωστόσο|αλλά|εν τούτοις|αντιθέτως|αντίθετα|εξαίρεση|αποτυγχάνει|δεν)\b/i;
const HEDGE_MODALS = /\b(may|might|could|sometimes|rarely|seldom|in some cases|μπορεί|ίσως|ενδεχομένως|σπάνια)\b/i;
const STRONG_MODALS = /\b(must|always|never|is|are|will|requires|θα|είναι|πάντα|ποτέ)\b/i;

interface DebateScore {
  sentence: string;
  claim: number;
  support: number;
  refute: number;
  rel: number;
}

function scoreDebateSentence(sentence: string, concept: string): DebateScore {
  const rel = conceptRelevanceScore(sentence, concept);
  const numericHits = (sentence.match(/\b\d+(?:\.\d+)?%?\b/g)?.length ?? 0);
  let claim = 0;
  let support = 0;
  let refute = 0;
  if (CLAIM_CONNECTIVES.test(sentence)) claim += 2;
  if (STRONG_MODALS.test(sentence)) claim += 0.5;
  if (SUPPORT_CONNECTIVES.test(sentence)) support += 2;
  if (numericHits > 0) support += Math.min(1.5, numericHits * 0.5);
  if (REFUTE_CONNECTIVES.test(sentence)) refute += 2;
  if (HEDGE_MODALS.test(sentence)) refute += 0.4;
  return { sentence, claim, support, refute, rel };
}

export function buildDebateTreeFromNotes(text: string, concept: string): DebateNode | null {
  const excerpt = relevantExcerpt(text, concept, 10000);
  const sentences = splitSentences(excerpt).filter((s) => conceptRelevanceScore(s, concept) > 0.2);
  if (sentences.length < 2) return null;

  const scored = sentences.map((s) => scoreDebateSentence(s, concept));

  // Pick the central claim: high claim-score + high concept relevance, but
  // only if such a sentence exists. Otherwise fall back to the most relevant
  // sentence so we don't return null on neutral / descriptive notes.
  const claimSentence =
    [...scored].sort((a, b) => b.claim * 1.5 + b.rel - (a.claim * 1.5 + a.rel))[0]!.sentence;

  const supports = scored
    .filter((s) => s.sentence !== claimSentence && s.support > 0.5 && s.refute < s.support)
    .sort((a, b) => b.support + b.rel * 0.5 - (a.support + a.rel * 0.5))
    .slice(0, 3)
    .map((s) => s.sentence);

  const refutations = scored
    .filter((s) => s.sentence !== claimSentence && s.refute > 0.5 && s.refute >= s.support)
    .sort((a, b) => b.refute + b.rel * 0.5 - (a.refute + a.rel * 0.5))
    .slice(0, 2)
    .map((s) => s.sentence);

  // If no explicit support/refute markers fired, pick neighbours by relevance
  // so the tree always has at least one premise per side when the corpus has
  // enough material.
  if (supports.length === 0) {
    const fallback = scored
      .filter((s) => s.sentence !== claimSentence)
      .sort((a, b) => b.rel - a.rel)
      .slice(0, 2)
      .map((s) => s.sentence);
    supports.push(...fallback);
  }

  const mk = (
    id: string,
    type: DebateNode['type'],
    label: string,
    x: number,
    y: number,
    children?: DebateNode[],
  ): DebateNode => ({
    id,
    type,
    text: label.slice(0, 160),
    x,
    y,
    expanded: true,
    children,
  });

  // Layout: claim at top, supports on the left subtree, refutations on the right.
  const supportNodes = supports.slice(0, 3).map((s, i) => mk(`s${i}`, 'support', s, 120 + i * 160, 250));
  const refuteNodes = refutations.slice(0, 2).map((r, i) => mk(`r${i}`, 'refutation', r, 480 + i * 160, 250));

  const premiseChildren: DebateNode[] = [];
  if (supportNodes.length > 0) {
    premiseChildren.push(mk('p-support', 'premise', 'Supporting evidence', 200, 150, supportNodes));
  }
  if (refuteNodes.length > 0) {
    premiseChildren.push(mk('p-refute', 'premise', 'Counter-arguments', 540, 150, refuteNodes));
  }

  return mk('root', 'claim', claimSentence, 360, 50, premiseChildren);
}

/* ------------------------------------------------------------------ *
 * Feynman + simulator helpers
 * ------------------------------------------------------------------ */

export function buildFeynmanOutline(
  topic: Topic | undefined,
  text: string,
  concept: string,
  lang: Lang,
): string[] {
  if (topic?.objectives?.length) return topic.objectives.slice(0, 5);
  if (topic?.keyConcepts?.length) {
    return topic.keyConcepts.map((c) =>
      lang === 'el' ? `Εξήγησε: ${c}` : `Explain: ${c}`,
    );
  }
  const phrases = rankKeyphrases(relevantExcerpt(text, concept, 8000), 4)
    .map((k) => titleCasePhrase(k.phrase));
  if (phrases.length > 0) {
    return phrases.map((p) => (lang === 'el' ? `Κάλυψε: ${p}` : `Cover: ${p}`));
  }
  return lang === 'el'
    ? [`Εξήγησε το «${concept}» με δικά σου λόγια`, 'Δώσε ένα παράδειγμα από τις σημειώσεις σου']
    : [`Explain «${concept}» in your own words`, 'Give an example from your notes'];
}

export function buildFeynmanGaps(glossary: GlossaryEntry[], concept: string, lang: Lang): string[] {
  const terms = glossary
    .filter((g) => conceptRelevanceScore(g.term, concept) > 0.2)
    .slice(0, 4)
    .map((g) => g.term);
  if (terms.length === 0) {
    return lang === 'el'
      ? [`Χρησιμοποίησε ακριβείς όροι από τις σημειώσεις για το «${concept}».`]
      : [`Use precise terms from your notes for «${concept}».`];
  }
  return lang === 'el'
    ? [`Να συμπεριλάβεις: ${terms.join(', ')}.`]
    : [`Include these terms from your material: ${terms.join(', ')}.`];
}

const ECON_SANDBOX =
  /\b(supply|demand|equilibrium|elasticity|price|quantity|προσφορ|ζήτησ|ισορροπ|ελαστικ|τιμή|ποσότητ)/i;

export function notesSupportEconomicsSandbox(text: string, concept: string): boolean {
  const excerpt = relevantExcerpt(text, concept, 6000);
  return ECON_SANDBOX.test(excerpt) || ECON_SANDBOX.test(concept);
}

export function sandboxInsightFromNotes(text: string, concept: string, lang: Lang): string {
  const excerpt = relevantExcerpt(text, concept, 4000);
  const summary = extractiveSummary(excerpt, 1, { biasTerms: [concept] })[0];
  if (summary) return summary.slice(0, 280);
  return lang === 'el'
    ? `Ρύθμισε τις παραμέτρους και σύνδεσέ τες με το «${concept}» όπως περιγράφεται στις σημειώσεις σου.`
    : `Adjust parameters and relate them to «${concept}» as described in your notes.`;
}
