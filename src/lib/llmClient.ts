import type { AgentMode, UserSettings } from '../types';
import { agentTonePrefix } from './settingsEffects';
import { generateFeynmanCoachFeedback, type CoachFeedback } from './feynmanCoach';
import type { RubricDimension, RubricScores } from './feynmanRubric';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE = 'https://api.openai.com/v1';
const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';

export function resolveApiKey(settings?: UserSettings): string | null {
  const fromSettings = settings?.openaiApiKey?.trim();
  if (fromSettings) return fromSettings;
  const fromEnv = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim();
  return fromEnv || null;
}

/**
 * Phase 6 hook: a managed/self-hosted proxy holds the key server-side, so the
 * browser needs no key — only the proxy URL. When `llmProxyUrl` is set, requests
 * route there and the Authorization header is omitted (the proxy injects it).
 */
function proxyUrl(settings?: UserSettings): string | null {
  const p = settings?.llmProxyUrl?.trim();
  return p ? p.replace(/\/$/, '') : null;
}

export function isLlmAvailable(settings?: UserSettings): boolean {
  if (settings?.useLlm === false) return false;
  return !!resolveApiKey(settings) || !!proxyUrl(settings);
}

function baseUrl(settings?: UserSettings): string {
  return proxyUrl(settings) || settings?.llmBaseUrl?.replace(/\/$/, '') || DEFAULT_BASE;
}

/** Auth header — proxy JWT when logged in, else direct API key. */
function authHeaders(settings?: UserSettings): Record<string, string> {
  if (settings?.authToken?.trim()) {
    return { Authorization: `Bearer ${settings.authToken.trim()}` };
  }
  if (proxyUrl(settings)) return {};
  const key = resolveApiKey(settings);
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/**
 * Embed texts via the OpenAI-compatible /embeddings endpoint. Returns null when
 * unavailable or on any failure, so callers degrade to lexical retrieval.
 */
export async function embedTexts(texts: string[], settings?: UserSettings): Promise<number[][] | null> {
  if (!isLlmAvailable(settings) || texts.length === 0) return null;
  try {
    const res = await fetch(`${baseUrl(settings)}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
      body: JSON.stringify({ model: DEFAULT_EMBED_MODEL, input: texts }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { embedding?: number[] }[] };
    const out = data.data?.map((d) => d.embedding ?? []);
    return out && out.length === texts.length && out.every((e) => e.length > 0) ? out : null;
  } catch {
    return null;
  }
}

function model(settings?: UserSettings): string {
  return settings?.llmModel?.trim() || DEFAULT_MODEL;
}

export async function chatCompletion(
  messages: ChatMessage[],
  settings?: UserSettings,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  if (!isLlmAvailable(settings)) throw new Error('No API key or proxy configured');

  const res = await fetch(`${baseUrl(settings)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(settings),
    },
    body: JSON.stringify({
      model: model(settings),
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 900,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${errBody.slice(0, 200) || res.statusText}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty LLM response');
  return content;
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  settings: UserSettings | undefined,
  onDelta: (chunk: string, fullText: string) => void,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  if (!isLlmAvailable(settings)) throw new Error('No API key or proxy configured');

  const res = await fetch(`${baseUrl(settings)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(settings),
    },
    body: JSON.stringify({
      model: model(settings),
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 900,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${errBody.slice(0, 200) || res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const chunk = parsed.choices?.[0]?.delta?.content ?? '';
        if (chunk) {
          full += chunk;
          onDelta(chunk, full);
        }
      } catch {
        /* skip malformed SSE chunk */
      }
    }
  }

  if (!full.trim()) throw new Error('Empty LLM response');
  return full.trim();
}

const MODE_SYSTEM: Record<AgentMode, string> = {
  socratic: 'You are a Socratic tutor. Ask guiding questions; do not give the full answer immediately.',
  direct: 'You are a clear, concise tutor. Give structured explanations with numbered steps.',
  beginner: 'You teach beginners with plain language, analogies, and encouragement.',
  'exam-coach': 'You are an exam coach. Focus on likely question formats, model answers, and common traps.',
  'deep-theory': 'You provide rigorous theory: definitions, assumptions, mechanisms, edge cases.',
  practical: 'You focus on hands-on practice, code/data steps, and debugging guidance.',
  'error-diagnosis': 'You diagnose learning errors: conceptual vs procedural vs recall.',
  feynman: 'You run Feynman checks: ask the learner to explain simply and highlight gaps.',
  debate: 'You facilitate critical debate with counter-arguments and evidence.',
  'oral-exam': 'You simulate an oral exam professor: short, challenging, time-boxed prompts.',
  'math-tutor': 'You tutor math step-by-step, verifying each algebraic step.',
  'coding-tutor': 'You tutor programming with minimal fixes and one follow-up exercise.',
  'writing-coach': 'You coach academic writing: structure, clarity, and argument flow.',
  'memory-coach': 'You run retrieval practice and spaced-repetition scheduling advice.',
  motivation: 'You give small, actionable next steps to build study momentum.',
};

function buildAgentSystemPrompt(
  mode: AgentMode,
  settings?: UserSettings,
  context?: {
    taskTitle?: string;
    concept?: string;
    courses?: string[];
    sourceExcerpt?: string;
  },
): string {
  const lang = settings?.language === 'el' ? 'Greek' : 'English';
  const tone = settings ? agentTonePrefix(settings) : '';
  const strictSources = settings?.sourceMode === 'strict' || settings?.sourceMode === 'notes-only';
  const sourceBlock = context?.sourceExcerpt
    ? `\nLearner material excerpt (prioritize this${strictSources ? ' — do not invent facts beyond it' : ''}):\n---\n${context.sourceExcerpt}\n---`
    : '';
  return `${MODE_SYSTEM[mode] ?? MODE_SYSTEM.direct}
Respond in ${lang}. ${tone}
Keep responses under 250 words unless the user asks for depth.
${context?.concept ? `Current concept: ${context.concept}.` : ''}
${context?.taskTitle ? `Active task: ${context.taskTitle}.` : ''}${sourceBlock}`;
}

function offlineAgentReply(input: string, mode: AgentMode): string {
  const topic = input.length > 60 ? `${input.slice(0, 60)}…` : input;
  const responses: Partial<Record<AgentMode, string>> = {
    socratic: `You asked about **"${topic}"**.\n\nBefore I explain directly: **what do you already know?** What would you predict if one variable changes?\n\nName your assumptions — I'll guide you through your own reasoning.`,
    direct: `**Direct explanation** for "${topic}":\n\n1. Identify core variables\n2. Apply the relevant framework\n3. Check boundary conditions\n\nWant a practice question to verify understanding?`,
    feynman: `**Feynman check** for "${topic}":\n\nExplain it in 2–3 sentences as if teaching a friend. I'll highlight gaps in mechanism, example, and contrast.`,
  };
  return responses[mode] ?? responses.direct!;
}

export async function streamAgentReply(
  input: string,
  mode: AgentMode,
  settings: UserSettings | undefined,
  context: {
    taskTitle?: string;
    concept?: string;
    courses?: string[];
    sourceExcerpt?: string;
  } | undefined,
  onDelta: (fullText: string) => void,
): Promise<{ content: string; usedLlm: boolean; sourceGrounded: boolean }> {
  const sourceGrounded = !!context?.sourceExcerpt;
  if (!isLlmAvailable(settings)) {
    const content = offlineAgentReply(input, mode);
    onDelta(content);
    return { content, usedLlm: false, sourceGrounded };
  }

  const system = buildAgentSystemPrompt(mode, settings, context);
  try {
    const content = await streamChatCompletion(
      [
        { role: 'system', content: system },
        { role: 'user', content: input },
      ],
      settings,
      (_chunk, full) => onDelta(full),
    );
    return { content, usedLlm: true, sourceGrounded };
  } catch {
    const content = offlineAgentReply(input, mode);
    onDelta(content);
    return { content, usedLlm: false, sourceGrounded };
  }
}

export async function generateAgentReply(
  input: string,
  mode: AgentMode,
  settings?: UserSettings,
  context?: {
    taskTitle?: string;
    concept?: string;
    courses?: string[];
    sourceExcerpt?: string;
  },
): Promise<{ content: string; usedLlm: boolean; sourceGrounded: boolean }> {
  const sourceGrounded = !!context?.sourceExcerpt;
  if (!isLlmAvailable(settings)) {
    return { content: offlineAgentReply(input, mode), usedLlm: false, sourceGrounded };
  }

  const system = buildAgentSystemPrompt(mode, settings, context);

  try {
    const content = await chatCompletion(
      [
        { role: 'system', content: system },
        { role: 'user', content: input },
      ],
      settings,
    );
    return { content, usedLlm: true, sourceGrounded };
  } catch {
    return { content: offlineAgentReply(input, mode), usedLlm: false, sourceGrounded };
  }
}

export async function generateFeynmanCoachFeedbackAsync(
  text: string,
  scores: RubricScores,
  weakDims: RubricDimension[],
  concept: string,
  settings?: UserSettings,
  referenceNotes?: string,
): Promise<{ feedback: CoachFeedback; usedLlm: boolean }> {
  const offline = generateFeynmanCoachFeedback(text, scores, weakDims, concept, settings, referenceNotes);

  if (!isLlmAvailable(settings) || text.trim().split(/\s+/).length < 8) {
    return { feedback: offline, usedLlm: false };
  }

  const lang = settings?.language === 'el' ? 'Greek' : 'English';
  const tone = settings ? agentTonePrefix(settings) : '';
  const avg = Math.round(
    (scores.accuracy + scores.completeness + scores.simplicity + scores.structure) / 4,
  );

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `${tone}You are a Feynman technique coach for "${concept}". Respond in ${lang}.
Format:
HEADLINE: one line with score ${avg}%
STRENGTHS: bullet list (2-3 items)
IMPROVE: bullet list (2-3 actionable items)
REWRITE: optional improved 3-sentence explanation (only if score < 78)
NEXT: one concrete next step`,
        },
        {
          role: 'user',
          content: `Learner explanation (${avg}% rubric: accuracy ${scores.accuracy}, completeness ${scores.completeness}, simplicity ${scores.simplicity}, structure ${scores.structure}):\n\n${text}${referenceNotes?.trim() ? `\n\nReference notes excerpt:\n${referenceNotes.slice(0, 1200)}` : ''}`,
        },
      ],
      settings,
      { temperature: 0.5, maxTokens: 700 },
    );

    return { feedback: parseFeynmanLlmResponse(raw, offline), usedLlm: true };
  } catch {
    return { feedback: offline, usedLlm: false };
  }
}

function parseFeynmanLlmResponse(raw: string, fallback: CoachFeedback): CoachFeedback {
  const section = (label: string) => {
    const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`, 'i');
    const m = raw.match(re);
    return m?.[1]?.trim() ?? '';
  };

  const headline = section('HEADLINE') || fallback.headline;
  const strengthsBlock = section('STRENGTHS');
  const improveBlock = section('IMPROVE');
  const rewrite = section('REWRITE');
  const nextStep = section('NEXT') || fallback.nextStep;

  const bullets = (block: string) =>
    block
      .split('\n')
      .map((l) => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);

  const strengths = bullets(strengthsBlock);
  const improvements = bullets(improveBlock);

  return {
    headline,
    overallScore: fallback.overallScore,
    strengths: strengths.length > 0 ? strengths : fallback.strengths,
    improvements: improvements.length > 0 ? improvements : fallback.improvements,
    rewrite: rewrite || fallback.rewrite,
    nextStep,
  };
}
