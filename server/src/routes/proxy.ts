import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceQuota } from '../middleware/usage';
import { addUsageAsync } from '../store/accounts';
import { estimateTokens, upstreamFetch, type UpstreamUsage } from '../lib/upstream';

export const proxyRouter = Router();
proxyRouter.use(authenticate, enforceQuota);

/** POST /v1/chat/completions — supports both streaming (SSE) and JSON. */
proxyRouter.post('/chat/completions', async (req, res) => {
  const account = req.account!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const wantsStream = body.stream === true;

  // Ask the upstream to include token usage in the final stream chunk.
  if (wantsStream) body.stream_options = { include_usage: true };

  let upstream: Response;
  try {
    upstream = await upstreamFetch('/chat/completions', body);
  } catch {
    res.status(502).json({ error: 'Upstream request failed' });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    res.status(upstream.status || 502).json({ error: 'Upstream error', detail: text.slice(0, 500) });
    return;
  }

  if (!wantsStream) {
    const data = (await upstream.json()) as { usage?: UpstreamUsage };
    const u = data.usage ?? {};
    await addUsageAsync(account, u.prompt_tokens ?? 0, u.completion_tokens ?? 0);
    res.json(data);
    return;
  }

  // Stream passthrough: pipe SSE to the client while sniffing the usage chunk.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: UpstreamUsage | null = null;
  let completionChars = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      res.write(text);
      buffer += text;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload) as {
            usage?: UpstreamUsage;
            choices?: { delta?: { content?: string } }[];
          };
          if (parsed.usage) usage = parsed.usage;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) completionChars += delta.length;
        } catch {
          /* ignore non-JSON keep-alives */
        }
      }
    }
  } catch {
    /* client disconnected or upstream aborted */
  } finally {
    res.end();
    if (usage) {
      await addUsageAsync(account, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0);
    } else {
      // Fallback estimate when the upstream omitted a usage object.
      await addUsageAsync(account, 0, estimateTokens(' '.repeat(completionChars)));
    }
  }
});

/** POST /v1/embeddings — proxied with usage metering. */
proxyRouter.post('/embeddings', async (req, res) => {
  const account = req.account!;
  let upstream: Response;
  try {
    upstream = await upstreamFetch('/embeddings', req.body);
  } catch {
    res.status(502).json({ error: 'Upstream request failed' });
    return;
  }
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    res.status(upstream.status || 502).json({ error: 'Upstream error', detail: text.slice(0, 500) });
    return;
  }
  const data = (await upstream.json()) as { usage?: UpstreamUsage };
  await addUsageAsync(account, data.usage?.prompt_tokens ?? 0, 0);
  res.json(data);
});
