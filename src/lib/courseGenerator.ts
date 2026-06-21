/**
 * LLM-grounded course generation from uploaded material.
 *
 * Reads the *actual* extracted text (sampled across the whole document via the
 * RAG corpus) and asks the model to extract a real, structured outline:
 * subject, difficulty, topics with concepts + prerequisites, and a glossary.
 *
 * Every network path degrades gracefully: when no API key is configured, the
 * model errors, or the JSON can't be parsed, callers fall back to the existing
 * deterministic keyword templates — so nothing is ever lost.
 */

import type { UserSettings } from '../types';
import { chatCompletion, isLlmAvailable } from './llmClient';
import { chunkText } from './rag';

export interface GeneratedTopic {
  title: string;
  description: string;
  concepts: string[];
  prerequisites: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  /** Optional learning objectives synthesized from the topic's concepts. */
  objectives?: string[];
}

export interface GeneratedGlossaryEntry {
  term: string;
  definition: string;
}

export interface GeneratedOutline {
  title: string;
  subject: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  summary: string;
  topics: GeneratedTopic[];
  glossary: GeneratedGlossaryEntry[];
}

/**
 * Sample representative text across the whole document so the model sees the
 * breadth of the material, not just the first page. Evenly spaced chunks keep
 * the prompt within budget while covering intro → middle → conclusion.
 */
export function sampleDocumentText(text: string, maxChars = 9000): string {
  if (text.length <= maxChars) return text;
  const chunks = chunkText(text, 'sample', 'sample');
  if (chunks.length === 0) return text.slice(0, maxChars);

  const budgetPerChunk = Math.max(400, Math.floor(maxChars / Math.min(chunks.length, 12)));
  const stride = Math.max(1, Math.floor(chunks.length / 12));
  const picked: string[] = [];
  let used = 0;
  for (let i = 0; i < chunks.length && used < maxChars; i += stride) {
    const slice = chunks[i]!.text.slice(0, budgetPerChunk);
    picked.push(slice);
    used += slice.length;
  }
  return picked.join('\n\n…\n\n');
}

/** Tolerant JSON extraction: strips code fences and finds the outermost object. */
export function parseJsonLoose<T>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

function clampDifficulty(v: unknown): GeneratedTopic['difficulty'] {
  return v === 'beginner' || v === 'advanced' ? v : 'intermediate';
}

function clampCourseDifficulty(v: unknown): GeneratedOutline['difficulty'] {
  return v === 'beginner' || v === 'advanced' || v === 'mixed' ? v : 'intermediate';
}

/** Coerce a loosely-typed parsed object into a safe GeneratedOutline. */
function normalizeOutline(parsed: Record<string, unknown>, fallbackTitle: string): GeneratedOutline | null {
  const rawTopics = Array.isArray(parsed.topics) ? parsed.topics : [];
  if (rawTopics.length === 0) return null;

  const topics: GeneratedTopic[] = rawTopics
    .slice(0, 12)
    .map((t) => {
      const obj = (t ?? {}) as Record<string, unknown>;
      const title = typeof obj.title === 'string' ? obj.title.trim() : '';
      if (!title) return null;
      const concepts = Array.isArray(obj.concepts)
        ? obj.concepts.filter((c): c is string => typeof c === 'string').slice(0, 10)
        : [];
      const prerequisites = Array.isArray(obj.prerequisites)
        ? obj.prerequisites.filter((c): c is string => typeof c === 'string').slice(0, 6)
        : [];
      const estimatedMinutes =
        typeof obj.estimatedMinutes === 'number' && obj.estimatedMinutes > 0
          ? Math.min(120, Math.round(obj.estimatedMinutes))
          : 20;
      const objectives = Array.isArray(obj.objectives)
        ? obj.objectives.filter((c): c is string => typeof c === 'string').slice(0, 5)
        : undefined;
      return {
        title,
        description: typeof obj.description === 'string' ? obj.description.trim() : `Topic: ${title}`,
        concepts,
        prerequisites,
        difficulty: clampDifficulty(obj.difficulty),
        estimatedMinutes,
        ...(objectives && objectives.length > 0 ? { objectives } : {}),
      } satisfies GeneratedTopic;
    })
    .filter((t): t is GeneratedTopic => t !== null);

  if (topics.length === 0) return null;

  const glossary: GeneratedGlossaryEntry[] = Array.isArray(parsed.glossary)
    ? parsed.glossary
        .map((g) => {
          const obj = (g ?? {}) as Record<string, unknown>;
          const term = typeof obj.term === 'string' ? obj.term.trim() : '';
          const definition = typeof obj.definition === 'string' ? obj.definition.trim() : '';
          return term && definition ? { term, definition } : null;
        })
        .filter((g): g is GeneratedGlossaryEntry => g !== null)
        .slice(0, 30)
    : [];

  return {
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : fallbackTitle,
    subject: typeof parsed.subject === 'string' && parsed.subject.trim() ? parsed.subject.trim() : 'General',
    difficulty: clampCourseDifficulty(parsed.difficulty),
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    topics,
    glossary,
  };
}

/**
 * Generate a structured course outline from raw material via the LLM.
 * Returns null when no LLM is available or generation fails — caller should
 * fall back to the keyword template path. Source-grounded by construction:
 * the model is instructed to extract only what the material supports.
 */
export async function generateCourseOutline(
  text: string,
  fileNames: string[],
  settings?: UserSettings,
): Promise<GeneratedOutline | null> {
  if (!isLlmAvailable(settings) || !text || text.trim().length < 120) return null;

  const lang = settings?.language === 'el' ? 'Greek' : 'English';
  const strict = settings?.sourceMode === 'strict' || settings?.sourceMode === 'notes-only';
  const sample = sampleDocumentText(text);
  const fallbackTitle = fileNames[0]?.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') ?? 'Course';

  const system = `You are a curriculum architect. Analyze the learner's uploaded study material and extract a structured course outline.
Respond in ${lang}. Output ONLY valid JSON, no prose, no code fences.
${strict ? 'Extract ONLY topics and concepts actually present in the material. Do not invent content beyond it.' : 'Prioritize the material; you may lightly enrich with closely-related standard concepts.'}
JSON schema:
{
  "title": string,            // concise course title
  "subject": string,          // e.g. "Microeconomics", "Statistics", "Philosophy"
  "difficulty": "beginner"|"intermediate"|"advanced"|"mixed",
  "summary": string,          // 1-2 sentence overview
  "topics": [                 // 4-8 ordered modules, prerequisites first
    {
      "title": string,
      "description": string,  // one sentence
      "concepts": string[],   // 3-8 key concepts taught in this topic
      "prerequisites": string[], // topic titles that should come first (may be empty)
      "difficulty": "beginner"|"intermediate"|"advanced",
      "estimatedMinutes": number,
      "objectives": string[]  // 2-4 concrete learning objectives for this topic
    }
  ],
  "glossary": [ { "term": string, "definition": string } ]  // 6-20 key terms from the material
}`;

  const user = `Source files: ${fileNames.join(', ') || 'pasted notes'}.

MATERIAL (sampled across the document):
"""
${sample}
"""

Build the course outline as specified. Order topics so prerequisites come first.`;

  try {
    const raw = await chatCompletion(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      settings,
      { temperature: 0.3, maxTokens: 1800 },
    );
    const parsed = parseJsonLoose<Record<string, unknown>>(raw);
    if (!parsed) return null;
    return normalizeOutline(parsed, fallbackTitle);
  } catch {
    return null;
  }
}
