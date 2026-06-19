import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Circle, ChevronRight,
  Lightbulb, AlertTriangle, BookOpen, Brain, Sparkles,
  FileText, MessageSquare, Zap, Star, X
} from 'lucide-react';
import { cn } from '../utils/cn';
import { SupplyDemandDiagram, FormulaExplorer, ComparisonTable, FlowchartDiagram } from './visuals/DiagramGenerator';
import { ConfidenceSelector } from './visuals/ConfidenceSelector';

interface LessonViewProps {
  onClose: () => void;
  onOpenAgent: () => void;
}

type LessonStep = 'intro' | 'explanation' | 'example' | 'misconception' | 'practice' | 'quiz' | 'summary';

const steps: { key: LessonStep; label: string }[] = [
  { key: 'intro', label: 'Introduction' },
  { key: 'explanation', label: 'Core Concept' },
  { key: 'example', label: 'Example' },
  { key: 'misconception', label: 'Common Mistakes' },
  { key: 'practice', label: 'Practice' },
  { key: 'quiz', label: 'Check' },
  { key: 'summary', label: 'Summary' },
];

export function LessonView({ onClose, onOpenAgent }: LessonViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setQuizAnswer(null);
      setShowHint(false);
      setConfidence(null);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-secondary/50">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <p className="text-sm font-semibold">Cournot vs Bertrand Competition</p>
            <p className="text-xs text-text-tertiary">Market Structures · Microeconomics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAgent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-brand-500/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            Ask Agent
          </button>
          <span className="text-xs text-accent-amber font-medium">+50 XP</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-surface-hover">
        <div
          className="h-1 bg-brand-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto hide-scrollbar">
        {steps.map((s, i) => (
          <button
            key={s.key}
            onClick={() => i <= currentStep && setCurrentStep(i)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all shrink-0',
              i === currentStep
                ? 'bg-brand-600/20 text-brand-300'
                : i < currentStep
                ? 'text-accent-emerald'
                : 'text-text-muted'
            )}
          >
            {i < currentStep ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : i === currentStep ? (
              <Circle className="w-3 h-3" />
            ) : (
              <Circle className="w-3 h-3 opacity-30" />
            )}
            {s.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step.key === 'intro' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs text-brand-400 font-medium uppercase tracking-wider">Introduction</span>
                    <h2 className="text-2xl font-bold mt-2">Cournot vs Bertrand Competition</h2>
                    <p className="text-text-secondary mt-2 leading-relaxed">
                      In this lesson, you'll learn the fundamental difference between two models of oligopoly 
                      competition: Cournot (quantity competition) and Bertrand (price competition). Understanding 
                      these models is crucial for analyzing real-world market behavior.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-brand-400" />
                      What you'll learn
                    </h4>
                    <ul className="space-y-1.5 text-sm text-text-secondary">
                      <li className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-brand-400 mt-1 shrink-0" />
                        How firms compete on quantity (Cournot) vs price (Bertrand)
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-brand-400 mt-1 shrink-0" />
                        Nash equilibrium in both models
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-brand-400 mt-1 shrink-0" />
                        Why the Bertrand paradox matters
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-brand-400 mt-1 shrink-0" />
                        Real-world applications and limitations
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-card border border-border-subtle">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-accent-amber" />
                      Prerequisites
                    </h4>
                    <p className="text-xs text-text-secondary">Supply & Demand (92% mastery ✓) · Game Theory basics (recommended)</p>
                  </div>

                  <div className="text-xs text-text-muted flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Source: Lecture_Notes_Micro.pdf, Chapter 4
                  </div>
                </div>
              )}

              {step.key === 'explanation' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs text-brand-400 font-medium uppercase tracking-wider">Core Concept</span>
                    <h2 className="text-2xl font-bold mt-2">Two Models of Oligopoly</h2>
                  </div>

                  <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
                    <p>
                      When a market has only a few firms (an <strong className="text-text-primary">oligopoly</strong>), each firm's 
                      decisions affect the others. The key question is: <strong className="text-text-primary">what variable do firms compete on?</strong>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                        <h4 className="font-semibold text-brand-300 mb-2">🏭 Cournot Model</h4>
                        <ul className="space-y-1 text-xs">
                          <li>• Firms choose <strong>quantities</strong></li>
                          <li>• Price determined by market</li>
                          <li>• Simultaneous decisions</li>
                          <li>• Output {'>'} monopoly, {'<'} perfect competition</li>
                          <li>• Price {'>'} competitive, {'<'} monopoly</li>
                        </ul>
                      </div>
                      <div className="p-4 rounded-xl bg-accent-teal/5 border border-accent-teal/20">
                        <h4 className="font-semibold text-accent-teal mb-2">💰 Bertrand Model</h4>
                        <ul className="space-y-1 text-xs">
                          <li>• Firms choose <strong>prices</strong></li>
                          <li>• Quantity determined by demand</li>
                          <li>• Simultaneous decisions</li>
                          <li>• Price = marginal cost (2 firms!)</li>
                          <li>• The "Bertrand Paradox"</li>
                        </ul>
                      </div>
                    </div>

                    <p>
                      The <strong className="text-text-primary">Bertrand Paradox</strong> is the surprising result that with just 
                      two firms competing on price (with identical products), the equilibrium price equals marginal cost — 
                      the same as perfect competition!
                    </p>

                    <div className="p-4 rounded-xl bg-surface-card border border-border-subtle">
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-brand-400" />
                        Key Intuition
                      </h4>
                      <p className="text-xs text-text-secondary">
                        In Cournot, firms can sustain higher prices because adding output is gradual — each firm 
                        responds to the other's quantity. In Bertrand, a tiny price cut steals ALL customers 
                        (with identical products), driving prices to marginal cost.
                      </p>
                    </div>
                  </div>

                  {/* Auto-generated visual aids */}
                  <SupplyDemandDiagram />

                  <ComparisonTable
                    title="Cournot vs Bertrand Comparison"
                    headers={['Feature', 'Cournot', 'Bertrand']}
                    items={[
                      ['Decision variable', 'Quantity', 'Price'],
                      ['Number of firms needed', '≥ 2', '≥ 2'],
                      ['Equilibrium price', 'Above MC', 'Equal to MC (homogeneous)'],
                      ['Consumer welfare', 'Lower than competitive', 'Same as competitive'],
                      ['Key assumption', 'Firms set output', 'Firms set price'],
                    ]}
                  />

                  <FormulaExplorer
                    name="Cournot Best Response Function"
                    formula="q₁* = (a - c - q₂) / 2b"
                    symbols={[
                      { symbol: 'q₁*', meaning: 'Firm 1 optimal quantity', unit: 'units' },
                      { symbol: 'a', meaning: 'Demand intercept', unit: '$/unit' },
                      { symbol: 'c', meaning: 'Marginal cost', unit: '$/unit' },
                      { symbol: 'q₂', meaning: 'Firm 2 quantity', unit: 'units' },
                      { symbol: 'b', meaning: 'Demand slope', unit: '$/unit²' },
                    ]}
                  />

                  <div className="text-xs text-text-muted flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Source: Lecture_Notes_Micro.pdf, slides 34-41
                  </div>
                </div>
              )}

              {step.key === 'example' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs text-brand-400 font-medium uppercase tracking-wider">Worked Example</span>
                    <h2 className="text-2xl font-bold mt-2">Cournot Duopoly Calculation</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-surface-card border border-border-subtle">
                      <p className="text-sm font-medium mb-2">Problem:</p>
                      <p className="text-sm text-text-secondary">
                        Two firms face market demand P = 100 - Q, where Q = q₁ + q₂. 
                        Both have MC = 10. Find the Cournot equilibrium quantities and price.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                        <p className="text-xs font-semibold text-brand-300 mb-1">Step 1: Profit function</p>
                        <p className="text-sm font-mono text-text-secondary">
                          π₁ = (100 - q₁ - q₂) · q₁ - 10 · q₁
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                        <p className="text-xs font-semibold text-brand-300 mb-1">Step 2: Best response (∂π₁/∂q₁ = 0)</p>
                        <p className="text-sm font-mono text-text-secondary">
                          90 - 2q₁ - q₂ = 0 → q₁* = (90 - q₂) / 2
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                        <p className="text-xs font-semibold text-brand-300 mb-1">Step 3: Symmetry (q₁ = q₂ = q)</p>
                        <p className="text-sm font-mono text-text-secondary">
                          q = (90 - q) / 2 → q* = 30
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-accent-emerald/5 border border-accent-emerald/20">
                        <p className="text-xs font-semibold text-accent-emerald mb-1">Result</p>
                        <p className="text-sm text-text-secondary">
                          q₁* = q₂* = 30, Q* = 60, P* = 40, π* = 900 per firm
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step.key === 'misconception' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs text-accent-amber font-medium uppercase tracking-wider">Common Mistakes</span>
                    <h2 className="text-2xl font-bold mt-2">Why Students Get Confused</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 rounded-xl bg-accent-rose/5 border border-accent-rose/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-accent-rose shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-accent-rose text-sm mb-1">Misconception #1</h4>
                          <p className="text-sm text-text-secondary">
                            "More firms always means lower prices." — This is true in Bertrand (even 2 firms give 
                            competitive pricing!) but in Cournot, prices decrease gradually as N increases.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-accent-rose/5 border border-accent-rose/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-accent-rose shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-accent-rose text-sm mb-1">Misconception #2</h4>
                          <p className="text-sm text-text-secondary">
                            "Cournot and Bertrand always give different results." — When products are differentiated, 
                            both models can yield similar outcomes. The stark difference only holds with homogeneous products.
                          </p>
                        </div>
                      </div>
                    </div>

                    <FlowchartDiagram
                      title="Decision Tree: Which Model to Use?"
                      nodes={[
                        { id: 'start', label: 'Oligopoly Problem', type: 'start' },
                        { id: 'q1', label: 'Decision variable?', type: 'decision' },
                        { id: 'qty', label: 'Cournot Model', type: 'step' },
                        { id: 'price', label: 'Bertrand Model', type: 'step' },
                        { id: 'end', label: 'Apply equilibrium', type: 'end' },
                      ]}
                      edges={[
                        { from: 'start', to: 'q1' },
                        { from: 'q1', to: 'qty', label: 'Quantity' },
                        { from: 'q1', to: 'price', label: 'Price' },
                        { from: 'qty', to: 'end' },
                        { from: 'price', to: 'end' },
                      ]}
                    />

                    <div className="p-4 rounded-xl bg-surface-card border border-border-subtle">
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-accent-amber" />
                        Pro Tip for Exams
                      </h4>
                      <p className="text-xs text-text-secondary">
                        Always state your assumptions clearly. Mention whether products are homogeneous or differentiated, 
                        and whether firms move simultaneously or sequentially (Stackelberg).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {step.key === 'practice' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs text-accent-teal font-medium uppercase tracking-wider">Practice</span>
                    <h2 className="text-2xl font-bold mt-2">Your Turn</h2>
                  </div>

                  <div className="p-5 rounded-xl bg-surface-card border border-border-subtle">
                    <p className="text-sm font-medium mb-4">
                      Using the same demand function P = 100 - Q and MC = 10, find the Bertrand equilibrium 
                      price with two firms selling identical products.
                    </p>

                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-surface-primary border border-border-subtle">
                        <p className="text-xs text-text-muted mb-2">Your answer:</p>
                        <input
                          type="text"
                          placeholder="Enter the Bertrand equilibrium price..."
                          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowHint(!showHint)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-accent-amber/30 text-text-secondary transition-all"
                        >
                          <Lightbulb className="w-3 h-3 inline mr-1 text-accent-amber" />
                          {showHint ? 'Hide hint' : 'Show hint'}
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white transition-all"
                        >
                          Check Answer
                        </button>
                      </div>

                      {showHint && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="p-3 rounded-lg bg-accent-amber/5 border border-accent-amber/20 text-xs text-text-secondary"
                        >
                          💡 Remember the Bertrand Paradox: with identical products, what happens when one firm 
                          slightly undercuts the other's price?
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step.key === 'quiz' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs text-accent-cyan font-medium uppercase tracking-wider">Knowledge Check</span>
                    <h2 className="text-2xl font-bold mt-2">Quick Recall</h2>
                  </div>

                  <div className="p-5 rounded-xl bg-surface-card border border-border-subtle">
                    <p className="text-sm font-medium mb-4">
                      In a Cournot duopoly with identical firms, the equilibrium output per firm is:
                    </p>

                    <div className="space-y-2">
                      {[
                        'Equal to the monopoly output',
                        'Between monopoly output and competitive output per firm',
                        'Equal to the competitive output',
                        'Zero (no production)',
                      ].map((option, i) => (
                        <button
                          key={i}
                          onClick={() => setQuizAnswer(i)}
                          className={cn(
                            'w-full text-left p-3 rounded-xl border text-sm transition-all',
                            quizAnswer === i
                              ? i === 1
                                ? 'border-accent-emerald/50 bg-accent-emerald/10 text-accent-emerald'
                                : 'border-accent-rose/50 bg-accent-rose/10 text-accent-rose'
                              : 'border-border-subtle hover:border-brand-500/30'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-medium shrink-0">
                              {String.fromCharCode(65 + i)}
                            </span>
                            {option}
                            {quizAnswer === i && i === 1 && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                          </div>
                        </button>
                      ))}
                    </div>

                    {quizAnswer !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'mt-4 p-4 rounded-xl text-sm',
                          quizAnswer === 1
                            ? 'bg-accent-emerald/10 border border-accent-emerald/20'
                            : 'bg-accent-rose/10 border border-accent-rose/20'
                        )}
                      >
                        {quizAnswer === 1 ? (
                          <p className="text-accent-emerald">
                            ✓ Correct! In Cournot, output is greater than monopoly but less than perfect competition. 
                            As N → ∞, Cournot converges to the competitive outcome.
                          </p>
                        ) : (
                          <p className="text-accent-rose">
                            ✗ Not quite. Remember: Cournot firms produce more than a monopolist (because they compete) 
                            but less than competitive firms (because they still have market power).
                          </p>
                        )}
                      </motion.div>
                    )}

                    {/* Confidence pre-submit (required before grading) */}
                    {quizAnswer === null && (
                      <div className="mt-4">
                        <ConfidenceSelector value={confidence} onChange={setConfidence} required />
                        <p className="text-[9px] text-text-muted mt-2">Your self-rating vs actual accuracy is tracked to calibrate confidence over time.</p>
                      </div>
                    )}

                    {quizAnswer !== null && (
                      <div className="mt-4">
                        <ConfidenceSelector value={confidence} onChange={setConfidence} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step.key === 'summary' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-xs text-accent-emerald font-medium uppercase tracking-wider">Summary</span>
                    <h2 className="text-2xl font-bold mt-2">Lesson Complete! 🎉</h2>
                  </div>

                  <div className="p-5 rounded-xl bg-surface-card border border-border-subtle">
                    <h4 className="font-semibold mb-3">Key Takeaways</h4>
                    <ul className="space-y-2 text-sm text-text-secondary">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                        Cournot: firms compete on quantity; Bertrand: firms compete on price
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                        Bertrand Paradox: 2 firms can replicate perfectly competitive pricing
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                        Product differentiation weakens the Bertrand Paradox
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                        Cournot equilibrium lies between monopoly and competitive outcomes
                      </li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-surface-card border border-border-subtle text-center">
                      <Zap className="w-5 h-5 text-accent-amber mx-auto mb-1" />
                      <p className="text-lg font-bold">+50</p>
                      <p className="text-xs text-text-tertiary">XP Earned</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-card border border-border-subtle text-center">
                      <Brain className="w-5 h-5 text-brand-400 mx-auto mb-1" />
                      <p className="text-lg font-bold">72%</p>
                      <p className="text-xs text-text-tertiary">Mastery</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-card border border-border-subtle text-center">
                      <Star className="w-5 h-5 text-accent-amber mx-auto mb-1" />
                      <p className="text-lg font-bold">12</p>
                      <p className="text-xs text-text-tertiary">Day Streak</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Recommended Next</h4>
                    <button className="w-full p-4 rounded-xl border border-border-subtle bg-surface-card hover:border-brand-500/20 transition-all text-left flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-brand-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Stackelberg Competition</p>
                        <p className="text-xs text-text-tertiary">Sequential quantity competition</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    </button>
                    <button className="w-full p-4 rounded-xl border border-border-subtle bg-surface-card hover:border-brand-500/20 transition-all text-left flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-accent-amber" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Practice: More Oligopoly Problems</p>
                        <p className="text-xs text-text-tertiary">5 exercises with step-by-step solutions</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-hover/50 border border-border-subtle text-xs text-text-muted flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    Spaced repetition scheduled: review in 1 day, then 3 days, then 7 days
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Interactive action buttons */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-4">
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border-subtle">
            {[
              { label: '💡 Explain Differently', desc: 'Alternative explanation' },
              { label: '🔰 Teach From Zero', desc: 'No background assumed' },
              { label: '🧪 Test Me Now', desc: 'Quick recall check' },
              { label: '📝 Compress Lesson', desc: 'Short revision version' },
              { label: '🔍 Show Source', desc: 'Where this came from' },
              { label: '📊 Compare Concepts', desc: 'Side-by-side comparison' },
            ].map(action => (
              <button key={action.label} onClick={onOpenAgent} className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-border-subtle hover:border-brand-500/30 hover:bg-surface-hover text-text-secondary transition-all">
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-border-subtle bg-surface-secondary/50 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentStep === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              currentStep === 0
                ? 'text-text-muted cursor-not-allowed'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <span className="text-xs text-text-muted">{currentStep + 1} / {steps.length}</span>

          <button
            onClick={currentStep === steps.length - 1 ? onClose : goNext}
            className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            {currentStep === steps.length - 1 ? 'Finish' : 'Continue'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
