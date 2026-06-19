import React, { useRef, useState } from 'react';

interface Node { id: string; label: string; x: number; y: number; mastery: number; }
interface Edge { from: string; to: string; type: 'prereq' | 'related' | 'contrast'; }

const initialNodes: Node[] = [
  { id: 'ref', label: 'Reference Point', x: 30, y: 25, mastery: 0.82 },
  { id: 'loss', label: 'Loss Aversion', x: 55, y: 18, mastery: 0.61 },
  { id: 'anchor', label: 'Anchoring', x: 42, y: 52, mastery: 0.73 },
  { id: 'frame', label: 'Framing Effect', x: 68, y: 42, mastery: 0.49 },
  { id: 'choice', label: 'Choice Architecture', x: 58, y: 72, mastery: 0.55 },
];

const initialEdges: Edge[] = [
  { from: 'ref', to: 'loss', type: 'prereq' },
  { from: 'ref', to: 'frame', type: 'related' },
  { from: 'anchor', to: 'frame', type: 'contrast' },
  { from: 'frame', to: 'choice', type: 'prereq' },
  { from: 'loss', to: 'choice', type: 'related' },
];

export const InteractiveKnowledgeGraph: React.FC = () => {
  const [nodes, setNodes] = useState(initialNodes);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const startDrag = (id: string, clientX: number, clientY: number) => {
    lastPos.current = { x: clientX, y: clientY };
    const onMove = (ev: MouseEvent) => {
      if (!lastPos.current) return;
      const dx = (ev.clientX - lastPos.current.x) / 6;
      const dy = (ev.clientY - lastPos.current.y) / 6;
      lastPos.current = { x: ev.clientX, y: ev.clientY };
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, x: Math.max(8, Math.min(92, n.x + dx)), y: Math.max(8, Math.min(88, n.y + dy)) }
            : n,
        ),
      );
    };
    const onUp = () => {
      lastPos.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex justify-between mb-3">
        <div className="text-sm font-semibold text-white">Interactive Concept Graph (Drag nodes)</div>
        <div className="text-xs text-slate-400">Blue = prerequisite • Purple = related • Orange = contrast</div>
      </div>

      <div
        className="relative h-[320px] bg-slate-900/40 rounded-2xl overflow-hidden border border-white/8"
        role="img"
        aria-label="Interactive concept graph showing mastery-linked nodes"
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
          {initialEdges.map((edge, i) => {
            const a = nodes.find((n) => n.id === edge.from)!;
            const b = nodes.find((n) => n.id === edge.to)!;
            const color = edge.type === 'prereq' ? '#67e8f9' : edge.type === 'contrast' ? '#fbbf24' : '#a78bfa';
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
            );
          })}

          {nodes.map((node) => (
            <g
              key={node.id}
              onMouseDown={(e) => { e.preventDefault(); startDrag(node.id, e.clientX, e.clientY); }}
              className="cursor-grab active:cursor-grabbing"
              role="button"
              aria-label={`${node.label}, mastery ${Math.round(node.mastery * 100)} percent`}
              tabIndex={0}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 2 : 0.8;
                if (e.key === 'ArrowLeft') setNodes((p) => p.map((n) => n.id === node.id ? { ...n, x: Math.max(8, n.x - step) } : n));
                if (e.key === 'ArrowRight') setNodes((p) => p.map((n) => n.id === node.id ? { ...n, x: Math.min(92, n.x + step) } : n));
                if (e.key === 'ArrowUp') setNodes((p) => p.map((n) => n.id === node.id ? { ...n, y: Math.max(8, n.y - step) } : n));
                if (e.key === 'ArrowDown') setNodes((p) => p.map((n) => n.id === node.id ? { ...n, y: Math.min(88, n.y + step) } : n));
              }}
            >
              <circle cx={node.x} cy={node.y} r="6.5" fill={node.mastery > 0.7 ? '#6ee7b7' : node.mastery > 0.5 ? '#67e8f9' : '#fbbf24'} opacity="0.85" />
              <text x={node.x} y={node.y + 11} textAnchor="middle" className="fill-white text-[4.8px] font-medium pointer-events-none">
                {node.label.split(' ')[0]}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 text-xs text-slate-400">
        Drag nodes or use arrow keys (Shift = faster). Color intensity reflects mastery level.
      </div>
    </div>
  );
};
