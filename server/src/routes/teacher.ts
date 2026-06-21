import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getUsage } from '../store/accounts';
import { config } from '../config';
import { getLibraryAsync } from '../store/libraryStore';

export const teacherRouter = Router();
teacherRouter.use(authenticate);

/** GET /v1/teacher/dashboard — course + usage aggregates for instructor view. */
teacherRouter.get('/teacher/dashboard', async (req, res) => {
  const account = req.account!;
  const usage = getUsage(account);
  const quota = config.quotas[account.plan] ?? config.quotas.free;

  let courseCount = 0;
  let fileCount = 0;
  let topicCount = 0;

  try {
    const lib = await getLibraryAsync(account.id);
    const courses = lib.generatedCourses as { topics?: unknown[] }[];
    courseCount = courses.length;
    fileCount = lib.uploadedFiles.length;
    topicCount = courses.reduce((s, c) => s + (c.topics?.length ?? 0), 0);
  } catch {
    /* library optional */
  }

  res.json({
    account: { id: account.id, email: account.email, plan: account.plan },
    usage: {
      ...usage,
      quota,
      remainingTokens: Math.max(0, quota - usage.promptTokens - usage.completionTokens),
    },
    library: { courseCount, fileCount, topicCount },
    features: {
      embeddings: Boolean(config.upstreamApiKey),
      rag: Boolean(config.upstreamApiKey),
      ner: true,
      stripe: Boolean(config.stripeSecretKey),
    },
  });
});
