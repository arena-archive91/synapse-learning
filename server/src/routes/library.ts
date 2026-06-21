import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getLibraryAsync, saveLibraryAsync, type StoredLibrary } from '../store/libraryStore';

export const libraryRouter = Router();

libraryRouter.get('/library', authenticate, async (req: Request, res: Response) => {
  try {
    const accountId = req.account!.id;
    res.json(await getLibraryAsync(accountId));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Library fetch failed' });
  }
});

libraryRouter.put('/library', authenticate, async (req: Request, res: Response) => {
  try {
    const accountId = req.account!.id;
    const body = req.body as Partial<StoredLibrary>;
    const saved = await saveLibraryAsync(accountId, {
      uploadedFiles: body.uploadedFiles ?? [],
      glossaryEntries: body.glossaryEntries ?? [],
      generatedCourses: body.generatedCourses ?? [],
    });
    res.json(saved);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Library save failed' });
  }
});
