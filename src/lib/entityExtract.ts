/**
 * Lightweight NER for note-grounded concept mining (offline-first).
 * Combines definition patterns, acronyms, title-case phrases, and keyphrases.
 * Optional server augmentation via POST /v1/nlp/entities when proxy is configured.
 */

import type { UserSettings } from '../types';
import {
  extractAcronyms,
  extractDefinitions,
  normalizeConcept,
  rankKeyphrases,
  titleCasePhrase,
} from './contentAnalysis';

export type ExtractedEntity = {
  term: string;
  kind: 'definition' | 'acronym' | 'keyphrase' | 'proper';
  score: number;
  span?: string;
};

const PROPER_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;

function proxyBase(settings?: UserSettings): string | null {
  const p = settings?.llmProxyUrl?.trim() ?? settings?.authProxyBase?.trim();
  if (!p) return null;
  return p.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

/** Rule-based entity extraction — deterministic, no network. */
export function extractEntities(text: string, max = 40): ExtractedEntity[] {
  const clean = text.trim();
  if (clean.length < 40) return [];

  const byKey = new Map<string, ExtractedEntity>();

  const add = (term: string, kind: ExtractedEntity['kind'], score: number, span?: string) => {
    const display = titleCasePhrase(term.trim());
    const key = normalizeConcept(display);
    if (!key || key.length < 3) return;
    const prev = byKey.get(key);
    if (!prev || score > prev.score) {
      byKey.set(key, { term: display, kind, score, span });
    }
  };

  for (const d of extractDefinitions(clean, 20)) {
    add(d.term, 'definition', 0.95, d.definition.slice(0, 120));
  }
  for (const a of extractAcronyms(clean)) {
    add(a.term, 'acronym', 0.9, a.definition.slice(0, 80));
  }
  for (const { phrase, score } of rankKeyphrases(clean, 24)) {
    if (phrase.split(/\s+/).length >= 2) {
      add(phrase, 'keyphrase', 0.55 + score * 0.35);
    }
  }

  const properMatches = clean.matchAll(PROPER_RE);
  for (const m of properMatches) {
    const phrase = m[1]?.trim();
    if (phrase && phrase.length >= 4 && phrase.split(/\s+/).length <= 4) {
      add(phrase, 'proper', 0.65);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Merge server NER results when proxy + auth are available. */
export async function extractEntitiesEnriched(
  text: string,
  settings?: UserSettings,
  max = 40,
): Promise<ExtractedEntity[]> {
  const local = extractEntities(text, max);
  const base = proxyBase(settings);
  if (!base || text.length < 80) return local;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings?.authToken?.trim()) {
      headers.Authorization = `Bearer ${settings.authToken.trim()}`;
    }
    const res = await fetch(`${base}/v1/nlp/entities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: text.slice(0, 12000), max }),
    });
    if (!res.ok) return local;
    const data = (await res.json()) as { entities?: ExtractedEntity[] };
    if (!data.entities?.length) return local;

    const map = new Map(local.map((e) => [normalizeConcept(e.term), e]));
    for (const e of data.entities) {
      const key = normalizeConcept(e.term);
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || (e.score ?? 0.5) > prev.score) {
        map.set(key, { ...e, term: titleCasePhrase(e.term) });
      }
    }
    return [...map.values()].sort((a, b) => b.score - a.score).slice(0, max);
  } catch {
    return local;
  }
}
