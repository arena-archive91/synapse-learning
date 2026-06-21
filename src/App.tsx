import { useEffect, useState, useMemo, lazy, Suspense, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/useStore';
import { applyTheme, watchSystemTheme } from './lib/theme';
import { I18nContext, t as translate, type I18nKey } from './lib/i18n';
import { getTaskConcept, getWorkspaceTool, getMistakesForTask, getExamDurationSeconds, findPendingTask } from './lib/taskFlows';
import {
  buildTaskFlowContext,
  resolveExamQuestions,
  resolvePrerequisiteCheckpoint,
  resolvePrerequisiteSteps,
  resolveReviewCards,
} from './lib/taskFlowContent';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import { NotificationsPanel } from './components/NotificationsPanel';
import { MistakeRetryView } from './components/MistakeRetryView';
import { ExamPrepView } from './components/ExamPrepView';
import { PrerequisiteRepairView } from './components/PrerequisiteRepairView';
import { SessionQueueBar } from './components/SessionQueueBar';
import { Landing } from './components/Landing';
import { Onboarding } from './components/Onboarding';
import { Shell } from './components/Shell';
import { Dashboard } from './components/Dashboard';
import { Library } from './components/Library';
import { Tasks } from './components/Tasks';
import { CourseView } from './components/CourseView';
import { Settings } from './components/Settings';
import { UploadModal } from './components/UploadModal';
import type { AppView } from './types';
import type { FsrsRating } from './lib/pedagogy';
import { visibleCourses } from './lib/demoMode';

const Agent = lazy(() => import('./components/Agent').then((m) => ({ default: m.Agent })));
const Analytics = lazy(() => import('./components/Analytics').then((m) => ({ default: m.Analytics })));
const LessonView = lazy(() => import('./components/LessonView').then((m) => ({ default: m.LessonView })));
const PracticalLessonView = lazy(() => import('./components/PracticalLessonView').then((m) => ({ default: m.PracticalLessonView })));
const StudyWorkspace = lazy(() => import('./components/workspace/StudyWorkspace').then((m) => ({ default: m.StudyWorkspace })));
const ReviewSessionView = lazy(() => import('./components/ReviewSessionView').then((m) => ({ default: m.ReviewSessionView })));

function LazyOverlay({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export default function App() {
  const store = useAppStore();
  const { open: paletteOpen, close: closePalette, setOpen: setPaletteOpen } = useCommandPalette();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const closeLessonView = () => {
    store.setActiveLessonView(false);
    store.setActiveTaskId(null);
  };

  const closePracticalView = () => {
    store.setPracticalLessonView(false);
    store.setActiveTaskId(null);
  };

  const completeActiveTask = () => {
    if (store.activeTaskId) {
      store.completeTaskAndAdvance(store.activeTaskId);
    }
  };

  const completeAgentTask = () => {
    if (store.activeTaskId) {
      store.completeTaskAndAdvance(store.activeTaskId);
    }
  };

  const closeWorkspace = () => {
    store.setStudyWorkspaceOpen(false);
    store.setActiveTaskId(null);
  };

  const closeReviewSession = () => {
    store.setReviewSessionOpen(false);
    store.setActiveTaskId(null);
  };

  const handleReviewRating = (rating: FsrsRating) => {
    if (store.activeTaskId) {
      store.submitReviewAndAdvance(store.activeTaskId, rating);
    } else {
      store.setReviewSessionOpen(false);
    }
  };

  const taskConcept = store.activeTask ? getTaskConcept(store.activeTask) : undefined;
  const taskFlowCtx = useMemo(
    () => buildTaskFlowContext({
      uploadedFiles: store.uploadedFiles,
      glossaryEntries: store.glossaryEntries,
      courses: store.courses,
      courseId: store.activeTask?.courseId,
      lang: store.user.settings.language,
    }),
    [store.uploadedFiles, store.glossaryEntries, store.courses, store.activeTask?.courseId, store.user.settings.language],
  );
  const workspaceTool = store.activeTask ? getWorkspaceTool(store.activeTask) : undefined;
  const reviewCards = taskConcept ? resolveReviewCards(taskConcept, taskFlowCtx) : undefined;
  const examQuestions = taskConcept ? resolveExamQuestions(taskConcept, taskFlowCtx) : undefined;
  const examDuration = store.activeTask ? getExamDurationSeconds(store.activeTask.estimatedMinutes) : 180;
  const prerequisiteSteps = taskConcept
    ? resolvePrerequisiteSteps(taskConcept, taskFlowCtx, store.pedagogyMetrics.repairs[0]?.concept)
    : undefined;
  const prerequisiteCheckpoint = taskConcept ? resolvePrerequisiteCheckpoint(taskConcept, taskFlowCtx) : undefined;
  const prerequisiteTarget = store.pedagogyMetrics.repairs[0]?.concept;
  const taskMistakes = store.activeTask
    ? getMistakesForTask(store.activeTask, store.openMistakes)
    : [];
  const sessionCurrentIndex = store.sessionTotal > 0
    ? store.sessionTotal - store.sessionQueue.length + 1
    : 0;

  const nextPendingTask = findPendingTask(store.tasks, () => true);

  const i18nValue = useMemo(() => ({
    lang: store.user.settings.language,
    t: (key: I18nKey) => translate(key, store.user.settings.language),
  }), [store.user.settings.language]);

  const shellProps = {
    currentView: store.currentView,
    onNavigate: store.navigate,
    sidebarOpen: store.sidebarOpen,
    onToggleSidebar: store.setSidebarOpen,
    user: store.user,
    stats: store.dashboardStats,
    onUpload: () => store.setShowUploadModal(true),
    theme: store.user.settings.theme,
    onToggleTheme: store.toggleTheme,
    onOpenSearch: () => setPaletteOpen(true),
    onOpenNotifications: () => setNotificationsOpen(true),
    notificationCount: store.activities.length,
    breadcrumb: store.activeTask
      ? { course: store.activeTask.courseName, lesson: store.activeTask.title }
      : store.selectedCourse
        ? { course: store.selectedCourse.title }
        : undefined,
  };

  const overlays = (
    <>
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        tasks={store.tasks}
        onNavigate={store.navigate}
        onStartTask={store.startTask}
        onStartSession={store.startSession}
      />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        activities={store.activities}
      />
      {store.activeLessonView && (
        <LazyOverlay>
        <LessonView
          onClose={closeLessonView}
          onOpenAgent={() => { store.setActiveLessonView(false); store.navigate('agent'); }}
          onComplete={completeActiveTask}
          onQuizAttempt={(c, corr, conf, sk) => store.recordQuizAttempt(c, corr, conf, sk, store.activeTask?.courseId)}
          taskTitle={store.activeTask?.title}
          courseName={store.activeTask?.courseName}
          quizConcept={taskConcept}
          xpReward={store.activeTask?.xpReward}
          taskId={store.activeTaskId ?? undefined}
          courseId={store.activeTask?.courseId}
          settings={store.user.settings}
          overallMastery={Math.round(store.learnerModel.overallMastery)}
          streak={store.dashboardStats.streak}
          onStartNextTask={() => { if (nextPendingTask) store.startTask(nextPendingTask.id); }}
          uploadedFiles={store.uploadedFiles}
          glossaryEntries={store.glossaryEntries}
          courses={store.courses}
          onUpload={() => store.setShowUploadModal(true)}
        />
        </LazyOverlay>
      )}
      {store.practicalLessonView && (
        <LazyOverlay>
        <PracticalLessonView
          onClose={closePracticalView}
          onOpenAgent={() => { store.setPracticalLessonView(false); store.navigate('agent'); }}
          onComplete={completeActiveTask}
          onPracticeAttempt={(concept, correct) => store.recordQuizAttempt(concept, correct, 70, undefined, store.activeTask?.courseId)}
          taskTitle={store.activeTask?.title}
          courseName={store.activeTask?.courseName}
          quizConcept={taskConcept}
          xpReward={store.activeTask?.xpReward}
          uploadedFiles={store.uploadedFiles}
          glossaryEntries={store.glossaryEntries}
          courses={store.courses}
          courseId={store.activeTask?.courseId}
          lang={store.user.settings.language}
          onUpload={() => store.setShowUploadModal(true)}
        />
        </LazyOverlay>
      )}
      {store.studyWorkspaceOpen && (
        <LazyOverlay>
        <StudyWorkspace
          key={`${store.activeTaskId ?? store.selectedCourse?.id ?? 'free'}-${store.uploadedFiles.length}`}
          onClose={closeWorkspace}
          onOpenAgent={() => { store.setStudyWorkspaceOpen(false); store.navigate('agent'); }}
          onComplete={completeActiveTask}
          taskTitle={store.activeTask?.title}
          courseName={store.activeTask?.courseName ?? store.selectedCourse?.title}
          quizConcept={taskConcept}
          xpReward={store.activeTask?.xpReward}
          initialTool={workspaceTool}
          taskId={store.activeTaskId}
          learnerModel={store.learnerModel}
          dashboardStats={store.dashboardStats}
          conceptBars={store.pedagogyMetrics.conceptBars}
          uploadedFiles={store.uploadedFiles}
          glossaryEntries={store.glossaryEntries}
          courses={store.courses}
          courseId={store.activeTask?.courseId ?? store.selectedCourse?.id}
          tasks={store.tasks}
          onQuizAttempt={(c, corr, conf, sk) => store.recordQuizAttempt(c, corr, conf, sk, store.activeTask?.courseId)}
          onLeitnerRate={(concept, rating) => store.submitLeitnerRating(concept, rating, store.activeTask?.courseId ?? store.selectedCourse?.id)}
          onLogStudyMinutes={store.logStudyMinutes}
          userSettings={store.user.settings}
          onUpload={() => store.setShowUploadModal(true)}
          sourceHighlight={store.sourceHighlight}
          openSourceAt={store.openSourceAt}
          clearSourceHighlight={store.clearSourceHighlight}
        />
        </LazyOverlay>
      )}
      {store.reviewSessionOpen && (
        <LazyOverlay>
        <ReviewSessionView
          onClose={closeReviewSession}
          onOpenAgent={() => { store.setReviewSessionOpen(false); store.navigate('agent'); }}
          onReviewRating={handleReviewRating}
          taskTitle={store.activeTask?.title}
          courseName={store.activeTask?.courseName}
          quizConcept={taskConcept}
          xpReward={store.activeTask?.xpReward}
          cards={reviewCards}
        />
        </LazyOverlay>
      )}
      {store.mistakeRetryOpen && (
        <MistakeRetryView
          onClose={() => { store.setMistakeRetryOpen(false); store.setActiveTaskId(null); }}
          onOpenAgent={() => {
            if (store.activeTask) store.bindAgentToTask(store.activeTask);
            store.setMistakeRetryOpen(false);
            store.navigate('agent');
          }}
          onComplete={completeActiveTask}
          onResolveMistake={store.resolveMistake}
          mistakes={taskMistakes}
          taskTitle={store.activeTask?.title}
          courseName={store.activeTask?.courseName}
          quizConcept={taskConcept}
          xpReward={store.activeTask?.xpReward}
        />
      )}
      {store.examPrepOpen && (
        <ExamPrepView
          onClose={() => { store.setExamPrepOpen(false); store.setActiveTaskId(null); }}
          onOpenAgent={() => { store.setExamPrepOpen(false); store.navigate('agent'); }}
          onComplete={completeActiveTask}
          onQuizAttempt={(c, corr, conf) => store.recordQuizAttempt(c, corr, conf, undefined, store.activeTask?.courseId)}
          taskTitle={store.activeTask?.title}
          courseName={store.activeTask?.courseName}
          quizConcept={taskConcept}
          xpReward={store.activeTask?.xpReward}
          durationSeconds={examDuration}
          questions={examQuestions}
        />
      )}
      {store.prerequisiteRepairOpen && (
        <PrerequisiteRepairView
          onClose={() => { store.setPrerequisiteRepairOpen(false); store.setActiveTaskId(null); }}
          onOpenAgent={() => {
            if (store.activeTask) store.bindAgentToTask(store.activeTask);
            store.setPrerequisiteRepairOpen(false);
            store.navigate('agent');
          }}
          onComplete={completeActiveTask}
          onQuizAttempt={(c, corr, conf) => store.recordQuizAttempt(c, corr, conf, undefined, store.activeTask?.courseId)}
          taskTitle={store.activeTask?.title}
          courseName={store.activeTask?.courseName}
          quizConcept={taskConcept}
          targetConcept={prerequisiteTarget}
          xpReward={store.activeTask?.xpReward}
          steps={prerequisiteSteps}
          checkpoint={prerequisiteCheckpoint}
        />
      )}
      <UploadModal
        isOpen={store.showUploadModal}
        onClose={() => store.setShowUploadModal(false)}
        onUpload={() => {}}
        onProcessUpload={store.processUpload}
        onUploadComplete={(course) => {
          store.setSelectedCourse(course);
          store.setStudyWorkspaceOpen(true);
        }}
        onProceed={() => {
          /* Navigation handled in onUploadComplete after successful upload */
        }}
        courses={visibleCourses(store.courses, store.user.settings)}
      />
    </>
  );

  const sessionBar = store.activeSessionType && store.sessionTotal > 0 ? (
    <SessionQueueBar
      sessionType={store.activeSessionType}
      currentIndex={sessionCurrentIndex}
      total={store.sessionTotal}
      onEndSession={store.endSession}
    />
  ) : null;

  useEffect(() => {
    applyTheme(store.user.settings.theme);
    if (store.user.settings.theme !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [store.user.settings.theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') !== 'success' || !store.user.settings.authToken) return;
    void store.refreshAuthPlan().finally(() => {
      window.history.replaceState({}, '', window.location.pathname);
    });
  }, [store.user.settings.authToken, store.refreshAuthPlan]);

  // Landing page
  if (store.currentView === 'landing') {
    return (
      <I18nContext.Provider value={i18nValue}>
        <Landing onGetStarted={() => store.navigate('onboarding')} />
      </I18nContext.Provider>
    );
  }

  // Onboarding
  if (store.currentView === 'onboarding') {
    return (
      <I18nContext.Provider value={i18nValue}>
        <Onboarding onComplete={store.completeOnboarding} />
      </I18nContext.Provider>
    );
  }

  // Course detail view
  if (store.currentView === 'course' && store.selectedCourse) {
    return (
      <I18nContext.Provider value={i18nValue}>
        <Shell {...shellProps} currentView={store.currentView}>
          <CourseView course={store.selectedCourse} onBack={() => store.navigate('library')} onStartLesson={() => store.setStudyWorkspaceOpen(true)} onOpenAgent={() => store.navigate('agent')} />
        </Shell>
        {overlays}
      </I18nContext.Provider>
    );
  }

  // Main app views
  return (
    <I18nContext.Provider value={i18nValue}>
      <Shell {...shellProps}>
        {sessionBar}
        <AnimatePresence mode="wait">
        <motion.div key={store.currentView} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {store.currentView === 'dashboard' && (
            <Dashboard
              stats={store.dashboardStats}
              courses={store.courses}
              tasks={store.tasks}
              learnerModel={store.learnerModel}
              prerequisiteRepairs={store.pedagogyMetrics.repairs}
              calibration={store.pedagogyMetrics.calibration}
              conceptMastery={store.pedagogyMetrics.conceptBars}
              activities={store.activities}
              masteryDelta={store.dashboardExtras.masteryDelta}
              daysToExam={store.dashboardExtras.daysToExam}
              antiPassiveAlert={store.dashboardExtras.antiPassive}
              onStartTask={store.startTask}
              onStartSession={store.startSession}
              onResolveMisconception={store.resolveMisconception}
              onNavigate={(view: AppView) => store.navigate(view)}
              onSelectCourse={(course) => { store.setSelectedCourse(course); store.navigate('course'); }}
              onOpenWorkspace={() => store.setStudyWorkspaceOpen(true)}
            />
          )}
          {store.currentView === 'library' && (
            <Library
              courses={visibleCourses(store.courses, store.user.settings)}
              uploadedFiles={store.uploadedFiles}
              onSelectCourse={(course) => { store.setSelectedCourse(course); store.navigate('course'); }}
              onUpload={() => store.setShowUploadModal(true)}
            />
          )}
          {store.currentView === 'tasks' && (
            <Tasks
              tasks={store.tasks}
              onComplete={store.completeTask}
              onReviewRating={store.submitReviewRating}
              onStartTask={store.startTask}
              onStartSession={store.startSession}
              daysToExam={store.dashboardExtras.daysToExam}
              expandedTaskId={store.expandedTaskId}
              onExpandedTaskChange={store.setExpandedTaskId}
              openMistakes={store.pedagogyMetrics.openMistakes}
              onResolveMistake={store.resolveMistake}
            />
          )}
          {store.currentView === 'agent' && (
            <LazyOverlay>
            <Agent
              messages={store.agentMessages}
              mode={store.agentMode}
              courses={store.courses}
              onSendMessage={store.addAgentMessage}
              onUpdateMessage={store.updateAgentMessage}
              onChangeMode={store.setAgentMode}
              activeTaskTitle={store.activeTask?.title}
              activeTaskConcept={taskConcept}
              xpReward={store.activeTask?.xpReward}
              onCompleteTask={store.activeTaskId ? completeAgentTask : undefined}
              settings={store.user.settings}
              uploadedFiles={store.uploadedFiles}
              onGoToSource={store.openSourceAt}
              lang={store.user.settings.language}
            />
            </LazyOverlay>
          )}
          {store.currentView === 'analytics' && (
            <LazyOverlay>
            <Analytics
              learnerModel={store.learnerModel}
              stats={store.dashboardStats}
              courses={store.courses}
              activities={store.activities}
              prerequisiteRepairs={store.pedagogyMetrics.repairs}
            />
            </LazyOverlay>
          )}
          {store.currentView === 'settings' && (
            <Settings
              settings={store.user.settings}
              onUpdate={store.updateSettings}
              onPullLibrary={store.pullLibraryFromServer}
              onPullSession={store.pullSessionFromServer}
              onPushSession={store.pushSessionToServer}
              onSyncAccount={store.syncAccountOnLogin}
              onRefreshPlan={store.refreshAuthPlan}
            />
          )}
        </motion.div>
      </AnimatePresence>
      </Shell>
      {overlays}
    </I18nContext.Provider>
  );
}
