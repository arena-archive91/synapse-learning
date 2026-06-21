import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth';
import { extractVideoId, fetchYoutubeTranscriptText } from '../lib/youtubeCaptions';

export const youtubeRouter = Router();

youtubeRouter.get('/youtube/transcript', authenticate, async (req: Request, res: Response) => {
  try {
    const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!url) {
      res.status(400).json({ error: 'Missing url query parameter' });
      return;
    }
    const videoId = extractVideoId(url);
    if (!videoId) {
      res.status(400).json({ error: 'Invalid YouTube URL' });
      return;
    }
    const transcript = await fetchYoutubeTranscriptText(videoId);
    if (!transcript) {
      res.status(404).json({ error: 'No captions available for this video' });
      return;
    }
    res.json({ videoId, transcript });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Transcript fetch failed' });
  }
});
