import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getSessionAsync, saveSessionAsync, type StoredSession } from '../store/sessionStore';

export const sessionRouter = Router();

sessionRouter.get('/session', authenticate, async (req: Request, res: Response) => {
  try {
    res.json(await getSessionAsync(req.account!.id));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Session fetch failed' });
  }
});

sessionRouter.put('/session', authenticate, async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<StoredSession>;
    const saved = await saveSessionAsync(req.account!.id, {
      learnerModel: body.learnerModel ?? null,
      dashboardStats: body.dashboardStats ?? null,
      tasks: body.tasks ?? [],
      xp: typeof body.xp === 'number' ? body.xp : 0,
      betaMastery: body.betaMastery ?? [],
      firstAttemptKeys: body.firstAttemptKeys ?? [],
      openMistakes: body.openMistakes ?? [],
      activities: body.activities ?? [],
      userSettings: body.userSettings ?? null,
    });
    res.json(saved);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Session save failed' });
  }
});
