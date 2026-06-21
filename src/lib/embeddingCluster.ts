/**
 * Embedding-space clustering primitives for semantic topic discovery.
 * Pure math — no imports from contentAnalysis (avoids circular deps).
 */

/** Cosine similarity between two dense vectors (0–1). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length !== a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

/** Pick cluster count from document size (sqrt heuristic, bounded 3–8). */
export function chooseClusterCount(sectionCount: number): number {
  if (sectionCount <= 2) return sectionCount;
  const heuristic = Math.round(Math.sqrt(sectionCount * 1.4));
  return Math.max(3, Math.min(8, heuristic, sectionCount));
}

/**
 * Agglomerative clustering with average linkage on cosine distance.
 * Returns cluster label (0..k-1) for each embedding index.
 */
export function agglomerativeCluster(embeddings: number[][], k: number): number[] {
  const n = embeddings.length;
  if (n === 0) return [];
  if (k >= n) return embeddings.map((_, i) => i);

  const labels = embeddings.map((_, i) => i);
  const clusterMembers = new Map<number, number[]>();
  for (let i = 0; i < n; i++) clusterMembers.set(i, [i]);

  const dist = (ca: number[], cb: number[]): number => {
    let sum = 0;
    for (const i of ca) {
      for (const j of cb) {
        sum += 1 - cosineSimilarity(embeddings[i]!, embeddings[j]!);
      }
    }
    return sum / (ca.length * cb.length);
  };

  while (clusterMembers.size > k) {
    let bestA = -1;
    let bestB = -1;
    let bestD = Infinity;
    const ids = [...clusterMembers.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const d = dist(clusterMembers.get(ids[i]!)!, clusterMembers.get(ids[j]!)!);
        if (d < bestD) {
          bestD = d;
          bestA = ids[i]!;
          bestB = ids[j]!;
        }
      }
    }
    if (bestA < 0 || bestB < 0) break;
    const merged = [...clusterMembers.get(bestA)!, ...clusterMembers.get(bestB)!];
    clusterMembers.delete(bestB);
    clusterMembers.set(bestA, merged);
    for (const idx of merged) labels[idx] = bestA;
  }

  const remap = new Map<number, number>();
  let cid = 0;
  return labels.map((l) => {
    if (!remap.has(l)) remap.set(l, cid++);
    return remap.get(l)!;
  });
}

/** Group indices by cluster label. */
export function groupByCluster(labels: number[]): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  labels.forEach((lab, idx) => {
    const arr = groups.get(lab) ?? [];
    arr.push(idx);
    groups.set(lab, arr);
  });
  return groups;
}

/** Index of the embedding closest to the cluster centroid (medoid proxy). */
export function medoidIndex(embeddings: number[][], indices: number[]): number {
  if (indices.length === 1) return indices[0]!;
  const vecs = indices.map((i) => embeddings[i]!);
  const c = vecs.reduce(
    (acc, v) => acc.map((x, i) => x + v[i]!),
    new Array<number>(vecs[0]!.length).fill(0),
  ).map((x) => x / vecs.length);

  let best = indices[0]!;
  let bestSim = -1;
  for (const i of indices) {
    const sim = cosineSimilarity(embeddings[i]!, c);
    if (sim > bestSim) {
      bestSim = sim;
      best = i;
    }
  }
  return best;
}
