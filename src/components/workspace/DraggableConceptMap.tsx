import { useState, useRef, useCallback, useEffect } from 'react';
// DraggableConceptMap — interactive drag/zoom concept graph

interface DragNode {
  id: string;
  label: string;
  mastery: number;
  type: 'concept' | 'formula' | 'definition' | 'theory';
  x: number;
  y: number;
  note?: string;
  pinned?: boolean;
}

interface DragEdge {
  from: string;
  to: string;
  relation: 'prerequisite' | 'related' | 'contrasts';
}

interface Props {
  initialNodes: DragNode[];
  initialEdges: DragEdge[];
  onNodeUpdate?: (nodes: DragNode[]) => void;
}

const MASTERY_COLOR = (m: number) =>
  m >= 80 ? '#34d399' : m >= 60 ? '#fbbf24' : m >= 40 ? '#38bdf8' : m > 0 ? '#fb7185' : '#4d4870';

const TYPE_EMOJI: Record<string, string> = { concept: '💡', formula: '📐', definition: '📖', theory: '🧠' };

export function DraggableConceptMap({ initialNodes, initialEdges, onNodeUpdate }: Props) {
  const [nodes, setNodes] = useState<DragNode[]>(initialNodes);
  const [edges] = useState<DragEdge[]>(initialEdges);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const dragging = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  const handlePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = nodeId;
    const pt = toSvg(e.clientX, e.clientY);
    const node = nodeMap[nodeId];
    dragOffset.current = { x: pt.x - node.x, y: pt.y - node.y };
    setSelected(nodeId);
  }, [toSvg, nodeMap]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging.current) {
      const pt = toSvg(e.clientX, e.clientY);
      setNodes(prev => prev.map(n =>
        n.id === dragging.current
          ? { ...n, x: pt.x - dragOffset.current.x, y: pt.y - dragOffset.current.y }
          : n
      ));
    } else if (isPanning) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x),
        y: panStart.current.py + (e.clientY - panStart.current.y),
      });
    }
  }, [toSvg, isPanning]);

  const handlePointerUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = null;
      onNodeUpdate?.(nodes);
    }
    setIsPanning(false);
  }, [nodes, onNodeUpdate]);

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    if (dragging.current) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    setSelected(null);
    setEditingNote(null);
  }, [pan]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.3, Math.min(2.5, prev - e.deltaY * 0.001)));
  }, []);

  const startNote = (id: string) => {
    setEditingNote(id);
    setNoteText(nodeMap[id]?.note || '');
  };

  const saveNote = () => {
    if (!editingNote) return;
    setNodes(prev => prev.map(n => n.id === editingNote ? { ...n, note: noteText } : n));
    setEditingNote(null);
  };

  useEffect(() => { setNodes(initialNodes); }, [initialNodes]);

  const selectedNode = selected ? nodeMap[selected] : null;

  return (
    <div className="relative rounded-2xl border border-border-subtle bg-surface-card overflow-hidden flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary">🗺 Concept Map</span>
          <span className="text-[10px] text-text-muted">Drag nodes • Scroll to zoom • Click to select</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} className="w-6 h-6 rounded bg-surface-hover text-text-secondary text-xs flex items-center justify-center hover:bg-surface-active">+</button>
          <span className="text-[10px] text-text-muted w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="w-6 h-6 rounded bg-surface-hover text-text-secondary text-xs flex items-center justify-center hover:bg-surface-active">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="ml-1 px-2 py-1 rounded text-[10px] text-text-muted hover:text-text-secondary bg-surface-hover">Reset</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing" onWheel={handleWheel}>
        <svg
          ref={svgRef}
          width="100%" height="100%"
          onPointerDown={handleBgPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="block select-none"
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            <defs>
              <marker id="dm-arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4d4870" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map((edge, i) => {
              const from = nodeMap[edge.from];
              const to = nodeMap[edge.to];
              if (!from || !to) return null;
              const lit = selected === edge.from || selected === edge.to;
              const dash = edge.relation === 'contrasts' ? '8,4' : edge.relation === 'related' ? '4,4' : 'none';
              return (
                <line key={i}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={lit ? '#818cf8' : '#2a2252'} strokeWidth={lit ? 2.5 : 1.5}
                  strokeDasharray={dash} markerEnd="url(#dm-arrow)"
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const color = MASTERY_COLOR(node.mastery);
              const isSel = selected === node.id;
              const r = 30;
              return (
                <g key={node.id} onPointerDown={e => handlePointerDown(e, node.id)} className="cursor-move">
                  {isSel && <circle cx={node.x} cy={node.y} r={r + 8} fill="none" stroke={color} strokeWidth={2} opacity={0.35} />}
                  <circle cx={node.x} cy={node.y} r={r} fill="#0f0a1e" stroke={color} strokeWidth={isSel ? 3 : 2} />
                  {/* mastery arc */}
                  <circle cx={node.x} cy={node.y} r={r} fill="none" stroke={color} strokeWidth={3} opacity={0.4}
                    strokeDasharray={`${(node.mastery / 100) * 2 * Math.PI * r} ${2 * Math.PI * r}`}
                    transform={`rotate(-90 ${node.x} ${node.y})`}
                  />
                  <text x={node.x} y={node.y - 4} textAnchor="middle" dominantBaseline="central" fontSize={16}>{TYPE_EMOJI[node.type]}</text>
                  <text x={node.x} y={node.y + 15} textAnchor="middle" fontSize={9} fill={color} fontWeight="700">{node.mastery}%</text>
                  <text x={node.x} y={node.y + r + 14} textAnchor="middle" fontSize={11} fill={isSel ? '#f1f0f7' : '#a8a3c4'} fontWeight={isSel ? '600' : '400'}>
                    {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
                  </text>
                  {node.note && <circle cx={node.x + r - 4} cy={node.y - r + 4} r={5} fill="#fbbf24" />}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Detail Panel */}
      {selectedNode && !editingNote && (
        <div className="absolute bottom-0 left-0 right-0 p-3 glass-strong border-t border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="text-lg">{TYPE_EMOJI[selectedNode.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{selectedNode.label}</p>
              <p className="text-[10px] text-text-muted">Mastery {selectedNode.mastery}% • {edges.filter(e => e.to === selectedNode.id).length} prerequisites</p>
            </div>
            <button onClick={() => startNote(selectedNode.id)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30">
              {selectedNode.note ? '✏️ Edit Note' : '📝 Add Note'}
            </button>
            <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-secondary text-xs">✕</button>
          </div>
          {selectedNode.note && <p className="text-xs text-text-secondary mt-2 bg-surface-hover/50 rounded-lg p-2">{selectedNode.note}</p>}
        </div>
      )}

      {/* Note Editor */}
      {editingNote && (
        <div className="absolute bottom-0 left-0 right-0 p-3 glass-strong border-t border-border-subtle">
          <p className="text-xs font-semibold mb-2">📝 Note for "{nodeMap[editingNote]?.label}"</p>
          <textarea
            value={noteText} onChange={e => setNoteText(e.target.value)}
            placeholder="Type your note about this concept…"
            className="w-full px-3 py-2 rounded-lg bg-surface-input border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50 resize-none"
            rows={2} autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setEditingNote(null)} className="px-3 py-1 text-xs text-text-muted hover:text-text-secondary">Cancel</button>
            <button onClick={saveNote} className="px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-500">Save</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 py-2 border-t border-border-subtle bg-surface-secondary/30 shrink-0">
        {[{ c: '#34d399', l: 'Strong' }, { c: '#fbbf24', l: 'Proficient' }, { c: '#38bdf8', l: 'Developing' }, { c: '#fb7185', l: 'Weak' }].map(b => (
          <span key={b.l} className="flex items-center gap-1 text-[9px] text-text-muted">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.c }} />{b.l}
          </span>
        ))}
        <span className="text-[9px] text-text-muted ml-2">→ prerequisite</span>
        <span className="text-[9px] text-text-muted">┄ related</span>
      </div>
    </div>
  );
}
