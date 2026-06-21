import { config } from '../config';

export interface UpstreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** Low-level POST to the upstream OpenAI-compatible API with the server key. */
export function upstreamFetch(path: string, body: unknown): Promise<Response> {
  return fetch(`${config.upstreamBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.upstreamApiKey}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Rough token estimate (~4 chars/token) used as a metering fallback when the
 * upstream response does not include a usage object (e.g. some stream configs).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
