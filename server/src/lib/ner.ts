/**
 * Server-side NER: rule-based extraction with optional LLM enrichment.
 */

import { config } from '../config';
import { upstreamFetch } from './upstream';

const DEF_RE =
  /\b([A-ZΑ-Ω][\w\- ]{2,48}?)\s+(?:is|are|refers to|means|defined as|είναι|ορίζεται)\s+([^.\n]{12,180})/giu;
const ACRONYM_RE = /\b([A-ZΑ-Ω][\w\- ]{2,60}?)\s*\(([A-Z]{2,8})\)/g;

export type NerEntity = {
  term: string;
  kind: 'definition' | 'acronym' | 'proper' | 'keyphrase';
  score: number;
  span?: string;
};

export function extractEntitiesRuleBased(text: string, max = 30): NerEntity[] {
  const clean = text.slice(0, 12000);
  const map = new Map<string, NerEntity>();

  const add = (term: string, kind: NerEntity['kind'], score: number, span?: string) => {
    const t = term.trim().replace(/\s+/g, ' ');
    if (t.length < 3) return;
    const key = t.toLowerCase();
    const prev = map.get(key);
    if (!prev || score > prev.score) map.set(key, { term: t, kind, score, span });
  };

  for (const m of clean.matchAll(DEF_RE)) {
    add(m[1]!, 'definition', 0.92, m[2]?.trim().slice(0, 120));
  }
  for (const m of clean.matchAll(ACRONYM_RE)) {
    add(m[1]!, 'acronym', 0.88, m[2]);
  }

  const proper = clean.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) ?? [];
  for (const p of proper.slice(0, 20)) add(p, 'proper', 0.6);

  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

const VALID_KINDS = new Set<NerEntity['kind']>(['definition', 'acronym', 'proper', 'keyphrase']);

function mergeEntities(base: NerEntity[], extra: NerEntity[], max: number): NerEntity[] {
  const map = new Map<string, NerEntity>();
  for (const e of base) map.set(e.term.toLowerCase(), e);
  for (const e of extra) {
    const key = e.term.toLowerCase();
    const prev = map.get(key);
    if (!prev || e.score > prev.score) map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/** LLM structured extraction when OPENAI_API_KEY is configured. */
export async function extractEntitiesLlm(text: string, max = 30): Promise<NerEntity[] | null> {
  if (!config.upstreamApiKey.trim()) return null;

  const clean = text.slice(0, 8000);
  const upstream = await upstreamFetch('/chat/completions', {
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Extract educational entities from the text. Return JSON: {"entities":[{"term":"...","kind":"definition|acronym|proper|keyphrase","score":0.0-1.0,"span":"optional short context"}]}. Prefer definitions, acronyms, and domain terms.',
      },
      { role: 'user', content: clean },
    ],
  });
  if (!upstream.ok) return null;

  const payload = (await upstream.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { entities?: unknown[] };
    const entities: NerEntity[] = [];
    for (const item of parsed.entities ?? []) {
      if (typeof item !== 'object' || item === null) continue;
      const row = item as Record<string, unknown>;
      const term = typeof row.term === 'string' ? row.term.trim() : '';
      const kind = typeof row.kind === 'string' ? row.kind : 'keyphrase';
      const score = typeof row.score === 'number' ? row.score : 0.7;
      const span = typeof row.span === 'string' ? row.span.slice(0, 120) : undefined;
      if (term.length < 3 || !VALID_KINDS.has(kind as NerEntity['kind'])) continue;
      entities.push({ term, kind: kind as NerEntity['kind'], score, span });
    }
    return entities.slice(0, max);
  } catch {
    return null;
  }
}

/** Hybrid NER: rule-based baseline merged with LLM entities when available. */
export async function extractEntitiesHybrid(text: string, max = 30): Promise<NerEntity[]> {
  const rule = extractEntitiesRuleBased(text, max);
  const llm = await extractEntitiesLlm(text, max);
  return llm?.length ? mergeEntities(rule, llm, max) : rule;
}
