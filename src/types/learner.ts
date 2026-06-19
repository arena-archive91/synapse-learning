export type ConceptMastery = {
  id: string;
  label: string;
  mastery: number;
  confidence: number;
  attempts: number;
  correctFirstTry: number;
  lastReviewDay: number;
  nextDueDay: number;
};

export type CalibrationPoint = {
  concept: string;
  predicted: number;
  actual: number;
};

export type LearnerActivity = {
  id: string;
  day: number;
  type: 'review' | 'quiz' | 'error' | 'mastery' | 'lesson';
  label: string;
  delta: number;
};

export type LearnerModel = {
  concepts: ConceptMastery[];
  readiness: number;
  retention: number;
  calibrationGap: number;
  activities: LearnerActivity[];
};
