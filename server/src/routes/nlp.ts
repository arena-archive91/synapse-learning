import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { extractEntitiesHybrid } from '../lib/ner';

export const nlpRouter = Router();
nlpRouter.use(authenticate);

/** POST /v1/nlp/entities — hybrid NER for note content. */
nlpRouter.post('/nlp/entities', async (req, res) => {
  const body = req.body as { text?: string; max?: number };
  const text = typeof body.text === 'string' ? body.text : '';
  const max = typeof body.max === 'number' ? Math.min(50, Math.max(1, body.max)) : 30;
  if (text.trim().length < 20) {
    res.status(400).json({ error: 'text too short' });
    return;
  }
  try {
    const entities = await extractEntitiesHybrid(text, max);
    res.json({ entities });
  } catch {
    res.status(502).json({ error: 'Entity extraction failed' });
  }
});
