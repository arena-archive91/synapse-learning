import { describe, expect, it } from 'vitest';
import {
  agglomerativeCluster,
  chooseClusterCount,
  cosineSimilarity,
  groupByCluster,
} from './embeddingCluster';

describe('embeddingCluster', () => {
  it('cosineSimilarity returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('chooseClusterCount scales with section count', () => {
    expect(chooseClusterCount(2)).toBe(2);
    expect(chooseClusterCount(16)).toBeGreaterThanOrEqual(3);
    expect(chooseClusterCount(16)).toBeLessThanOrEqual(8);
  });

  it('agglomerativeCluster assigns every index a label', () => {
    const embeddings = [
      [1, 0, 0],
      [0.9, 0.1, 0],
      [0, 1, 0],
      [0, 0.95, 0.05],
    ];
    const labels = agglomerativeCluster(embeddings, 2);
    expect(labels).toHaveLength(4);
    const groups = groupByCluster(labels);
    expect(groups.size).toBe(2);
    expect(labels[0]).toBe(labels[1]);
    expect(labels[2]).toBe(labels[3]);
  });
});
