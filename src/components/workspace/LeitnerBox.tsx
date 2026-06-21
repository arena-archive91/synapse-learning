import { useState } from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { FsrsRating } from '../../lib/pedagogy';
import { useI18n } from '../../lib/i18n';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

const BOX_KEYS = ['leitnerAgain', 'leitnerHard', 'leitnerGood', 'leitnerEasy'] as const;

interface LeitnerBoxProps {
  cards?: { front: string; back: string }[];
  concept?: string;
  onRate?: (rating: FsrsRating) => void;
  /** When true, the first FSRS rating triggers onRate and ends the session (task-bound review). */
  completeOnRate?: boolean;
  emptyMessage?: string;
  onUpload?: () => void;
}

export function LeitnerBox({
  cards = [],
  concept,
  onRate,
  completeOnRate = false,
  emptyMessage,
  onUpload,
}: LeitnerBoxProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [boxCounts, setBoxCounts] = useState([2, 1, 0, 0]);
  const [finished, setFinished] = useState(false);

  const deck = cards;
  const card = deck.length > 0 ? deck[index % deck.length] : null;

  const rate = (rating: FsrsRating) => {
    if (finished || !card) return;
    const boxIdx = { again: 0, hard: 1, good: 2, easy: 3 }[rating];
    setBoxCounts((prev) => prev.map((c, i) => (i === boxIdx ? c + 1 : c)));
    onRate?.(rating);
    if (completeOnRate) {
      setFinished(true);
      return;
    }
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  if (deck.length === 0) {
    return (
      <WorkspaceEmptyState
        message={emptyMessage ?? 'Upload notes to generate flashcards from your glossary and definitions.'}
        onUpload={onUpload}
      />
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-accent-amber" />
        {t('leitnerBox')}{concept ? `: ${concept}` : ''}
      </h3>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {BOX_KEYS.map((key, i) => (
          <div key={key} className="p-2 rounded-lg bg-surface-primary/50 border border-border-subtle text-center">
            <p className="text-lg font-bold">{boxCounts[i]}</p>
            <p className="text-[9px] text-text-muted">{t(key)}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => setFlipped(!flipped)}
        className="flex-1 min-h-[140px] rounded-xl border border-brand-500/30 bg-brand-500/5 p-5 text-left hover:border-brand-500/50 transition-all"
      >
        <p className="text-[10px] text-text-muted mb-2">{flipped ? t('answer') : t('question')}</p>
        <p className="text-sm font-medium leading-relaxed">{flipped ? card!.back : card!.front}</p>
      </button>

      {finished && (
        <p className="mt-4 text-center text-sm text-accent-emerald font-medium">
          {t('reviewLogged')}
        </p>
      )}

      {flipped && !finished && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {([
            { rating: 'again' as FsrsRating, key: 'leitnerAgain' as const, color: 'border-accent-rose/40 text-accent-rose' },
            { rating: 'hard' as FsrsRating, key: 'leitnerHard' as const, color: 'border-accent-orange/40 text-accent-orange' },
            { rating: 'good' as FsrsRating, key: 'leitnerGood' as const, color: 'border-accent-amber/40 text-accent-amber' },
            { rating: 'easy' as FsrsRating, key: 'leitnerEasy' as const, color: 'border-accent-emerald/40 text-accent-emerald' },
          ]).map(({ rating, key, color }) => (
            <button
              key={rating}
              onClick={() => rate(rating)}
              className={cn('py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-90', color)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => { setFlipped(false); setIndex(0); setBoxCounts([2, 1, 0, 0]); setFinished(false); }}
        className="mt-3 flex items-center justify-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
      >
        <RotateCcw className="w-3 h-3" /> {t('resetDeck')}
      </button>
    </div>
  );
}
