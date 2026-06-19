import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { computeCalibrationGap, computeReadiness } from '../lib/spacedRepetition';
import type { CalibrationPoint, ConceptMastery, LearnerActivity, LearnerModel } from '../types/learner';

const INITIAL_CONCEPTS: ConceptMastery[] = [
  { id: 'ref', label: 'Reference point', mastery: 82, confidence: 78, attempts: 12, correctFirstTry: 9, lastReviewDay: 5, nextDueDay: 8 },
  { id: 'loss', label: 'Loss aversion', mastery: 61, confidence: 42, attempts: 10, correctFirstTry: 5, lastReviewDay: 3, nextDueDay: 4 },
  { id: 'anchor', label: 'Anchoring', mastery: 74, confidence: 68, attempts: 11, correctFirstTry: 7, lastReviewDay: 4, nextDueDay: 6 },
  { id: 'frame', label: 'Framing effect', mastery: 49, confidence: 38, attempts: 9, correctFirstTry: 3, lastReviewDay: 2, nextDueDay: 2 },
  { id: 'choice', label: 'Choice architecture', mastery: 55, confidence: 52, attempts: 8, correctFirstTry: 4, lastReviewDay: 3, nextDueDay: 5 },
  { id: 'bias', label: 'Bias vs heuristic', mastery: 38, confidence: 35, attempts: 7, correctFirstTry: 2, lastReviewDay: 1, nextDueDay: 1 },
];

const INITIAL_CALIBRATION: CalibrationPoint[] = [
  { concept: 'Reference point', predicted: 85, actual: 82 },
  { concept: 'Loss aversion', predicted: 70, actual: 61 },
  { concept: 'Anchoring', predicted: 80, actual: 74 },
  { concept: 'Framing effect', predicted: 65, actual: 49 },
  { concept: 'Choice architecture', predicted: 60, actual: 55 },
];

const INITIAL_ACTIVITIES: LearnerActivity[] = [
  { id: 'a1', day: 1, type: 'quiz', label: 'First quiz — 4/8 correct', delta: -12 },
  { id: 'a2', day: 2, type: 'review', label: 'Spaced recall: loss aversion', delta: 6 },
  { id: 'a3', day: 3, type: 'error', label: 'Bias vs heuristic confused', delta: -8 },
  { id: 'a4', day: 4, type: 'mastery', label: 'Reference point stabilized', delta: 14 },
];

type LearnerModelContextValue = LearnerModel & {
  calibration: CalibrationPoint[];
  recordReview: (conceptId: string, correct: boolean, confidence: number) => void;
  addActivity: (activity: Omit<LearnerActivity, 'id'>) => void;
  getConcept: (id: string) => ConceptMastery | undefined;
};

const LearnerModelContext = createContext<LearnerModelContextValue | null>(null);

export function LearnerModelProvider({ children }: { children: ReactNode }) {
  const [concepts, setConcepts] = useState(INITIAL_CONCEPTS);
  const [calibration, setCalibration] = useState(INITIAL_CALIBRATION);
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES);

  const recordReview = useCallback((conceptId: string, correct: boolean, confidence: number) => {
    setConcepts((prev) =>
      prev.map((c) => {
        if (c.id !== conceptId) return c;
        const masteryDelta = correct ? Math.min(8, 100 - c.mastery) : -Math.min(12, c.mastery);
        return {
          ...c,
          mastery: Math.max(0, Math.min(100, c.mastery + masteryDelta)),
          confidence,
          attempts: c.attempts + 1,
          correctFirstTry: correct ? c.correctFirstTry + 1 : c.correctFirstTry,
          lastReviewDay: c.lastReviewDay + 1,
          nextDueDay: c.lastReviewDay + (correct ? 3 + Math.floor(confidence / 25) : 1),
        };
      }),
    );
    setCalibration((prev) =>
      prev.map((p) => {
        const concept = INITIAL_CONCEPTS.find((c) => c.id === conceptId);
        if (!concept || p.concept !== concept.label) return p;
        const actual = correct
          ? Math.min(100, p.actual + 5)
          : Math.max(0, p.actual - 7);
        return { ...p, predicted: confidence, actual };
      }),
    );
    setActivities((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        day: (prev[prev.length - 1]?.day ?? 0) + 1,
        type: correct ? 'review' : 'error',
        label: correct ? `Correct recall: ${conceptId}` : `Error on: ${conceptId}`,
        delta: correct ? 4 : -6,
      },
    ]);
  }, []);

  const addActivity = useCallback((activity: Omit<LearnerActivity, 'id'>) => {
    setActivities((prev) => [...prev, { ...activity, id: `a-${Date.now()}` }]);
  }, []);

  const value = useMemo<LearnerModelContextValue>(() => ({
    concepts,
    calibration,
    activities,
    readiness: computeReadiness(concepts),
    retention: Math.round(concepts.reduce((s, c) => s + c.mastery, 0) / concepts.length * 0.82),
    calibrationGap: computeCalibrationGap(calibration),
    recordReview,
    addActivity,
    getConcept: (id) => concepts.find((c) => c.id === id),
  }), [concepts, calibration, activities, recordReview, addActivity]);

  return (
    <LearnerModelContext.Provider value={value}>
      {children}
    </LearnerModelContext.Provider>
  );
}

export function useLearnerModel() {
  const ctx = useContext(LearnerModelContext);
  if (!ctx) throw new Error('useLearnerModel must be used within LearnerModelProvider');
  return ctx;
}
