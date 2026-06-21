import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Circle, Eraser, Highlighter, Minus, Pen,
  Redo2, Ruler, Save, Square, Trash2, Type, Undo2, BookOpen,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ExtractedFormula } from '../../lib/noteContentExtractors';
import { loadWhiteboardStrokes, saveWhiteboardStrokes } from '../../lib/workspacePersistence';

type Tool = 'pen' | 'marker' | 'highlighter' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'ruler' | 'text';
type Point = { x: number; y: number };
type Stroke = { tool: Tool; color: string; width: number; points: Point[]; text?: string };

const COLORS = ['#f8fafc', '#67e8f9', '#a78bfa', '#6ee7b7', '#fbbf24', '#f87171', '#fb7185', '#1e293b'];
const LEGACY_STORAGE_KEY = 'synapse.whiteboard.v1';

function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

const TOOL_DEFS: { id: Tool; icon: typeof Pen; label: string }[] = [
  { id: 'pen', icon: Pen, label: 'Pen' },
  { id: 'marker', icon: Highlighter, label: 'Marker' },
  { id: 'highlighter', icon: Highlighter, label: 'Highlight' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'rect', icon: Square, label: 'Rect' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { id: 'ruler', icon: Ruler, label: 'Ruler' },
  { id: 'text', icon: Type, label: 'Text' },
];

export function StudyWhiteboard({
  referenceFormulas = [],
  referenceExcerpt,
  scopeKey,
}: {
  referenceFormulas?: ExtractedFormula[];
  referenceExcerpt?: string;
  /** Workspace/task identifier used to scope persistence (avoids cross-task bleed). */
  scopeKey?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[1]!);
  const [width, setWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const drawing = useRef(false);

  const redraw = useCallback((list: Stroke[], current?: Stroke | null) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = Math.max(420, container.clientHeight - 8);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--viz-canvas-bg').trim() || '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawStroke = (s: Stroke) => {
      if (s.points.length === 0) return;
      if (s.tool === 'text' && s.text) {
        ctx.fillStyle = s.color;
        ctx.font = `${Math.max(14, s.width * 5)}px system-ui, sans-serif`;
        ctx.fillText(s.text, s.points[0]?.x, s.points[0]?.y);
        return;
      }
      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else if (s.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 0.35;
      } else if (s.tool === 'marker') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 0.75;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 1;
      }
      ctx.lineWidth = s.width;

      const p0 = s.points[0]!;
      const p1 = s.points[s.points.length - 1]!;

      if (['line', 'ruler', 'arrow', 'rect', 'ellipse'].includes(s.tool) && s.points.length >= 2) {
        ctx.beginPath();
        if (s.tool === 'rect') {
          ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
        } else if (s.tool === 'ellipse') {
          const rx = Math.abs(p1.x - p0.x) / 2;
          const ry = Math.abs(p1.y - p0.y) / 2;
          ctx.ellipse((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          if (s.tool === 'arrow') {
            const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
            const head = 10 + s.width;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p1.x - head * Math.cos(angle - 0.4), p1.y - head * Math.sin(angle - 0.4));
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p1.x - head * Math.cos(angle + 0.4), p1.y - head * Math.sin(angle + 0.4));
            ctx.stroke();
          }
          if (s.tool === 'ruler') {
            ctx.fillStyle = s.color;
            ctx.globalAlpha = 1;
            ctx.font = '11px system-ui';
            ctx.fillText(`${Math.round(dist(p0, p1))} px`, (p0.x + p1.x) / 2 + 6, (p0.y + p1.y) / 2 - 6);
          }
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i]?.x, s.points[i]?.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    for (const s of list) drawStroke(s);
    if (current) drawStroke(current);
  }, []);

  useEffect(() => {
    try {
      const scope = scopeKey ?? '__global';
      const persisted = loadWhiteboardStrokes<Stroke[]>(scope);
      if (persisted) {
        setStrokes(persisted);
        return;
      }
      // One-time migration from the legacy single-key whiteboard so existing
      // boards aren't lost when scoped persistence is introduced.
      if (scope === '__global') {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy) as Stroke[];
          setStrokes(parsed);
          saveWhiteboardStrokes(scope, parsed);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
    } catch { /* ignore */ }
  }, [scopeKey]);

  useEffect(() => { redraw(strokes, draft); }, [strokes, draft, redraw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => redraw(strokes, draft));
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [strokes, draft, redraw]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const effectiveWidth = tool === 'marker' ? width * 2.5 : tool === 'highlighter' ? width * 4 : tool === 'eraser' ? width * 3 : width;

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'text') {
      const p = pos(e);
      const text = window.prompt('Enter text:');
      if (text?.trim()) {
        setStrokes((s) => [...s, { tool: 'text', color, width, points: [p], text: text.trim() }]);
        setRedoStack([]);
      }
      return;
    }
    drawing.current = true;
    setDraft({ tool, color, width: effectiveWidth, points: [pos(e)] });
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !draft) return;
    const p = pos(e);
    if (['line', 'ruler', 'arrow', 'rect', 'ellipse'].includes(tool)) {
      setDraft({ ...draft, points: [draft.points[0]!, p] });
    } else {
      setDraft({ ...draft, points: [...draft.points, p] });
    }
  };

  const onUp = () => {
    if (!drawing.current || !draft) return;
    drawing.current = false;
    setStrokes((s) => [...s, draft]);
    setDraft(null);
    setRedoStack([]);
  };

  const undo = () => {
    setStrokes((s) => {
      if (s.length === 0) return s;
      setRedoStack((r) => [...r, s[s.length - 1]!]);
      return s.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const last = r[r.length - 1]!;
      setStrokes((s) => [...s, last]);
      return r.slice(0, -1);
    });
  };

  const save = () => {
    try {
      saveWhiteboardStrokes(scopeKey ?? '__global', strokes);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch { /* ignore */ }
  };

  const insertFormulaLabel = (label: string, formula: string) => {
    const x = 40 + Math.random() * 80;
    const y = 40 + Math.random() * 60;
    const stroke: Stroke = {
      tool: 'text',
      color,
      width: 2,
      points: [{ x, y }],
      text: `${label}: ${formula}`,
    };
    setStrokes((s) => [...s, stroke]);
    setRedoStack([]);
  };

  return (
    <div className="flex h-full flex-col lg:flex-row min-w-0">
      {(referenceFormulas.length > 0 || referenceExcerpt) && (
        <aside className="shrink-0 border-b lg:border-b-0 lg:border-r border-border-subtle lg:w-56 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
            <BookOpen className="w-3.5 h-3.5 text-brand-400" />
            From your notes
          </div>
          {referenceFormulas.map((f) => (
            <div key={f.id} className="p-2 rounded-lg bg-surface-card border border-border-subtle">
              <p className="text-[10px] font-medium text-brand-300 truncate">{f.name}</p>
              <p className="text-[10px] font-mono text-text-secondary mt-1 break-all">{f.formula}</p>
              <button
                type="button"
                onClick={() => insertFormulaLabel(f.name, f.formula)}
                className="mt-2 text-[9px] font-medium text-brand-400 hover:text-brand-300"
              >
                Insert on board →
              </button>
            </div>
          ))}
          {referenceExcerpt && referenceFormulas.length === 0 && (
            <p className="text-[10px] text-text-tertiary leading-relaxed line-clamp-6">{referenceExcerpt.slice(0, 280)}…</p>
          )}
        </aside>
      )}

      <div className="flex min-h-0 flex-1 flex-col min-w-0">
      <div className="shrink-0 border-b border-border-subtle px-3 py-2">
        <h3 className="text-sm font-semibold">Study Whiteboard</h3>
        <p className="text-[10px] text-text-tertiary">Sketch diagrams, annotate, and save to this device.</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2">
        {TOOL_DEFS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => setTool(id)}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors',
              tool === id ? 'bg-brand-600/20 text-brand-300' : 'text-text-muted hover:bg-surface-hover',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-border-subtle" />
        <button type="button" onClick={undo} disabled={strokes.length === 0} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"><Undo2 className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={redo} disabled={redoStack.length === 0} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"><Redo2 className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => { setStrokes([]); setRedoStack([]); setDraft(null); }} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"><Trash2 className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={save} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"><Save className="w-3.5 h-3.5" /></button>
        {savedMsg && <span className="text-[10px] text-accent-emerald">Saved</span>}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border-subtle px-3 py-2 text-[10px]">
        <span className="text-text-tertiary">Color</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={cn('h-5 w-5 rounded-full border-2', color === c ? 'border-brand-400' : 'border-transparent')}
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="ml-2 text-text-tertiary">Width</span>
        <input type="range" min={1} max={12} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-24" />
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 p-2">
        <canvas
          ref={canvasRef}
          className="touch-none rounded-xl border border-border-subtle w-full"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>
      </div>
    </div>
  );
}
