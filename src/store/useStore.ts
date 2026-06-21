import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { AppView, Course, AgentMessage, AgentMode, UploadedFile, UserSettings, LearnerModel, DashboardStats, MistakeRecord, ActivityItem, GlossaryEntry } from '../types';
import { createActivity } from '../lib/activityLog';
import { SEED_ACTIVITIES } from '../demo/activityDemo';
import { mockUser, mockCourses, mockTasks, mockLearnerModel, mockDashboardStats, mockAgentMessages } from '../demo/mockData';
import { loadThemePreference, applyTheme } from '../lib/theme';
import { ECON_CONCEPT_IMPORTANCE } from '../data/conceptGraph';
import {
  betaMean,
  computeCalibration,
  computeExamReadiness,
  computePrerequisiteRepairs,
  computeReviewInterval,
  deriveInsights,
  fsrsIntervalDays,
  updateBetaMastery,
  updateSkillMastery,
  type FsrsRating,
} from '../lib/pedagogy';
import { ECON_CONCEPT_EDGES } from '../data/conceptGraph';
import { edgesFromCourses } from '../lib/conceptEdges';
import { loadJson, saveJson } from '../lib/persistence';
import { hydrateLibrary, loadLibrarySync, saveLibrarySync } from '../lib/libraryStorage';
import { mergeLibraries, remoteLibraryToPersisted } from '../lib/librarySync';
import { fetchYoutubeTranscript } from '../lib/youtubeTranscript';
import { fetchRemoteLibrary, fetchRemoteSession, pushRemoteSession, authMe } from '../lib/authClient';
import {
  loadLocalSession,
  mergeSessions,
  localSessionToRemote,
  remoteSessionToLocal,
} from '../lib/sessionSync';
import { filterTasksForSession, getTaskAction, getTaskConcept, getAgentMode, type SessionType } from '../lib/taskFlows';
import { settingsToAgentMode } from '../lib/settingsEffects';
import { buildCourseFromUpload, buildCourseFromOutline, readTextFromFiles, uploadedFileMeta, extractFileContent, type UploadPayload } from '../lib/uploadPipeline';
import { buildConceptSpans, type SourceHighlight } from '../lib/conceptProvenance';
import { generateCourseOutline } from '../lib/courseGenerator';
import { analyzeContentToOutline, analyzeContentToOutlineAsync } from '../lib/contentAnalysis';
import type { BetaMastery } from '../lib/pedagogy';
import {
  shouldShowDemo,
  initialCourses,
  stripDemoFromTasks,
} from '../lib/demoMode';
import { buildInitialUser, applyAuthIdentity, levelFromXp } from '../lib/identity';
import { createEmptyLearnerModel, EMPTY_DASHBOARD_STATS } from '../lib/emptyLearnerState';
import { mergeCourseTasks } from '../lib/taskGenerator';
import { syncLearnerHeatmap, computeStreakFromHeatmap } from '../lib/activityAnalytics';
import { computeRetentionRate, weeklyMasteryFromActivities } from '../lib/retentionAnalytics';
import { mergeOutlineIntoCourse } from '../lib/courseMerge';
import {
  applySkillUpdate,
  ensureSkillNode,
  findSkillForConcept,
  fsrsRatingToConfidence,
  mergeBetaFromCourse,
  mergeSkillNodesFromCourse,
  updateCourseTopicMastery,
} from '../lib/skillNodes';

const STORAGE_KEY = 'session-v2';

const MOCK_COURSE_IDS = new Set(mockCourses.map((c) => c.id));

type PersistedState = {
  learnerModel: LearnerModel;
  dashboardStats: DashboardStats;
  tasks: typeof mockTasks;
  xp: number;
  betaMastery: BetaMastery[];
  firstAttemptKeys: string[];
  openMistakes: MistakeRecord[];
  activities: ActivityItem[];
  userSettings: UserSettings;
};

function initTasks(
  persisted: Partial<PersistedState>,
  generatedCourses: Course[],
  settings: UserSettings,
): typeof mockTasks {
  const showDemo = shouldShowDemo(settings);
  let tasks = persisted.tasks ?? [];
  if (showDemo && tasks.length === 0) return mockTasks;
  tasks = stripDemoFromTasks(tasks);
  for (const course of generatedCourses) {
    if (course.status !== 'generating') {
      tasks = mergeCourseTasks(tasks, course);
    }
  }
  return tasks;
}

function initActivities(persisted: Partial<PersistedState>, settings: UserSettings): ActivityItem[] {
  if (shouldShowDemo(settings)) return persisted.activities ?? SEED_ACTIVITIES;
  return persisted.activities ?? [];
}

function initBetaMastery(settings: UserSettings): BetaMastery[] {
  if (!shouldShowDemo(settings)) return [];
  const allSkills = [
    ...mockLearnerModel.strongAreas,
    ...mockLearnerModel.weakAreas,
    ...mockLearnerModel.almostKnown,
  ];
  return allSkills.map((s) => {
    const importance = ECON_CONCEPT_IMPORTANCE[s.concept] ?? 1;
    const mastery = s.mastery / 100;
    const attempts = Math.max(1, s.practiceCount);
    return {
      concept: s.concept,
      alpha: 1 + mastery * attempts,
      beta: 1 + (1 - mastery) * attempts,
      firstAttempts: attempts,
      importance,
    };
  });
}

import { DEMO_INITIAL_MISTAKES as INITIAL_MISTAKES } from '../demo/mockData';

function loadPersisted(): Partial<PersistedState> {
  const legacy = loadJson<Partial<PersistedState>>('session-v1', {});
  const current = loadJson<Partial<PersistedState>>(STORAGE_KEY, {});
  return { ...legacy, ...current };
}

function masteryMapFromSkills(lm: LearnerModel, courses: Course[], showDemo: boolean): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of [...lm.strongAreas, ...lm.weakAreas, ...lm.almostKnown]) {
    map[s.concept] = s.mastery;
  }
  for (const c of courses) {
    if (!showDemo && MOCK_COURSE_IDS.has(c.id)) continue;
    for (const t of c.topics) {
      map[t.title] = t.mastery;
    }
  }
  return map;
}

export function useAppStore() {
  const persisted = useMemo(() => loadPersisted(), []);
  const library = useMemo(() => loadLibrarySync(), []);
  const mergedSettings = useMemo(
    () => ({
      ...mockUser.settings,
      ...persisted.userSettings,
      theme: loadThemePreference(),
    }),
    [persisted.userSettings],
  );
  const initialActivities = useMemo(
    () => initActivities(persisted, mergedSettings),
    [persisted, mergedSettings],
  );

  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(() => buildInitialUser({
    settings: mergedSettings,
    persistedXp: persisted.xp,
    authEmail: mergedSettings.authEmail,
  }));
  const [courses, setCourses] = useState<Course[]>(
    () => initialCourses(library.generatedCourses, mergedSettings, mockCourses),
  );
  const [tasks, setTasks] = useState(
    () => initTasks(persisted, library.generatedCourses, mergedSettings),
  );
  const [learnerModel, setLearnerModel] = useState<LearnerModel>(() => {
    const base = shouldShowDemo(mergedSettings)
      ? (persisted.learnerModel ?? mockLearnerModel)
      : (persisted.learnerModel ?? createEmptyLearnerModel('u1', initialActivities));
    return syncLearnerHeatmap(base, initialActivities);
  });
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(() => {
    const base = shouldShowDemo(mergedSettings)
      ? (persisted.dashboardStats ?? mockDashboardStats)
      : (persisted.dashboardStats ?? EMPTY_DASHBOARD_STATS);
    const heatmap = syncLearnerHeatmap(createEmptyLearnerModel('u1', initialActivities), initialActivities).heatmapData;
    return { ...base, streak: computeStreakFromHeatmap(heatmap) };
  });
  const [betaMastery, setBetaMastery] = useState<BetaMastery[]>(
    () => persisted.betaMastery ?? initBetaMastery(mergedSettings),
  );
  const [firstAttemptKeys, setFirstAttemptKeys] = useState<Set<string>>(
    new Set(persisted.firstAttemptKeys ?? []),
  );
  const [openMistakes, setOpenMistakes] = useState<MistakeRecord[]>(
    shouldShowDemo(mergedSettings) ? (persisted.openMistakes ?? INITIAL_MISTAKES) : (persisted.openMistakes ?? []),
  );
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>(
    shouldShowDemo(mergedSettings) ? mockAgentMessages : [],
  );
  const [agentMode, setAgentMode] = useState<AgentMode>('socratic');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(library.uploadedFiles);
  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>(library.glossaryEntries);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeLessonView, setActiveLessonView] = useState(false);
  const [practicalLessonView, setPracticalLessonView] = useState(false);
  const [studyWorkspaceOpen, setStudyWorkspaceOpen] = useState(false);
  const [sourceHighlight, setSourceHighlight] = useState<SourceHighlight | null>(null);
  const openSourceAt = useCallback((highlight: SourceHighlight) => {
    setSourceHighlight(highlight);
    setStudyWorkspaceOpen(true);
  }, []);
  const [reviewSessionOpen, setReviewSessionOpen] = useState(false);
  const [mistakeRetryOpen, setMistakeRetryOpen] = useState(false);
  const [examPrepOpen, setExamPrepOpen] = useState(false);
  const [prerequisiteRepairOpen, setPrerequisiteRepairOpen] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<string[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [activeSessionType, setActiveSessionType] = useState<SessionType | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const persistLibrary = useCallback((
    files: UploadedFile[],
    glossary: GlossaryEntry[],
    allCourses: Course[],
  ) => {
    saveLibrarySync({
      uploadedFiles: files,
      glossaryEntries: glossary,
      generatedCourses: allCourses.filter((c) => !MOCK_COURSE_IDS.has(c.id)),
    });
  }, []);

  useEffect(() => {
    void hydrateLibrary({
      uploadedFiles: library.uploadedFiles,
      glossaryEntries: library.glossaryEntries,
      generatedCourses: library.generatedCourses,
    }).then((hydrated) => {
      if (hydrated.uploadedFiles.some((f, i) => f.extractedText !== library.uploadedFiles[i]?.extractedText)) {
        setUploadedFiles(hydrated.uploadedFiles);
      }
    });
  }, [library.uploadedFiles, library.glossaryEntries, library.generatedCourses]);

  const persist = useCallback((
    nextLearner: LearnerModel,
    nextStats: DashboardStats,
    nextTasks: typeof tasks,
    nextXp: number,
    nextBeta: BetaMastery[],
    nextKeys: Set<string>,
    nextMistakes: MistakeRecord[],
    nextActivities: ActivityItem[],
    nextSettings: UserSettings,
  ) => {
    saveJson(STORAGE_KEY, {
      learnerModel: nextLearner,
      dashboardStats: nextStats,
      tasks: nextTasks,
      xp: nextXp,
      betaMastery: nextBeta,
      firstAttemptKeys: [...nextKeys],
      openMistakes: nextMistakes,
      activities: nextActivities,
      userSettings: nextSettings,
    } satisfies PersistedState);
  }, []);

  const logActivity = useCallback((item: ActivityItem): ActivityItem[] => {
    const next = [item, ...activities].slice(0, 50);
    setActivities(next);
    setLearnerModel((lm) => syncLearnerHeatmap(lm, next));
    setDashboardStats((stats) => ({
      ...stats,
      streak: computeStreakFromHeatmap(syncLearnerHeatmap(learnerModel, next).heatmapData),
    }));
    return next;
  }, [activities, learnerModel]);

  const recomputeLearnerMetrics = useCallback((
    lm: LearnerModel,
    beta: BetaMastery[],
    keys: Set<string>,
    _mistakes: MistakeRecord[],
  ): LearnerModel => {
    const masteryMap = masteryMapFromSkills(lm, courses, shouldShowDemo(user.settings));
    const courseEdges = edgesFromCourses(courses);
    const edges = courseEdges.length > 0
      ? courseEdges
      : (shouldShowDemo(user.settings) ? ECON_CONCEPT_EDGES : []);
    const repairs = computePrerequisiteRepairs(masteryMap, edges);
    const calibration = computeCalibration(lm.confidenceCalibration);
    const firstCount = keys.size;
    const fallbackAccuracy = lm.confidenceCalibration.length > 0
      ? lm.confidenceCalibration.reduce((s, p) => s + p.actual, 0) / lm.confidenceCalibration.length
      : lm.retentionRate;
    const selfReliance = 1 - lm.helpSeekingRate;
    const readiness = computeExamReadiness(beta, fallbackAccuracy, selfReliance, firstCount);

    return {
      ...lm,
      overallMastery: readiness,
      interactionInsights: deriveInsights(lm, repairs, calibration),
    };
  }, [courses, user.settings]);

  const navigate = useCallback((view: AppView) => {
    setCurrentView(view);
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }, []);

  const completeTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task || task.status === 'completed') return prev;

      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, status: 'completed' as const } : t,
      );

      setLearnerModel((lm) => {
        const concept = task.title.split('—')[0]?.trim() ?? task.title;
        const match = findSkillForConcept(lm, concept);
        const updatedSkill = match ? updateSkillMastery(match, true, 70) : null;

        const nextWeak = updatedSkill
          ? lm.weakAreas.map((s) => (s.concept === updatedSkill.concept ? updatedSkill : s))
          : lm.weakAreas;

        let next: LearnerModel = {
          ...lm,
          weakAreas: nextWeak,
          totalSessions: lm.totalSessions + 1,
          retrievalPerformance: Math.min(1, lm.retrievalPerformance + (task.isSpacedRepetition ? 0.03 : 0.01)),
        };
        next = recomputeLearnerMetrics(next, betaMastery, firstAttemptKeys, openMistakes);

        setDashboardStats((stats) => {
          const nextStats: DashboardStats = {
            ...stats,
            tasksCompleted: stats.tasksCompleted + 1,
            todayXP: stats.todayXP + task.xpReward,
            weeklyXP: stats.weeklyXP + task.xpReward,
            reviewsDue: Math.max(0, stats.reviewsDue - (task.isSpacedRepetition ? 1 : 0)),
          };
          setUser((u) => {
            const nextXp = u.xp + task.xpReward;
            const nextActs = logActivity(createActivity('task_complete', `Completed: ${task.title}`, task.xpReward));
            persist(next, nextStats, updated, nextXp, betaMastery, firstAttemptKeys, openMistakes, nextActs, u.settings);
            return { ...u, xp: nextXp, level: levelFromXp(nextXp) };
          });
          return nextStats;
        });

        return next;
      });

      return updated;
    });
  }, [persist, betaMastery, firstAttemptKeys, openMistakes, recomputeLearnerMetrics, logActivity, activities]);

  const submitReviewRating = useCallback((taskId: string, rating: FsrsRating) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task || task.status === 'completed') return prev;

      const concept = getTaskConcept(task);
      const spacing = learnerModel.spacingIntervals.find((s) => s.concept.toLowerCase().includes(concept.toLowerCase().slice(0, 6)));
      const stability = spacing?.stability ?? 0.5;
      const reviewCount = spacing?.reviewCount ?? 0;
      const days = fsrsIntervalDays(stability, rating, reviewCount);

      const updated = prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'completed' as const,
              scheduledFor: new Date(Date.now() + days * 86400000).toISOString(),
            }
          : t,
      );

      setLearnerModel((lm) => {
        const correct = rating !== 'again';
        const confidence = fsrsRatingToConfidence(rating);
        const skill = ensureSkillNode(lm, concept, task.courseId);
        const updatedSkill = updateSkillMastery(skill, correct, confidence);
        let nextLm = applySkillUpdate(lm, updatedSkill);

        const betaIdx = betaMastery.findIndex(
          (b) => b.concept.toLowerCase().includes(concept.toLowerCase().slice(0, 6))
            || concept.toLowerCase().includes(b.concept.toLowerCase().slice(0, 6)),
        );
        const betaRecord = betaIdx >= 0
          ? betaMastery[betaIdx]!
          : { concept, alpha: 1, beta: 1, firstAttempts: 0, importance: 1 };
        const nextBetaRecord = updateBetaMastery(betaRecord, correct);
        const nextBeta = betaIdx >= 0
          ? betaMastery.map((b, i) => (i === betaIdx ? nextBetaRecord : b))
          : [...betaMastery, nextBetaRecord];
        setBetaMastery(nextBeta);

        const nextSpacing = nextLm.spacingIntervals.some((s) => s.concept === concept)
          ? nextLm.spacingIntervals.map((s) =>
              s.concept === concept
                ? {
                    ...s,
                    interval: days,
                    reviewCount: s.reviewCount + 1,
                    nextReview: new Date(Date.now() + days * 86400000).toISOString(),
                    stability: rating === 'again' ? Math.max(0.1, s.stability - 0.15) : Math.min(1, s.stability + 0.1),
                  }
                : s,
            )
          : [
              ...nextLm.spacingIntervals,
              {
                concept,
                interval: days,
                nextReview: new Date(Date.now() + days * 86400000).toISOString(),
                stability: rating === 'again' ? 0.3 : 0.55,
                difficulty: 0.5,
                reviewCount: 1,
              },
            ];

        let next: LearnerModel = {
          ...nextLm,
          spacingIntervals: nextSpacing,
          retrievalPerformance: correct
            ? Math.min(1, nextLm.retrievalPerformance + 0.04)
            : Math.max(0, nextLm.retrievalPerformance - 0.02),
          totalSessions: nextLm.totalSessions + 1,
        };
        next = recomputeLearnerMetrics(next, nextBeta, firstAttemptKeys, openMistakes);

        setCourses((prev) => updateCourseTopicMastery(prev, task.courseId, concept, correct ? 6 : -8, correct));

        setDashboardStats((stats) => {
          const nextStats: DashboardStats = {
            ...stats,
            tasksCompleted: stats.tasksCompleted + 1,
            todayXP: stats.todayXP + task.xpReward,
            weeklyXP: stats.weeklyXP + task.xpReward,
            reviewsDue: Math.max(0, stats.reviewsDue - 1),
          };
          setUser((u) => {
            const nextXp = u.xp + task.xpReward;
            const nextActs = logActivity(createActivity('review_done', `Reviewed: ${task.title} (${rating})`, task.xpReward));
            next = {
              ...next,
              retentionRate: computeRetentionRate(nextActs),
              weeklyMastery: weeklyMasteryFromActivities(nextActs),
            };
            persist(next, nextStats, updated, nextXp, nextBeta, firstAttemptKeys, openMistakes, nextActs, u.settings);
            return { ...u, xp: nextXp, level: levelFromXp(nextXp) };
          });
          return nextStats;
        });

        return next;
      });

      return updated;
    });
  }, [learnerModel.spacingIntervals, betaMastery, firstAttemptKeys, openMistakes, persist, recomputeLearnerMetrics]);

  const submitLeitnerRating = useCallback((concept: string, rating: FsrsRating, courseId?: string) => {
    const resolvedCourseId =
      courseId ??
      courses.find((c) => !MOCK_COURSE_IDS.has(c.id))?.id ??
      'unknown';
    const spacing = learnerModel.spacingIntervals.find((s) =>
      s.concept.toLowerCase().includes(concept.toLowerCase().slice(0, 6))
      || concept.toLowerCase().includes(s.concept.toLowerCase().slice(0, 6)),
    );
    const stability = spacing?.stability ?? 0.5;
    const reviewCount = spacing?.reviewCount ?? 0;
    const days = fsrsIntervalDays(stability, rating, reviewCount);
    const correct = rating !== 'again';
    const confidence = fsrsRatingToConfidence(rating);

    setLearnerModel((lm) => {
      const skill = ensureSkillNode(lm, concept, resolvedCourseId);
      const updatedSkill = updateSkillMastery(skill, correct, confidence);
      let nextLm = applySkillUpdate(lm, updatedSkill);

      const betaIdx = betaMastery.findIndex(
        (b) => b.concept.toLowerCase().includes(concept.toLowerCase().slice(0, 6))
          || concept.toLowerCase().includes(b.concept.toLowerCase().slice(0, 6)),
      );
      const betaRecord = betaIdx >= 0
        ? betaMastery[betaIdx]!
        : { concept, alpha: 1, beta: 1, firstAttempts: 0, importance: 1 };
      const nextBetaRecord = updateBetaMastery(betaRecord, correct);
      const nextBeta = betaIdx >= 0
        ? betaMastery.map((b, i) => (i === betaIdx ? nextBetaRecord : b))
        : [...betaMastery, nextBetaRecord];
      setBetaMastery(nextBeta);

      const nextSpacing = nextLm.spacingIntervals.some((s) => s.concept === concept)
        ? nextLm.spacingIntervals.map((s) =>
            s.concept === concept
              ? {
                  ...s,
                  interval: days,
                  reviewCount: s.reviewCount + 1,
                  nextReview: new Date(Date.now() + days * 86400000).toISOString(),
                  stability: rating === 'again' ? Math.max(0.1, s.stability - 0.15) : Math.min(1, s.stability + 0.1),
                }
              : s,
          )
        : [
            ...nextLm.spacingIntervals,
            {
              concept,
              interval: days,
              nextReview: new Date(Date.now() + days * 86400000).toISOString(),
              stability: rating === 'again' ? 0.3 : 0.55,
              difficulty: 0.5,
              reviewCount: 1,
            },
          ];

      let next: LearnerModel = {
        ...nextLm,
        spacingIntervals: nextSpacing,
        retrievalPerformance: correct
          ? Math.min(1, nextLm.retrievalPerformance + 0.04)
          : Math.max(0, nextLm.retrievalPerformance - 0.02),
        totalSessions: nextLm.totalSessions + 1,
      };
      next = recomputeLearnerMetrics(next, nextBeta, firstAttemptKeys, openMistakes);

      setCourses((prev) => updateCourseTopicMastery(prev, resolvedCourseId, concept, correct ? 6 : -8, correct));

      const nextActs = logActivity(createActivity('review_done', `Leitner: ${concept} (${rating})`, 5));
      next = {
        ...next,
        retentionRate: computeRetentionRate(nextActs),
        weeklyMastery: weeklyMasteryFromActivities(nextActs),
      };
      persist(next, dashboardStats, tasks, user.xp, nextBeta, firstAttemptKeys, openMistakes, nextActs, user.settings);
      return next;
    });
  }, [courses, learnerModel.spacingIntervals, betaMastery, firstAttemptKeys, openMistakes, dashboardStats, tasks, user.xp, user.settings, persist, recomputeLearnerMetrics, logActivity]);

  const resolveMistake = useCallback((mistakeId: string) => {
    setOpenMistakes((prev) => {
      const next = prev.map((m) => (m.id === mistakeId ? { ...m, resolved: true } : m));
      setLearnerModel((lm) => {
        const updated = recomputeLearnerMetrics(lm, betaMastery, firstAttemptKeys, next);
        const nextActs = logActivity(createActivity('mistake_fixed', `Resolved mistake: ${next.find(m => m.id === mistakeId)?.concept ?? 'concept'}`));
        persist(updated, dashboardStats, tasks, user.xp, betaMastery, firstAttemptKeys, next, nextActs, user.settings);
        return updated;
      });
      return next;
    });
  }, [betaMastery, firstAttemptKeys, dashboardStats, tasks, user.xp, persist, recomputeLearnerMetrics]);

  const recordConfidence = useCallback((concept: string, predictedPct: number, actualPct: number) => {
    const point = {
      predicted: predictedPct / 100,
      actual: actualPct / 100,
      concept,
      timestamp: new Date().toISOString(),
    };
    const calibration = [...learnerModel.confidenceCalibration, point].slice(-20);
    const avgConf = Math.round(calibration.reduce((s, p) => s + p.predicted, 0) / calibration.length * 100);

    let next: LearnerModel = {
      ...learnerModel,
      confidenceCalibration: calibration,
      averageConfidence: avgConf,
    };
    next = recomputeLearnerMetrics(next, betaMastery, firstAttemptKeys, openMistakes);
    setLearnerModel(next);
    persist(next, dashboardStats, tasks, user.xp, betaMastery, firstAttemptKeys, openMistakes, activities, user.settings);
  }, [learnerModel, betaMastery, firstAttemptKeys, openMistakes, dashboardStats, tasks, user.xp, user.settings, activities, persist, recomputeLearnerMetrics]);

  const recordQuizAttempt = useCallback((
    concept: string,
    correct: boolean,
    confidence: number,
    stepKey?: string,
    courseId?: string,
  ) => {
    const attemptKey = stepKey ?? `${concept}:${Date.now()}`;
    const isFirstAttempt = !firstAttemptKeys.has(attemptKey);
    const resolvedCourseId =
      courseId ??
      tasks.find((t) => getTaskConcept(t).toLowerCase() === concept.toLowerCase())?.courseId ??
      courses.find((c) => !MOCK_COURSE_IDS.has(c.id))?.id ??
      'unknown';

    const point = {
      predicted: confidence / 100,
      actual: correct ? 1 : 0,
      concept,
      timestamp: new Date().toISOString(),
    };
    const calibration = [...learnerModel.confidenceCalibration, point].slice(-20);
    const avgConf = Math.round(calibration.reduce((s, p) => s + p.predicted, 0) / calibration.length * 100);

    const nextKeys = isFirstAttempt ? new Set([...firstAttemptKeys, attemptKey]) : firstAttemptKeys;

    let nextBeta = betaMastery;
    if (isFirstAttempt) {
      const idx = betaMastery.findIndex((b) => concept.toLowerCase().includes(b.concept.toLowerCase().slice(0, 6))
        || b.concept.toLowerCase().includes(concept.toLowerCase().slice(0, 6)));
      const record = idx >= 0
        ? betaMastery[idx]!
        : { concept, alpha: 1, beta: 1, firstAttempts: 0, importance: 1 };
      const updated = updateBetaMastery(record, correct);
      nextBeta = idx >= 0 ? betaMastery.map((b, i) => (i === idx ? updated : b)) : [...betaMastery, updated];
      setBetaMastery(nextBeta);
      setFirstAttemptKeys(nextKeys);
    }

    let nextMistakes = openMistakes;
    if (!correct && isFirstAttempt) {
      nextMistakes = [
        {
          id: `mistake-${Date.now()}`,
          concept,
          questionSummary: `Quiz on ${concept}`,
          courseId: resolvedCourseId,
          createdAt: new Date().toISOString(),
          resolved: false,
        },
        ...openMistakes,
      ].slice(0, 12);
      setOpenMistakes(nextMistakes);
    }

    const skill = ensureSkillNode(learnerModel, concept, resolvedCourseId);
    const updatedSkill = updateSkillMastery(skill, correct, confidence);
    let nextLm = applySkillUpdate(
      { ...learnerModel, confidenceCalibration: calibration, averageConfidence: avgConf },
      updatedSkill,
    );

    const spacing = nextLm.spacingIntervals.some((s) => s.concept === updatedSkill.concept)
      ? nextLm.spacingIntervals.map((s) =>
          s.concept === updatedSkill.concept
            ? {
                ...s,
                interval: computeReviewInterval(s.reviewCount + 1, confidence, correct),
                reviewCount: s.reviewCount + 1,
                nextReview: new Date(Date.now() + computeReviewInterval(s.reviewCount + 1, confidence, correct) * 86400000).toISOString(),
                stability: correct ? Math.min(1, s.stability + 0.08) : Math.max(0.1, s.stability - 0.12),
              }
            : s,
        )
      : [
          ...nextLm.spacingIntervals,
          {
            concept: updatedSkill.concept,
            interval: computeReviewInterval(1, confidence, correct),
            nextReview: new Date(Date.now() + computeReviewInterval(1, confidence, correct) * 86400000).toISOString(),
            stability: correct ? 0.55 : 0.3,
            difficulty: 0.5,
            reviewCount: 1,
          },
        ];

    let next: LearnerModel = {
      ...nextLm,
      spacingIntervals: spacing,
      retrievalPerformance: correct
        ? Math.min(1, nextLm.retrievalPerformance + 0.02)
        : Math.max(0, nextLm.retrievalPerformance - 0.03),
    };
    next = recomputeLearnerMetrics(next, nextBeta, nextKeys, nextMistakes);
    setLearnerModel(next);
    setCourses((prev) => updateCourseTopicMastery(prev, resolvedCourseId, concept, correct ? 8 : -10, correct));
    const actType = correct ? 'quiz_passed' : 'quiz_failed';
    const nextActs = logActivity(createActivity(actType, `${correct ? 'Passed' : 'Missed'} quiz on ${concept}`, correct ? 15 : undefined));
    const nextWithRetention = {
      ...next,
      retentionRate: computeRetentionRate(nextActs),
      weeklyMastery: weeklyMasteryFromActivities(nextActs),
    };
    setLearnerModel(nextWithRetention);
    persist(nextWithRetention, dashboardStats, tasks, user.xp, nextBeta, nextKeys, nextMistakes, nextActs, user.settings);
  }, [firstAttemptKeys, betaMastery, openMistakes, learnerModel, dashboardStats, tasks, courses, user.xp, user.settings, persist, recomputeLearnerMetrics, logActivity]);

  const addAgentMessage = useCallback((msg: AgentMessage) => {
    setAgentMessages((prev) => [...prev, msg]);
  }, []);

  const updateAgentMessage = useCallback((id: string, patch: Partial<AgentMessage>) => {
    setAgentMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const bindAgentToTask = useCallback((task: typeof mockTasks[number]) => {
    setAgentMode(getAgentMode(task));
    const concept = getTaskConcept(task);
    const contextMsg: AgentMessage = {
      id: `task-ctx-${task.id}-${Date.now()}`,
      role: 'system',
      content: `Task bound: **${task.title}** (${task.courseName}). Focus concept: **${concept}**. Work through the task, then mark it complete.`,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    setAgentMessages((prev) => [...prev, contextMsg]);
  }, []);

  const startTaskRef = useRef<(taskId: string) => void>(() => {});

  const closeTaskViews = useCallback(() => {
    setActiveLessonView(false);
    setPracticalLessonView(false);
    setStudyWorkspaceOpen(false);
    setReviewSessionOpen(false);
    setMistakeRetryOpen(false);
    setExamPrepOpen(false);
    setPrerequisiteRepairOpen(false);
  }, []);

  const advanceSession = useCallback((completedTaskId: string) => {
    setSessionQueue((prev) => {
      if (prev.length === 0) return prev;
      const remaining = prev[0] === completedTaskId ? prev.slice(1) : prev.filter((id) => id !== completedTaskId);
      if (remaining.length > 0) {
        setTimeout(() => startTaskRef.current(remaining[0]!), 150);
      } else {
        setActiveSessionType(null);
        setSessionTotal(0);
      }
      return remaining;
    });
  }, []);

  const completeTaskAndAdvance = useCallback((taskId: string) => {
    completeTask(taskId);
    closeTaskViews();
    setActiveTaskId(null);
    advanceSession(taskId);
  }, [completeTask, advanceSession, closeTaskViews]);

  const submitReviewAndAdvance = useCallback((taskId: string, rating: FsrsRating) => {
    submitReviewRating(taskId, rating);
    closeTaskViews();
    setActiveTaskId(null);
    advanceSession(taskId);
  }, [submitReviewRating, advanceSession, closeTaskViews]);

  const endSession = useCallback(() => {
    setSessionQueue([]);
    setSessionTotal(0);
    setActiveSessionType(null);
    setActiveTaskId(null);
    setActiveLessonView(false);
    setPracticalLessonView(false);
    setStudyWorkspaceOpen(false);
    setReviewSessionOpen(false);
    setMistakeRetryOpen(false);
    setExamPrepOpen(false);
    setPrerequisiteRepairOpen(false);
  }, []);

  const toggleTheme = useCallback(() => {
    setUser((prev) => {
      const nextTheme = prev.settings.theme === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
      return { ...prev, settings: { ...prev.settings, theme: nextTheme } };
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setUser((prev) => {
      const nextSettings = { ...prev.settings, ...partial };
      if (partial.theme) applyTheme(partial.theme);
      if (partial.teachingStyle || partial.explanationDepth || partial.challengeLevel) {
        setAgentMode(settingsToAgentMode(nextSettings));
      }
      persist(learnerModel, dashboardStats, tasks, prev.xp, betaMastery, firstAttemptKeys, openMistakes, activities, nextSettings);
      return { ...prev, settings: nextSettings };
    });
  }, [learnerModel, dashboardStats, tasks, betaMastery, firstAttemptKeys, openMistakes, activities, persist]);

  const logStudyMinutes = useCallback((minutes: number, label = 'Focus session') => {
    if (minutes <= 0) return;
    setDashboardStats((stats) => {
      const nextStats: DashboardStats = {
        ...stats,
        studyTimeToday: stats.studyTimeToday + minutes,
        studyTimeWeek: stats.studyTimeWeek + minutes,
      };
      const nextActs = logActivity(createActivity('study_time', `${label}: ${minutes} min`, Math.round(minutes * 2)));
      persist(learnerModel, nextStats, tasks, user.xp, betaMastery, firstAttemptKeys, openMistakes, nextActs, user.settings);
      return nextStats;
    });
  }, [learnerModel, tasks, user.xp, user.settings, betaMastery, firstAttemptKeys, openMistakes, persist, logActivity]);

  const applyRemoteLibrary = useCallback((merged: ReturnType<typeof mergeLibraries>) => {
    setUploadedFiles(merged.uploadedFiles);
    setGlossaryEntries(merged.glossaryEntries);
    const nextCourses = initialCourses(merged.generatedCourses, user.settings, mockCourses);
    setCourses(nextCourses);

    let nextTasks = stripDemoFromTasks(tasks);
    for (const course of merged.generatedCourses) {
      if (course.status !== 'generating') {
        nextTasks = mergeCourseTasks(nextTasks, course);
      }
    }
    setTasks(nextTasks);

    let nextLm = learnerModel;
    let nextBeta = betaMastery;
    for (const course of merged.generatedCourses) {
      nextBeta = mergeBetaFromCourse(nextBeta, course);
      nextLm = mergeSkillNodesFromCourse(nextLm, course);
    }
    const nextLmMetrics = recomputeLearnerMetrics(nextLm, nextBeta, firstAttemptKeys, openMistakes);
    setBetaMastery(nextBeta);
    setLearnerModel(nextLmMetrics);
    persistLibrary(merged.uploadedFiles, merged.glossaryEntries, merged.generatedCourses);
    persist(nextLmMetrics, dashboardStats, nextTasks, user.xp, nextBeta, firstAttemptKeys, openMistakes, activities, user.settings);
    void hydrateLibrary(merged).then((hydrated) => {
      if (hydrated.uploadedFiles.some((f, i) => f.extractedText !== merged.uploadedFiles[i]?.extractedText)) {
        setUploadedFiles(hydrated.uploadedFiles);
      }
    });
  }, [user.settings, tasks, learnerModel, betaMastery, firstAttemptKeys, openMistakes, dashboardStats, user.xp, activities, persist, persistLibrary, recomputeLearnerMetrics]);

  const pullLibraryFromServer = useCallback(async () => {
    const token = user.settings.authToken;
    if (!token) throw new Error('Sign in to pull your library');
    const remote = await fetchRemoteLibrary(token, user.settings);
    const local = loadLibrarySync();
    const merged = mergeLibraries(local, remoteLibraryToPersisted(remote));
    applyRemoteLibrary(merged);
    return merged;
  }, [user.settings, applyRemoteLibrary]);

  const applyRemoteSession = useCallback((merged: ReturnType<typeof mergeSessions>) => {
    const nextTasks = stripDemoFromTasks(merged.tasks as typeof tasks);
    const nextKeys = new Set(merged.firstAttemptKeys);
    const nextLm = syncLearnerHeatmap(merged.learnerModel, merged.activities);
    const nextStats = {
      ...merged.dashboardStats,
      streak: computeStreakFromHeatmap(nextLm.heatmapData),
    };
    setLearnerModel(nextLm);
    setDashboardStats(nextStats);
    setTasks(nextTasks);
    setBetaMastery(merged.betaMastery);
    setFirstAttemptKeys(nextKeys);
    setOpenMistakes(merged.openMistakes);
    setActivities(merged.activities);
    setUser((u) => {
      const merged2 = applyAuthIdentity(u, merged.userSettings.authEmail);
      return {
        ...merged2,
        xp: merged.xp,
        level: levelFromXp(merged.xp),
        settings: { ...u.settings, ...merged.userSettings },
      };
    });
    persist(
      nextLm,
      nextStats,
      nextTasks,
      merged.xp,
      merged.betaMastery,
      nextKeys,
      merged.openMistakes,
      merged.activities,
      { ...user.settings, ...merged.userSettings },
    );
  }, [persist, user.settings]);

  const pullSessionFromServer = useCallback(async () => {
    const token = user.settings.authToken;
    if (!token) throw new Error('Sign in to pull your session');
    const remote = await fetchRemoteSession(token, user.settings);
    const local = loadLocalSession();
    const merged = mergeSessions(local, remoteSessionToLocal(remote));
    applyRemoteSession(merged);
    return merged;
  }, [user.settings, applyRemoteSession]);

  const pushSessionToServer = useCallback(async () => {
    const token = user.settings.authToken;
    if (!token) throw new Error('Sign in to push your session');
    const local = loadLocalSession();
    const payload = localSessionToRemote({
      learnerModel,
      dashboardStats,
      tasks,
      xp: user.xp,
      betaMastery,
      firstAttemptKeys: [...firstAttemptKeys],
      openMistakes,
      activities,
      userSettings: user.settings,
      ...local,
    });
    return pushRemoteSession(token, user.settings, payload);
  }, [
    user.settings,
    user.xp,
    learnerModel,
    dashboardStats,
    tasks,
    betaMastery,
    firstAttemptKeys,
    openMistakes,
    activities,
  ]);

  const syncAccountOnLogin = useCallback(async () => {
    const token = user.settings.authToken;
    if (token) {
      try {
        const me = await authMe(token, user.settings);
        if (me.email) {
          setUser((u) => applyAuthIdentity(u, me.email));
        }
      } catch {
        /* ignore — sync still proceeds */
      }
    }
    await pullLibraryFromServer();
    await pullSessionFromServer();
    await pushSessionToServer();
  }, [user.settings, pullLibraryFromServer, pullSessionFromServer, pushSessionToServer]);

  const refreshAuthPlan = useCallback(async () => {
    const token = user.settings.authToken;
    if (!token) return null;
    const me = await authMe(token, user.settings);
    updateSettings({ authPlan: me.plan, authEmail: me.email ?? user.settings.authEmail });
    if (me.email) {
      setUser((u) => applyAuthIdentity(u, me.email));
    }
    return me.plan;
  }, [user.settings, updateSettings]);

  const autoSessionSynced = useRef<string | null>(null);
  useEffect(() => {
    const token = user.settings.authToken;
    if (!token || autoSessionSynced.current === token) return;
    autoSessionSynced.current = token;
    void pullSessionFromServer().catch(() => {
      autoSessionSynced.current = null;
    });
  }, [user.settings.authToken, pullSessionFromServer]);

  const processUpload = useCallback(async (payload: UploadPayload) => {
    setIsUploading(true);
    try {
      const MIN_SOURCE_CHARS = 80;
      const fileTexts: string[] = [];
      const newFiles: UploadedFile[] = [];
      let ytTranscript = '';
      const pasted = payload.pastedContent?.trim() ?? '';

      for (const f of payload.files) {
        const extracted = await extractFileContent(f, user.settings);
        if (extracted.text.trim()) fileTexts.push(extracted.text);
        newFiles.push(uploadedFileMeta(f, undefined, undefined, extracted.text, extracted.pageCount));
      }
      if (payload.youtubeUrl) {
        const fetched = await fetchYoutubeTranscript(payload.youtubeUrl, user.settings);
        if (fetched?.trim()) {
          ytTranscript = fetched;
          fileTexts.push(ytTranscript);
        }
      }

      let text = [pasted, ...fileTexts].filter(Boolean).join('\n\n');
      if (text.trim().length < MIN_SOURCE_CHARS) {
        text = await readTextFromFiles(payload.files, user.settings);
      }
      if (text.trim().length < MIN_SOURCE_CHARS) {
        throw new Error(
          'Could not extract enough readable text (need at least 80 characters). '
          + 'Use PDF with selectable text, scanned PDF (OCR), DOCX, TXT/MD, images, or paste your notes directly.',
        );
      }

      if (pasted && !fileTexts.some((t) => t.includes(pasted.slice(0, 40)))) {
        newFiles.push({
          id: `file-paste-${Date.now()}`,
          name: 'Pasted notes',
          type: 'txt',
          size: pasted.length,
          uploadedAt: new Date().toISOString(),
          status: 'analyzed',
          progress: 100,
          extractedText: pasted,
        });
      }
      if (newFiles.length === 0) {
        newFiles.push({
          id: `file-source-${Date.now()}`,
          name: payload.files[0]?.name ?? 'Course notes',
          type: 'txt',
          size: text.length,
          uploadedAt: new Date().toISOString(),
          status: 'analyzed',
          progress: 100,
          extractedText: text,
        });
      }

    // Course generation, best source first:
    //   1. LLM-grounded outline (richest) when an API key is configured;
    //   2. otherwise the offline content-recognition engine, which derives a
    //      real structured outline from the actual note content — no key needed;
    //   3. only if there's too little text, the lightweight keyword template.
    let course: Course;
    const fileNames = payload.files.map((f) => f.name);
    const outline =
      (await generateCourseOutline(text, fileNames, user.settings)) ??
      (await analyzeContentToOutlineAsync(text, fileNames, user.settings)) ??
      analyzeContentToOutline(text, fileNames, user.settings);
    let nextGlossary = glossaryEntries;
    const extendTarget =
      payload.uploadMode === 'extend' && payload.targetCourseId
        ? courses.find((c) => c.id === payload.targetCourseId && !MOCK_COURSE_IDS.has(c.id))
        : undefined;

    if (outline) {
      const built = buildCourseFromOutline(outline, { ...payload, pastedContent: text }, courses.length);
      if (extendTarget) {
        const merged = mergeOutlineIntoCourse(
          extendTarget,
          outline,
          fileNames,
          glossaryEntries,
          built.glossary,
        );
        course = merged.course;
        nextGlossary = [
          ...glossaryEntries.filter((g) => g.courseId !== course.id),
          ...merged.glossary,
        ];
        setGlossaryEntries(nextGlossary);
      } else {
        course = built.course;
        if (built.glossary.length > 0) {
          nextGlossary = [...glossaryEntries, ...built.glossary];
          setGlossaryEntries(nextGlossary);
        }
      }
    } else if (extendTarget) {
      course = extendTarget;
    } else {
      course = buildCourseFromUpload({ ...payload, pastedContent: text }, courses.length);
    }
    const topics = course.topics.map((t) => t.title);
    const withCourse = newFiles.map((meta) => ({
      ...meta,
      courseId: course.id,
      extractedTopics: topics,
      extractedText: meta.extractedText?.trim()
        ? meta.extractedText
        : (newFiles.length === 1 ? text : meta.extractedText),
    }));
    if (payload.youtubeUrl) {
      withCourse.push({
        id: `file-yt-${Date.now()}`,
        name: payload.youtubeUrl,
        type: 'txt',
        size: ytTranscript.length,
        uploadedAt: new Date().toISOString(),
        status: 'analyzed',
        progress: 100,
        courseId: course.id,
        extractedTopics: topics,
        extractedText: ytTranscript || undefined,
      });
    }
    const nextFiles = [...uploadedFiles, ...withCourse];
    if (outline && course.conceptSpans === undefined) {
      const conceptLabels = [...new Set(outline.topics.flatMap((t) => t.concepts))];
      course = {
        ...course,
        conceptSpans: buildConceptSpans(withCourse, conceptLabels, course.id),
      };
    }
    const generatedOnly = [
      ...courses.filter((c) => !MOCK_COURSE_IDS.has(c.id) && c.id !== course.id),
      course,
    ];
    const nextCourses = initialCourses(generatedOnly, user.settings, mockCourses);
    const nextTasks = mergeCourseTasks(stripDemoFromTasks(tasks), course);
    const nextBeta = mergeBetaFromCourse(betaMastery, course);
    const nextLm = mergeSkillNodesFromCourse(learnerModel, course);
    const nextLmMetrics = recomputeLearnerMetrics(nextLm, nextBeta, firstAttemptKeys, openMistakes);
    setUploadedFiles(nextFiles);
    setCourses(nextCourses);
    setTasks(nextTasks);
    setBetaMastery(nextBeta);
    setLearnerModel(nextLmMetrics);
    persistLibrary(nextFiles, nextGlossary, nextCourses.filter((c) => !MOCK_COURSE_IDS.has(c.id)));
    const actLabel = extendTarget ? `Extended course: ${course.title}` : `Created course: ${course.title}`;
    const nextActs = logActivity(createActivity('upload', actLabel));
    persist(nextLmMetrics, dashboardStats, nextTasks, user.xp, nextBeta, firstAttemptKeys, openMistakes, nextActs, user.settings);
    setSelectedCourse(course);
    return course;
    } finally {
      setIsUploading(false);
    }
  }, [courses, uploadedFiles, glossaryEntries, learnerModel, dashboardStats, tasks, user.xp, user.settings, betaMastery, firstAttemptKeys, openMistakes, persist, persistLibrary, logActivity]);

  const simulateUpload = useCallback((files: File[]) => {
    setIsUploading(true);
    const newFiles: UploadedFile[] = files.map((f, i) => ({
      id: `file-${Date.now()}-${i}`,
      name: f.name,
      type: getFileType(f.name),
      size: f.size,
      uploadedAt: new Date().toISOString(),
      status: 'uploading' as const,
      progress: 0,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((file) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadedFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, status: 'processing' as const, progress: 100 } : f));
          setTimeout(() => {
            setUploadedFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, status: 'analyzed' as const } : f));
            setIsUploading(false);
          }, 2000);
        } else {
          setUploadedFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, progress } : f));
        }
      }, 500);
    });
  }, []);

  const startTask = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === 'completed') return;

    setActiveTaskId(taskId);
    const action = getTaskAction(task);

    switch (action) {
      case 'practical':
        setPracticalLessonView(true);
        break;
      case 'workspace':
        setStudyWorkspaceOpen(true);
        break;
      case 'agent':
        bindAgentToTask(task);
        navigate('agent');
        break;
      case 'tasks-review':
        setReviewSessionOpen(true);
        break;
      case 'tasks-fix':
        setMistakeRetryOpen(true);
        break;
      case 'tasks-prereq':
        setPrerequisiteRepairOpen(true);
        break;
      case 'exam-prep':
        setExamPrepOpen(true);
        break;
      default:
        setActiveLessonView(true);
        break;
    }
  }, [tasks, navigate, bindAgentToTask]);

  startTaskRef.current = startTask;

  const startSession = useCallback((sessionType: SessionType) => {
    const queue = filterTasksForSession(tasks, sessionType);
    if (queue.length === 0) {
      navigate('tasks');
      return;
    }
    const ids = queue.map((t) => t.id);
    setActiveSessionType(sessionType);
    setSessionQueue(ids);
    setSessionTotal(ids.length);
    startTask(ids[0]!);
  }, [tasks, startTask, navigate]);

  const resolveMisconception = useCallback((misconceptionId: string) => {
    setLearnerModel((lm) => {
      const target = lm.misconceptions.find((m) => m.id === misconceptionId);
      const next: LearnerModel = {
        ...lm,
        misconceptions: lm.misconceptions.map((m) =>
          m.id === misconceptionId ? { ...m, corrected: true } : m,
        ),
      };
      const updated = recomputeLearnerMetrics(next, betaMastery, firstAttemptKeys, openMistakes);
      const nextActs = logActivity(createActivity('mistake_fixed', `Corrected misconception: ${target?.concept ?? 'concept'}`));
      persist(updated, dashboardStats, tasks, user.xp, betaMastery, firstAttemptKeys, openMistakes, nextActs, user.settings);
      return updated;
    });
  }, [betaMastery, firstAttemptKeys, openMistakes, learnerModel, dashboardStats, tasks, user, persist, recomputeLearnerMetrics, logActivity]);

  const activeTask = useMemo(
    () => (activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null),
    [activeTaskId, tasks],
  );

  const completeOnboarding = useCallback((data: {
    role?: string;
    goals?: string[];
    dailyGoalMinutes?: number;
    examDate?: string;
    openUpload?: boolean;
    displayName?: string;
  }) => {
    setUser((prev) => {
      const nextSettings: UserSettings = {
        ...prev.settings,
        dailyGoalMinutes: data.dailyGoalMinutes ?? prev.settings.dailyGoalMinutes,
        examDate: data.examDate || prev.settings.examDate,
      };
      const trimmedName = (data.displayName ?? '').trim();
      const next = {
        ...prev,
        name: trimmedName || prev.name,
        segment: (data.role as typeof prev.segment) ?? prev.segment,
        onboardingComplete: true,
        settings: nextSettings,
      };
      persist(learnerModel, dashboardStats, tasks, next.xp, betaMastery, firstAttemptKeys, openMistakes, activities, nextSettings);
      return next;
    });
    if (data.openUpload) setShowUploadModal(true);
    navigate('dashboard');
  }, [learnerModel, dashboardStats, tasks, betaMastery, firstAttemptKeys, openMistakes, activities, persist, navigate]);

  const dashboardExtras = useMemo(() => {
    const weekly = learnerModel.weeklyMastery;
    const masteryDelta = weekly.length >= 2 ? weekly[weekly.length - 1]! - weekly[0]! : 0;
    const examDate = user.settings.examDate;
    const daysToExam = examDate
      ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000))
      : null;
    const pendingReviews = tasks.filter((t) => t.isSpacedRepetition && t.status === 'pending').length;
    const antiPassive = dashboardStats.studyTimeToday > 20
      && learnerModel.confidenceCalibration.length > 0
      && Date.now() - new Date(learnerModel.confidenceCalibration.at(-1)?.timestamp ?? 0).getTime() > 86400000;
    return { masteryDelta, daysToExam, pendingReviews, antiPassive };
  }, [learnerModel, user.settings.examDate, tasks, dashboardStats.studyTimeToday]);

  const pedagogyMetrics = useMemo(() => {
    const masteryMap = masteryMapFromSkills(learnerModel, courses, shouldShowDemo(user.settings));
    const courseEdges = edgesFromCourses(courses);
    const edges = courseEdges.length > 0
      ? courseEdges
      : (shouldShowDemo(user.settings) ? ECON_CONCEPT_EDGES : []);
    const repairs = computePrerequisiteRepairs(masteryMap, edges);
    const calibration = computeCalibration(learnerModel.confidenceCalibration);
    const conceptBars = betaMastery.map((b) => ({
      concept: b.concept,
      mastery: Math.round(betaMean(b.alpha, b.beta) * 100),
    }));
    return { repairs, calibration, conceptBars, openMistakes: openMistakes.filter((m) => !m.resolved) };
  }, [learnerModel, betaMastery, openMistakes, courses, user.settings]);

  return {
    currentView, navigate,
    sidebarOpen, setSidebarOpen,
    user, updateSettings, toggleTheme,
    courses, selectedCourse, setSelectedCourse,
    tasks, completeTask, completeTaskAndAdvance, submitReviewRating, submitReviewAndAdvance, submitLeitnerRating,
    startTask, startSession, endSession,
    sessionQueue, sessionTotal, activeSessionType,
    activeTask, activeTaskId, setActiveTaskId, expandedTaskId, setExpandedTaskId,
    learnerModel, dashboardStats, pedagogyMetrics, dashboardExtras, activities,
    recordConfidence, recordQuizAttempt,
    openMistakes, resolveMistake, resolveMisconception, completeOnboarding,
    agentMessages, addAgentMessage, updateAgentMessage, agentMode, setAgentMode, bindAgentToTask,
    uploadedFiles, glossaryEntries, isUploading, simulateUpload, processUpload,
    pullLibraryFromServer, pullSessionFromServer, pushSessionToServer, syncAccountOnLogin,
    refreshAuthPlan, logStudyMinutes,
    showUploadModal, setShowUploadModal,
    activeLessonView, setActiveLessonView,
    practicalLessonView, setPracticalLessonView,
    studyWorkspaceOpen, setStudyWorkspaceOpen,
    sourceHighlight, openSourceAt, clearSourceHighlight: () => setSourceHighlight(null),
    reviewSessionOpen, setReviewSessionOpen,
    mistakeRetryOpen, setMistakeRetryOpen,
    examPrepOpen, setExamPrepOpen,
    prerequisiteRepairOpen, setPrerequisiteRepairOpen,
  };
}

function getFileType(name: string): UploadedFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'docx': case 'doc': return 'docx';
    case 'pptx': case 'ppt': return 'pptx';
    case 'txt': return 'txt';
    case 'md': return 'md';
    case 'csv': return 'csv';
    case 'py': case 'js': case 'ts': case 'r': case 'sql': return 'code';
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return 'image';
    default: return 'txt';
  }
}
