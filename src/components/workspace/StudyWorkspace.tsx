import { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, BookOpen, Map, FileText, Calculator, Layout,
  ChevronRight, Sparkles, PanelLeftClose, PanelLeftOpen,
  Maximize2, Minimize2
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { DraggableConceptMap } from './DraggableConceptMap';
import { AnnotationOverlay } from './AnnotationOverlay';
import { FormulaScratchpad } from './FormulaScratchpad';
import { MiniDashboard } from './MiniDashboard';

type WorkspaceTool = 'concept-map' | 'annotations' | 'scratchpad' | 'source';
type LayoutMode = 'split' | 'focus-lesson' | 'focus-tool';

interface Props {
  onClose: () => void;
  onOpenAgent: () => void;
}

const TOOLS: { id: WorkspaceTool; icon: typeof Map; label: string }[] = [
  { id: 'concept-map', icon: Map, label: 'Concept Map' },
  { id: 'annotations', icon: FileText, label: 'Source & Notes' },
  { id: 'scratchpad', icon: Calculator, label: 'Scratchpad' },
];

// Sample concept map data
const CONCEPT_NODES = [
  { id: 'sd', label: 'Supply & Demand', mastery: 92, type: 'concept' as const, x: 140, y: 80 },
  { id: 'ct', label: 'Consumer Theory', mastery: 78, type: 'theory' as const, x: 360, y: 60 },
  { id: 'el', label: 'Elasticity', mastery: 45, type: 'formula' as const, x: 140, y: 240 },
  { id: 'ms', label: 'Market Structures', mastery: 45, type: 'concept' as const, x: 380, y: 210 },
  { id: 'we', label: 'Welfare Econ', mastery: 20, type: 'theory' as const, x: 560, y: 130 },
  { id: 'gt', label: 'Game Theory', mastery: 0, type: 'concept' as const, x: 560, y: 300 },
];
const CONCEPT_EDGES = [
  { from: 'sd', to: 'ct', relation: 'prerequisite' as const },
  { from: 'sd', to: 'el', relation: 'prerequisite' as const },
  { from: 'sd', to: 'ms', relation: 'prerequisite' as const },
  { from: 'ct', to: 'ms', relation: 'prerequisite' as const },
  { from: 'ms', to: 'we', relation: 'prerequisite' as const },
  { from: 'ms', to: 'gt', relation: 'prerequisite' as const },
  { from: 'el', to: 'we', relation: 'related' as const },
];

export function StudyWorkspace({ onClose, onOpenAgent }: Props) {
  const [activeTool, setActiveTool] = useState<WorkspaceTool>('concept-map');
  const [layout, setLayout] = useState<LayoutMode>('split');
  const [splitPos, setSplitPos] = useState(50); // percentage
  const [lessonCollapsed, setLessonCollapsed] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const resizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    setLayout(prev => prev === 'split' ? 'focus-lesson' : prev === 'focus-lesson' ? 'focus-tool' : 'split');
  };

  const STEPS = [
    { title: 'Two Models of Oligopoly', type: 'Core Concept' },
    { title: 'Cournot: Quantity Competition', type: 'Deep Dive' },
    { title: 'Bertrand: Price Competition', type: 'Deep Dive' },
    { title: 'The Bertrand Paradox', type: 'Key Insight' },
    { title: 'Worked Example', type: 'Practice' },
    { title: 'Knowledge Check', type: 'Quiz' },
  ];

  const leftWidth = layout === 'focus-lesson' ? 100 : layout === 'focus-tool' ? 0 : splitPos;
  const rightWidth = 100 - leftWidth;

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-surface-secondary/50 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover"><X className="w-4 h-4 text-text-secondary" /></button>
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold">Market Structures</span>
            <span className="text-[10px] text-text-muted">• Microeconomics</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Tool tabs */}
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => { setActiveTool(t.id); if (layout === 'focus-lesson') setLayout('split'); }}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all',
                activeTool === t.id ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover')}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
          <div className="w-px h-5 bg-border-subtle mx-1" />
          <button onClick={cycleLayout} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-secondary" title="Toggle layout">
            {layout === 'split' ? <Layout className="w-4 h-4" /> : layout === 'focus-lesson' ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button onClick={onOpenAgent} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Agent
          </button>
        </div>
      </div>

      {/* Progress mini-bar */}
      <div className="h-1 bg-surface-hover shrink-0">
        <div className="h-1 bg-brand-500 transition-all duration-300" style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* Main split area */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
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
                    className={cn('flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium shrink-0 transition-all',
                      currentStep === i ? 'bg-brand-600/20 text-brand-300' : i < currentStep ? 'text-accent-emerald' : 'text-text-muted')}>
                    <span className={cn('w-4 h-4 rounded-full border text-[8px] flex items-center justify-center',
                      currentStep === i ? 'border-brand-400 text-brand-400' : i < currentStep ? 'border-accent-emerald text-accent-emerald bg-accent-emerald/10' : 'border-text-muted')}>
                      {i < currentStep ? '✓' : i + 1}
                    </span>
                    <span className="hidden sm:inline">{s.title.length > 16 ? s.title.slice(0, 14) + '…' : s.title}</span>
                  </button>
                ))}
              </div>

              {/* Lesson body */}
              <div className="flex-1 overflow-y-auto p-5">
                <LessonContent step={currentStep} onOpenAgent={onOpenAgent} />
              </div>

              {/* Bottom nav */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle shrink-0">
                <button onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)} disabled={currentStep === 0}
                  className={cn('text-xs', currentStep === 0 ? 'text-text-muted' : 'text-text-secondary hover:text-text-primary')}>← Previous</button>
                <span className="text-[10px] text-text-muted">{currentStep + 1}/{STEPS.length}</span>
                <button onClick={() => currentStep < STEPS.length - 1 && setCurrentStep(currentStep + 1)}
                  className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-medium">
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resize handle */}
        {layout === 'split' && (
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
                <DraggableConceptMap initialNodes={CONCEPT_NODES} initialEdges={CONCEPT_EDGES} />
              )}
              {activeTool === 'annotations' && (
                <AnnotationOverlay onAskAgent={() => { onOpenAgent(); }} />
              )}
              {activeTool === 'scratchpad' && (
                <FormulaScratchpad />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini Dashboard - floating */}
        <div className="absolute bottom-4 right-4 z-20">
          <MiniDashboard
            readiness={58}
            streak={12}
            reviewsDue={3}
            weakSpots={[
              { concept: 'Elasticity Calculations', mastery: 45, course: 'Microeconomics' },
              { concept: 'Welfare Economics', mastery: 20, course: 'Microeconomics' },
              { concept: 'Game Theory', mastery: 0, course: 'Microeconomics' },
            ]}
            nextActions={[
              { label: 'Review: Supply & Demand', type: 'review', minutes: 8, xp: 30 },
              { label: 'Practice: Elasticity', type: 'practice', minutes: 12, xp: 35 },
              { label: 'Lesson: Welfare Economics', type: 'lesson', minutes: 20, xp: 50 },
            ]}
            conceptsMastered={31}
            totalConcepts={136}
          />
        </div>
      </div>
    </div>
  );
}

/* --- Inline lesson content for the workspace --- */
function LessonContent({ step, onOpenAgent }: { step: number; onOpenAgent: () => void }) {
  switch (step) {
    case 0: return (
      <div className="space-y-4">
        <span className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider">Core Concept</span>
        <h2 className="text-xl font-bold">Two Models of Oligopoly</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          When a market has only a few firms, each firm's decisions affect the others. The key strategic question is:
          <strong className="text-text-primary"> what variable do firms compete on?</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-brand-500/5 border border-brand-500/20">
            <h4 className="text-xs font-semibold text-brand-300 mb-1">🏭 Cournot</h4>
            <ul className="text-[11px] text-text-secondary space-y-0.5">
              <li>• Compete on <strong>quantity</strong></li>
              <li>• Price set by market</li>
              <li>• Simultaneous moves</li>
            </ul>
          </div>
          <div className="p-3 rounded-xl bg-accent-teal/5 border border-accent-teal/20">
            <h4 className="text-xs font-semibold text-accent-teal mb-1">💰 Bertrand</h4>
            <ul className="text-[11px] text-text-secondary space-y-0.5">
              <li>• Compete on <strong>price</strong></li>
              <li>• Quantity set by demand</li>
              <li>• The "Bertrand Paradox"</li>
            </ul>
          </div>
        </div>
        <p className="text-[10px] text-text-muted flex items-center gap-1">📖 Source: Lecture Notes, slides 34-41</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onOpenAgent} className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary">💡 Explain Differently</button>
          <button onClick={onOpenAgent} className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary">🧪 Test Me</button>
          <button onClick={onOpenAgent} className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary">🔰 From Zero</button>
        </div>
      </div>
    );
    case 1: return (
      <div className="space-y-4">
        <span className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider">Deep Dive</span>
        <h2 className="text-xl font-bold">Cournot: Quantity Competition</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          In the Cournot model, each firm chooses its <strong className="text-text-primary">output level</strong> simultaneously.
          The market price is then determined by the total quantity via the demand curve.
        </p>
        <div className="p-3 rounded-xl bg-surface-primary/60 border border-border-subtle text-center">
          <p className="text-[10px] text-text-muted mb-1">Best Response Function</p>
          <p className="text-lg font-mono font-bold text-brand-300">q₁* = (a − c − q₂) / 2b</p>
        </div>
        <p className="text-sm text-text-secondary">Open the <strong className="text-brand-300">📐 Scratchpad</strong> to substitute values and compute step-by-step.</p>
        <p className="text-[10px] text-text-muted">📖 Source: Lecture Notes, slide 36 • Textbook Ch4 §4.3</p>
      </div>
    );
    case 2: return (
      <div className="space-y-4">
        <span className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider">Deep Dive</span>
        <h2 className="text-xl font-bold">Bertrand: Price Competition</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          In the Bertrand model, firms simultaneously choose <strong className="text-text-primary">prices</strong>.
          Consumers buy from the cheapest firm. With homogeneous products, any firm charging above MC loses all customers.
        </p>
        <div className="p-3 rounded-xl bg-accent-amber/5 border border-accent-amber/20">
          <p className="text-xs font-semibold text-accent-amber mb-1">⚠ Common Misconception</p>
          <p className="text-[11px] text-text-secondary">Students often think more firms are needed for competitive pricing. The Bertrand Paradox shows that <strong>just two firms</strong> can achieve the competitive outcome.</p>
        </div>
      </div>
    );
    case 3: return (
      <div className="space-y-4">
        <span className="text-[10px] text-accent-amber font-semibold uppercase tracking-wider">Key Insight</span>
        <h2 className="text-xl font-bold">The Bertrand Paradox</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          With just two firms selling <strong className="text-text-primary">identical products</strong>, the Nash equilibrium price equals marginal cost — the same outcome as perfect competition.
        </p>
        <p className="text-sm text-text-secondary">This is "paradoxical" because we expect oligopolies to have market power, yet Bertrand competition eliminates it entirely.</p>
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">Resolution:</strong> Product differentiation, capacity constraints, or repeated interaction can restore market power in Bertrand settings.
        </p>
        <p className="text-[10px] text-text-muted">💡 Tip: Use the <strong className="text-brand-300">🗺 Concept Map</strong> to see how this connects to Welfare Economics.</p>
      </div>
    );
    case 4: return (
      <div className="space-y-4">
        <span className="text-[10px] text-accent-teal font-semibold uppercase tracking-wider">Practice</span>
        <h2 className="text-xl font-bold">Worked Example</h2>
        <div className="p-3 rounded-xl bg-surface-primary/60 border border-border-subtle">
          <p className="text-xs font-medium mb-2">Two firms face demand P = 100 − Q, MC = 10. Find Cournot equilibrium.</p>
        </div>
        <div className="space-y-2 text-sm text-text-secondary font-mono">
          <p className="text-brand-300 text-[10px] font-sans font-semibold">Step 1: Profit function</p>
          <p className="bg-surface-primary/40 px-3 py-1.5 rounded-lg">π₁ = (100 − q₁ − q₂)q₁ − 10q₁</p>
          <p className="text-brand-300 text-[10px] font-sans font-semibold">Step 2: FOC → Best response</p>
          <p className="bg-surface-primary/40 px-3 py-1.5 rounded-lg">q₁* = (90 − q₂) / 2</p>
          <p className="text-brand-300 text-[10px] font-sans font-semibold">Step 3: Symmetry → q₁ = q₂ = q</p>
          <p className="bg-surface-primary/40 px-3 py-1.5 rounded-lg">q* = 30, Q* = 60, P* = 40</p>
          <p className="text-accent-emerald text-[10px] font-sans font-semibold">✓ Each firm produces 30 units, profit = 900.</p>
        </div>
        <p className="text-[10px] text-text-muted">📐 Open the <strong className="text-brand-300">Scratchpad</strong> to try different values!</p>
      </div>
    );
    case 5: return (
      <div className="space-y-4">
        <span className="text-[10px] text-accent-cyan font-semibold uppercase tracking-wider">Quiz</span>
        <h2 className="text-xl font-bold">Knowledge Check</h2>
        <div className="p-3 rounded-xl bg-surface-card border border-border-subtle">
          <p className="text-sm mb-3">In Bertrand competition with identical products, the equilibrium price is:</p>
          {['Above marginal cost', 'Equal to marginal cost', 'Equal to average total cost', 'Zero'].map((opt, i) => (
            <button key={i} className="w-full text-left p-2.5 rounded-lg border border-border-subtle hover:border-brand-500/30 text-sm mb-1.5 transition-all flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border border-text-muted text-[10px] flex items-center justify-center shrink-0">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
    default: return <p className="text-text-muted">Select a step to begin.</p>;
  }
}
