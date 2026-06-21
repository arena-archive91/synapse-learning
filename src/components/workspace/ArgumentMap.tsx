import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GitCommit, Plus, Pencil } from 'lucide-react';
import { saveJson } from '../../lib/persistence';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

export type ArgNodeType = 'claim' | 'premise' | 'support' | 'refutation';

export interface ArgNode {
  id: string;
  type: ArgNodeType;
  text: string;
  x: number;
  y: number;
  expanded?: boolean;
  children?: ArgNode[];
}

const NODE_COLORS: Record<ArgNodeType, { bg: string; border: string; text: string }> = {
  claim: { bg: '#1e1b4b', border: '#818cf8', text: '#e0e7ff' },
  premise: { bg: '#162032', border: '#67e8f9', text: '#cffafe' },
  support: { bg: '#064e3b', border: '#34d399', text: '#d1fae5' },
  refutation: { bg: '#4c1d2e', border: '#fb7185', text: '#ffe4e6' },
};

const TYPE_LABELS: Record<ArgNodeType, string> = {
  claim: 'Claim',
  premise: 'Premise',
  support: 'Support',
  refutation: 'Refutation',
};

function updateNodeText(node: ArgNode, id: string, text: string): ArgNode {
  if (node.id === id) return { ...node, text };
  if (!node.children) return node;
  return { ...node, children: node.children.map((c) => updateNodeText(c, id, text)) };
}

function addChild(node: ArgNode, parentId: string, child: ArgNode): ArgNode {
  if (node.id === parentId) {
    return { ...node, expanded: true, children: [...(node.children ?? []), child] };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map((c) => addChild(c, parentId, child)) };
}

interface Props {
  tree?: ArgNode | null;
  storageKey?: string;
  concept?: string;
  emptyMessage?: string;
  onUpload?: () => void;
}

export function ArgumentMap({ tree, storageKey = 'debate-tree', concept, emptyMessage, onUpload }: Props) {
  const [root, setRoot] = useState<ArgNode | null>(tree ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setRoot(tree ?? null);
  }, [tree]);

  const persist = (next: ArgNode) => {
    setRoot(next);
    saveJson(storageKey, next);
  };

  if (!root) {
    return (
      <WorkspaceEmptyState
        message={emptyMessage ?? 'Upload notes to build a debate tree from claims in your material.'}
        onUpload={onUpload}
      />
    );
  }

  const startEdit = (node: ArgNode) => {
    setEditingId(node.id);
    setDraft(node.text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    persist(updateNodeText(root, editingId, draft.trim() || 'New node'));
    setEditingId(null);
  };

  const addNode = (parentId: string) => {
    const id = `n-${Date.now()}`;
    const child: ArgNode = {
      id,
      type: 'support',
      text: 'New argument point',
      x: 300 + Math.random() * 80,
      y: 280 + Math.random() * 40,
    };
    persist(addChild(root, parentId, child));
    startEdit(child);
  };

  const renderEdges = (node: ArgNode): React.ReactNode => {
    if (!node.children || !node.expanded) return null;
    return node.children.map((child) => (
      <g key={`edge-${node.id}-${child.id}`}>
        <motion.line
          x1={node.x} y1={node.y + 40} x2={child.x} y2={child.y - 40}
          stroke={child.type === 'refutation' ? '#fb7185' : child.type === 'support' ? '#34d399' : '#6b6494'}
          strokeWidth={2} strokeLinecap="round"
          strokeDasharray={child.type === 'refutation' ? '4 4' : 'none'}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }}
        />
        {renderEdges(child)}
      </g>
    ));
  };

  const renderNodes = (node: ArgNode): React.ReactNode => {
    const colorStyle = NODE_COLORS[node.type];
    const isEditing = editingId === node.id;
    return (
      <div key={`wrap-${node.id}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute group flex flex-col items-center justify-center rounded-xl border-2 p-3 text-center text-xs font-medium shadow-lg"
          style={{
            width: 150, minHeight: 84, left: node.x - 75, top: node.y - 42,
            backgroundColor: colorStyle.bg, borderColor: colorStyle.border, color: colorStyle.text,
          }}
        >
          {isEditing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              autoFocus
              className="w-full h-14 bg-transparent text-xs resize-none outline-none text-center"
            />
          ) : (
            <>
              <span>{node.text}</span>
              <div className="absolute -bottom-7 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => startEdit(node)} className="p-1 rounded bg-surface-primary/80 border border-border-subtle">
                  <Pencil className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => addNode(node.id)} className="p-1 rounded bg-surface-primary/80 border border-border-subtle">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
          <div
            className="absolute -top-2 rounded-full border bg-surface-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ borderColor: colorStyle.border, color: colorStyle.border }}
          >
            {TYPE_LABELS[node.type]}
          </div>
        </motion.div>
        {node.children && node.expanded && node.children.map(renderNodes)}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-card px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <GitCommit className="w-4 h-4 text-accent-cyan" />
          Debate Tree{concept ? ` — ${concept}` : ''}
        </span>
        <span className="text-[10px] text-text-muted">Click node to edit · + to add branch</span>
      </div>
      <div className="relative flex-1 cursor-grab overflow-auto bg-surface-primary active:cursor-grabbing">
        <div className="relative h-[600px] w-[800px]">
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {renderEdges(root)}
          </svg>
          {renderNodes(root)}
        </div>
      </div>
    </div>
  );
}
