import { useEffect, useRef, useState } from 'react';

import { Sparkles, Type } from 'lucide-react';

import { cn } from '../../utils/cn';

import { useI18n } from '../../lib/i18n';

import type { SourceHighlight } from '../../lib/conceptProvenance';

import { WorkspaceEmptyState } from './WorkspaceEmptyState';



interface Props {

  text?: string;

  complexityThreshold?: number;

  emptyMessage?: string;

  onUpload?: () => void;

  /** Scroll to and highlight a sentence-level span in the full source text. */

  highlight?: SourceHighlight | null;

}



export function CognitiveReader({

  text = '',

  complexityThreshold = 25,

  emptyMessage,

  onUpload,

  highlight,

}: Props) {

  const { t } = useI18n();

  const [bionic, setBionic] = useState(false);

  const [highlightComplexity, setHighlightComplexity] = useState(false);

  const markRef = useRef<HTMLElement>(null);



  useEffect(() => {

    if (highlight) markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  }, [highlight, text]);



  const renderBionic = (word: string) => {

    if (word.length <= 1) return <strong className="font-bold">{word}</strong>;

    const mid = Math.ceil(word.length / 2);

    return (

      <span>

        <strong className="font-bold">{word.slice(0, mid)}</strong>

        <span className="opacity-80">{word.slice(mid)}</span>

      </span>

    );

  };



  const paragraphs = text.split('\n\n').filter((p) => p.trim());



  if (!text.trim()) {

    return (

      <WorkspaceEmptyState

        message={emptyMessage ?? 'Upload notes to read your material with bionic and complexity highlighting.'}

        onUpload={onUpload}

      />

    );

  }



  const renderHighlightedBody = () => {

    if (!highlight) return null;

    const start = Math.max(0, Math.min(highlight.charStart, text.length));

    const end = Math.max(start, Math.min(highlight.charEnd, text.length));

    return (

      <div className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">

        {text.slice(0, start)}

        <mark

          ref={markRef}

          className="rounded bg-brand-500/25 px-0.5 text-text-primary ring-1 ring-brand-400/40"

        >

          {text.slice(start, end)}

        </mark>

        {text.slice(end)}

      </div>

    );

  };



  return (

    <div className="flex h-full flex-col overflow-hidden">

      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-card px-4 py-2">

        <span className="flex items-center gap-2 text-xs font-semibold">

          <Type className="w-3.5 h-3.5 text-brand-400" />

          {t('cognitiveReader')}

          {highlight && (

            <span className="text-[10px] font-normal text-brand-300">· source highlight</span>

          )}

        </span>

        <div className="flex items-center gap-2">

          <button

            onClick={() => setBionic(!bionic)}

            disabled={!!highlight}

            className={cn(

              'rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all',

              bionic ? 'border-brand-500/30 bg-brand-600/20 text-brand-300' : 'border-transparent text-text-muted hover:text-text-secondary',

              highlight && 'opacity-40 cursor-not-allowed',

            )}

          >

            {t('bionic')}

          </button>

          <button

            onClick={() => setHighlightComplexity(!highlightComplexity)}

            disabled={!!highlight}

            className={cn(

              'rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all',

              highlightComplexity ? 'border-accent-amber/30 bg-accent-amber/20 text-accent-amber' : 'border-transparent text-text-muted hover:text-text-secondary',

              highlight && 'opacity-40 cursor-not-allowed',

            )}

          >

            {t('heatmap')}

          </button>

        </div>

      </div>



      <div className="flex-1 overflow-y-auto bg-surface-primary/40 p-6">

        {highlight ? (

          renderHighlightedBody()

        ) : (

          <div className="w-full space-y-4">

            {paragraphs.map((p, i) => {

              const words = p.split(' ');

              const isComplex = words.length > complexityThreshold;

              return (

                <p

                  key={i}

                  className={cn(

                    'rounded-lg p-2 text-sm leading-relaxed transition-colors duration-500',

                    highlightComplexity

                      ? isComplex ? 'border-l-2 border-accent-rose bg-accent-rose/10 text-text-primary' : 'text-text-tertiary'

                      : 'text-text-secondary',

                  )}

                >

                  {words.map((w, j) => (

                    <span key={j}>

                      {bionic ? renderBionic(w) : w}

                      {j < words.length - 1 ? ' ' : ''}

                    </span>

                  ))}

                </p>

              );

            })}

          </div>

        )}

        {highlightComplexity && !highlight && (

          <div className="mx-auto mt-6 flex max-w-xl items-start gap-2 rounded-lg border border-accent-rose/20 bg-accent-rose/5 p-3 text-xs text-accent-rose">

            <Sparkles className="w-4 h-4 shrink-0" />

            <span>Highlighted paragraphs contain dense terminology — break them down or open the Concept Map.</span>

          </div>

        )}

      </div>

    </div>

  );

}


