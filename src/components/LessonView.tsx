import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Circle, ChevronRight, Sparkles,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { ConfidenceSelector } from './visuals/ConfidenceSelector';
import { GroundedLessonContent } from './grounded/GroundedLessonContent';
import { buildLessonSteps } from '../lib/lessonContent';
import { isMcQuiz } from '../lib/lessonTypes';
import { getLessonProgress, saveLessonProgress } from '../lib/lessonProgress';
import { useI18n } from '../lib/i18n';
import { buildWorkspaceNoteBundle } from '../lib/workspaceNoteContent';
import { generateLessonPanels, canGenerateGroundedLesson } from '../lib/lessonGenerator';
import type { WorkspacePanel } from '../lib/workspaceLessonPanels';
import type { Course, GlossaryEntry, UploadedFile, UserSettings } from '../types';

interface LessonViewProps {
  onClose: () => void;
  onOpenAgent: () => void;
  onComplete?: () => void;
  onQuizAttempt?: (concept: string, correct: boolean, confidence: number, stepKey?: string) => void;
  taskTitle?: string;
  courseName?: string;
  quizConcept?: string;
  xpReward?: number;
  taskId?: string;
  courseId?: string;
  settings?: UserSettings;
  overallMastery?: number;
  streak?: number;
  onStartNextTask?: () => void;
  uploadedFiles?: UploadedFile[];
  glossaryEntries?: GlossaryEntry[];
  courses?: Course[];
  onUpload?: () => void;
}

export function LessonView({
  onClose,
  onOpenAgent,
  onComplete,
  onQuizAttempt,
  taskTitle,
  courseName,
  quizConcept = 'Study topic',
  xpReward = 50,
  taskId,
  courseId,
  settings,
  overallMastery = 0,
  streak = 0,
  onStartNextTask,
  uploadedFiles = [],
  glossaryEntries = [],
  courses = [],
  onUpload,
}: LessonViewProps) {
  const { t, lang } = useI18n();
  const lessonKey = taskId ? `lesson:${taskId}` : `lesson:${quizConcept.replace(/\s+/g, '-').toLowerCase()}`;

  const noteBundle = useMemo(
    () => buildWorkspaceNoteBundle({
      uploadedFiles,
      glossaryEntries,
      courses,
      courseId,
      concept: quizConcept,
      conceptBars: [],
      lang,
    }),
    [uploadedFiles, glossaryEntries, courses, courseId, quizConcept, lang],
  );

  const dynamicSteps = useMemo(() => {
    if (!noteBundle.hasSource) {
      return [{ key: 'intro' as const, label: lang === 'el' ? 'Ανέβασμα' : 'Upload' }];
    }
    return buildLessonSteps(settings);
  }, [noteBundle.hasSource, settings, lang]);

  const quizDef = noteBundle.quiz ?? {
    question: lang === 'el' ? 'Ανέβασε σημειώσεις για κουίζ.' : 'Upload notes to generate a quiz.',
    options: ['—', '—', '—', '—'],
    correctIndex: 0,
  };

  const [currentStep, setCurrentStep] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [quizPassed, setQuizPassed] = useState(false);
  const [genPanels, setGenPanels] = useState<WorkspacePanel[] | null>(null);
  const [genStatus, setGenStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');

  const groundedAvailable = noteBundle.hasSource && canGenerateGroundedLesson(uploadedFiles, settings);

  useEffect(() => {
    let cancelled = false;
    setGenPanels(null);
    if (!groundedAvailable) {
      setGenStatus('idle');
      return;
    }
    setGenStatus('loading');
    generateLessonPanels(quizConcept, uploadedFiles, settings, courseId)
      .then((panels) => {
        if (cancelled) return;
        if (panels && panels.length > 0) {
          setGenPanels(panels);
          setGenStatus('ready');
        } else {
          setGenStatus('fallback');
        }
      })
      .catch(() => {
        if (!cancelled) setGenStatus('fallback');
      });
    return () => { cancelled = true; };
  }, [quizConcept, groundedAvailable, uploadedFiles, settings, courseId]);

  useEffect(() => {
    const saved = getLessonProgress(lessonKey);
    if (saved?.step != null) {
      setCurrentStep(Math.min(saved.step, dynamicSteps.length - 1));
      setQuizPassed(saved.quizPassed ?? false);
    }
  }, [lessonKey, dynamicSteps.length]);

  useEffect(() => {
    saveLessonProgress(lessonKey, {
      step: currentStep,
      practicePassed: true,
      quizPassed,
    });
  }, [lessonKey, currentStep, quizPassed]);

  const lessonTitle = taskTitle ?? quizConcept;
  const lessonCourse = noteBundle.hasSource
    ? (courseName ?? noteBundle.courseTitle ?? (lang === 'el' ? 'Το μάθημά σου' : 'Your course'))
    : (lang === 'el' ? 'Ανέβασε σημειώσεις' : 'Upload your notes');

  const step = dynamicSteps[currentStep] ?? dynamicSteps[0]!;
  const progress = ((currentStep + 1) / dynamicSteps.length) * 100;
  const isLast = currentStep >= dynamicSteps.length - 1;

  const canAdvance = () => {
    if (!noteBundle.hasSource) return false;
    if (step.key === 'quiz' && !quizPassed) return false;
    return true;
  };

  const goNext = () => {
    if (!canAdvance()) return;
    if (isLast) {
      onComplete?.();
      onClose();
      return;
    }
    setCurrentStep((s) => s + 1);
    setQuizAnswer(null);
    setConfidence(null);
  };

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const panelForStep = genPanels?.[currentStep] ?? null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-secondary/50">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover shrink-0">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{lessonTitle}</p>
            <p className="text-xs text-text-tertiary truncate">
              {lessonCourse}
              {noteBundle.hasSource && (
                <span className="ml-1.5 text-accent-emerald">· {lang === 'el' ? 'από τις σημειώσεις σου' : 'from your notes'}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenAgent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-brand-500/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            {t('agentBtn')}
          </button>
          <span className="text-xs text-accent-amber font-medium">+{xpReward} XP</span>
        </div>
      </div>

      <div className="h-1 bg-surface-hover">
        <div className="h-1 bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto hide-scrollbar">
        {dynamicSteps.map((s, i) => (
          <button
            key={s.key}
            onClick={() => noteBundle.hasSource && i <= currentStep && setCurrentStep(i)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all shrink-0',
              i === currentStep ? 'bg-brand-600/20 text-brand-300'
                : i < currentStep ? 'text-accent-emerald' : 'text-text-muted',
            )}
          >
            {i < currentStep ? <CheckCircle2 className="w-3 h-3" /> : <Circle className={cn('w-3 h-3', i !== currentStep && 'opacity-30')} />}
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GroundedLessonContent
                stepKey={step.key}
                stepLabel={step.label}
                concept={quizConcept}
                noteText={noteBundle.readerText}
                hasSource={noteBundle.hasSource}
                emptyMessage={noteBundle.emptyMessage}
                sourceName={noteBundle.sourceName}
                topic={noteBundle.matchingTopic}
                generatedPanel={panelForStep}
                genStatus={genStatus}
                quizDef={quizDef}
                quizAnswer={quizAnswer}
                quizPassed={quizPassed}
                onQuizSelect={(idx) => {
                  if (!isMcQuiz(quizDef)) return;
                  setQuizAnswer(idx);
                  const correct = idx === quizDef.correctIndex;
                  setQuizPassed(correct);
                  onQuizAttempt?.(quizConcept, correct, confidence ?? 75, `${lessonKey}:${step.key}`);
                }}
                onOpenAgent={onOpenAgent}
                onUpload={onUpload}
                lang={lang}
                t={t}
              />

              {step.key === 'quiz' && quizAnswer !== null && (
                <div className="mt-6">
                  <ConfidenceSelector value={confidence} onChange={setConfidence} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-border-subtle bg-surface-secondary/30">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className={cn('text-sm', currentStep === 0 ? 'text-text-muted' : 'text-text-secondary hover:text-text-primary')}
        >
          ← {t('previous')}
        </button>
        <div className="text-center">
          <p className="text-[10px] text-text-muted">{currentStep + 1}/{dynamicSteps.length}</p>
          {noteBundle.hasSource && (
            <p className="text-[10px] text-text-tertiary">{overallMastery}% · 🔥 {streak}d</p>
          )}
        </div>
        <button
          onClick={goNext}
          disabled={!canAdvance()}
          className={cn(
            'flex items-center gap-1 text-sm font-medium',
            canAdvance() ? 'text-brand-400 hover:text-brand-300' : 'text-text-muted cursor-not-allowed',
          )}
        >
          {isLast ? t('finish') : t('next')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isLast && quizPassed && onStartNextTask && (
        <div className="px-4 pb-4">
          <button
            onClick={onStartNextTask}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-brand-500/30 text-brand-300 hover:bg-brand-600/10"
          >
            {lang === 'el' ? 'Επόμενη εργασία →' : 'Next task →'}
          </button>
        </div>
      )}
    </div>
  );
}
