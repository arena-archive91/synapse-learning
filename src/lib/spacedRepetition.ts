/** SM-2 inspired interval with confidence modulation (days until next review). */
export function computeNextInterval(box: number, confidence: number, streak: number): number {
  const base = [1, 2, 4, 7, 14, 21][Math.min(box, 5)] ?? 21;
  const confidenceFactor = confidence >= 80 ? 1.25 : confidence >= 60 ? 1.0 : confidence >= 40 ? 0.85 : 0.65;
  const streakBonus = Math.min(streak * 0.15, 0.6);
  return Math.max(1, Math.round(base * confidenceFactor * (1 + streakBonus)));
}

export function computeReadiness(concepts: { mastery: number; confidence: number }[]): number {
  if (concepts.length === 0) return 0;
  const weighted = concepts.reduce(
    (sum, c) => sum + c.mastery * 0.7 + c.confidence * 0.3,
    0,
  );
  return Math.round(weighted / concepts.length);
}

export function computeCalibrationGap(points: { predicted: number; actual: number }[]): number {
  if (points.length === 0) return 0;
  const gap = points.reduce((sum, p) => sum + Math.abs(p.predicted - p.actual), 0) / points.length;
  return Math.round(gap);
}
