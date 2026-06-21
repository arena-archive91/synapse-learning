// Core domain types for Synapse — Adaptive AI Tutoring Platform

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'student' | 'teacher' | 'self-learner' | 'corporate';
  segment: 'university' | 'highschool' | 'selflearner' | 'tutor' | 'company';
  streak: number;
  xp: number;
  level: number;
  joinedAt: string;
  onboardingComplete: boolean;
  settings: UserSettings;
}

export interface UserSettings {
  questionFrequency: 'minimal' | 'moderate' | 'frequent';
  explanationDepth: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  practiceIntensity: 'light' | 'moderate' | 'intense';
  theoryVsPractice: number; // 0=all theory, 100=all practice
  exampleDensity: 'fewer' | 'moderate' | 'many';
  diagramFrequency: 'minimal' | 'moderate' | 'rich';
  teachingStyle: 'socratic' | 'direct' | 'mixed';
  pacing: 'slow' | 'moderate' | 'fast';
  feedbackTone: 'gentle' | 'balanced' | 'strict';
  lessonLength: 'short' | 'medium' | 'long';
  revisionLoops: 'fewer' | 'moderate' | 'more';
  masteryThreshold: number; // 0-100
  challengeLevel: 'low-stress' | 'balanced' | 'high-challenge';
  sourceMode: 'strict' | 'enriched' | 'notes-only';
  language: 'en' | 'el';
  theme: 'dark' | 'light' | 'system';
  dailyGoalMinutes: number;
  examDate?: string;
  /** OpenAI-compatible API key (stored locally). Falls back to VITE_OPENAI_API_KEY. */
  openaiApiKey?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  /** Managed/self-hosted LLM proxy URL (holds the key server-side). */
  llmProxyUrl?: string;
  useLlm?: boolean;
  /** Managed proxy auth token from /auth/login */
  authToken?: string;
  authEmail?: string;
  authProxyBase?: string;
  /** Plan tier from managed proxy (/auth/me). */
  authPlan?: 'free' | 'pro' | 'team';
  /** When true, show seeded demo courses/tasks (MVP showcase). Default: false. */
  showDemoContent?: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: FileType;
  size: number;
  uploadedAt: string;
  status: 'uploading' | 'processing' | 'analyzed' | 'error';
  progress?: number;
  courseId?: string;
  extractedTopics?: string[];
  extractedText?: string;
  pageCount?: number;
  detectedLanguage?: string;
}

export type FileType = 'pdf' | 'docx' | 'pptx' | 'txt' | 'md' | 'image' | 'csv' | 'code' | 'youtube' | 'audio';

export interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  color: string;
  icon: string;
  totalLessons: number;
  completedLessons: number;
  mastery: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  topics: Topic[];
  createdAt: string;
  lastStudied?: string;
  examDate?: string;
  estimatedHours: number;
  sourceFiles: string[];
  status: 'generating' | 'ready' | 'in-progress' | 'completed';
  sourceMode: 'strict' | 'enriched' | 'notes-only';
  conceptCount: number;
  glossaryCount: number;
  exerciseCount: number;
  /** Sentence-level provenance linking concepts to source file spans. */
  conceptSpans?: ConceptSpan[];
}

/** Maps a course concept to a precise span in uploaded source material. */
export interface ConceptSpan {
  conceptId: string;
  concept: string;
  chunkId: string;
  fileId: string;
  fileName?: string;
  charStart: number;
  charEnd: number;
  sentence?: string;
  page?: number;
  heading?: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  mastery: number;
  prerequisites: string[];
  order: number;
  isLocked: boolean;
  estimatedMinutes: number;
  conceptCount: number;
  retentionPrediction: number;
  /** Key concepts taught in this topic (from content analysis / LLM). */
  keyConcepts?: string[];
  /** Learning objectives for this topic. */
  objectives?: string[];
}

export interface Lesson {
  id: string;
  title: string;
  type: 'theoretical' | 'practical';
  format: LessonFormat;
  duration: number;
  mastery: number;
  status: 'locked' | 'available' | 'in-progress' | 'completed' | 'review-due';
  xpReward: number;
  concepts: string[];
  difficulty: number;
  nextReviewAt?: string;
  completedAt?: string;
  attempts: number;
  bestScore: number;
}

export type LessonFormat =
  | 'explanation'
  | 'guided-practice'
  | 'interactive-exercise'
  | 'quiz'
  | 'exam-simulation'
  | 'coding-challenge'
  | 'socratic-dialogue'
  | 'recall-exercise'
  | 'diagram-labeling'
  | 'comparison'
  | 'case-study'
  | 'flashcard-review'
  | 'feynman-explanation'
  | 'error-analysis'
  | 'concept-mapping';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  courseId: string;
  courseName: string;
  courseColor: string;
  courseIcon: string;
  lessonId?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  dueAt?: string;
  scheduledFor?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  xpReward: number;
  isSpacedRepetition: boolean;
  masteryBefore?: number;
  retentionPrediction?: number;
  tags: string[];
  category: 'learn' | 'review' | 'practice' | 'exam' | 'fix';
}

export type TaskType =
  | 'lesson'
  | 'quiz'
  | 'review'
  | 'practice'
  | 'exam-prep'
  | 'flashcards'
  | 'mistake-retry'
  | 'concept-check'
  | 'deep-dive'
  | 'timed-test'
  | 'self-explanation'
  | 'comparison'
  | 'prerequisite-repair'
  | 'oral-exam';

export interface LearnerModel {
  userId: string;
  overallMastery: number;
  totalStudyTime: number;
  totalSessions: number;
  averageSessionLength: number;
  averageConfidence: number;
  retentionRate: number;
  strongAreas: SkillNode[];
  weakAreas: SkillNode[];
  almostKnown: SkillNode[];
  misconceptions: Misconception[];
  learningVelocity: number;
  cognitiveLoadPreference: 'low' | 'medium' | 'high';
  preferredSessionLength: number;
  bestTimeOfDay: string;
  streakDays: number;
  errorPatterns: ErrorPattern[];
  spacingIntervals: SpacingData[];
  confidenceCalibration: ConfidencePoint[];
  retrievalPerformance: number;
  transferAbility: number;
  helpSeekingRate: number;
  persistenceScore: number;
  interactionInsights: string[];
  heatmapData: HeatmapDay[];
  weeklyMastery: number[];
}

export interface SkillNode {
  concept: string;
  courseId: string;
  mastery: number;
  lastPracticed: string;
  retentionPrediction: number;
  practiceCount: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface Misconception {
  id: string;
  concept: string;
  description: string;
  frequency: number;
  corrected: boolean;
  relatedErrors: string[];
  suggestedFix: string;
  detectedAt: string;
}

export interface ErrorPattern {
  type: string;
  frequency: number;
  concepts: string[];
  suggestedRemedy: string;
  category: 'calculation' | 'conceptual' | 'procedural' | 'application' | 'recall';
}

export interface SpacingData {
  concept: string;
  interval: number;
  nextReview: string;
  stability: number;
  difficulty: number;
  reviewCount: number;
}

export interface ConfidencePoint {
  predicted: number;
  actual: number;
  concept: string;
  timestamp: string;
}

export interface MistakeRecord {
  id: string;
  concept: string;
  questionSummary: string;
  wrongAnswer?: string;
  correctAnswer?: string;
  courseId: string;
  createdAt: string;
  resolved: boolean;
}

export type ActivityType =
  | 'lesson_complete'
  | 'quiz_passed'
  | 'quiz_failed'
  | 'review_done'
  | 'streak'
  | 'mastery_up'
  | 'xp_earned'
  | 'mistake_fixed'
  | 'task_complete'
  | 'study_time'
  | 'upload';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  xp?: number;
  timestamp: string;
}

export interface HeatmapDay {
  date: string;
  minutes: number;
  xp: number;
  tasksCompleted: number;
  conceptsReviewed: number;
}

export interface MessageCitation {
  chunkId: string;
  fileId: string;
  fileName: string;
  locator: string;
  charStart: number;
  charEnd: number;
  page?: number;
  heading?: string;
  snippet: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  type?: 'text' | 'question' | 'hint' | 'feedback' | 'exercise' | 'code' | 'diagram' | 'citation' | 'quiz';
  sourceReference?: string;
  /** Structured, precise citations for "show me where this came from". */
  citations?: MessageCitation[];
  confidence?: number;
  isStreaming?: boolean;
  metadata?: {
    sourceGrounded: boolean;
    enrichmentUsed: boolean;
    inferenceUsed: boolean;
  };
}

export type AgentMode =
  | 'socratic'
  | 'direct'
  | 'beginner'
  | 'exam-coach'
  | 'deep-theory'
  | 'practical'
  | 'error-diagnosis'
  | 'feynman'
  | 'debate'
  | 'oral-exam'
  | 'math-tutor'
  | 'coding-tutor'
  | 'writing-coach'
  | 'memory-coach'
  | 'motivation';

export interface StudySession {
  id: string;
  type: '10min' | '25min' | '50min' | 'cram' | 'review' | 'custom';
  startedAt: string;
  endedAt?: string;
  tasksCompleted: number;
  xpEarned: number;
  conceptsPracticed: string[];
  accuracyRate: number;
}

export interface DashboardStats {
  todayXP: number;
  weeklyXP: number;
  streak: number;
  tasksToday: number;
  tasksCompleted: number;
  reviewsDue: number;
  weakConcepts: number;
  upcomingExams: number;
  studyTimeToday: number;
  studyTimeWeek: number;
  masteryTrend: number[];
  conceptsMastered: number;
  totalConcepts: number;
  antiPassiveAlert: boolean;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  source: string;
  relatedConcepts: string[];
  courseId: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  mastery: number;
  type: 'concept' | 'formula' | 'definition' | 'theory' | 'example';
  connections: { to: string; relation: string }[];
}

export type AppView = 'landing' | 'onboarding' | 'dashboard' | 'library' | 'tasks' | 'agent' | 'course' | 'lesson' | 'settings' | 'analytics';
