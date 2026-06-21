import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Map, FileText, Calculator, Layout,
  ChevronRight, Sparkles, PanelLeftClose, PanelLeftOpen,
  Maximize2, Minimize2, Layers, Timer, GitCompare,
  SlidersHorizontal, PenSquare, Type, GitCommit,
  Keyboard, StickyNote, Clock,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { RichText } from '../RichText';
import type { WorkspaceToolId } from '../../lib/taskFlows';
import { DraggableConceptMap } from './DraggableConceptMap';
import { AnnotationOverlay } from './AnnotationOverlay';
import { FormulaScratchpad } from './FormulaScratchpad';
import { MiniDashboard } from './MiniDashboard';
import { LeitnerBox } from './LeitnerBox';
import { StudyTimer } from './StudyTimer';
import { InteractiveSimulator } from './InteractiveSimulator';
import { ArgumentMap } from './ArgumentMap';
import { CognitiveReader } from './CognitiveReader';
import { StudyWhiteboard } from './StudyWhiteboard';
import { FeynmanCheck } from './FeynmanCheck';
import { ComparisonTable } from '../visuals/DiagramGenerator';
import { CommandPalette, type CommandItem } from './CommandPalette';
import { type WorkspacePanel, type WorkspacePanelBlock } from '../../lib/workspaceLessonPanels';
import { generateLessonPanels, canGenerateGroundedLesson } from '../../lib/lessonGenerator';
import { WorkspaceQuiz } from './WorkspaceQuiz';
import type { QuizDef } from '../../lib/lessonTypes';
import { buildWorkspaceNoteBundle } from '../../lib/workspaceNoteContent';
import { loadWorkspaceStep, saveWorkspaceStep, loadConceptMapPositions, saveConceptMapPositions, loadWorkspaceNotes, saveWorkspaceNotes } from '../../lib/workspacePersistence';
import { buildMiniDashboardProps } from '../../lib/workspaceData';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';
import { getNoteContentForLessonStep } from '../../lib/groundedLesson';
import type { LessonStepKey } from '../../lib/domainContent';
import { useI18n, type I18nKey } from '../../lib/i18n';
import type { Course, GlossaryEntry, LearnerModel, UploadedFile, UserSettings } from '../../types';
import type { FsrsRating } from '../../lib/pedagogy';
import { findConceptSpan, resolveReaderText, type SourceHighlight } from '../../lib/conceptProvenance';
import { GoToSourceButton } from '../GoToSourceButton';

type WorkspaceTool = WorkspaceToolId;
type LayoutMode = 'split' | 'focus-lesson' | 'focus-tool' | 'zen';

interface Props {
  onClose: () => void;
  onOpenAgent: () => void;
  onComplete?: () => void;
  taskTitle?: string;
  courseName?: string;
  quizConcept?: string;
  xpReward?: number;
  initialTool?: WorkspaceTool;
  taskId?: string | null;
  learnerModel?: LearnerModel;
  dashboardStats?: { streak: number; reviewsDue: number };
  conceptBars?: { concept: string; mastery: number }[];
  uploadedFiles?: UploadedFile[];
  onQuizAttempt?: (concept: string, correct: boolean, confidence: number, stepKey?: string) => void;
  onLeitnerRate?: (concept: string, rating: FsrsRating) => void;
  onLogStudyMinutes?: (minutes: number, label?: string) => void;
  onStartTask?: (taskId: string) => void;
  tasks?: { id: string; title: string; status: string; isSpacedRepetition?: boolean; estimatedMinutes: number; xpReward: number }[];
  userSettings?: UserSettings;
  glossaryEntries?: GlossaryEntry[];
  courses?: Course[];
  courseId?: string;
  onUpload?: () => void;
  sourceHighlight?: SourceHighlight | null;
  openSourceAt?: (highlight: SourceHighlight) => void;
  clearSourceHighlight?: () => void;
}

const TOOL_LABELS: Record<WorkspaceTool, I18nKey> = {
  'concept-map': 'toolMap',
  simulator: 'toolSandbox',
  leitner: 'toolLeitner',
  compare: 'toolCompare',
  whiteboard: 'toolBoard',
  feynman: 'toolFeynman',
  timer: 'toolTimer',
  debate: 'toolDebate',
  reader: 'toolReader',
  scratchpad: 'toolScratchpad',
  annotations: 'toolSource',
};

const TOOL_ICONS: Record<WorkspaceTool, typeof Map> = {
  'concept-map': Map,
  simulator: SlidersHorizontal,
  leitner: Layers,
  compare: GitCompare,
  whiteboard: PenSquare,
  feynman: Sparkles,
  timer: Timer,
  debate: GitCommit,
  reader: Type,
  scratchpad: Calculator,
  annotations: FileText,
};

const TOOL_IDS = Object.keys(TOOL_LABELS) as WorkspaceTool[];

export function StudyWorkspace({
  onClose,
  onOpenAgent,
  onComplete,
  taskTitle,
  courseName,
  quizConcept = 'Study concept',
  xpReward = 50,
  initialTool = 'concept-map',
  taskId,
  learnerModel,
  dashboardStats,
  conceptBars = [],
  uploadedFiles = [],
  onQuizAttempt,
  onLeitnerRate,
  onLogStudyMinutes,
  onStartTask,
  tasks = [],
  userSettings,
  glossaryEntries = [],
  courses = [],
  courseId,
  onUpload,
  sourceHighlight,
  openSourceAt,
}: Props) {
  const { t, lang } = useI18n();
  const progressKey = taskId ? `workspace:${taskId}` : `workspace:${quizConcept.replace(/\s+/g, '-').toLowerCase()}`;
  const [activeTool, setActiveTool] = useState<WorkspaceTool>(initialTool);
  // Detect mobile / narrow viewport so we can stack panes (single-pane mode)
  // instead of forcing a 50/50 horizontal split that's unreadable on phones.
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [layout, setLayout] = useState<LayoutMode>('split');
  const [splitPos, setSplitPos] = useState(50);
  const [lessonCollapsed, setLessonCollapsed] = useState(false);
  const [currentStep, setCurrentStep] = useState(() => loadWorkspaceStep(progressKey));
  const [quizPassed, setQuizPassed] = useState(false);
  const [genPanels, setGenPanels] = useState<WorkspacePanel[] | null>(null);
  const [genStatus, setGenStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [dashOpen, setDashOpen] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(() => loadWorkspaceNotes(progressKey));
  const resizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);

  const noteBundle = useMemo(
    () => buildWorkspaceNoteBundle({
      uploadedFiles,
      glossaryEntries,
      courses,
      courseId,
      concept: quizConcept,
      conceptBars,
      lang,
      learnerModel,
    }),
    [uploadedFiles, glossaryEntries, courses, courseId, quizConcept, conceptBars, lang, learnerModel],
  );

  const linkedCourse = useMemo(
    () => courses.find((c) => c.id === (courseId ?? uploadedFiles.find((f) => f.courseId)?.courseId)),
    [courses, courseId, uploadedFiles],
  );
  const conceptSpan = useMemo(
    () => findConceptSpan(linkedCourse, quizConcept),
    [linkedCourse, quizConcept],
  );
  const readerText = useMemo(
    () => resolveReaderText(uploadedFiles, sourceHighlight, noteBundle.readerText),
    [uploadedFiles, sourceHighlight, noteBundle.readerText],
  );

  useEffect(() => {
    if (!sourceHighlight) return;
    setActiveTool('reader');
    setLayout((prev) => (prev === 'focus-lesson' ? 'split' : prev));
  }, [sourceHighlight]);

  const groundedAvailable = noteBundle.hasSource && canGenerateGroundedLesson(uploadedFiles, userSettings);

  // Generate a lesson grounded in the learner's uploaded material when an LLM
  // and source text are available; otherwise keep the deterministic templates.
  useEffect(() => {
    let cancelled = false;
    setGenPanels(null);
    if (!groundedAvailable) {
      setGenStatus('idle');
      return;
    }
    setGenStatus('loading');
    generateLessonPanels(quizConcept, uploadedFiles, userSettings)
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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quizConcept,
    groundedAvailable,
    uploadedFiles.length,
    userSettings?.openaiApiKey,
    userSettings?.llmModel,
    userSettings?.useLlm,
    userSettings?.language,
    userSettings?.sourceMode,
  ]);

  const STEPS = useMemo(() => {
    if (!noteBundle.hasSource) {
      return [{
        title: lang === 'el' ? 'Ανέβασμα σημειώσεων' : 'Upload your notes',
        type: lang === 'el' ? 'Απαιτείται' : 'Required',
      }];
    }
    if (noteBundle.workspaceSteps && noteBundle.workspaceSteps.length > 0) {
      return noteBundle.workspaceSteps;
    }
    const quizStep = {
      title: lang === 'el' ? 'Έλεγχος Γνώσεων' : 'Knowledge Check',
      type: lang === 'el' ? 'Κουίζ' : 'Quiz',
    };
    if (noteBundle.matchingTopic?.objectives?.length) {
      return [
        ...noteBundle.matchingTopic.objectives.slice(0, 4).map((o, i) => ({
          title: o.slice(0, 42),
          type: lang === 'el' ? ['Βασική Έννοια', 'Εμβάθυνση', 'Εξάσκηση', 'Σύνδεση'][i] ?? 'Ενότητα' : ['Core', 'Deep Dive', 'Practice', 'Link'][i] ?? 'Section',
        })),
        quizStep,
      ];
    }
    return [
      { title: quizConcept, type: lang === 'el' ? 'Βασική Έννοια' : 'Core Concept' },
      quizStep,
    ];
  }, [noteBundle, quizConcept, lang]);

  const quizDef = useMemo(() => {
    if (noteBundle.quiz) return noteBundle.quiz;
    return {
      question: lang === 'el'
        ? `Ανέβασε σημειώσεις για να δημιουργηθεί κουίζ από το δικό σου υλικό για «${quizConcept}».`
        : `Upload notes to generate a quiz from your material for «${quizConcept}».`,
      options: [
        lang === 'el' ? 'Θα εμφανιστεί μετά το ανέβασμα' : 'Available after upload',
        '—', '—', '—',
      ],
      correctIndex: 0,
    };
  }, [noteBundle.quiz, quizConcept, lang]);

  const conceptNodes = useMemo(() => {
    const base = noteBundle.conceptMap.nodes;
    return loadConceptMapPositions(base, progressKey);
  }, [noteBundle.conceptMap.nodes, progressKey]);

  const conceptEdges = noteBundle.conceptMap.edges;

  const miniDash = useMemo(() => {
    if (!learnerModel || !dashboardStats) return null;
    return buildMiniDashboardProps(
      learnerModel,
      dashboardStats,
      tasks as never,
      onStartTask,
      noteBundle.courseTitle ?? courseName,
    );
  }, [learnerModel, dashboardStats, tasks, onStartTask, noteBundle.courseTitle, courseName]);

  // Command palette entries — every action discoverable by typing.
  // Tools → numeric shortcuts, layouts → L/T/S, plus palette-only actions.
  const paletteItems: CommandItem[] = useMemo(() => {
    const out: CommandItem[] = [];
    const groupTools = lang === 'el' ? 'Εργαλεία' : 'Tools';
    const groupLayout = lang === 'el' ? 'Διάταξη' : 'Layout';
    const groupSession = lang === 'el' ? 'Συνεδρία' : 'Session';

    TOOL_IDS.forEach((id, idx) => {
      const shortcut = idx === 9 ? '0' : String(idx + 1);
      out.push({
        id: `tool:${id}`,
        group: groupTools,
        label: t(TOOL_LABELS[id]),
        shortcut,
        run: () => {
          setActiveTool(id);
          if (layout === 'focus-lesson') setLayout(isMobile ? 'focus-tool' : 'split');
        },
      });
    });

    out.push(
      {
        id: 'layout:split',
        group: groupLayout,
        label: lang === 'el' ? 'Διπλή προβολή' : 'Split layout',
        shortcut: 'S',
        run: () => setLayout('split'),
      },
      {
        id: 'layout:focus-lesson',
        group: groupLayout,
        label: lang === 'el' ? 'Εστίαση στο μάθημα' : 'Focus lesson',
        shortcut: 'L',
        run: () => setLayout('focus-lesson'),
      },
      {
        id: 'layout:focus-tool',
        group: groupLayout,
        label: lang === 'el' ? 'Εστίαση στο εργαλείο' : 'Focus tool',
        shortcut: 'T',
        run: () => setLayout('focus-tool'),
      },
    );

    out.push(
      {
        id: 'session:toggle-notes',
        group: groupSession,
        label: lang === 'el' ? 'Σημειώσεις συνεδρίας' : 'Toggle session notes',
        shortcut: 'N',
        run: () => setShowNotes((v) => !v),
      },
      {
        id: 'session:next-step',
        group: groupSession,
        label: lang === 'el' ? 'Επόμενο βήμα' : 'Next step',
        shortcut: '→',
        run: () => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1)),
      },
      {
        id: 'session:prev-step',
        group: groupSession,
        label: lang === 'el' ? 'Προηγούμενο βήμα' : 'Previous step',
        shortcut: '←',
        run: () => setCurrentStep((s) => Math.max(0, s - 1)),
      },
      {
        id: 'session:agent',
        group: groupSession,
        label: lang === 'el' ? 'Άνοιγμα Βοηθού' : 'Open Agent',
        run: () => onOpenAgent(),
      },
      {
        id: 'session:upload',
        group: groupSession,
        label: lang === 'el' ? 'Ανέβασμα νέου υλικού' : 'Upload more material',
        run: () => onUpload?.(),
      },
      {
        id: 'session:shortcuts',
        group: groupSession,
        label: lang === 'el' ? 'Συντομεύσεις πληκτρολογίου' : 'Keyboard shortcuts',
        shortcut: '?',
        run: () => setShowShortcuts(true),
      },
      {
        id: 'session:close',
        group: groupSession,
        label: lang === 'el' ? 'Κλείσιμο workspace' : 'Close workspace',
        shortcut: 'Esc',
        run: () => onClose(),
      },
    );

    return out.filter((it) => it.id !== 'session:upload' || Boolean(onUpload));
  }, [t, lang, layout, isMobile, STEPS.length, onOpenAgent, onUpload, onClose]);

  useEffect(() => {
    saveWorkspaceStep(progressKey, currentStep);
  }, [currentStep, progressKey]);

  // Keyboard navigation. Ignored while the user is typing into a field
  // (annotations, Feynman, scratchpad, etc.). Bindings:
  //   Esc          — close overlays / workspace
  //   ← / →        — previous / next step
  //   1 … 0        — switch tool (1=concept-map, 2=simulator, …, 0=annotations)
  //   L / T / S    — focus lesson / focus tool / split layout
  //   N            — toggle session notes
  //   ?            — show shortcut overlay
  //   ⌘K / Ctrl+K  — open command palette (works even while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K must work even from inside text inputs.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowPalette((v) => !v);
        return;
      }
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'Escape') {
        if (showPalette) setShowPalette(false);
        else if (showNotes) setShowNotes(false);
        else if (showShortcuts) setShowShortcuts(false);
        else onClose();
        return;
      }
      if (showPalette) return; // palette owns the keyboard while open
      if (k === 'ArrowRight') { setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1)); return; }
      if (k === 'ArrowLeft')  { setCurrentStep((s) => Math.max(0, s - 1)); return; }
      if (k === '?') { setShowShortcuts((v) => !v); return; }
      if (k === 'l' || k === 'L') { setLayout('focus-lesson'); return; }
      if (k === 't' || k === 'T') { setLayout('focus-tool'); return; }
      if (k === 's' || k === 'S') { setLayout('split'); return; }
      if (k === 'z' || k === 'Z') { setLayout((prev) => (prev === 'zen' ? 'split' : 'zen')); return; }
      if (k === 'n' || k === 'N') { setShowNotes((v) => !v); return; }
      if (/^[0-9]$/.test(k)) {
        // 1..9 → first 9 tools, 0 → 10th (annotations)
        const idx = k === '0' ? 9 : Number(k) - 1;
        const tool = TOOL_IDS[idx];
        if (tool) {
          setActiveTool(tool);
          if (layout === 'focus-lesson') setLayout(isMobile ? 'focus-tool' : 'split');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [STEPS.length, onClose, showNotes, showShortcuts, showPalette, layout, isMobile]);

  // Live session timer; logs accumulated study minutes when the workspace closes.
  useEffect(() => {
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    elapsedRef.current = elapsedSec;
  }, [elapsedSec]);
  useEffect(() => {
    return () => {
      const mins = Math.round(elapsedRef.current / 60);
      if (mins >= 1) onLogStudyMinutes?.(mins, taskTitle ?? 'Study Workspace');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced persistence of session notes.
  useEffect(() => {
    const id = window.setTimeout(() => saveWorkspaceNotes(progressKey, notes), 400);
    return () => window.clearTimeout(id);
  }, [notes, progressKey]);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startSplit = splitPos;

    const onMove = (ev: PointerEvent) => {
      if (!resizing.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ev.clientX - startX;
      const pct = startSplit + (dx / rect.width) * 100;
      setSplitPos(Math.max(25, Math.min(75, pct)));
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [splitPos]);

  const cycleLayout = () => {
    setLayout((prev) =>
      prev === 'split' ? 'focus-lesson'
        : prev === 'focus-lesson' ? 'focus-tool'
          : prev === 'focus-tool' ? 'zen'
            : 'split',
    );
  };

  const chromeHidden = layout === 'zen';

  const workspaceTitle = taskTitle ?? quizConcept;
  const workspaceCourse = noteBundle.hasSource
    ? (courseName ?? noteBundle.courseTitle ?? (lang === 'el' ? 'Το μάθημά σου' : 'Your course'))
    : (lang === 'el' ? 'Ανέβασε σημειώσεις για εξατομίκευση' : 'Upload notes to personalize');
  const isLastStep = currentStep >= STEPS.length - 1;
  const progressPct = Math.round(((currentStep + 1) / STEPS.length) * 100);
  const elapsedLabel = `${Math.floor(elapsedSec / 60).toString().padStart(2, '0')}:${(elapsedSec % 60).toString().padStart(2, '0')}`;

  const handleStepNext = () => {
    const onQuizStep = currentStep === STEPS.length - 1;
    if (onQuizStep && !quizPassed) return;
    if (isLastStep) {
      onComplete?.();
      onClose();
      return;
    }
    setCurrentStep((s) => s + 1);
  };

  // On mobile the split layout is collapsed into a single pane; we expose the
  // same focus modes as toggle states so the user can swap which pane is
  // visible without touching the resize handle.
  const effectiveLayout: LayoutMode = layout === 'zen'
    ? 'focus-lesson'
    : isMobile && layout === 'split'
      ? 'focus-lesson'
      : layout;
  const leftWidth = effectiveLayout === 'focus-lesson' ? 100
    : effectiveLayout === 'focus-tool' || lessonCollapsed ? 0
    : splitPos;
  const rightWidth = 100 - leftWidth;

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary flex flex-col blueprint-canvas blueprint-grid" data-testid="study-workspace">
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-2 border-b border-white/8 bg-surface-secondary/70 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} aria-label={t('close')} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X className="w-4 h-4 text-text-secondary" /></button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-accent-cyan shadow-[0_0_12px_rgba(34,211,238,0.7)] shrink-0" />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold truncate">{workspaceTitle}</span>
              <span className="text-[10px] text-text-muted truncate">
                {workspaceCourse}
                {noteBundle.hasSource && (
                  <span className="ml-1.5 text-accent-emerald">· {lang === 'el' ? 'από τις σημειώσεις σου' : 'from your notes'}</span>
                )}
                {conceptSpan && openSourceAt && (
                  <span className="ml-2">
                    <GoToSourceButton
                      lang={lang}
                      onClick={() => openSourceAt({
                        fileId: conceptSpan.fileId,
                        charStart: conceptSpan.charStart,
                        charEnd: conceptSpan.charEnd,
                      })}
                    />
                  </span>
                )}
              </span>
            </div>
          </div>
          {/* Live progress ring + percent */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0 pl-2 ml-1 border-l border-white/8">
            <div className="relative w-7 h-7">
              <svg viewBox="0 0 36 36" className="w-7 h-7 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${(progressPct / 100) * 94.2} 94.2`} className="transition-all duration-500" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-accent-cyan">{progressPct}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {!chromeHidden && (
          <>
          {/* Tool tabs — scrollable; compact select on very small screens */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
          <select
            className="sm:hidden max-w-[42%] shrink-0 rounded-full border border-white/10 bg-surface-primary/80 px-2 py-1.5 text-[10px] text-text-secondary"
            value={activeTool}
            onChange={(e) => { setActiveTool(e.target.value as WorkspaceTool); if (layout === 'focus-lesson') setLayout('split'); }}
          >
            {TOOL_IDS.map((toolId) => (
              <option key={toolId} value={toolId}>{t(TOOL_LABELS[toolId])}</option>
            ))}
          </select>
          <div className="hidden sm:flex items-center gap-1 overflow-x-auto hide-scrollbar flex-1 min-w-0">
          {TOOL_IDS.map((toolId) => {
            const Icon = TOOL_ICONS[toolId];
            const active = activeTool === toolId;
            return (
            <button key={toolId} onClick={() => { setActiveTool(toolId); if (layout === 'focus-lesson') setLayout('split'); }}
              className={cn('flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium transition-all shrink-0 border',
                active
                  ? 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/40 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
                  : 'text-text-muted border-transparent hover:text-text-secondary hover:bg-white/[0.06]')}>
              <Icon className="w-3.5 h-3.5" />{t(TOOL_LABELS[toolId])}
            </button>
            );
          })}
          </div>
          </div>
          <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />
          <span className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.04] border border-white/8 text-[10px] font-mono text-text-secondary shrink-0" title="Session time">
            <Clock className="w-3 h-3 text-accent-cyan" />{elapsedLabel}
          </span>
          <span className="hidden sm:inline text-[10px] text-accent-amber font-semibold shrink-0">+{xpReward} XP</span>
          <button onClick={() => { setShowNotes((v) => !v); }} title="Session notes"
            className={cn('p-1.5 rounded-lg transition-colors shrink-0', showNotes ? 'bg-accent-cyan/15 text-accent-cyan' : 'hover:bg-white/10 text-text-muted hover:text-text-secondary')}>
            <StickyNote className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowPalette(true)}
            title={lang === 'el' ? 'Παλέτα εντολών (⌘K)' : 'Command palette (⌘K)'}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-text-secondary shrink-0"
          >
            <span className="opacity-70">⌘K</span>
          </button>
          <button onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)" className="hidden sm:block p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-secondary shrink-0">
            <Keyboard className="w-4 h-4" />
          </button>
          </>
          )}
          {chromeHidden && (
            <span className="text-[10px] text-text-muted px-2">
              {lang === 'el' ? 'Λειτουργία εστίασης (Z)' : 'Focus mode (Z)'}
            </span>
          )}
          {/* Mobile pane swap (md and below): swap which pane is visible since
              the workspace is single-pane on phones. */}
          {isMobile ? (
            <button
              onClick={() => setLayout(effectiveLayout === 'focus-tool' ? 'focus-lesson' : 'focus-tool')}
              aria-label={effectiveLayout === 'focus-tool' ? 'Show lesson' : 'Show tool'}
              className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-secondary shrink-0"
              title={effectiveLayout === 'focus-tool' ? (lang === 'el' ? 'Εμφάνιση μαθήματος' : 'Show lesson') : (lang === 'el' ? 'Εμφάνιση εργαλείου' : 'Show tool')}
            >
              {effectiveLayout === 'focus-tool' ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          ) : (
            <button onClick={cycleLayout} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-secondary shrink-0" title={layout === 'zen' ? 'Exit focus (Z)' : 'Toggle layout (S)'}>
              {layout === 'zen' ? <Minimize2 className="w-4 h-4 text-accent-cyan" /> : layout === 'split' ? <Layout className="w-4 h-4" /> : layout === 'focus-lesson' ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
          )}
          {!chromeHidden && (
          <button onClick={onOpenAgent} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-medium border border-white/10 bg-white/[0.04] hover:border-accent-cyan/40 hover:bg-white/[0.08] text-text-secondary shrink-0 transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-accent-cyan" /> {t('agentBtn')}
          </button>
          )}
        </div>
      </div>

      {/* Progress mini-bar — cyan/violet gradient */}
      <div className="relative z-10 h-0.5 bg-white/5 shrink-0">
        <div className="h-0.5 bg-gradient-to-r from-accent-cyan to-brand-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Main split area */}
      <div ref={containerRef} className="relative z-10 flex-1 flex overflow-hidden">
        {/* Left: Lesson content */}
        <AnimatePresence initial={false}>
          {leftWidth > 0 && (
            <motion.div
              key="left"
              initial={{ width: 0 }}
              animate={{ width: `${leftWidth}%` }}
              exit={{ width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden flex flex-col border-r border-border-subtle"
            >
              {/* Step nav */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border-subtle overflow-x-auto hide-scrollbar shrink-0">
                <button onClick={() => setLessonCollapsed(!lessonCollapsed)} className="p-1 rounded hover:bg-surface-hover text-text-muted shrink-0">
                  {lessonCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
                </button>
                {STEPS.map((s, i) => (
                  <button key={i} onClick={() => setCurrentStep(i)}
                    className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-medium shrink-0 transition-all',
                      currentStep === i ? 'bg-accent-cyan/15 text-accent-cyan' : i < currentStep ? 'text-accent-emerald' : 'text-text-muted hover:text-text-secondary')}>
                    <span className={cn('w-4 h-4 rounded-full border text-[8px] flex items-center justify-center',
                      currentStep === i ? 'border-accent-cyan text-accent-cyan' : i < currentStep ? 'border-accent-emerald text-accent-emerald bg-accent-emerald/10' : 'border-text-muted')}>
                      {i < currentStep ? '✓' : i + 1}
                    </span>
                    <span className="hidden sm:inline">{s.title.length > 16 ? s.title.slice(0, 14) + '…' : s.title}</span>
                  </button>
                ))}
              </div>

              {/* Lesson body — reading column capped for line-length comfort,
                  centered so it stays readable even when the lesson is maximized. */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
                <div key={currentStep} className="w-full min-w-0 animate-fade-up">
                  <LessonContent
                    step={currentStep}
                    stepCount={STEPS.length}
                    stepTitle={STEPS[currentStep]?.title}
                    concept={quizConcept}
                    onOpenAgent={onOpenAgent}
                    quizDef={quizDef}
                    quizPassed={quizPassed}
                    generatedPanels={genPanels}
                    genStatus={genStatus}
                    noteExcerpt={noteBundle.readerText}
                    hasSource={noteBundle.hasSource}
                    emptyMessage={noteBundle.emptyMessage}
                    onUpload={onUpload}
                    onQuizComplete={(correct) => {
                      setQuizPassed(correct);
                      onQuizAttempt?.(quizConcept, correct, 75, `${progressKey}:quiz`);
                    }}
                    t={t}
                    lang={lang}
                  />
                </div>
              </div>

              {/* Bottom nav */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle shrink-0">
                <button onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)} disabled={currentStep === 0}
                  className={cn('text-xs', currentStep === 0 ? 'text-text-muted' : 'text-text-secondary hover:text-text-primary')}>← {t('previous')}</button>
                <span className="text-[10px] text-text-muted">{currentStep + 1}/{STEPS.length}</span>
                <button onClick={handleStepNext}
                  className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-medium">
                  {isLastStep ? t('finish') : t('next')} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resize handle (desktop split mode only) */}
        {effectiveLayout === 'split' && !isMobile && (
          <div onPointerDown={handleResizeStart}
            className="w-1.5 cursor-col-resize bg-border-subtle hover:bg-brand-500/50 transition-colors shrink-0 flex items-center justify-center group z-10">
            <div className="w-0.5 h-8 rounded-full bg-text-muted/30 group-hover:bg-brand-400 transition-colors" />
          </div>
        )}

        {/* Right: Tool panel */}
        <AnimatePresence initial={false}>
          {rightWidth > 0 && (
            <motion.div
              key="right"
              initial={{ width: 0 }}
              animate={{ width: `${rightWidth}%` }}
              exit={{ width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden flex flex-col"
            >
              {activeTool === 'concept-map' && (
                <DraggableConceptMap
                  initialNodes={conceptNodes}
                  initialEdges={conceptEdges}
                  onNodeUpdate={(nodes) => saveConceptMapPositions(nodes, progressKey)}
                  emptyMessage={noteBundle.emptyMessage}
                  onUpload={onUpload}
                />
              )}
              {activeTool === 'simulator' && (
                <InteractiveSimulator
                  economicsMode={noteBundle.economicsSandbox}
                  insight={noteBundle.sandboxInsight}
                  emptyMessage={noteBundle.emptyMessage}
                  onUpload={onUpload}
                />
              )}
              {activeTool === 'leitner' && (
                <LeitnerBox
                  cards={noteBundle.leitnerCards}
                  concept={quizConcept}
                  emptyMessage={noteBundle.emptyMessage}
                  onUpload={onUpload}
                  onRate={(rating) => onLeitnerRate?.(quizConcept, rating)}
                />
              )}
              {activeTool === 'compare' && (
                <div className="p-4 overflow-y-auto h-full">
                  {noteBundle.compareRows.length > 0 ? (
                    <ComparisonTable
                      title={`${lang === 'el' ? 'Σύγκριση' : 'Compare'}: ${quizConcept}`}
                      headers={['Dimension', lang === 'el' ? 'Α' : 'A', lang === 'el' ? 'Β' : 'B']}
                      items={noteBundle.compareRows}
                    />
                  ) : (
                    <WorkspaceEmptyState message={noteBundle.emptyMessage} onUpload={onUpload} />
                  )}
                </div>
              )}
              {activeTool === 'whiteboard' && (
                <StudyWhiteboard
                  referenceFormulas={noteBundle.formulas}
                  referenceExcerpt={noteBundle.hasSource ? noteBundle.readerText.slice(0, 400) : undefined}
                  scopeKey={progressKey}
                />
              )}
              {activeTool === 'feynman' && (
                <FeynmanCheck
                  concept={quizConcept}
                  settings={userSettings}
                  onOpenAgent={onOpenAgent}
                  outline={noteBundle.feynmanOutline}
                  placeholder={noteBundle.feynmanPlaceholder}
                  gapHints={noteBundle.feynmanGaps}
                  referenceNotes={noteBundle.hasSource ? noteBundle.readerText.slice(0, 2500) : undefined}
                  glossary={glossaryEntries}
                  extraTerms={noteBundle.matchingTopic?.title ? [noteBundle.matchingTopic.title] : undefined}
                  onFocusConcept={() => { setActiveTool('concept-map'); if (layout === 'focus-lesson') setLayout('split'); }}
                />
              )}
              {activeTool === 'timer' && <StudyTimer onSessionComplete={onLogStudyMinutes} />}
              {activeTool === 'debate' && (
                <ArgumentMap
                  tree={noteBundle.debateTree}
                  concept={quizConcept}
                  storageKey={`debate-${progressKey}`}
                  emptyMessage={noteBundle.emptyMessage}
                  onUpload={onUpload}
                />
              )}
              {activeTool === 'reader' && (
                <CognitiveReader
                  text={readerText}
                  highlight={sourceHighlight}
                  emptyMessage={noteBundle.emptyMessage}
                  onUpload={onUpload}
                />
              )}
              {activeTool === 'annotations' && (
                <AnnotationOverlay
                  sourceText={noteBundle.annotationText}
                  sourceName={noteBundle.sourceName}
                  fileKey={noteBundle.fileKey}
                  emptyMessage={noteBundle.emptyMessage}
                  onUpload={onUpload}
                  onAskAgent={() => { onOpenAgent(); }}
                />
              )}
              {activeTool === 'scratchpad' && (
                <FormulaScratchpad
                  noteFormulas={noteBundle.formulas}
                  emptyMessage={noteBundle.emptyMessage}
                  onUpload={onUpload}
                  scopeKey={progressKey}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini Dashboard - floating, collapsible so it never hides the tool */}
        <div className="absolute bottom-4 right-4 z-20">
          {dashOpen && !chromeHidden ? (
            <div className="relative">
              <button
                onClick={() => setDashOpen(false)}
                aria-label="Collapse dashboard"
                title="Collapse dashboard"
                className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-surface-secondary border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-secondary hover:border-brand-500/40 shadow-sm"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
              {miniDash ? (
                <MiniDashboard {...miniDash} />
              ) : (
                <MiniDashboard
                  readiness={58}
                  streak={12}
                  reviewsDue={3}
                  weakSpots={[]}
                  nextActions={[]}
                  conceptsMastered={31}
                  totalConcepts={136}
                />
              )}
            </div>
          ) : (
            <button
              onClick={() => setDashOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-secondary/90 backdrop-blur border border-border-subtle text-xs font-medium text-text-secondary hover:border-brand-500/40 shadow-sm"
            >
              <Maximize2 className="w-3.5 h-3.5 text-brand-400" /> {lang === 'el' ? 'Πίνακας' : 'Dashboard'}
            </button>
          )}
        </div>
      </div>

      {/* Session notes — persistent slide-over */}
      <AnimatePresence>
        {showNotes && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNotes(false)}
              className="absolute inset-0 z-30 bg-slate-950/40"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="absolute top-0 right-0 bottom-0 z-40 w-full sm:w-[380px] bg-surface-secondary/95 backdrop-blur-xl border-l border-white/10 flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-accent-cyan" />
                  <span className="text-sm font-semibold">{lang === 'el' ? 'Σημειώσεις συνεδρίας' : 'Session notes'}</span>
                </div>
                <button onClick={() => setShowNotes(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted"><X className="w-4 h-4" /></button>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === 'el' ? 'Κράτα σημειώσεις καθώς μελετάς… (αποθηκεύονται τοπικά)' : 'Jot notes as you study… (saved locally)'}
                className="flex-1 w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-text-primary focus:outline-none"
              />
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/8 text-[10px] text-text-muted">
                <span>{lang === 'el' ? 'Αποθηκεύεται αυτόματα' : 'Auto-saved'}</span>
                <span>{notes.trim().split(/\s+/).filter(Boolean).length} {lang === 'el' ? 'λέξεις' : 'words'}</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Command palette (⌘K / Ctrl+K) */}
      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        placeholder={lang === 'el' ? 'Εντολή, εργαλείο ή διάταξη…' : 'Type a command, tool, or layout…'}
        items={paletteItems}
      />

      {/* Keyboard shortcuts overlay */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowShortcuts(false)}
            className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-secondary p-5 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <Keyboard className="w-4 h-4 text-accent-cyan" />
                <span className="text-sm font-semibold">{lang === 'el' ? 'Συντομεύσεις πληκτρολογίου' : 'Keyboard shortcuts'}</span>
              </div>
              <ul className="space-y-2 text-sm">
                {[
                  { k: ['Esc'], d: lang === 'el' ? 'Κλείσιμο / πίσω' : 'Close / dismiss' },
                  { k: ['⌘', 'K'], d: lang === 'el' ? 'Παλέτα εντολών' : 'Command palette' },
                  { k: ['←', '→'], d: lang === 'el' ? 'Προηγούμενο / επόμενο βήμα' : 'Previous / next step' },
                  { k: ['1', '…', '0'], d: lang === 'el' ? 'Εναλλαγή εργαλείου' : 'Switch tool' },
                  { k: ['L'], d: lang === 'el' ? 'Εστίαση στο μάθημα' : 'Focus lesson' },
                  { k: ['T'], d: lang === 'el' ? 'Εστίαση στο εργαλείο' : 'Focus tool' },
                  { k: ['S'], d: lang === 'el' ? 'Διπλή προβολή' : 'Split layout' },
                  { k: ['N'], d: lang === 'el' ? 'Σημειώσεις συνεδρίας' : 'Toggle notes' },
                  { k: ['?'], d: lang === 'el' ? 'Αυτή η βοήθεια' : 'This help' },
                ].map((row) => (
                  <li key={row.d} className="flex items-center justify-between gap-3">
                    <span className="text-text-secondary">{row.d}</span>
                    <span className="flex items-center gap-1">
                      {row.k.map((key) => (
                        <kbd key={key} className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-mono text-text-primary">{key}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --- Dynamic lesson content for the workspace --- */
function LessonContent({
  step,
  stepCount,
  stepTitle,
  concept,
  onOpenAgent,
  quizDef,
  quizPassed,
  generatedPanels,
  genStatus,
  noteExcerpt,
  hasSource,
  emptyMessage,
  onUpload,
  onQuizComplete,
  t,
  lang,
}: {
  step: number;
  stepCount: number;
  stepTitle?: string;
  concept: string;
  onOpenAgent: () => void;
  quizDef: QuizDef;
  quizPassed: boolean;
  generatedPanels: WorkspacePanel[] | null;
  genStatus: 'idle' | 'loading' | 'ready' | 'fallback';
  noteExcerpt: string;
  hasSource: boolean;
  emptyMessage: string;
  onUpload?: () => void;
  onQuizComplete: (correct: boolean) => void;
  t: (key: import('../../lib/i18n').I18nKey) => string;
  lang: import('../../lib/i18n').Lang;
}) {
  const quizStepIndex = stepCount - 1;
  if (step === quizStepIndex && hasSource) {
    return (
      <div className="space-y-4">
        <span className="text-[10px] text-accent-cyan font-semibold uppercase tracking-wider">{t('quiz')}</span>
        <h2 className="text-xl font-bold">{t('knowledgeCheck')}</h2>
        <div className="p-3 rounded-xl bg-surface-card border border-border-subtle">
          <WorkspaceQuiz quizDef={quizDef} lang={lang} onComplete={onQuizComplete} />
          {quizPassed && (
            <p className="text-xs mt-2 text-accent-emerald">✓ {t('canFinish')}</p>
          )}
        </div>
      </div>
    );
  }

  // Prefer LLM content grounded in the learner's uploaded material.
  const panel = generatedPanels?.[step];
  if (panel) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider">{panel.badge}</span>
          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald font-medium">
            <Sparkles className="w-2.5 h-2.5" /> {lang === 'el' ? 'Από τις πηγές σου' : 'From your sources'}
          </span>
        </div>
        <h2 className="text-xl font-bold">{panel.title}</h2>
        {panel.blocks.map((block, i) => (
          <PanelBlock key={i} block={block} onOpenAgent={onOpenAgent} />
        ))}
      </div>
    );
  }

  // Note-grounded excerpt per step — section-aware mapping.
  if (hasSource && noteExcerpt.trim()) {
    const keys: LessonStepKey[] = ['intro', 'explanation', 'example', 'misconception', 'practice', 'summary'];
    const stepKey = keys[step % keys.length] ?? 'explanation';
    const chunk = getNoteContentForLessonStep(stepKey, noteExcerpt, concept, undefined, lang);
    return (
      <div className="space-y-4">
        <span className="text-[10px] text-accent-cyan font-semibold uppercase tracking-wider">
          {lang === 'el' ? 'Από τις σημειώσεις σου' : 'From your notes'}
        </span>
        <h2 className="text-xl font-bold">{stepTitle ?? concept}</h2>
        <div className="text-sm text-text-secondary leading-relaxed">
          <RichText text={chunk} />
        </div>
        {genStatus === 'loading' && (
          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-300 font-medium animate-pulse">
            <Sparkles className="w-2.5 h-2.5" /> {lang === 'el' ? 'Δημιουργία από τις πηγές σου…' : 'Generating from your sources…'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center py-8">
      <p className="text-sm text-text-secondary">{emptyMessage}</p>
      {onUpload && (
        <button
          type="button"
          onClick={onUpload}
          className="mt-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-500 transition-colors"
        >
          {lang === 'el' ? 'Ανέβασμα Υλικού' : 'Upload Material'}
        </button>
      )}
    </div>
  );
}

function PanelBlock({ block, onOpenAgent }: { block: WorkspacePanelBlock; onOpenAgent: () => void }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <div className="text-sm text-text-secondary leading-relaxed">
          <RichText text={block.text} />
          {block.emphasis && <strong className="text-text-primary"> {block.emphasis}</strong>}
        </div>
      );
    case 'cards':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {block.items.map((card) => (
            <div
              key={card.title}
              className={cn(
                'p-3 rounded-xl border',
                card.accent === 'teal' ? 'bg-accent-teal/5 border-accent-teal/20' : 'bg-brand-500/5 border-brand-500/20',
              )}
            >
              <h4 className={cn('text-xs font-semibold mb-1', card.accent === 'teal' ? 'text-accent-teal' : 'text-brand-300')}>{card.title}</h4>
              <ul className="text-[11px] text-text-secondary space-y-0.5">
                {card.bullets.map((b) => <li key={b}>• {b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      );
    case 'formula':
      return (
        <div className="p-3 rounded-xl bg-surface-primary/60 border border-border-subtle text-center">
          <p className="text-[10px] text-text-muted mb-1">{block.label}</p>
          <div className="text-lg font-bold text-brand-300">
            <RichText text={/[$\\]/.test(block.formula) ? block.formula : `$$${block.formula}$$`} />
          </div>
        </div>
      );
    case 'callout':
      return (
        <div className={cn(
          'p-3 rounded-xl border',
          block.variant === 'warning' ? 'bg-accent-amber/5 border-accent-amber/20' : 'bg-brand-500/5 border-brand-500/20',
        )}>
          <p className={cn('text-xs font-semibold mb-1', block.variant === 'warning' ? 'text-accent-amber' : 'text-brand-300')}>{block.title}</p>
          <p className="text-[11px] text-text-secondary">{block.text}</p>
        </div>
      );
    case 'steps':
      return (
        <div className="space-y-2 text-sm text-text-secondary font-mono">
          {block.items.map((s) => (
            <div key={s.label}>
              <p className={cn('text-[10px] font-sans font-semibold', s.success ? 'text-accent-emerald' : 'text-brand-300')}>{s.label}</p>
              <p className="bg-surface-primary/40 px-3 py-1.5 rounded-lg">{s.content}</p>
            </div>
          ))}
        </div>
      );
    case 'actions':
      return (
        <div className="flex gap-2 flex-wrap">
          {block.items.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={onOpenAgent}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary"
            >
              {a.label}
            </button>
          ))}
        </div>
      );
    case 'source':
      return <p className="text-[10px] text-text-muted">{block.text}</p>;
    default:
      return null;
  }
}
