import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceQuota } from '../middleware/usage';
import { addUsageAsync } from '../store/accounts';
import { retrieveTopK } from '../lib/ragServer';

export const ragRouter = Router();
ragRouter.use(authenticate, enforceQuota);

/** POST /v1/rag/query — semantic retrieval over client-supplied chunks. */
ragRouter.post('/rag/query', async (req, res) => {
  const account = req.account!;
  const body = req.body as {
    query?: string;
    chunks?: { id?: string; text?: string }[];
    topK?: number;
  };
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const topK = typeof body.topK === 'number' ? Math.min(20, Math.max(1, body.topK)) : 5;
  const chunks = (body.chunks ?? [])
    .filter((c) => typeof c.text === 'string' && c.text.trim().length > 0)
    .slice(0, 64)
    .map((c, i) => ({
      id: typeof c.id === 'string' ? c.id : `chunk-${i}`,
      text: c.text!.trim(),
    }));

  if (!query || chunks.length === 0) {
    res.status(400).json({ error: 'query and chunks required' });
    return;
  }

  try {
    const results = await retrieveTopK(query, chunks, topK);
    // Rough embedding cost estimate for metering.
    const estTokens = Math.ceil((query.length + chunks.reduce((s, c) => s + c.text.length, 0)) / 4);
    await addUsageAsync(account, estTokens, 0);
    res.json({ results });
  } catch {
    res.status(502).json({ error: 'RAG retrieval failed' });
  }
});
