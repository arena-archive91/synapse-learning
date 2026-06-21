/**
 * Grounded lesson generation.
 *
 * Given a concept and the learner's uploaded material, retrieves the most
 * relevant source chunks (BM25) and asks the LLM to write a structured,
 * multi-panel lesson *from that material*, returning blocks in the exact shape
 * the workspace already renders (`WorkspacePanel`). A citation `source` block
 * is appended to each panel so the learner can see where it came from.
 *
 * Returns null whenever grounding or generation isn't possible — the workspace
 * then falls back to the existing deterministic templates, so no functionality
 * is ever lost.
 */

import type { UploadedFile, UserSettings } from '../types';
import { chatCompletion, isLlmAvailable } from './llmClient';
import { retrieveSources, formatCitation } from './rag';
import { parseJsonLoose } from './courseGenerator';
import type { WorkspacePanel, WorkspacePanelBlock } from './workspaceLessonPanels';

interface RawBlock {
  kind?: string;
  text?: string;
  emphasis?: string;
  label?: string;
  formula?: string;
  title?: string;
  variant?: string;
  items?: unknown;
}

interface RawPanel {
  badge?: string;
  title?: string;
  blocks?: RawBlock[];
}

function asStringArray(v: unknown, max: number): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max)
    : [];
}

function normalizeBlock(raw: RawBlock, index: number): WorkspacePanelBlock | null {
  switch (raw.kind) {
    case 'paragraph':
      if (typeof raw.text !== 'string' || !raw.text.trim()) return null;
      return { kind: 'paragraph', text: raw.text.trim(), emphasis: raw.emphasis?.trim() || undefined };
    case 'cards': {
      const items = Array.isArray(raw.items)
        ? raw.items
            .map((it, i) => {
              const obj = (it ?? {}) as Record<string, unknown>;
              const title = typeof obj.title === 'string' ? obj.title.trim() : '';
              const bullets = asStringArray(obj.bullets, 6);
              if (!title || bullets.length === 0) return null;
              return { title, bullets, accent: (i % 2 === 0 ? 'brand' : 'teal') as 'brand' | 'teal' };
            })
            .filter((x): x is { title: string; bullets: string[]; accent: 'brand' | 'teal' } => x !== null)
            .slice(0, 3)
        : [];
      return items.length > 0 ? { kind: 'cards', items } : null;
    }
    case 'formula':
      if (typeof raw.formula !== 'string' || !raw.formula.trim()) return null;
      return { kind: 'formula', label: raw.label?.trim() || 'Formula', formula: raw.formula.trim() };
    case 'callout':
      if (typeof raw.text !== 'string' || !raw.text.trim()) return null;
      return {
        kind: 'callout',
        title: raw.title?.trim() || 'Note',
        text: raw.text.trim(),
        variant: raw.variant === 'warning' ? 'warning' : 'tip',
      };
    case 'steps': {
      const items = Array.isArray(raw.items)
        ? raw.items
            .map((it) => {
              const obj = (it ?? {}) as Record<string, unknown>;
              const label = typeof obj.label === 'string' ? obj.label.trim() : '';
              const content = typeof obj.content === 'string' ? obj.content.trim() : '';
              if (!label || !content) return null;
              return { label, content, success: obj.success === true };
            })
            .filter((x): x is { label: string; content: string; success: boolean } => x !== null)
            .slice(0, 6)
        : [];
      return items.length > 0 ? { kind: 'steps', items } : null;
    }
    default:
      // Tolerate a bare string-ish block by index — skip unknown kinds.
      return index === 0 && typeof raw.text === 'string' && raw.text.trim()
        ? { kind: 'paragraph', text: raw.text.trim() }
        : null;
  }
}

function normalizePanels(parsed: { panels?: RawPanel[] }, sourceLine: string): WorkspacePanel[] | null {
  const rawPanels = Array.isArray(parsed.panels) ? parsed.panels : [];
  if (rawPanels.length === 0) return null;

  const panels: WorkspacePanel[] = rawPanels
    .slice(0, 6)
    .map((p) => {
      const title = typeof p.title === 'string' ? p.title.trim() : '';
      if (!title) return null;
      const blocks = Array.isArray(p.blocks)
        ? p.blocks.map((b, i) => normalizeBlock(b, i)).filter((b): b is WorkspacePanelBlock => b !== null)
        : [];
      if (blocks.length === 0) return null;
      // Append a citation source block so provenance is always visible.
      blocks.push({ kind: 'source', text: `📖 ${sourceLine}` });
      return {
        badge: typeof p.badge === 'string' && p.badge.trim() ? p.badge.trim() : 'Lesson',
        title,
        blocks,
      } satisfies WorkspacePanel;
    })
    .filter((p): p is WorkspacePanel => p !== null);

  return panels.length > 0 ? panels : null;
}

/** Whether grounded generation is possible for the given settings/files. */
export function canGenerateGroundedLesson(files: UploadedFile[], settings?: UserSettings): boolean {
  if (!isLlmAvailable(settings)) return false;
  return files.some((f) => f.status === 'analyzed' && (f.extractedText?.trim().length ?? 0) > 120);
}

/**
 * Generate grounded lesson panels for a concept. Returns null on any failure
 * (no LLM, no sources, bad JSON) so the caller falls back to templates.
 */
export async function generateLessonPanels(
  concept: string,
  files: UploadedFile[],
  settings?: UserSettings,
  courseId?: string,
): Promise<WorkspacePanel[] | null> {
  if (!isLlmAvailable(settings)) return null;

  const retrieval = retrieveSources(files, concept, { concept, courseId, k: 6, maxChars: 5000 });
  if (!retrieval.grounded || !retrieval.excerpt) return null;

  const lang = settings?.language === 'el' ? 'Greek' : 'English';
  const strict = settings?.sourceMode === 'strict' || settings?.sourceMode === 'notes-only';
  const sourceLine = retrieval.citations.length > 0
    ? `Source: ${formatCitation(retrieval.citations[0]!)}`
    : 'Source: your uploaded material';

  const system = `You are an expert tutor writing an interactive lesson on "${concept}" from the learner's own material.
Respond in ${lang}. Output ONLY valid JSON (no prose, no code fences).
${strict ? 'Use ONLY facts present in the provided source excerpts. If the material is insufficient for a panel, write fewer panels rather than inventing content.' : 'Prioritize the provided source excerpts; you may lightly enrich with standard, well-established facts clearly consistent with them.'}
Produce 4-5 progressive panels following good pedagogy: Core Concept → Deep Dive(s) → Common Misconception → Worked Example.
JSON schema:
{
  "panels": [
    {
      "badge": string,   // e.g. "Core Concept", "Deep Dive", "Key Insight", "Practice"
      "title": string,
      "blocks": [
        { "kind": "paragraph", "text": string, "emphasis"?: string }
      | { "kind": "cards", "items": [ { "title": string, "bullets": string[] } ] }
      | { "kind": "formula", "label": string, "formula": string }
      | { "kind": "callout", "title": string, "text": string, "variant": "warning"|"tip" }
      | { "kind": "steps", "items": [ { "label": string, "content": string, "success"?: boolean } ] }
      ]
    }
  ]
}
Keep paragraphs concise (2-4 sentences). Include at least one worked example with "steps" when the topic is quantitative.`;

  const user = `Concept to teach: ${concept}

SOURCE EXCERPTS (cite-grounded):
"""
${retrieval.excerpt}
"""

Write the lesson panels now as specified.`;

  try {
    const raw = await chatCompletion(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      settings,
      { temperature: 0.4, maxTokens: 2000 },
    );
    const parsed = parseJsonLoose<{ panels?: RawPanel[] }>(raw);
    if (!parsed) return null;
    return normalizePanels(parsed, sourceLine);
  } catch {
    return null;
  }
}
