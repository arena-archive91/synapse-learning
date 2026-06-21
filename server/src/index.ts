import express from 'express';
import cors from 'cors';
import { config } from './config';
import { runMigrations } from './db/migrate';
import { rateLimit } from './middleware/rateLimit';
import { authRouter } from './routes/auth';
import { proxyRouter } from './routes/proxy';
import { usageRouter } from './routes/usage';
import { libraryRouter } from './routes/library';
import { sessionRouter } from './routes/session';
import { youtubeRouter } from './routes/youtube';
import { billingWebhookHandler, billingRouter } from './routes/billing';
import { adminRouter } from './routes/admin';
import { nlpRouter } from './routes/nlp';
import { ragRouter } from './routes/rag';
import { teacherRouter } from './routes/teacher';
import { ocrRouter } from './routes/ocr';

const app = express();

app.use(
  cors({
    origin: config.allowedOrigins.includes('*') ? true : config.allowedOrigins,
    credentials: true,
  }),
);

app.post('/v1/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    upstream: config.upstreamBaseUrl,
    anonymous: config.allowAnonymous,
    database: Boolean(config.databaseUrl),
    features: {
      embeddings: Boolean(config.upstreamApiKey),
      rag: Boolean(config.upstreamApiKey),
      ner: true,
      refreshTokens: true,
      ocr: true,
      rateLimitRpm: config.rateLimitRpm,
    },
  });
});

app.use('/auth', authRouter);
app.use('/v1', rateLimit);
app.use('/v1', usageRouter);
app.use('/v1', libraryRouter);
app.use('/v1', sessionRouter);
app.use('/v1', youtubeRouter);
app.use('/v1', billingRouter);
app.use('/v1', adminRouter);
app.use('/v1', nlpRouter);
app.use('/v1', ragRouter);
app.use('/v1', ocrRouter);
app.use('/v1', teacherRouter);
app.use('/v1', proxyRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

async function main(): Promise<void> {
  if (config.databaseUrl && config.runMigrationsOnStart) {
    await runMigrations(config.databaseUrl);
  }

  app.listen(config.port, () => {
    console.log(`[synapse-proxy] listening on http://localhost:${config.port}`);
    console.log(`[synapse-proxy] upstream: ${config.upstreamBaseUrl} · anonymous: ${config.allowAnonymous}`);
    if (config.databaseUrl) {
      console.log(`[synapse-proxy] database: connected · migrations-on-start: ${config.runMigrationsOnStart}`);
    }
  });
}

main().catch((err) => {
  console.error('[synapse-proxy] failed to start:', err);
  process.exit(1);
});
