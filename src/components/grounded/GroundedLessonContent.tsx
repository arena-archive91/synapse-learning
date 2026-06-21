import { Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';
import { RichText } from '../RichText';
import type { QuizDef, LessonStepKey } from '../../lib/domainContent';
import { isMcQuiz } from '../../lib/lessonTypes';
import type { Lang, I18nKey } from '../../lib/i18n';
import type { Topic } from '../../types';
import type { WorkspacePanel, WorkspacePanelBlock } from '../../lib/workspaceLessonPanels';
import { getNoteContentForLessonStep } from '../../lib/groundedLesson';

interface Props {
  stepKey: LessonStepKey;
  stepLabel: string;
  concept: string;
  noteText: string;
  hasSource: boolean;
  emptyMessage: string;
  sourceName?: string;
  generatedPanel?: WorkspacePanel | null;
  genStatus: 'idle' | 'loading' | 'ready' | 'fallback';
  quizDef?: QuizDef | null;
  quizAnswer: number | null;
  quizPassed: boolean;
  onQuizSelect?: (idx: number) => void;
  onOpenAgent: () => void;
  onUpload?: () => void;
  lang: Lang;
  t: (key: I18nKey) => string;
  topic?: Topic;
}

export function GroundedLessonContent({
  stepKey,
  stepLabel,
  concept,
  noteText,
  hasSource,
  emptyMessage,
  sourceName,
  generatedPanel,
  genStatus,
  quizDef,
  quizAnswer,
  quizPassed,
  onQuizSelect,
  onOpenAgent,
  onUpload,
  lang,
  t,
  topic,
}: Props) {
  if (!hasSource) {
    return (
      <div className="space-y-4 text-center py-12">
        <p className="text-sm text-text-secondary max-w-md mx-auto">{emptyMessage}</p>
        {onUpload && (
          <button
            type="button"
            onClick={onUpload}
            className="mt-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400 transition-all"
          >
            {lang === 'el' ? 'Ανέβασμα Υλικού' : 'Upload Material'}
          </button>
        )}
      </div>
    );
  }

  if (stepKey === 'quiz' && quizDef && onQuizSelect && isMcQuiz(quizDef)) {
    return (
      <div className="space-y-4">
        <span className="text-xs text-brand-400 font-medium uppercase tracking-wider">{t('quiz')}</span>
        <h2 className="text-2xl font-bold">{t('knowledgeCheck')}</h2>
        <div className="p-4 rounded-xl bg-surface-card border border-border-subtle">
          <p className="text-sm mb-3">{quizDef.question}</p>
          {quizDef.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onQuizSelect(i)}
              className={cn(
                'w-full text-left p-3 rounded-lg border text-sm mb-2 transition-all flex items-center gap-2',
                quizAnswer === i
                  ? i === quizDef.correctIndex
                    ? 'border-accent-emerald/50 bg-accent-emerald/10 text-accent-emerald'
                    : 'border-accent-rose/50 bg-accent-rose/10 text-accent-rose'
                  : 'border-border-subtle hover:border-brand-500/30',
              )}
            >
              <span className="w-6 h-6 rounded-full border border-current text-xs flex items-center justify-center shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          ))}
          {quizAnswer !== null && (
            <p className={cn('text-xs mt-2', quizPassed ? 'text-accent-emerald' : 'text-accent-rose')}>
              {quizPassed ? `✓ ${t('canFinish')}` : `✗ ${t('reviewMaterial')}`}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (generatedPanel) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-brand-400 font-medium uppercase tracking-wider">{generatedPanel.badge}</span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald font-medium">
            <Sparkles className="w-3 h-3" />
            {lang === 'el' ? 'Από τις πηγές σου' : 'From your sources'}
          </span>
        </div>
        <h2 className="text-2xl font-bold">{generatedPanel.title}</h2>
        {generatedPanel.blocks.map((block, i) => (
          <PanelBlock key={i} block={block} onOpenAgent={onOpenAgent} />
        ))}
      </div>
    );
  }

  const body = getNoteContentForLessonStep(stepKey, noteText, concept, topic, lang);
  if (!body.trim() && stepKey !== 'practice') {
    return (
      <div className="space-y-4 text-center py-8">
        <p className="text-sm text-text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs text-accent-cyan font-medium uppercase tracking-wider">{stepLabel}</span>
        <h2 className="text-2xl font-bold mt-2">{concept}</h2>
      </div>
      <div className="text-sm text-text-secondary leading-relaxed">
        <RichText text={body} />
      </div>
      {stepKey === 'practice' && (
        <p className="text-xs text-text-muted italic">
          {lang === 'el'
            ? 'Σκέψου δυνατά πριν προχωρήσεις — η εξάσκηση βασίζεται στις σημειώσεις σου.'
            : 'Think through this before continuing — practice is tied to your notes.'}
        </p>
      )}
      {sourceName && (
        <p className="text-[10px] text-text-muted flex items-center gap-1.5 pt-2 border-t border-border-subtle">
          {lang === 'el' ? 'Πηγή' : 'Source'}: {sourceName}
        </p>
      )}
      {genStatus === 'loading' && (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-brand-500/10 text-brand-300 animate-pulse">
          <Sparkles className="w-3 h-3" />
          {lang === 'el' ? 'Δημιουργία από τις πηγές σου…' : 'Generating from your sources…'}
        </span>
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
                'p-4 rounded-xl border',
                card.accent === 'teal' ? 'bg-accent-teal/5 border-accent-teal/20' : 'bg-brand-500/5 border-brand-500/20',
              )}
            >
              <h4 className={cn('text-sm font-semibold mb-2', card.accent === 'teal' ? 'text-accent-teal' : 'text-brand-300')}>
                {card.title}
              </h4>
              <ul className="text-xs text-text-secondary space-y-1">
                {card.bullets.map((b) => <li key={b}>• {b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      );
    case 'formula':
      return (
        <div className="p-4 rounded-xl bg-surface-primary/60 border border-border-subtle text-center">
          <p className="text-[10px] text-text-muted mb-1">{block.label}</p>
          <div className="text-lg font-bold text-brand-300">
            <RichText text={/[$\\]/.test(block.formula) ? block.formula : `$$${block.formula}$$`} />
          </div>
        </div>
      );
    case 'callout':
      return (
        <div className={cn(
          'p-4 rounded-xl border',
          block.variant === 'warning' ? 'bg-accent-amber/5 border-accent-amber/20' : 'bg-brand-500/5 border-brand-500/20',
        )}>
          <p className={cn('text-sm font-semibold mb-1', block.variant === 'warning' ? 'text-accent-amber' : 'text-brand-300')}>
            {block.title}
          </p>
          <p className="text-xs text-text-secondary">{block.text}</p>
        </div>
      );
    case 'steps':
      return (
        <div className="space-y-2 text-sm text-text-secondary font-mono">
          {block.items.map((s) => (
            <div key={s.label}>
              <p className={cn('text-[10px] font-sans font-semibold', s.success ? 'text-accent-emerald' : 'text-brand-300')}>{s.label}</p>
              <p className="bg-surface-primary/40 px-3 py-2 rounded-lg">{s.content}</p>
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
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary"
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
