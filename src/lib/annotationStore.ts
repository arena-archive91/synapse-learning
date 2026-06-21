import { loadJson, saveJson } from './persistence';

export type StoredAnnotation = {
  id: string;
  type: 'highlight' | 'comment' | 'pin';
  text: string;
  color: string;
  lineStart: number;
  lineEnd: number;
};

export function loadAnnotations(fileKey: string): StoredAnnotation[] {
  return loadJson<StoredAnnotation[]>(`annotations:${fileKey}`, []);
}

export function saveAnnotations(fileKey: string, items: StoredAnnotation[]): void {
  saveJson(`annotations:${fileKey}`, items);
}

export function pickSourceText(
  uploadedFiles: { name: string; extractedText?: string }[],
  fallback = '',
): { text: string; name: string; fileKey: string } {
  const withText = uploadedFiles.find((f) => f.extractedText && f.extractedText.trim().length > 50);
  if (withText?.extractedText) {
    return { text: withText.extractedText, name: withText.name, fileKey: withText.name };
  }
  return { text: fallback, name: '', fileKey: 'no-source' };
}
