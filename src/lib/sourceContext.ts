import type { UploadedFile, UserSettings } from '../types';
import { ragQuery } from './authClient';
import { retrieveSources, retrieveAndRerank, type Citation, type RetrievalResult, type RetrievedChunk } from './rag';
import { embedTexts, isLlmAvailable } from './llmClient';

function isServerProxyConfigured(settings?: UserSettings): boolean {
  return !!(settings?.llmProxyUrl?.trim() || settings?.authProxyBase?.trim());
}

const MAX_EXCERPT = 3500;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * Semantic reranker: embeds the query + candidate chunks and blends cosine
 * similarity (0.5) with normalized lexical BM25 (0.5). Returns the candidates
 * unchanged if embeddings are unavailable — so retrieval always degrades to
 * pure lexical without error.
 */
/**
 * Server-side semantic rerank via POST /v1/rag/query — keeps embeddings off the
 * client and meters usage through the Phase 6 proxy.
 */
function serverRagReranker(settings: UserSettings) {
  return async (query: string, hits: RetrievedChunk[]): Promise<RetrievedChunk[]> => {
    if (hits.length === 0) return hits;
    const chunks = hits.map((h) => ({
      id: h.chunk.id,
      text: h.chunk.text.slice(0, 2000),
    }));
    try {
      const { results } = await ragQuery(settings.authToken, settings, query, chunks, hits.length);
      const byId = new Map(hits.map((h) => [h.chunk.id, h]));
      const reranked = results
        .map((r) => {
          const hit = byId.get(r.id);
          return hit ? { chunk: hit.chunk, score: r.score } : null;
        })
        .filter((h): h is RetrievedChunk => h !== null);
      return reranked.length > 0 ? reranked : hits;
    } catch {
      return hits;
    }
  };
}

function embeddingReranker(settings?: UserSettings) {
  return async (query: string, hits: RetrievedChunk[]): Promise<RetrievedChunk[]> => {
    if (!isLlmAvailable(settings)) return hits;
    const texts = [query, ...hits.map((h) => h.chunk.text.slice(0, 800))];
    const emb = await embedTexts(texts, settings);
    if (!emb || emb.length !== texts.length) return hits;
    const q = emb[0]!;
    const maxLex = Math.max(...hits.map((h) => h.score), 1e-9);
    return hits
      .map((h, i) => ({
        chunk: h.chunk,
        score: 0.5 * (h.score / maxLex) + 0.5 * Math.max(0, cosine(q, emb[i + 1]!)),
      }))
      .sort((a, b) => b.score - a.score);
  };
}

/**
 * Backward-compatible excerpt builder. Now backed by BM25 retrieval instead of
 * a naive `indexOf` slice: returns the most relevant chunks for `concept`,
 * each prefixed with its citation. Falls back to the document opening when the
 * concept matches nothing.
 */
export function buildSourceExcerpt(
  files: UploadedFile[],
  concept?: string,
  courseId?: string,
): string | undefined {
  const result = retrieveSources(files, concept ?? '', {
    concept,
    courseId,
    k: 4,
    maxChars: MAX_EXCERPT,
  });
  return result.excerpt;
}

/**
 * Query-aware retrieval for the agent: ranks against the user's actual message
 * (widened by the active concept) and returns excerpt + structured citations.
 */
export function retrieveForQuery(
  files: UploadedFile[],
  query: string,
  opts: { concept?: string; courseId?: string; k?: number } = {},
): RetrievalResult {
  return retrieveSources(files, query, {
    concept: opts.concept,
    courseId: opts.courseId,
    k: opts.k ?? 4,
    maxChars: MAX_EXCERPT,
  });
}

/**
 * Hybrid query retrieval: wide BM25 candidate set reranked by semantic
 * embeddings when an LLM/embeddings endpoint is configured; otherwise identical
 * to lexical `retrieveForQuery`. Async because embedding is a network call.
 */
export async function retrieveForQueryHybrid(
  files: UploadedFile[],
  query: string,
  settings?: UserSettings,
  opts: { concept?: string; courseId?: string; k?: number } = {},
): Promise<RetrievalResult> {
  const rerankOpts = {
    concept: opts.concept,
    courseId: opts.courseId,
    k: opts.k ?? 4,
    maxChars: MAX_EXCERPT,
  };

  if (settings && isServerProxyConfigured(settings)) {
    return retrieveAndRerank(files, query, rerankOpts, serverRagReranker(settings));
  }

  return retrieveAndRerank(
    files,
    query,
    rerankOpts,
    isLlmAvailable(settings) ? embeddingReranker(settings) : undefined,
  );
}

export function shouldGroundInSources(settings?: UserSettings): boolean {
  return settings?.sourceMode !== 'enriched';
}

export type { Citation, RetrievalResult };
