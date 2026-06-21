import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Pin, Highlighter, X, ChevronDown, ChevronUp, Sparkles, Trash2, FileText } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useI18n } from '../../lib/i18n';
import { loadAnnotations, saveAnnotations, type StoredAnnotation } from '../../lib/annotationStore';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

const COLORS = ['#818cf8', '#fbbf24', '#34d399', '#fb7185', '#22d3ee'];

interface Props {
  onAskAgent?: (text: string) => void;
  sourceText?: string;
  sourceName?: string;
  fileKey?: string;
  emptyMessage?: string;
  onUpload?: () => void;
}

export function AnnotationOverlay({
  onAskAgent,
  sourceText = '',
  sourceName = '',
  fileKey = 'no-source',
  emptyMessage,
  onUpload,
}: Props) {
  const { t } = useI18n();
  const [annotations, setAnnotations] = useState<StoredAnnotation[]>(() => loadAnnotations(fileKey));
  const [tool, setTool] = useState<'highlight' | 'comment' | 'pin'>('highlight');
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [newComment, setNewComment] = useState('');
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnnotations(loadAnnotations(fileKey));
  }, [fileKey]);

  useEffect(() => {
    saveAnnotations(fileKey, annotations);
  }, [annotations, fileKey]);

  const lines = sourceText.split('\n');

  const addAnnotation = useCallback((lineIdx: number) => {
    if (tool === 'comment') {
      setAddingAt(lineIdx);
      return;
    }
    const ann: StoredAnnotation = {
      id: `ann-${Date.now()}`,
      type: tool,
      text: tool === 'pin' ? t('pin') : '',
      color: activeColor,
      lineStart: lineIdx,
      lineEnd: lineIdx,
    };
    setAnnotations((prev) => [...prev, ann]);
  }, [tool, activeColor, t]);

  const confirmComment = () => {
    if (addingAt === null || !newComment.trim()) return;
    const ann: StoredAnnotation = {
      id: `ann-${Date.now()}`,
      type: 'comment',
      text: newComment.trim(),
      color: activeColor,
      lineStart: addingAt,
      lineEnd: addingAt,
    };
    setAnnotations((prev) => [...prev, ann]);
    setNewComment('');
    setAddingAt(null);
  };

  const removeAnnotation = (id: string) => setAnnotations((prev) => prev.filter((a) => a.id !== id));

  const highlightedLines = new Set<number>();
  annotations.filter((a) => a.type === 'highlight').forEach((a) => {
    for (let i = a.lineStart; i <= a.lineEnd; i++) highlightedLines.add(i);
  });

  if (!sourceText.trim()) {
    return (
      <WorkspaceEmptyState
        message={emptyMessage ?? 'Upload notes to annotate your own source material.'}
        onUpload={onUpload}
      />
    );
  }

  return (
    <div className="relative flex flex-col h-full rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 text-brand-400 shrink-0" />
          <span className="text-xs font-semibold text-text-secondary">{t('sourceViewer')}</span>
          <span className="text-[10px] text-text-muted truncate">{sourceName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {[
            { tool: 'highlight' as const, icon: Highlighter, label: t('highlight') },
            { tool: 'comment' as const, icon: MessageSquare, label: t('comment') },
            { tool: 'pin' as const, icon: Pin, label: t('pin') },
          ].map((b) => (
            <button key={b.tool} type="button" onClick={() => setTool(b.tool)}
              className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                tool === b.tool ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30' : 'text-text-muted hover:text-text-secondary')}>
              <b.icon className="w-3 h-3" />{b.label}
            </button>
          ))}
          <div className="ml-2 flex gap-1">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setActiveColor(c)}
                className={cn('w-4 h-4 rounded-full border-2 transition-all', activeColor === c ? 'border-white scale-125' : 'border-transparent opacity-60')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div ref={contentRef} className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-[22px] text-text-secondary relative">
          {lines.map((line, i) => {
            const isHighlighted = highlightedLines.has(i);
            const isEmpty = line.trim() === '';
            const isHeading = /^(Chapter|\d+\.)/.test(line.trim());
            const pinHere = annotations.some((a) => a.type === 'pin' && a.lineStart === i);
            return (
              <div key={i} onClick={() => addAnnotation(i)} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && addAnnotation(i)}
                className={cn(
                  'px-2 rounded cursor-pointer transition-colors hover:bg-surface-hover/50 relative',
                  isHighlighted && 'bg-brand-500/10 border-l-2 border-brand-500',
                  isHeading && 'font-bold text-text-primary text-sm mt-2',
                  isEmpty && 'h-3',
                )}>
                {pinHere && <span className="absolute -left-1 text-[10px]">📌</span>}
                {line || '\u00A0'}
              </div>
            );
          })}
        </div>

        <div className={cn('border-l border-border-subtle bg-surface-secondary/30 transition-all overflow-y-auto', expanded ? 'w-64' : 'w-8')}>
          <button type="button" onClick={() => setExpanded(!expanded)} className="w-full p-2 flex items-center justify-center text-text-muted hover:text-text-secondary">
            {expanded ? <ChevronDown className="w-3.5 h-3.5 rotate-90" /> : <ChevronUp className="w-3.5 h-3.5 rotate-90" />}
          </button>
          {expanded && (
            <div className="px-2 pb-2 space-y-2">
              <p className="text-[10px] text-text-muted font-medium px-1">{annotations.length} {t('annotations')}</p>
              <AnimatePresence>
                {annotations.map((ann) => (
                  <motion.div key={ann.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="p-2 rounded-lg border text-[10px]"
                    style={{ borderColor: ann.color + '40', backgroundColor: ann.color + '08' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize" style={{ color: ann.color }}>
                        {ann.type === 'highlight' ? '🖍' : ann.type === 'comment' ? '💬' : '📌'} {ann.type}
                      </span>
                      <button type="button" onClick={() => removeAnnotation(ann.id)} className="text-text-muted hover:text-accent-rose"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <p className="text-text-muted">Line {ann.lineStart + 1}</p>
                    {ann.text && <p className="text-text-secondary mt-1">{ann.text}</p>}
                    {(ann.type === 'highlight' || ann.type === 'pin') && onAskAgent && (
                      <button type="button" onClick={() => onAskAgent(lines[ann.lineStart] || '')}
                        className="mt-1.5 flex items-center gap-1 text-brand-400 hover:text-brand-300">
                        <Sparkles className="w-3 h-3" /> {t('askAgent')}
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {addingAt !== null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 p-3 glass-strong border-t border-border-subtle">
            <p className="text-xs font-semibold mb-2">💬 {t('addComment')} (line {addingAt + 1})</p>
            <div className="flex gap-2">
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)} autoFocus
                placeholder="…"
                onKeyDown={(e) => e.key === 'Enter' && confirmComment()}
                className="flex-1 px-3 py-2 rounded-lg bg-surface-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50" />
              <button type="button" onClick={confirmComment} className="px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg">OK</button>
              <button type="button" onClick={() => setAddingAt(null)} className="px-3 py-2 text-text-muted hover:text-text-secondary text-xs rounded-lg"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
