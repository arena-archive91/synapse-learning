import { motion } from 'framer-motion';

/* --- Flowchart Diagram --- */
interface FlowNode { id: string; label: string; type: 'start' | 'step' | 'decision' | 'end' }
interface FlowEdge { from: string; to: string; label?: string }

export function FlowchartDiagram({ nodes, edges, title }: { nodes: FlowNode[]; edges: FlowEdge[]; title?: string }) {
  const nodeW = 140, nodeH = 44, gapY = 70;
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => { positions[n.id] = { x: 160, y: 40 + i * gapY }; });
  const svgH = nodes.length * gapY + 40;

  const getShape = (node: FlowNode, x: number, y: number) => {
    const nw = nodeW, nh = nodeH;
    switch (node.type) {
      case 'start': case 'end':
        return <rect x={x - nw / 2} y={y - nh / 2} width={nw} height={nh} rx={nh / 2} fill="#1e1740" stroke={node.type === 'start' ? '#34d399' : '#fb7185'} strokeWidth={2} />;
      case 'decision':
        return <polygon points={`${x},${y - nh / 2} ${x + nw / 2},${y} ${x},${y + nh / 2} ${x - nw / 2},${y}`} fill="#1e1740" stroke="#fbbf24" strokeWidth={2} />;
      default:
        return <rect x={x - nw / 2} y={y - nh / 2} width={nw} height={nh} rx={8} fill="#1e1740" stroke="#818cf8" strokeWidth={2} />;
    }
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
      {title && <p className="text-xs font-semibold mb-2 text-text-secondary">📋 {title}</p>}
      <svg width={320} height={svgH} className="block mx-auto">
        {/* Edges */}
        {edges.map((e, i) => {
          const from = positions[e.from], to = positions[e.to];
          if (!from || !to) return null;
          return (
            <g key={i}>
              <motion.line
                x1={from.x} y1={from.y + nodeH / 2} x2={to.x} y2={to.y - nodeH / 2}
                stroke="#4d4870" strokeWidth={1.5} markerEnd="url(#arrow)"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: i * 0.15 }}
              />
              {e.label && (
                <text x={(from.x + to.x) / 2 + 8} y={(from.y + to.y) / 2 + 4} fill="#706b8f" fontSize={8}>{e.label}</text>
              )}
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#4d4870" />
          </marker>
        </defs>

        {/* Nodes */}
        {nodes.map((node, i) => {
          const pos = positions[node.id];
          return (
            <motion.g key={node.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.12 }}>
              {getShape(node, pos.x, pos.y)}
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#f1f0f7" fontSize={10} fontWeight="500">
                {node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

/* --- Formula Explorer --- */
interface FormulaSymbol { symbol: string; meaning: string; unit?: string }

export function FormulaExplorer({ formula, name, symbols }: { formula: string; name: string; symbols: FormulaSymbol[] }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
      <p className="text-xs font-semibold mb-3 text-text-secondary">📐 Formula Explorer</p>
      <div className="text-center mb-4">
        <p className="text-xs text-text-muted mb-1">{name}</p>
        <div className="text-2xl font-mono font-bold text-brand-300 py-3 px-4 rounded-lg bg-surface-primary/60 inline-block">
          {formula}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {symbols.map(s => (
          <div key={s.symbol} className="flex items-start gap-2 p-2 rounded-lg bg-surface-hover/50">
            <span className="font-mono font-bold text-brand-400 text-sm w-8 shrink-0">{s.symbol}</span>
            <div>
              <p className="text-xs text-text-secondary">{s.meaning}</p>
              {s.unit && <p className="text-[9px] text-text-muted">Unit: {s.unit}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- Comparison Table --- */
export function ComparisonTable({ title, items, headers }: { title: string; items: string[][]; headers: string[] }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card p-4 overflow-x-auto">
      <p className="text-xs font-semibold mb-3 text-text-secondary">⚖️ {title}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-subtle">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-2 px-3 text-text-tertiary font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border-b border-border-subtle/50 last:border-0"
            >
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-text-secondary">{cell}</td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --- Timeline / Progress Milestones --- */
interface Milestone { label: string; completed: boolean; date?: string; xp?: number }

export function ProgressTimeline({ milestones, title }: { milestones: Milestone[]; title?: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
      {title && <p className="text-xs font-semibold mb-3 text-text-secondary">🏁 {title}</p>}
      <div className="space-y-0">
        {milestones.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-3"
          >
            <div className="flex flex-col items-center">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${m.completed ? 'border-accent-emerald bg-accent-emerald/20' : 'border-text-muted bg-surface-hover'}`}>
                {m.completed && <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />}
              </div>
              {i < milestones.length - 1 && (
                <div className={`w-0.5 h-8 ${m.completed ? 'bg-accent-emerald/30' : 'bg-border-subtle'}`} />
              )}
            </div>
            <div className="pb-6">
              <p className={`text-xs font-medium ${m.completed ? 'text-text-primary' : 'text-text-tertiary'}`}>{m.label}</p>
              {m.date && <p className="text-[9px] text-text-muted mt-0.5">{m.date}</p>}
              {m.xp && m.completed && <p className="text-[9px] text-accent-amber mt-0.5">+{m.xp} XP</p>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* --- Retention Curve --- */
export function RetentionCurve({ dataPoints }: { dataPoints: { day: number; retention: number }[] }) {
  const w = 300, h = 160, pad = 30;
  const gw = w - 2 * pad, gh = h - 2 * pad;
  const maxDay = Math.max(...dataPoints.map(d => d.day), 30);

  const points = dataPoints.map(d => ({
    x: pad + (d.day / maxDay) * gw,
    y: pad + gh - (d.retention / 100) * gh,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
      <p className="text-xs font-semibold mb-2 text-text-secondary">📉 Forgetting Curve</p>
      <svg width={w} height={h} className="block mx-auto">
        {/* Grid */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={pad} y1={pad + gh - (v / 100) * gh} x2={w - pad} y2={pad + gh - (v / 100) * gh} stroke="#1e1740" strokeWidth={1} />
            <text x={pad - 5} y={pad + gh - (v / 100) * gh + 3} textAnchor="end" fill="#4d4870" fontSize={8}>{v}%</text>
          </g>
        ))}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#4d4870" strokeWidth={1} />

        {/* Curve */}
        <motion.path
          d={pathD}
          fill="none" stroke="#818cf8" strokeWidth={2.5} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5 }}
        />

        {/* Area fill */}
        <path d={`${pathD} L${points[points.length - 1]?.x || pad},${pad + gh} L${pad},${pad + gh} Z`} fill="url(#retention-grad)" opacity={0.15} />
        <defs>
          <linearGradient id="retention-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Data points */}
        {points.map((p, i) => (
          <motion.circle
            key={i} cx={p.x} cy={p.y} r={3} fill="#818cf8"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.1 }}
          />
        ))}

        {/* Labels */}
        <text x={pad + gw / 2} y={h - 5} textAnchor="middle" fill="#706b8f" fontSize={9}>Days since learning</text>
      </svg>
      <p className="text-[9px] text-text-muted text-center mt-1">Spaced reviews (↑) reset the curve. Without review, retention decays exponentially.</p>
    </div>
  );
}
