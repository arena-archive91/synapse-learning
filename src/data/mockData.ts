import type { User, Course, Task, LearnerModel, DashboardStats, AgentMessage, UserSettings } from '../types';

const defaultSettings: UserSettings = {
  questionFrequency: 'moderate',
  explanationDepth: 'intermediate',
  practiceIntensity: 'moderate',
  theoryVsPractice: 50,
  exampleDensity: 'moderate',
  diagramFrequency: 'moderate',
  teachingStyle: 'mixed',
  pacing: 'moderate',
  feedbackTone: 'balanced',
  lessonLength: 'medium',
  revisionLoops: 'moderate',
  masteryThreshold: 80,
  challengeLevel: 'balanced',
  sourceMode: 'enriched',
  language: 'en',
  theme: 'dark',
  dailyGoalMinutes: 30,
  examDate: '2026-02-20',
};

export const mockUser: User = {
  id: 'u1',
  name: 'Alex Chen',
  email: 'alex@university.edu',
  role: 'student',
  segment: 'university',
  streak: 12,
  xp: 4850,
  level: 7,
  joinedAt: '2025-09-01',
  onboardingComplete: true,
  settings: defaultSettings,
};

const mkTopic = (id: string, title: string, desc: string, mastery: number, prereqs: string[], order: number, locked: boolean, mins: number, concepts: number) => ({
  id, title, description: desc, lessons: [], mastery, prerequisites: prereqs, order, isLocked: locked, estimatedMinutes: mins, conceptCount: concepts, retentionPrediction: Math.max(0, mastery - Math.random() * 15),
});

export const mockCourses: Course[] = [
  {
    id: 'c1', title: 'Microeconomics Fundamentals', description: 'Complete course generated from lecture notes and textbook chapters on consumer theory, market structures, and welfare economics.',
    subject: 'Economics', color: '#818cf8', icon: '📊', totalLessons: 24, completedLessons: 16, mastery: 72, difficulty: 'intermediate',
    topics: [
      mkTopic('t1', 'Supply & Demand', 'Market equilibrium and price mechanisms', 92, [], 1, false, 45, 8),
      mkTopic('t2', 'Consumer Theory', 'Utility, preferences, and budget constraints', 78, ['t1'], 2, false, 60, 12),
      mkTopic('t3', 'Elasticity', 'Price, income, and cross elasticity', 65, ['t1'], 3, false, 40, 6),
      mkTopic('t4', 'Market Structures', 'Perfect competition, monopoly, oligopoly', 45, ['t1', 't2'], 4, false, 75, 14),
      mkTopic('t5', 'Welfare Economics', 'Efficiency, equity, and market failures', 20, ['t1', 't4'], 5, false, 50, 9),
      mkTopic('t6', 'Game Theory Basics', 'Strategic interaction and Nash equilibrium', 0, ['t4'], 6, true, 55, 10),
    ],
    createdAt: '2025-10-15', lastStudied: '2026-01-14', examDate: '2026-02-20', estimatedHours: 18,
    sourceFiles: ['Lecture_Notes_Micro.pdf', 'Textbook_Ch1-6.pdf', 'Problem_Sets.docx'], status: 'in-progress',
    sourceMode: 'enriched', conceptCount: 59, glossaryCount: 42, exerciseCount: 85,
  },
  {
    id: 'c2', title: 'Python for Data Science', description: 'Interactive course built from bootcamp slides and Jupyter notebooks covering pandas, numpy, matplotlib, and scikit-learn.',
    subject: 'Programming', color: '#22d3ee', icon: '🐍', totalLessons: 32, completedLessons: 22, mastery: 68, difficulty: 'intermediate',
    topics: [
      mkTopic('t7', 'Python Basics Review', 'Variables, data types, control flow', 95, [], 1, false, 30, 6),
      mkTopic('t8', 'NumPy Arrays', 'Array operations and broadcasting', 82, ['t7'], 2, false, 50, 8),
      mkTopic('t9', 'Pandas DataFrames', 'Data manipulation and analysis', 70, ['t8'], 3, false, 60, 12),
      mkTopic('t10', 'Data Visualization', 'Matplotlib and Seaborn', 55, ['t9'], 4, false, 45, 7),
      mkTopic('t11', 'Machine Learning Intro', 'Scikit-learn basics', 30, ['t9'], 5, false, 70, 11),
    ],
    createdAt: '2025-11-01', lastStudied: '2026-01-13', estimatedHours: 22,
    sourceFiles: ['DS_Bootcamp_Slides.pptx', 'Notebooks.zip', 'Exercises.py'], status: 'in-progress',
    sourceMode: 'enriched', conceptCount: 44, glossaryCount: 30, exerciseCount: 120,
  },
  {
    id: 'c3', title: 'Intro to Philosophy', description: 'Course generated from lecture transcripts and reading excerpts on epistemology, ethics, and philosophy of mind.',
    subject: 'Philosophy', color: '#2dd4bf', icon: '🧠', totalLessons: 18, completedLessons: 5, mastery: 28, difficulty: 'beginner',
    topics: [
      mkTopic('t12', 'What is Philosophy?', 'Methods, questions, and branches', 88, [], 1, false, 25, 5),
      mkTopic('t13', 'Epistemology', 'Knowledge, belief, and justification', 40, ['t12'], 2, false, 55, 9),
      mkTopic('t14', 'Ethics', 'Consequentialism, deontology, virtue ethics', 10, ['t12'], 3, false, 60, 11),
      mkTopic('t15', 'Philosophy of Mind', 'Consciousness, dualism, physicalism', 0, ['t12', 't13'], 4, true, 50, 8),
    ],
    createdAt: '2025-12-01', lastStudied: '2026-01-10', estimatedHours: 12,
    sourceFiles: ['Philosophy_Lectures.txt', 'Readings_Anthology.pdf'], status: 'in-progress',
    sourceMode: 'strict', conceptCount: 33, glossaryCount: 28, exerciseCount: 40,
  },
  {
    id: 'c4', title: 'Statistics & Probability', description: 'Generated from textbook and problem sets. Covers descriptive statistics, probability distributions, hypothesis testing.',
    subject: 'Mathematics', color: '#fb923c', icon: '📐', totalLessons: 28, completedLessons: 0, mastery: 0, difficulty: 'mixed',
    topics: [], createdAt: '2026-01-14', estimatedHours: 20,
    sourceFiles: ['Stats_Textbook_Ch1-8.pdf'], status: 'generating',
    sourceMode: 'enriched', conceptCount: 0, glossaryCount: 0, exerciseCount: 0,
  },
];

const mkTask = (id: string, title: string, desc: string, type: Task['type'], courseId: string, cName: string, cColor: string, cIcon: string, priority: Task['priority'], mins: number, xp: number, spaced: boolean, status: Task['status'], category: Task['category'], tags: string[], extra?: Partial<Task>): Task => ({
  id, title, description: desc, type, courseId, courseName: cName, courseColor: cColor, courseIcon: cIcon, priority, estimatedMinutes: mins, xpReward: xp, isSpacedRepetition: spaced, status, category, tags, ...extra,
});

export const mockTasks: Task[] = [
  mkTask('task1', 'Review: Supply & Demand Equilibrium', 'Spaced repetition review — retention predicted to drop below 80% today', 'review', 'c1', 'Microeconomics', '#818cf8', '📊', 'critical', 8, 30, true, 'pending', 'review', ['review', 'spaced-repetition'], { dueAt: '2026-01-15T10:00:00', retentionPrediction: 0.72 }),
  mkTask('task2', 'Lesson: Cournot vs Bertrand Competition', 'New lesson on oligopoly models — Market Structures topic', 'lesson', 'c1', 'Microeconomics', '#818cf8', '📊', 'high', 20, 50, false, 'pending', 'learn', ['lesson', 'market-structures']),
  mkTask('task3', 'Practice: Pandas GroupBy Operations', 'Solve 5 coding challenges on DataFrame aggregation', 'practice', 'c2', 'Python for DS', '#22d3ee', '🐍', 'high', 15, 40, false, 'pending', 'practice', ['coding', 'pandas']),
  mkTask('task4', 'Retry Mistakes: Elasticity Calculations', 'You got 3/5 wrong last time — targeted practice', 'mistake-retry', 'c1', 'Microeconomics', '#818cf8', '📊', 'high', 12, 35, false, 'pending', 'fix', ['mistakes', 'elasticity'], { masteryBefore: 45 }),
  mkTask('task5', 'Flashcard Review: Epistemology Terms', '12 cards due for review', 'flashcards', 'c3', 'Philosophy', '#2dd4bf', '🧠', 'medium', 6, 20, true, 'pending', 'review', ['flashcards', 'philosophy']),
  mkTask('task6', 'Exam Simulation: Consumer Theory', 'Timed 30-minute mock with past paper questions', 'exam-prep', 'c1', 'Microeconomics', '#818cf8', '📊', 'medium', 30, 80, false, 'pending', 'exam', ['exam', 'consumer-theory'], { dueAt: '2026-02-20T00:00:00' }),
  mkTask('task7', 'Concept Check: NumPy Broadcasting', 'Quick 3-question check on array broadcasting rules', 'concept-check', 'c2', 'Python for DS', '#22d3ee', '🐍', 'low', 5, 15, false, 'completed', 'learn', ['concept-check', 'numpy']),
  mkTask('task8', 'Deep Dive: Price Discrimination', 'Extended lesson with real-world examples', 'deep-dive', 'c1', 'Microeconomics', '#818cf8', '📊', 'low', 25, 60, false, 'pending', 'learn', ['deep-dive', 'monopoly']),
  mkTask('task9', 'Self-Explain: What is the Bertrand Paradox?', 'Explain in your own words — Feynman technique', 'self-explanation', 'c1', 'Microeconomics', '#818cf8', '📊', 'medium', 10, 25, false, 'pending', 'learn', ['feynman', 'oligopoly']),
  mkTask('task10', 'Prerequisite Repair: Utility Functions', 'You struggled with indifference curves — review utility basics', 'prerequisite-repair', 'c1', 'Microeconomics', '#818cf8', '📊', 'high', 15, 30, false, 'pending', 'fix', ['prerequisite', 'consumer-theory']),
];

const mkSkill = (concept: string, courseId: string, mastery: number, lastPracticed: string, retention: number, count: number, avgTime: number, errRate: number): import('../types').SkillNode => ({
  concept, courseId, mastery, lastPracticed, retentionPrediction: retention, practiceCount: count, averageResponseTime: avgTime, errorRate: errRate,
});

export const mockLearnerModel: LearnerModel = {
  userId: 'u1',
  overallMastery: 58,
  totalStudyTime: 4260,
  totalSessions: 47,
  averageSessionLength: 22,
  averageConfidence: 0.65,
  retentionRate: 0.78,
  strongAreas: [
    mkSkill('Supply & Demand', 'c1', 92, '2026-01-13', 0.88, 14, 12, 0.08),
    mkSkill('Python Basics', 'c2', 95, '2026-01-12', 0.92, 18, 8, 0.05),
    mkSkill('NumPy Arrays', 'c2', 82, '2026-01-11', 0.79, 10, 15, 0.12),
  ],
  weakAreas: [
    mkSkill('Elasticity Calculations', 'c1', 45, '2026-01-10', 0.38, 4, 45, 0.42),
    mkSkill('Game Theory', 'c1', 0, '', 0, 0, 0, 0),
    mkSkill('Welfare Economics', 'c1', 20, '2026-01-08', 0.15, 2, 55, 0.55),
  ],
  almostKnown: [
    mkSkill('Pandas Merging', 'c2', 68, '2026-01-12', 0.62, 6, 22, 0.18),
    mkSkill('Consumer Surplus', 'c1', 62, '2026-01-11', 0.55, 5, 30, 0.22),
  ],
  misconceptions: [
    { id: 'm1', concept: 'Elasticity', description: 'Confusing percentage change with absolute change in elasticity formula', frequency: 3, corrected: false, relatedErrors: ['unit-error', 'formula-application'], suggestedFix: 'Practice with explicit percentage change calculations', detectedAt: '2026-01-10' },
    { id: 'm2', concept: 'Consumer Surplus', description: 'Including producer surplus area when calculating consumer surplus', frequency: 2, corrected: false, relatedErrors: ['graph-reading', 'area-calculation'], suggestedFix: 'Diagram labeling exercises with shaded regions', detectedAt: '2026-01-08' },
  ],
  learningVelocity: 1.15,
  cognitiveLoadPreference: 'medium',
  preferredSessionLength: 25,
  bestTimeOfDay: '10:00-12:00',
  streakDays: 12,
  errorPatterns: [
    { type: 'Calculation errors in multi-step problems', frequency: 8, concepts: ['elasticity', 'consumer-theory'], suggestedRemedy: 'Practice step-by-step worked examples', category: 'calculation' },
    { type: 'Confusing similar concepts', frequency: 5, concepts: ['monopoly vs oligopoly', 'nash vs dominant strategy'], suggestedRemedy: 'Comparison exercises and concept mapping', category: 'conceptual' },
    { type: 'Skipping intermediate steps', frequency: 4, concepts: ['profit maximization', 'derivatives'], suggestedRemedy: 'Use "show hidden steps" mode', category: 'procedural' },
  ],
  spacingIntervals: [],
  confidenceCalibration: [
    { predicted: 0.9, actual: 0.7, concept: 'Elasticity', timestamp: '2026-01-10' },
    { predicted: 0.6, actual: 0.8, concept: 'Supply & Demand', timestamp: '2026-01-12' },
    { predicted: 0.8, actual: 0.85, concept: 'NumPy', timestamp: '2026-01-11' },
    { predicted: 0.7, actual: 0.4, concept: 'Consumer Surplus', timestamp: '2026-01-09' },
    { predicted: 0.5, actual: 0.55, concept: 'Pandas', timestamp: '2026-01-13' },
  ],
  retrievalPerformance: 0.72,
  transferAbility: 0.58,
  helpSeekingRate: 0.35,
  persistenceScore: 0.82,
  interactionInsights: [
    'You learn topics better when you see worked examples first.',
    'You make more calculation errors than conceptual errors.',
    'You tend to overestimate your mastery of elasticity.',
    'You perform better in morning sessions (10am-12pm).',
    'You retain concepts 23% better when you practice recall vs re-reading.',
    'You benefit from comparison exercises between similar concepts.',
  ],
  heatmapData: Array.from({ length: 90 }, (_, i) => {
    const d = new Date('2025-10-15');
    d.setDate(d.getDate() + i);
    const mins = Math.random() > 0.3 ? Math.floor(Math.random() * 60 + 5) : 0;
    return { date: d.toISOString().slice(0, 10), minutes: mins, xp: mins * 3, tasksCompleted: Math.floor(mins / 8), conceptsReviewed: Math.floor(mins / 10) };
  }),
  weeklyMastery: [42, 45, 48, 50, 52, 55, 58],
};

export const mockDashboardStats: DashboardStats = {
  todayXP: 120, weeklyXP: 680, streak: 12, tasksToday: 8, tasksCompleted: 1,
  reviewsDue: 3, weakConcepts: 4, upcomingExams: 1, studyTimeToday: 35,
  masteryTrend: [42, 45, 48, 50, 52, 55, 58], conceptsMastered: 31, totalConcepts: 136,
  antiPassiveAlert: false,
};

export const mockAgentMessages: AgentMessage[] = [
  { id: 'msg1', role: 'system', content: 'Agent mode: Socratic Tutor · Source: Microeconomics Lecture Notes · Strict source-grounded', timestamp: '2026-01-15T09:30:00', type: 'text' },
  { id: 'msg2', role: 'agent', content: "Welcome back, Alex! I see you have a review due on Supply & Demand equilibrium. Before we dive in, let me ask you something:\n\n**If the government imposes a price ceiling below the equilibrium price, what happens to the quantity demanded and quantity supplied?**\n\nTake a moment to think about this. You can sketch it mentally or write out your reasoning.", timestamp: '2026-01-15T09:30:05', type: 'question', metadata: { sourceGrounded: true, enrichmentUsed: false, inferenceUsed: false } },
  { id: 'msg3', role: 'user', content: 'The quantity demanded goes up because the price is lower, and quantity supplied goes down because producers don\'t want to sell at that low price. So there\'s a shortage.', timestamp: '2026-01-15T09:31:20', type: 'text' },
  { id: 'msg4', role: 'agent', content: "Excellent reasoning! ✓ You've correctly identified all three key effects:\n\n1. **Qd increases** — consumers want more at the lower price\n2. **Qs decreases** — producers reduce supply at the lower price\n3. **Shortage** — Qd > Qs creates excess demand\n\n📖 *Source: Your lecture notes, slide 14*\n\nNow let me push your understanding deeper: **Can you think of a real-world example where a price ceiling created a shortage?** And what was the unintended consequence?", timestamp: '2026-01-15T09:31:45', type: 'feedback', sourceReference: 'Lecture_Notes_Micro.pdf, slide 14', confidence: 0.95, metadata: { sourceGrounded: true, enrichmentUsed: false, inferenceUsed: true } },
];
