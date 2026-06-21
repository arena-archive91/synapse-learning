/**
 * Source-intelligence layer (client-side, offline-capable).
 *
 * Turns raw extracted document text into retrievable, citable chunks and ranks
 * them against a query with a BM25 scorer. This is the substrate the rest of
 * the platform builds on: grounded agent answers, precise "show me where this
 * came from" citations, and LLM lesson generation that reads the real material
 * instead of falling back to demo templates.
 *
 * Everything here is deterministic and runs without a network connection.
 * Semantic (embedding-based) retrieval can layer on top later via `scoreFn`.
 */

import type { UploadedFile } from '../types';

/** A retrievable unit of source material with precise provenance. */
export interface SourceChunk {
  /** Stable id: `${fileId}#${index}`. */
  id: string;
  fileId: string;
  fileName: string;
  /** Order of this chunk within its file (0-based). */
  index: number;
  /** The chunk's text content. */
  text: string;
  /** Character offset of the chunk start within the file's full extracted text. */
  charStart: number;
  /** Character offset of the chunk end (exclusive). */
  charEnd: number;
  /** Best-effort 1-based page number when page markers are available. */
  page?: number;
  /** Nearest preceding heading-like line, when detectable. */
  heading?: string;
}

/** A chunk paired with its relevance score for a given query. */
export interface RetrievedChunk {
  chunk: SourceChunk;
  score: number;
}

/** Human + machine readable citation for a retrieved chunk. */
export interface Citation {
  chunkId: string;
  fileId: string;
  fileName: string;
  /** e.g. "¶4" — section/paragraph index within the file. */
  locator: string;
  charStart: number;
  charEnd: number;
  page?: number;
  heading?: string;
  /** Short snippet for previews. */
  snippet: string;
}

/** A prepared, scorable corpus over a set of files. */
export interface Corpus {
  /** Signature used to invalidate the module cache. */
  signature: string;
  chunks: SourceChunk[];
  /** Cached lowercased tokens per chunk (index-aligned with `chunks`). */
  chunkTokens: string[][];
  /** Document frequency per token across the corpus. */
  docFreq: Map<string, number>;
  /** Average chunk length in tokens (BM25 normalization). */
  avgLen: number;
}

const TARGET_CHARS = 900;
const OVERLAP_CHARS = 160;
const MIN_CHUNK_CHARS = 60;

/** Greek + English stopwords kept short on purpose — BM25 IDF handles the rest. */
export const STOPWORDS = new Set<string>([
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those',
  'it', 'its', 'as', 'at', 'by', 'with', 'from', 'we', 'you', 'they', 'he', 'she',
  'i', 'not', 'no', 'so', 'if', 'then', 'than', 'can', 'will', 'would', 'should',
  // Greek
  'και', 'ή', 'το', 'τα', 'τη', 'την', 'της', 'τον', 'τους', 'των', 'ο', 'η',
  'οι', 'ένα', 'μια', 'ένας', 'στο', 'στη', 'στην', 'στις', 'στους', 'με', 'σε',
  'για', 'από', 'που', 'ως', 'είναι', 'ήταν', 'θα', 'να', 'δεν', 'αν', 'αλλά',
]);

const TOKEN_RE = /[\p{L}\p{N}]+/gu;

/** Lowercase, unicode-aware tokenization with stopword + length filtering. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const matches = text.toLowerCase().matchAll(TOKEN_RE);
  for (const m of matches) {
    const tok = m[0];
    if (tok.length < 2) continue;
    if (STOPWORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

/** Heuristic: is this line a heading (short, no terminal period, not a list item)? */
export function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  if (/^#{1,6}\s+\S/.test(trimmed)) return true;
  if (/[.:;,]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 12) return false;
  const isUpperish = trimmed === trimmed.toUpperCase() && /[A-ZΑ-Ω]/.test(trimmed);
  const isTitleish = /^[A-ZΑ-Ω0-9]/.test(trimmed) && words.length <= 8;
  const isNumbered = /^(\d+(\.\d+)*|chapter|κεφάλαιο|section|ενότητα)\b/i.test(trimmed);
  return isUpperish || isTitleish || isNumbered;
}

/**
 * Split a document's full text into overlapping, offset-tracked chunks.
 * Paragraph-aware: accumulates paragraphs up to ~TARGET_CHARS, carrying a small
 * overlap into the next chunk so context isn't severed mid-idea. Tracks the
 * nearest preceding heading and a best-effort page number (form-feed markers).
 */
export function chunkText(text: string, fileId: string, fileName: string): SourceChunk[] {
  if (!text || !text.trim()) return [];

  const chunks: SourceChunk[] = [];
  // Normalize CRLF, keep offsets meaningful against the normalized string.
  const normalized = text.replace(/\r\n/g, '\n');

  // Page tracking: pdf/pptx extractors join pages with blank lines; treat
  // explicit form-feeds (\f) as hard page breaks when present.
  const hasFormFeeds = normalized.includes('\f');

  let cursor = 0;
  let index = 0;
  let currentHeading: string | undefined;
  let page = 1;

  const pushChunk = (chunkStart: number, chunkEnd: number, heading?: string, pageNo?: number) => {
    const slice = normalized.slice(chunkStart, chunkEnd).trim();
    if (slice.length < MIN_CHUNK_CHARS && chunks.length > 0) return;
    if (slice.length === 0) return;
    chunks.push({
      id: `${fileId}#${index}`,
      fileId,
      fileName,
      index,
      text: slice,
      charStart: chunkStart,
      charEnd: chunkEnd,
      page: pageNo,
      heading,
    });
    index += 1;
  };

  while (cursor < normalized.length) {
    let end = Math.min(cursor + TARGET_CHARS, normalized.length);

    // Prefer to break on a paragraph or sentence boundary near the target.
    if (end < normalized.length) {
      const window = normalized.slice(cursor, end);
      const lastPara = window.lastIndexOf('\n\n');
      const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'));
      const breakAt = lastPara > TARGET_CHARS * 0.5
        ? lastPara
        : lastSentence > TARGET_CHARS * 0.5
          ? lastSentence + 1
          : -1;
      if (breakAt > 0) end = cursor + breakAt;
    }

    // Capture nearest heading inside this slice for citation context.
    const lines = normalized.slice(cursor, end).split('\n');
    for (const line of lines) {
      if (looksLikeHeading(line)) currentHeading = line.trim();
    }
    if (hasFormFeeds) {
      page += (normalized.slice(cursor, end).match(/\f/g)?.length ?? 0);
    }

    pushChunk(cursor, end, currentHeading, hasFormFeeds ? page : undefined);

    if (end >= normalized.length) break;
    // Advance with overlap, but always make forward progress.
    cursor = Math.max(end - OVERLAP_CHARS, cursor + MIN_CHUNK_CHARS);
  }

  return chunks;
}

/** Stable signature so the corpus cache invalidates when files change. */
function corpusSignature(files: { id: string; extractedText?: string }[]): string {
  return files
    .filter((f) => f.extractedText && f.extractedText.trim().length > 0)
    .map((f) => `${f.id}:${f.extractedText!.length}`)
    .sort()
    .join('|');
}

/** Build a scorable corpus from chunks (computes token cache + IDF stats). */
export function buildCorpusFromChunks(chunks: SourceChunk[], signature = ''): Corpus {
  const chunkTokens = chunks.map((c) => tokenize(c.text));
  const docFreq = new Map<string, number>();
  let totalLen = 0;
  for (const tokens of chunkTokens) {
    totalLen += tokens.length;
    for (const tok of new Set(tokens)) {
      docFreq.set(tok, (docFreq.get(tok) ?? 0) + 1);
    }
  }
  return {
    signature,
    chunks,
    chunkTokens,
    docFreq,
    avgLen: chunkTokens.length > 0 ? totalLen / chunkTokens.length : 0,
  };
}

let corpusCache: Corpus | null = null;

/**
 * Build (or return cached) corpus for the analyzed uploaded files.
 * Optionally restrict to a single course.
 */
export function getCorpus(files: UploadedFile[], courseId?: string): Corpus {
  const relevant = files.filter(
    (f) =>
      f.status === 'analyzed' &&
      f.extractedText &&
      f.extractedText.trim().length > 0 &&
      (!courseId || f.courseId === courseId),
  );

  const signature = `${courseId ?? 'all'}::${corpusSignature(relevant)}`;
  if (corpusCache && corpusCache.signature === signature) return corpusCache;

  const chunks: SourceChunk[] = [];
  for (const f of relevant) {
    chunks.push(...chunkText(f.extractedText!, f.id, f.name));
  }
  corpusCache = buildCorpusFromChunks(chunks, signature);
  return corpusCache;
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

/** Inverse document frequency with the BM25 (probabilistic) formulation. */
function idf(docFreq: number, totalDocs: number): number {
  return Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));
}

/**
 * Rank corpus chunks against a query with BM25. Returns the top `k` scoring
 * chunks (score > 0) sorted descending. Fully deterministic and offline.
 */
export function retrieve(query: string, corpus: Corpus, k = 4): RetrievedChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || corpus.chunks.length === 0) return [];

  const totalDocs = corpus.chunks.length;
  const queryTermCounts = new Map<string, number>();
  for (const tok of queryTokens) {
    queryTermCounts.set(tok, (queryTermCounts.get(tok) ?? 0) + 1);
  }

  const scored: RetrievedChunk[] = corpus.chunks.map((chunk, i) => {
    const tokens = corpus.chunkTokens[i]!;
    const len = tokens.length || 1;
    const termFreq = new Map<string, number>();
    for (const tok of tokens) termFreq.set(tok, (termFreq.get(tok) ?? 0) + 1);

    let score = 0;
    for (const [term] of queryTermCounts) {
      const tf = termFreq.get(term);
      if (!tf) continue;
      const df = corpus.docFreq.get(term) ?? 0;
      const termIdf = idf(df, totalDocs);
      const denom = tf + BM25_K1 * (1 - BM25_B + BM25_B * (len / (corpus.avgLen || 1)));
      score += termIdf * ((tf * (BM25_K1 + 1)) / denom);
    }
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Build a citation object from a chunk (used for "show me where this came from"). */
export function toCitation(chunk: SourceChunk): Citation {
  const snippet = chunk.text.length > 160 ? `${chunk.text.slice(0, 157)}…` : chunk.text;
  const locator = chunk.page ? `p.${chunk.page}` : `¶${chunk.index + 1}`;
  return {
    chunkId: chunk.id,
    fileId: chunk.fileId,
    fileName: chunk.fileName,
    locator,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    page: chunk.page,
    heading: chunk.heading,
    snippet,
  };
}

/** Compact one-line reference, e.g. "Notes.pdf · ¶4 · Elasticity". */
export function formatCitation(c: Citation): string {
  const parts = [c.fileName, c.locator];
  if (c.heading) parts.push(c.heading);
  return parts.join(' · ');
}

export interface RetrievalResult {
  /** Concatenated, citation-headed excerpt ready to inject into an LLM prompt. */
  excerpt?: string;
  /** Structured citations for UI surfacing. */
  citations: Citation[];
  /** Whether any grounded material was found. */
  grounded: boolean;
}

/**
 * High-level retrieval: query the corpus over the given files and return a
 * prompt-ready excerpt plus structured citations. Used by the agent and the
 * lesson generator. `concept` widens the query when the user's text is terse.
 */
export function retrieveSources(
  files: UploadedFile[],
  query: string,
  opts: { concept?: string; courseId?: string; k?: number; maxChars?: number } = {},
): RetrievalResult {
  const { concept, courseId, k = 4, maxChars = 3500 } = opts;
  const corpus = getCorpus(files, courseId);
  if (corpus.chunks.length === 0) return { citations: [], grounded: false };

  const fullQuery = [query, concept].filter(Boolean).join(' ');
  let hits = retrieve(fullQuery, corpus, k);

  // Fallback: if the query matched nothing, surface the opening chunks so the
  // model still has source context to work from.
  if (hits.length === 0) {
    hits = corpus.chunks.slice(0, Math.min(k, 2)).map((chunk) => ({ chunk, score: 0 }));
  }

  return buildRetrievalResult(hits, maxChars);
}

/** Assemble a citation-headed excerpt + structured citations from ranked hits. */
function buildRetrievalResult(hits: RetrievedChunk[], maxChars: number): RetrievalResult {
  const citations: Citation[] = [];
  const blocks: string[] = [];
  let used = 0;
  for (const { chunk } of hits) {
    const citation = toCitation(chunk);
    const header = `[${formatCitation(citation)}]`;
    const block = `${header}\n${chunk.text}`;
    if (used + block.length > maxChars && blocks.length > 0) break;
    blocks.push(block);
    citations.push(citation);
    used += block.length;
  }

  return {
    excerpt: blocks.length > 0 ? blocks.join('\n\n') : undefined,
    citations,
    grounded: blocks.length > 0,
  };
}

/**
 * A reranker reorders lexical candidates using an external signal (e.g. semantic
 * embeddings). Injected by callers so this module stays fully offline/pure.
 */
export type Reranker = (query: string, hits: RetrievedChunk[]) => Promise<RetrievedChunk[]>;

/**
 * Hybrid retrieval: fetch a wide lexical candidate set (BM25), optionally rerank
 * it semantically via the injected `reranker`, then build the top-k excerpt.
 * Degrades to pure lexical when no reranker is supplied or it fails.
 */
export async function retrieveAndRerank(
  files: UploadedFile[],
  query: string,
  opts: { concept?: string; courseId?: string; k?: number; maxChars?: number; candidateMultiplier?: number } = {},
  reranker?: Reranker,
): Promise<RetrievalResult> {
  const { concept, courseId, k = 4, maxChars = 3500, candidateMultiplier = 4 } = opts;
  const corpus = getCorpus(files, courseId);
  if (corpus.chunks.length === 0) return { citations: [], grounded: false };

  const fullQuery = [query, concept].filter(Boolean).join(' ');
  let hits = retrieve(fullQuery, corpus, Math.max(k, k * candidateMultiplier));
  if (hits.length === 0) {
    hits = corpus.chunks.slice(0, Math.min(k, 2)).map((chunk) => ({ chunk, score: 0 }));
  }

  if (reranker && hits.length > 1) {
    try {
      hits = await reranker(fullQuery, hits);
    } catch {
      /* keep lexical ordering on failure */
    }
  }

  return buildRetrievalResult(hits.slice(0, k), maxChars);
}

/** Clear the module corpus cache (e.g. after deleting files). */
export function invalidateCorpus(): void {
  corpusCache = null;
}
