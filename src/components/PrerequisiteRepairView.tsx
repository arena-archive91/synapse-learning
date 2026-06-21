import { useState } from 'react';
import { X, ArrowDownRight, CheckCircle2, Sparkles, BookOpen } from 'lucide-react';
import type { PrerequisiteStep } from '../lib/taskFlows';
import { cn } from '../utils/cn';

interface PrerequisiteRepairViewProps {
  onClose: () => void;
  onOpenAgent: () => void;
  onComplete: () => void;
  onQuizAttempt?: (concept: string, correct: boolean, confidence: number) => void;
  taskTitle?: string;
  courseName?: string;
  quizConcept?: string;
  targetConcept?: string;
  xpReward?: number;
  steps?: PrerequisiteStep[];
  checkpoint?: { question: string; options: string[]; correctIndex: number };
}

export function PrerequisiteRepairView({
  onClose,
  onOpenAgent,
  onComplete,
  onQuizAttempt,
  taskTitle,
  courseName,
  quizConcept = 'Prerequisite',
  targetConcept,
  xpReward = 30,
  steps = [],
  checkpoint,
}: PrerequisiteRepairViewProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [checkpointAnswer, setCheckpointAnswer] = useState<number | null>(null);
  const [checkpointDone, setCheckpointDone] = useState(false);

  const checkpointQuestion = checkpoint?.question
    ?? `Quick check: What is the core idea of ${quizConcept}?`;
  const checkpointOptions = checkpoint?.options ?? [
    `The definition and key properties of ${quizConcept}`,
    'An unrelated concept from another chapter',
    'Only the formula with no assumptions',
    'A graph with no interpretation',
  ];
  const checkpointCorrectIndex = checkpoint?.correctIndex ?? 0;
  const repairSteps = steps.length > 0 ? steps : [{ title: quizConcept, body: 'Review the foundational concept before continuing.' }];
  const isLastStep = stepIndex >= repairSteps.length - 1;
  const sessionTitle = taskTitle ?? `Prerequisite Repair: ${quizConcept}`;

  const handleCheckpoint = (index: number) => {
    setCheckpointAnswer(index);
    const correct = index === checkpointCorrectIndex;
    setCheckpointDone(true);
    onQuizAttempt?.(quizConcept, correct, 70);
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-surface-secondary/50">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <p className="text-sm font-semibold">{sessionTitle}</p>
            <p className="text-xs text-text-tertiary flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3 text-accent-amber" />
              {courseName ?? 'Prerequisite repair'}
              {targetConcept ? ` · before ${targetConcept}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAgent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-brand-500/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Ask Agent
          </button>
          <span className="text-xs text-accent-amber font-medium">+{xpReward} XP</span>
        </div>
      </div>

      <div className="h-1 bg-surface-hover">
        <div
          className="h-1 bg-accent-amber transition-all duration-300"
          style={{ width: `${((stepIndex + 1) / repairSteps.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-5">
        <div className="p-4 rounded-xl bg-accent-amber/5 border border-accent-amber/20">
          <h2 className="text-sm font-semibold text-accent-amber flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {repairSteps[stepIndex]?.title}
          </h2>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">{repairSteps[stepIndex]?.body}</p>
        </div>

        {isLastStep && (
          <div className="p-5 rounded-xl bg-surface-card border border-border-subtle">
            <p className="text-sm font-medium mb-3">{checkpointQuestion}</p>
            <div className="space-y-2">
              {checkpointOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => !checkpointDone && handleCheckpoint(i)}
                  disabled={checkpointDone}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border text-sm transition-all',
                    checkpointAnswer === i
                      ? i === checkpointCorrectIndex
                        ? 'border-accent-emerald/50 bg-accent-emerald/10 text-accent-emerald'
                        : 'border-accent-rose/50 bg-accent-rose/10 text-accent-rose'
                      : 'border-border-subtle hover:border-brand-500/30',
                  )}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              ))}
            </div>
            {checkpointDone && (
              <p className={cn('text-xs mt-3', checkpointAnswer === checkpointCorrectIndex ? 'text-accent-emerald' : 'text-accent-rose')}>
                {checkpointAnswer === checkpointCorrectIndex
                  ? '✓ Correct — you are ready to return to the dependent topic.'
                  : '✗ Review the steps above before completing the repair.'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border-subtle bg-surface-secondary/50 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
            disabled={stepIndex === 0}
            className="text-xs text-text-secondary disabled:text-text-muted"
          >
            ← Previous
          </button>
          <span className="text-xs text-text-muted">{stepIndex + 1}/{repairSteps.length}</span>
          {isLastStep ? (
            <button
              onClick={handleComplete}
              disabled={!checkpointDone}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                checkpointDone
                  ? 'bg-brand-600 hover:bg-brand-500 text-white'
                  : 'bg-surface-hover text-text-muted cursor-not-allowed',
              )}
            >
              Complete repair <CheckCircle2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setStepIndex((s) => s + 1)}
              className="text-xs text-brand-400 font-medium"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
