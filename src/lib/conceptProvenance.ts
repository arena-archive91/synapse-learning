/**
 * Sentence-level concept provenance: maps course concepts to precise spans
 * in uploaded source files (chunk + char offsets).
 */

import type { ConceptSpan, Course, MessageCitation, UploadedFile } from '../types';
import { normalizeConcept, splitSentences } from './contentAnalysis';
import { conceptSalience } from './conceptSectionBinding';
import { buildCorpusFromChunks, chunkText, retrieve, type SourceChunk } from './rag';

export function makeConceptId(courseId: string, concept: string): string {
  const slug = normalizeConcept(concept).replace(/\s+/g, '-').slice(0, 48);
  return `concept-${courseId.slice(-10)}-${slug}`;
}

function findSentenceSpan(
  chunk: SourceChunk,
  concept: string,
): { charStart: number; charEnd: number; sentence: string } {
  const sentences = splitSentences(chunk.text);
  let cursor = 0;
  for (const sent of sentences) {
    const idx = chunk.text.indexOf(sent, cursor);
    if (idx < 0) continue;
    if (conceptSalience(concept, sent) >= 0.22) {
      return {
        charStart: chunk.charStart + idx,
        charEnd: chunk.charStart + idx + sent.length,
        sentence: sent.trim(),
      };
    }
    cursor = idx + sent.length;
  }
  return {
    charStart: chunk.charStart,
    charEnd: Math.min(chunk.charEnd, chunk.charStart + 280),
    sentence: chunk.text.slice(0, 220).trim(),
  };
}

/**
 * Build sentence-level provenance for each unique concept label.
 * Uses BM25 chunk retrieval + salience filter within the winning chunk.
 */
export function buildConceptSpans(
  files: UploadedFile[],
  concepts: string[],
  courseId: string,
): ConceptSpan[] {
  const relevant = files.filter((f) => (f.extractedText?.trim().length ?? 0) > 80);
  if (relevant.length === 0 || concepts.length === 0) return [];

  const spans: ConceptSpan[] = [];
  const seen = new Set<string>();

  for (const concept of concepts) {
    const norm = normalizeConcept(concept);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);

    let best: ConceptSpan | null = null;
    let bestScore = 0;

    for (const file of relevant) {
      const text = file.extractedText!.trim();
      const chunks = chunkText(text, file.id, file.name);
      const corpus = buildCorpusFromChunks(chunks);
      const hits = retrieve(concept, corpus, 4);

      for (const hit of hits) {
        const sal = conceptSalience(concept, hit.chunk.text);
        const score = sal * 0.7 + (hit.score / Math.max(hits[0]?.score ?? 1, 1e-9)) * 0.3;
        if (score <= bestScore) continue;
        const sent = findSentenceSpan(hit.chunk, concept);
        bestScore = score;
        best = {
          conceptId: makeConceptId(courseId, concept),
          concept,
          chunkId: hit.chunk.id,
          fileId: file.id,
          fileName: file.name,
          charStart: sent.charStart,
          charEnd: sent.charEnd,
          sentence: sent.sentence,
          page: hit.chunk.page,
          heading: hit.chunk.heading,
        };
      }
    }

    if (best && bestScore >= 0.15) spans.push(best);
  }

  return spans;
}

export function findConceptSpan(course: Course | undefined, concept: string): ConceptSpan | undefined {
  if (!course?.conceptSpans?.length) return undefined;
  const key = normalizeConcept(concept);
  return course.conceptSpans.find((s) => normalizeConcept(s.concept) === key);
}

export function spanFromCitation(c: MessageCitation): Pick<ConceptSpan, 'fileId' | 'charStart' | 'charEnd'> {
  return { fileId: c.fileId, charStart: c.charStart, charEnd: c.charEnd };
}

export type SourceHighlight = Pick<ConceptSpan, 'fileId' | 'charStart' | 'charEnd'>;

export function resolveReaderText(
  files: UploadedFile[],
  highlight: SourceHighlight | null | undefined,
  fallback: string,
): string {
  if (!highlight) return fallback;
  const file = files.find((f) => f.id === highlight.fileId);
  return file?.extractedText?.trim() || fallback;
}
