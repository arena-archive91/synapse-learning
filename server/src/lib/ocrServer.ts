import Tesseract from 'tesseract.js';
import { config } from '../config';

export async function ocrBase64Pages(
  pages: string[],
  languages = 'eng+ell',
): Promise<{ text: string; pagesProcessed: number }> {
  const slice = pages.slice(0, config.ocrMaxPages).filter((p) => typeof p === 'string' && p.length > 0);
  if (slice.length === 0) return { text: '', pagesProcessed: 0 };

  const worker = await Tesseract.createWorker(languages);
  try {
    const parts: string[] = [];
    for (const page of slice) {
      const buf = Buffer.from(page, 'base64');
      const { data } = await worker.recognize(buf);
      const text = data.text.trim();
      if (text) parts.push(text);
    }
    return { text: parts.join('\n\f\n'), pagesProcessed: slice.length };
  } finally {
    await worker.terminate();
  }
}
