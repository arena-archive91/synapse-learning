import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Play, CheckCircle2, AlertTriangle, Lightbulb,
  ChevronRight, ArrowRight, Sparkles, RotateCcw,
  Terminal, Eye, Gauge, Zap, Upload,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { CodeEditor } from './CodeEditor';
import { buildPracticeExercisesFromNotes, getPracticeExercises } from '../lib/practiceExercises';
import { getPyodide, runPythonCode, validatePythonExercise } from '../lib/pyodideRunner';
import { useI18n, type Lang } from '../lib/i18n';
import type { Course, GlossaryEntry, UploadedFile } from '../types';

interface PracticalLessonViewProps {
  onClose: () => void;
  onOpenAgent: () => void;
  onComplete?: () => void;
  onPracticeAttempt?: (concept: string, correct: boolean) => void;
  taskTitle?: string;
  courseName?: string;
  quizConcept?: string;
  xpReward?: number;
  uploadedFiles?: UploadedFile[];
  glossaryEntries?: GlossaryEntry[];
  courses?: Course[];
  courseId?: string;
  lang?: Lang;
  onUpload?: () => void;
}

export function PracticalLessonView({
  onClose,
  onOpenAgent,
  onComplete,
  onPracticeAttempt,
  taskTitle,
  courseName,
  quizConcept = 'Study topic',
  xpReward = 40,
  uploadedFiles = [],
  glossaryEntries = [],
  courses = [],
  courseId,
  lang: langProp,
  onUpload,
}: PracticalLessonViewProps) {
  const { t, lang: i18nLang } = useI18n();
  const lang = langProp ?? i18nLang;

  const noteExercises = useMemo(
    () => buildPracticeExercisesFromNotes({
      uploadedFiles,
      glossaryEntries,
      courses,
      courseId,
      concept: quizConcept,
      lang,
    }),
    [uploadedFiles, glossaryEntries, courses, courseId, quizConcept, lang],
  );

  const exercises = useMemo(
    () => getPracticeExercises(quizConcept, noteExercises),
    [quizConcept, noteExercises],
  );

  const hasNoteSource = noteExercises.length > 0;
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const exercise = exercises[exerciseIdx] ?? exercises[0];

  const [code, setCode] = useState(exercise?.starterCode ?? '');
  const [output, setOutput] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [testsPassed, setTestsPassed] = useState<boolean | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [pyodideStatus, setPyodideStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const isPythonExercise = useMemo(
    () => exercise ? /\b(import |def |pandas|pd\.|numpy|np\.)/.test(exercise.starterCode + exercise.solution) : false,
    [exercise],
  );

  useEffect(() => {
    if (!isPythonExercise) return;
    setPyodideStatus('loading');
    getPyodide()
      .then(() => setPyodideStatus('ready'))
      .catch(() => setPyodideStatus('error'));
  }, [isPythonExercise]);

  useEffect(() => {
    if (!exercise) return;
    setCode(exercise.starterCode);
    setOutput('');
    setHintLevel(0);
    setTestsPassed(null);
    setShowSolution(false);
  }, [exercise]);

  const loadExercise = (idx: number) => {
    const ex = exercises[idx];
    if (!ex) return;
    setExerciseIdx(idx);
    setCode(ex.starterCode);
    setOutput('');
    setHintLevel(0);
    setTestsPassed(null);
    setShowSolution(false);
  };

  const runCode = async () => {
    if (!exercise) return;
    if (isPythonExercise && pyodideStatus === 'ready') {
      setOutput(t('loadingPyodide'));
      const run = await runPythonCode(code);
      if (run.error) {
        setOutput(`Error: ${run.error}`);
      } else {
        setOutput(run.resultPreview ?? (run.stdout || '(no output)'));
      }
      return;
    }
    setOutput(exercise.expectedOutput ?? 'Code executed (sandbox mode).');
  };

  const runTests = async () => {
    if (!exercise) return;
    if (isPythonExercise && pyodideStatus === 'ready') {
      setOutput(t('loadingPyodide'));
      const result = await validatePythonExercise(code, exercise.validate);
      setTestsPassed(result.passed);
      setOutput(result.output);
      if (result.passed) {
        onPracticeAttempt?.(quizConcept, true);
        setCompletedCount((c) => Math.max(c, exerciseIdx + 1));
      } else {
        onPracticeAttempt?.(quizConcept, false);
      }
      return;
    }
    const passed = exercise.validate(code);
    setTestsPassed(passed);
    setOutput(passed ? `✓ ${t('allTestsPassed')}` : `✗ ${t('testsFailed')}`);
    if (passed) {
      onPracticeAttempt?.(quizConcept, true);
      setCompletedCount((c) => Math.max(c, exerciseIdx + 1));
    } else {
      onPracticeAttempt?.(quizConcept, false);
    }
  };

  const handleFinish = () => {
    if (completedCount < exercises.length) return;
    onComplete?.();
    onClose();
  };

  const lessonTitle = taskTitle ?? (lang === 'el' ? `Εξάσκηση: ${quizConcept}` : `Practice: ${quizConcept}`);
  const lessonCourse = courseName ? `${courseName} · Practice` : 'Practice';
  const allDone = completedCount >= exercises.length;

  if (!hasNoteSource && onUpload) {
    return (
      <div className="fixed inset-0 z-50 bg-surface-primary flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-surface-secondary/50">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover">
              <X className="w-5 h-5 text-text-secondary" />
            </button>
            <div>
              <p className="text-sm font-semibold">{lessonTitle}</p>
              <p className="text-xs text-text-tertiary">{lessonCourse}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
          <Upload className="w-12 h-12 text-brand-400 mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            {lang === 'el' ? 'Ανέβασε σημειώσεις για εξάσκηση' : 'Upload notes to practice'}
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            {lang === 'el'
              ? 'Οι ασκήσεις παράγονται από παραδείγματα, τύπους και κώδικα στις δικές σου σημειώσεις — όχι από demo templates.'
              : 'Exercises are generated from worked examples, formulas, and code in your notes — not demo templates.'}
          </p>
          <button
            type="button"
            onClick={onUpload}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium"
          >
            {lang === 'el' ? 'Ανέβασμα υλικού' : 'Upload material'}
          </button>
        </div>
      </div>
    );
  }

  if (!exercise) return null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary flex flex-col w-full min-w-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-surface-secondary/50">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover shrink-0">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{lessonTitle}</p>
            <p className="text-xs text-text-tertiary truncate">{lessonCourse}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onOpenAgent} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-brand-500/30 transition-all">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Ask Agent
          </button>
          <span className="text-xs text-accent-amber font-medium">+{xpReward} XP</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-w-0">
        <div className="lg:w-[40%] border-b lg:border-b-0 lg:border-r border-border-subtle overflow-y-auto min-w-0">
          <div className="p-5 space-y-5">
            <div>
              <span className="text-xs text-accent-teal font-medium uppercase tracking-wider">
                {hasNoteSource ? (lang === 'el' ? 'Από τις σημειώσεις σου' : 'From your notes') : 'Exercise'}
              </span>
              <h2 className="text-xl font-bold mt-1">{exercise.title}</h2>
              <p className="text-[10px] text-text-muted mt-1">{t('exercise')} {exerciseIdx + 1} {t('of')} {exercises.length}</p>
              {isPythonExercise && (
                <p className="text-[10px] text-brand-400 mt-0.5">
                  {pyodideStatus === 'loading' && t('loadingPyodide')}
                  {pyodideStatus === 'ready' && t('pyodideReady')}
                  {pyodideStatus === 'error' && 'Pyodide unavailable — using regex fallback'}
                </p>
              )}
            </div>

            <div className="flex gap-1 flex-wrap">
              {exercises.map((ex, i) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => loadExercise(i)}
                  className={cn(
                    'w-7 h-7 rounded-lg text-[10px] font-bold border',
                    i === exerciseIdx ? 'border-brand-500 bg-brand-600/20 text-brand-300' : i < completedCount ? 'border-accent-emerald/40 text-accent-emerald' : 'border-border-subtle text-text-muted',
                  )}
                >
                  {i < completedCount ? '✓' : i + 1}
                </button>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-border-subtle">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-brand-400" /> Learning Objective
              </h4>
              <p className="text-sm text-text-secondary">{exercise.objective}</p>
            </div>

            <div className="space-y-2">
              {exercise.hints.slice(0, hintLevel).map((hint, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-accent-amber/5 border border-accent-amber/20 text-xs text-text-secondary">
                  💡 {hint}
                </motion.div>
              ))}
              {hintLevel < exercise.hints.length && (
                <button type="button" onClick={() => setHintLevel((p) => p + 1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-accent-amber/30 text-text-secondary transition-all">
                  <Lightbulb className="w-3 h-3 text-accent-amber" /> Show hint
                </button>
              )}
            </div>

            {showSolution && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-4 rounded-xl bg-accent-emerald/5 border border-accent-emerald/20">
                <h4 className="text-sm font-semibold text-accent-emerald mb-2">Solution</h4>
                <pre className="text-xs font-mono text-text-secondary bg-surface-primary p-3 rounded-lg overflow-x-auto">{exercise.solution}</pre>
              </motion.div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowSolution(!showSolution)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary transition-all">
                {showSolution ? '🙈 Hide solution' : '👀 Show solution'}
              </button>
              <button type="button" onClick={onOpenAgent} className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary transition-all">
                🔰 Explain like beginner
              </button>
            </div>
          </div>
        </div>

        <div className="lg:w-[60%] flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary/30">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-text-tertiary" />
              <span className="text-xs font-medium text-text-secondary">script.py</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void runCode()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20 transition-all">
                <Play className="w-3 h-3" /> {t('run')}
              </button>
              <button type="button" onClick={() => void runTests()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 text-brand-300 hover:bg-brand-500/20 transition-all">
                <CheckCircle2 className="w-3 h-3" /> {t('runTests')}
              </button>
              <button type="button" onClick={() => { setCode(exercise.starterCode); setOutput(''); setTestsPassed(null); }} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[200px]">
            <CodeEditor
              value={code}
              onChange={(val) => { setCode(val); setTestsPassed(null); }}
            />
          </div>

          <div className="border-t border-border-subtle bg-surface-secondary/30">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-xs font-medium text-text-secondary">Output</span>
              </div>
              {testsPassed !== null && (
                <span className={cn('text-xs font-medium flex items-center gap-1', testsPassed ? 'text-accent-emerald' : 'text-accent-rose')}>
                  {testsPassed ? <><CheckCircle2 className="w-3 h-3" /> Passed</> : <><AlertTriangle className="w-3 h-3" /> Failed</>}
                </span>
              )}
            </div>
            <pre className="p-4 text-xs font-mono text-text-secondary min-h-[100px] max-h-[200px] overflow-y-auto">
              {output || 'Click "Run Tests" to validate your code...'}
            </pre>
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle bg-surface-secondary/50 px-4 py-3 w-full min-w-0">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">{completedCount}/{exercises.length} completed</span>
            {testsPassed && <span className="text-xs text-accent-emerald flex items-center gap-1"><Zap className="w-3 h-3" /> Exercise passed</span>}
          </div>
          <div className="flex items-center gap-2">
            {exerciseIdx < exercises.length - 1 && testsPassed && (
              <button type="button" onClick={() => loadExercise(exerciseIdx + 1)} className="px-4 py-2 text-sm text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
                Next exercise <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleFinish}
              disabled={!allDone}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all',
                allDone ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-surface-hover text-text-muted cursor-not-allowed',
              )}
            >
              Finish <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
