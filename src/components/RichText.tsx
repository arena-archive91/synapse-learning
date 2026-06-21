/**
 * RichText — a dependency-light Markdown + LaTeX renderer.
 *
 * Renders the subset of Markdown that study content actually uses (headings,
 * bold/italic, inline + fenced code, bullet/numbered lists) plus real math via
 * KaTeX: inline `$...$` and display `$$...$$`. KaTeX output is generated from the
 * TeX string itself (not user HTML), so the single `dangerouslySetInnerHTML` is
 * confined to KaTeX's own sanitized markup.
 *
 * Used by the Agent chat and lesson content so equations, code, and structure
 * render properly instead of as raw text.
 */

import { Fragment, useMemo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '../utils/cn';
import { MermaidDiagram } from './MermaidDiagram';

function MathSpan({ tex, display }: { tex: string; display: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        output: 'html',
        strict: 'ignore',
      });
    } catch {
      return null;
    }
  }, [tex, display]);

  if (!html) return <code className="text-accent-rose">{tex}</code>;
  return (
    <span
      className={display ? 'block my-2 overflow-x-auto text-center' : 'inline-block align-middle'}
      // eslint-disable-next-line react/no-danger -- KaTeX emits sanitized markup from the TeX source
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Tokenize an inline string into math / code / bold / italic / plain nodes. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let plainStart = 0;
  let k = 0;

  const pushPlain = (end: number) => {
    if (end > plainStart) nodes.push(<Fragment key={`${keyPrefix}-t${k++}`}>{text.slice(plainStart, end)}</Fragment>);
  };

  while (i < text.length) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (ch === '$' && next === '$') {
      const end = text.indexOf('$$', i + 2);
      if (end > i + 1) {
        pushPlain(i);
        nodes.push(<MathSpan key={`${keyPrefix}-m${k++}`} tex={text.slice(i + 2, end).trim()} display />);
        i = end + 2;
        plainStart = i;
        continue;
      }
    }
    if (ch === '$') {
      const end = text.indexOf('$', i + 1);
      if (end > i + 1 && !text.slice(i + 1, end).includes('\n')) {
        pushPlain(i);
        nodes.push(<MathSpan key={`${keyPrefix}-mi${k++}`} tex={text.slice(i + 1, end).trim()} display={false} />);
        i = end + 1;
        plainStart = i;
        continue;
      }
    }
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        pushPlain(i);
        nodes.push(
          <code key={`${keyPrefix}-c${k++}`} className="px-1 py-0.5 rounded bg-surface-hover text-[0.85em] font-mono">
            {text.slice(i + 1, end)}
          </code>,
        );
        i = end + 1;
        plainStart = i;
        continue;
      }
    }
    if (ch === '*' && next === '*') {
      const end = text.indexOf('**', i + 2);
      if (end > i + 1) {
        pushPlain(i);
        nodes.push(
          <strong key={`${keyPrefix}-b${k++}`} className="font-semibold">
            {renderInline(text.slice(i + 2, end), `${keyPrefix}-b${k}`)}
          </strong>,
        );
        i = end + 2;
        plainStart = i;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && next !== undefined && next !== ' ') {
      const end = text.indexOf(ch, i + 1);
      if (end > i + 1) {
        pushPlain(i);
        nodes.push(
          <em key={`${keyPrefix}-i${k++}`} className="italic">
            {renderInline(text.slice(i + 1, end), `${keyPrefix}-i${k}`)}
          </em>,
        );
        i = end + 1;
        plainStart = i;
        continue;
      }
    }
    i += 1;
  }
  pushPlain(text.length);
  return nodes;
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'code'; text: string; lang?: string }
  | { kind: 'mathBlock'; tex: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'p'; text: string };

/** Group raw text lines into renderable blocks. */
function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === '') {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim().toLowerCase();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        body.push(lines[i]!);
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push({ kind: 'code', text: body.join('\n'), lang: lang || undefined });
      continue;
    }

    if (trimmed.startsWith('$$')) {
      const inlineClose = trimmed.length > 2 && trimmed.endsWith('$$');
      if (inlineClose) {
        blocks.push({ kind: 'mathBlock', tex: trimmed.slice(2, -2).trim() });
        i += 1;
        continue;
      }
      const body: string[] = [trimmed.slice(2)];
      i += 1;
      while (i < lines.length && !lines[i]!.includes('$$')) {
        body.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) {
        body.push(lines[i]!.slice(0, lines[i]!.indexOf('$$')));
        i += 1;
      }
      blocks.push({ kind: 'mathBlock', tex: body.join('\n').trim() });
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.trim() });
      i += 1;
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.trim().startsWith('```') &&
      !lines[i]!.trim().startsWith('$$') &&
      !/^(#{1,3})\s+/.test(lines[i]!.trim()) &&
      !/^\s*[-*•]\s+/.test(lines[i]!) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i += 1;
    }
    blocks.push({ kind: 'p', text: para.join('\n') });
  }

  return blocks;
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-lg font-bold mt-3 mb-1.5',
  2: 'text-base font-bold mt-3 mb-1',
  3: 'text-sm font-semibold mt-2 mb-1',
};

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(text ?? ''), [text]);

  return (
    <div className={cn('rich-text space-y-1.5', className)}>
      {blocks.map((block, bi) => {
        switch (block.kind) {
          case 'heading':
            return (
              <div key={bi} className={HEADING_CLASS[block.level] ?? HEADING_CLASS[3]}>
                {renderInline(block.text, `h${bi}`)}
              </div>
            );
          case 'code':
            if (block.lang === 'mermaid') return <MermaidDiagram key={bi} code={block.text} />;
            return (
              <pre key={bi} className="my-2 p-3 rounded-lg bg-surface-hover overflow-x-auto text-[0.8em] font-mono leading-relaxed">
                <code>{block.text}</code>
              </pre>
            );
          case 'mathBlock':
            return <MathSpan key={bi} tex={block.tex} display />;
          case 'ul':
            return (
              <ul key={bi} className="list-disc pl-5 space-y-0.5">
                {block.items.map((it, ii) => (
                  <li key={ii}>{renderInline(it, `ul${bi}-${ii}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={bi} className="list-decimal pl-5 space-y-0.5">
                {block.items.map((it, ii) => (
                  <li key={ii}>{renderInline(it, `ol${bi}-${ii}`)}</li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={bi} className="whitespace-pre-wrap leading-relaxed">
                {renderInline(block.text, `p${bi}`)}
              </p>
            );
        }
      })}
    </div>
  );
}
