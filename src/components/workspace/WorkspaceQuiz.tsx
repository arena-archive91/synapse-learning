import { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { isMcQuiz, type QuizDef } from '../../lib/lessonTypes';
import type { Lang } from '../../lib/i18n';

type Props = {
  quizDef: QuizDef;
  lang: Lang;
  onComplete: (correct: boolean) => void;
};

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function WorkspaceQuiz({ quizDef, lang, onComplete }: Props) {
  const [mcAnswer, setMcAnswer] = useState<number | null>(null);
  const [shortText, setShortText] = useState('');
  const [shortChecked, setShortChecked] = useState<boolean | null>(null);
  const [order, setOrder] = useState<number[]>(() =>
    quizDef.kind === 'ordering' ? quizDef.items.map((_, i) => i) : [],
  );
  const [orderChecked, setOrderChecked] = useState<boolean | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [matchChecked, setMatchChecked] = useState<boolean | null>(null);

  const shuffledRight = useMemo(() => {
    if (quizDef.kind !== 'matching') return [];
    return quizDef.right.map((label, i) => ({ label, orig: i }));
  }, [quizDef]);

  if (isMcQuiz(quizDef)) {
    const passed = mcAnswer !== null && mcAnswer === quizDef.correctIndex;
    return (
      <div className="space-y-3">
        <p className="text-sm mb-3">{quizDef.question}</p>
        {quizDef.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setMcAnswer(i);
              onComplete(i === quizDef.correctIndex);
            }}
            className={cn(
              'w-full text-left p-2.5 rounded-lg border text-sm mb-1.5 transition-all flex items-center gap-2',
              mcAnswer === i
                ? i === quizDef.correctIndex
                  ? 'border-accent-emerald/50 bg-accent-emerald/10 text-accent-emerald'
                  : 'border-accent-rose/50 bg-accent-rose/10 text-accent-rose'
                : 'border-border-subtle hover:border-white/20 hover:bg-white/[0.03]',
            )}
          >
            <span className="w-5 h-5 rounded-full border border-current/30 flex items-center justify-center text-[10px] shrink-0">
              {String.fromCharCode(65 + i)}
            </span>
            {opt}
          </button>
        ))}
        {mcAnswer !== null && (
          <p className={cn('text-xs mt-2', passed ? 'text-accent-emerald' : 'text-accent-rose')}>
            {passed
              ? (lang === 'el' ? '✓ Σωστά — μπορείς να συνεχίσεις' : '✓ Correct — you can continue')
              : (lang === 'el' ? '✗ Δες ξανά το υλικό σου' : '✗ Review your material')}
          </p>
        )}
      </div>
    );
  }

  if (quizDef.kind === 'short-answer') {
    const sa = quizDef;
    const check = () => {
      const ok = sa.acceptedAnswers.some(
        (a: string) => normalizeAnswer(a) === normalizeAnswer(shortText),
      );
      setShortChecked(ok);
      onComplete(ok);
    };
    return (
      <div className="space-y-3">
        <p className="text-sm">{sa.question}</p>
        {sa.hint && <p className="text-xs text-text-muted">{sa.hint}</p>}
        <input
          type="text"
          value={shortText}
          onChange={(e) => { setShortText(e.target.value); setShortChecked(null); }}
          className="w-full rounded-lg border border-border-subtle bg-surface-primary px-3 py-2 text-sm"
          placeholder={lang === 'el' ? 'Η απάντησή σου…' : 'Your answer…'}
        />
        <button
          type="button"
          onClick={check}
          disabled={!shortText.trim()}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-40"
        >
          {lang === 'el' ? 'Έλεγχος' : 'Check'}
        </button>
        {shortChecked !== null && (
          <p className={cn('text-xs', shortChecked ? 'text-accent-emerald' : 'text-accent-rose')}>
            {shortChecked
              ? (lang === 'el' ? '✓ Σωστά' : '✓ Correct')
              : (lang === 'el' ? '✗ Δοκίμασε ξανά' : '✗ Try again')}
          </p>
        )}
      </div>
    );
  }

  if (quizDef.kind === 'ordering') {
    const ord = quizDef;
    const move = (from: number, dir: -1 | 1) => {
      const next = order.slice();
      const to = from + dir;
      if (to < 0 || to >= next.length) return;
      [next[from], next[to]] = [next[to]!, next[from]!];
      setOrder(next);
      setOrderChecked(null);
    };
    const checkOrder = () => {
      const ok = order.every((v, i) => v === ord.correctOrder[i]);
      setOrderChecked(ok);
      onComplete(ok);
    };
    return (
      <div className="space-y-3">
        <p className="text-sm">{ord.question}</p>
        <ul className="space-y-2">
          {order.map((itemIdx, pos) => (
            <li key={itemIdx} className="flex items-center gap-2 p-2 rounded-lg border border-border-subtle bg-surface-card text-sm">
              <span className="text-text-muted w-5">{pos + 1}.</span>
              <span className="flex-1">{ord.items[itemIdx]}</span>
              <button type="button" onClick={() => move(pos, -1)} className="px-2 py-0.5 text-xs rounded border border-white/10">↑</button>
              <button type="button" onClick={() => move(pos, 1)} className="px-2 py-0.5 text-xs rounded border border-white/10">↓</button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={checkOrder} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm">
          {lang === 'el' ? 'Έλεγχος σειράς' : 'Check order'}
        </button>
        {orderChecked !== null && (
          <p className={cn('text-xs', orderChecked ? 'text-accent-emerald' : 'text-accent-rose')}>
            {orderChecked ? '✓' : '✗'} {lang === 'el' ? (orderChecked ? 'Σωστή σειρά' : 'Λάθος σειρά') : (orderChecked ? 'Correct order' : 'Wrong order')}
          </p>
        )}
      </div>
    );
  }

  if (quizDef.kind === 'matching') {
    const match = quizDef;
    const checkMatch = () => {
      const ok = match.pairs.every(([l, r]) => matches[l] === r);
      setMatchChecked(ok);
      onComplete(ok);
    };
    return (
      <div className="space-y-3">
        <p className="text-sm">{match.question}</p>
        <div className="grid gap-2">
          {match.left.map((left, li) => (
            <div key={li} className="flex items-center gap-2 text-sm">
              <span className="flex-1 p-2 rounded-lg bg-surface-card border border-border-subtle">{left}</span>
              <select
                value={matches[li] ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value);
                  setMatches((m) => {
                    const next = { ...m };
                    if (v === undefined) delete next[li];
                    else next[li] = v;
                    return next;
                  });
                  setMatchChecked(null);
                }}
                className="flex-1 rounded-lg border border-border-subtle bg-surface-primary px-2 py-2 text-sm"
              >
                <option value="">{lang === 'el' ? '— επίλεξε —' : '— select —'}</option>
                {shuffledRight.map(({ label, orig }) => (
                  <option key={orig} value={orig}>{label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={checkMatch}
          disabled={Object.keys(matches).length < match.left.length}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-40"
        >
          {lang === 'el' ? 'Έλεγχος αντιστοιχίσεων' : 'Check matches'}
        </button>
        {matchChecked !== null && (
          <p className={cn('text-xs', matchChecked ? 'text-accent-emerald' : 'text-accent-rose')}>
            {matchChecked ? '✓' : '✗'} {lang === 'el' ? (matchChecked ? 'Σωστά' : 'Λάθος') : (matchChecked ? 'Correct' : 'Incorrect')}
          </p>
        )}
      </div>
    );
  }

  return null;
}
