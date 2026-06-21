import { upstreamFetch } from './upstream';

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d > 0 ? dot / d : 0;
}

export type RagChunk = { id: string; text: string };

export async function retrieveTopK(
  query: string,
  chunks: RagChunk[],
  k: number,
): Promise<Array<{ id: string; text: string; score: number }>> {
  if (chunks.length === 0 || !query.trim()) return [];

  const texts = [query, ...chunks.map((c) => c.text.slice(0, 2000))];
  const upstream = await upstreamFetch('/embeddings', {
    model: 'text-embedding-3-small',
    input: texts,
  });
  if (!upstream.ok) return chunks.slice(0, k).map((c, i) => ({ ...c, score: 1 - i * 0.01 }));

  const data = (await upstream.json()) as { data?: { embedding?: number[] }[] };
  const vectors = data.data?.map((d) => d.embedding ?? []) ?? [];
  if (vectors.length !== texts.length) return [];

  const qVec = vectors[0]!;
  const scored = chunks.map((c, i) => ({
    id: c.id,
    text: c.text,
    score: cosine(qVec, vectors[i + 1]!),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
