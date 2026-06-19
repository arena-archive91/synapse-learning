import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Pin, Highlighter, X, ChevronDown, ChevronUp, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface Annotation {
  id: string;
  type: 'highlight' | 'comment' | 'pin';
  y: number;
  text: string;
  color: string;
  lineStart: number;
  lineEnd: number;
}

const COLORS = ['#818cf8', '#fbbf24', '#34d399', '#fb7185', '#22d3ee'];

const MOCK_SOURCE = `Chapter 4: Market Structures

4.1 Perfect Competition

A perfectly competitive market is characterised by many buyers and sellers, a homogeneous product, free entry and exit, and perfect information. Each firm is a price taker — it cannot influence the market price.

In the short run, a firm maximises profit where MC = MR = P. If P > ATC the firm earns economic profit. If ATC > P > AVC the firm operates at a loss but continues production. If P < AVC the firm shuts down.

4.2 Monopoly

A monopolist is the sole seller in a market with high barriers to entry. Unlike a competitive firm, the monopolist faces the entire market demand curve and must lower price to sell more units.

The monopolist maximises profit where MR = MC, but sets price from the demand curve above MR. This creates deadweight loss — the monopolist produces less and charges more than a competitive market would.

4.3 Oligopoly

An oligopoly consists of a few large firms whose decisions are interdependent. The key models are:

• Cournot (quantity competition): firms simultaneously choose output levels.
• Bertrand (price competition): firms simultaneously choose prices.
• Stackelberg (sequential quantity): one firm moves first as a leader.

The Bertrand Paradox states that with just two firms selling identical products and competing on price, the equilibrium price equals marginal cost — the same as perfect competition.

4.4 Monopolistic Competition

Many firms sell differentiated products. Each firm has some market power but faces competition from close substitutes. In the long run, economic profits are driven to zero by entry.

Key distinction: product differentiation gives each firm a downward-sloping demand curve, unlike in perfect competition.`;

export function AnnotationOverlay({ onAskAgent }: { onAskAgent?: (text: string) => void }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([
    { id: 'a1', type: 'highlight', y: 108, text: '', color: '#818cf8', lineStart: 3, lineEnd: 4 },
    { id: 'a2', type: 'comment', y: 220, text: 'Why does this create deadweight loss exactly?', color: '#fbbf24', lineStart: 10, lineEnd: 10 },
    { id: 'a3', type: 'pin', y: 360, text: 'Key for exam — know all three models', color: '#fb7185', lineStart: 17, lineEnd: 20 },
  ]);
  const [tool, setTool] = useState<'highlight' | 'comment' | 'pin'>('highlight');
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [newComment, setNewComment] = useState('');
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const lines = MOCK_SOURCE.split('\n');

  const addAnnotation = useCallback((lineIdx: number) => {
    if (tool === 'comment') {
      setAddingAt(lineIdx);
      return;
    }
    const ann: Annotation = {
      id: `ann-${Date.now()}`,
      type: tool,
      y: lineIdx * 22 + 20,
      text: '',
      color: activeColor,
      lineStart: lineIdx,
      lineEnd: lineIdx,
    };
    setAnnotations(prev => [...prev, ann]);
  }, [tool, activeColor]);

  const confirmComment = () => {
    if (addingAt === null || !newComment.trim()) return;
    const ann: Annotation = {
      id: `ann-${Date.now()}`,
      type: 'comment',
      y: addingAt * 22 + 20,
      text: newComment.trim(),
      color: activeColor,
      lineStart: addingAt,
      lineEnd: addingAt,
    };
    setAnnotations(prev => [...prev, ann]);
    setNewComment('');
    setAddingAt(null);
  };

  const removeAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id));

  const highlightedLines = new Set<number>();
  annotations.filter(a => a.type === 'highlight').forEach(a => {
    for (let i = a.lineStart; i <= a.lineEnd; i++) highlightedLines.add(i);
  });

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary">📄 Source Viewer</span>
          <span className="text-[10px] text-text-muted">Lecture_Notes_Micro.pdf — Ch4</span>
        </div>
        <div className="flex items-center gap-1">
          {[
            { t: 'highlight' as const, icon: Highlighter, label: 'Highlight' },
            { t: 'comment' as const, icon: MessageSquare, label: 'Comment' },
            { t: 'pin' as const, icon: Pin, label: 'Pin' },
          ].map(b => (
            <button key={b.t} onClick={() => setTool(b.t)}
              className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                tool === b.t ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30' : 'text-text-muted hover:text-text-secondary')}>
              <b.icon className="w-3 h-3" />{b.label}
            </button>
          ))}
          <div className="ml-2 flex gap-1">
            {COLORS.map(c => (
              <button key={c} onClick={() => setActiveColor(c)}
                className={cn('w-4 h-4 rounded-full border-2 transition-all', activeColor === c ? 'border-white scale-125' : 'border-transparent opacity-60')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Source content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-[22px] text-text-secondary relative">
          {lines.map((line, i) => {
            const isHighlighted = highlightedLines.has(i);
            const isEmpty = line.trim() === '';
            const isHeading = line.startsWith('Chapter') || line.startsWith('4.');
            return (
              <div key={i} onClick={() => addAnnotation(i)}
                className={cn(
                  'px-2 rounded cursor-pointer transition-colors hover:bg-surface-hover/50',
                  isHighlighted && 'bg-brand-500/10 border-l-2 border-brand-500',
                  isHeading && 'font-bold text-text-primary text-sm mt-2',
                  isEmpty && 'h-3'
                )}>
                {line || '\u00A0'}
              </div>
            );
          })}
        </div>

        {/* Annotation sidebar */}
        <div className={cn('border-l border-border-subtle bg-surface-secondary/30 transition-all overflow-y-auto', expanded ? 'w-64' : 'w-8')}>
          <button onClick={() => setExpanded(!expanded)} className="w-full p-2 flex items-center justify-center text-text-muted hover:text-text-secondary">
            {expanded ? <ChevronDown className="w-3.5 h-3.5 rotate-90" /> : <ChevronUp className="w-3.5 h-3.5 rotate-90" />}
          </button>
          {expanded && (
            <div className="px-2 pb-2 space-y-2">
              <p className="text-[10px] text-text-muted font-medium px-1">{annotations.length} annotations</p>
              <AnimatePresence>
                {annotations.map(ann => (
                  <motion.div key={ann.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="p-2 rounded-lg border text-[10px]"
                    style={{ borderColor: ann.color + '40', backgroundColor: ann.color + '08' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize" style={{ color: ann.color }}>
                        {ann.type === 'highlight' ? '🖍' : ann.type === 'comment' ? '💬' : '📌'} {ann.type}
                      </span>
                      <button onClick={() => removeAnnotation(ann.id)} className="text-text-muted hover:text-accent-rose"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <p className="text-text-muted">Line {ann.lineStart + 1}</p>
                    {ann.text && <p className="text-text-secondary mt-1">{ann.text}</p>}
                    {ann.type === 'highlight' && onAskAgent && (
                      <button onClick={() => onAskAgent(lines[ann.lineStart] || '')}
                        className="mt-1.5 flex items-center gap-1 text-brand-400 hover:text-brand-300">
                        <Sparkles className="w-3 h-3" /> Ask Agent about this
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Comment input overlay */}
      <AnimatePresence>
        {addingAt !== null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 p-3 glass-strong border-t border-border-subtle">
            <p className="text-xs font-semibold mb-2">💬 Add comment (line {addingAt + 1})</p>
            <div className="flex gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} autoFocus
                placeholder="Your comment…"
                onKeyDown={e => e.key === 'Enter' && confirmComment()}
                className="flex-1 px-3 py-2 rounded-lg bg-surface-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50" />
              <button onClick={confirmComment} className="px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg">Add</button>
              <button onClick={() => setAddingAt(null)} className="px-3 py-2 text-text-muted hover:text-text-secondary text-xs rounded-lg"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
