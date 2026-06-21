import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RotateCcw, Copy, Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import { inferVariablesFromFormula, evaluateFormulaExpression, type FormulaVariable } from '../../lib/formulaSolver';
import { loadScratchpadFormulas, saveScratchpadFormulas } from '../../lib/workspacePersistence';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

interface Variable { symbol: string; value: string; unit: string }
interface SavedFormula { id: string; name: string; formula: string; variables: Variable[] }
interface PersistedScratch {
  formulas: SavedFormula[];
  vars: Variable[];
  steps: string[];
  active: string;
}

interface NoteFormula {
  id: string;
  name: string;
  formula: string;
}

interface Props {
  noteFormulas?: NoteFormula[];
  emptyMessage?: string;
  onUpload?: () => void;
  /** Workspace/task identifier used to scope persistence (avoids cross-task bleed). */
  scopeKey?: string;
}

export function FormulaScratchpad({ noteFormulas = [], emptyMessage, onUpload, scopeKey }: Props) {
  const scope = scopeKey ?? '__global';
  const persisted = loadScratchpadFormulas<PersistedScratch>(scope);
  const initialFormulas: SavedFormula[] = noteFormulas.map((f) => ({
    ...f,
    variables: inferVariablesFromFormula(f.formula),
  }));
  const [formulas, setFormulas] = useState<SavedFormula[]>(() =>
    initialFormulas.length > 0 ? initialFormulas : (persisted?.formulas ?? []),
  );
  const [active, setActive] = useState<string>(() => initialFormulas[0]?.id ?? persisted?.active ?? '');
  const [vars, setVars] = useState<Variable[]>(() =>
    initialFormulas[0]?.variables ?? persisted?.vars ?? [{ symbol: 'x', value: '', unit: '' }],
  );
  const [steps, setSteps] = useState<string[]>(() => persisted?.steps ?? []);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    saveScratchpadFormulas<PersistedScratch>(scope, { formulas, vars, steps, active });
  }, [scope, formulas, vars, steps, active]);

  useEffect(() => {
    if (noteFormulas.length === 0) return;
    const mapped: SavedFormula[] = noteFormulas.map((f) => ({
      ...f,
      variables: inferVariablesFromFormula(f.formula),
    }));
    setFormulas(mapped);
    if (mapped[0]) {
      setActive(mapped[0].id);
      setVars([...mapped[0].variables]);
      setSteps([]);
    }
  }, [noteFormulas]);

  const activeFormula = formulas.find(f => f.id === active);

  const selectFormula = (id: string) => {
    const f = formulas.find(x => x.id === id);
    if (f) { setActive(id); setVars([...f.variables]); setSteps([]); }
  };

  const updateVar = (idx: number, value: string) => {
    setVars(prev => prev.map((v, i) => i === idx ? { ...v, value } : v));
  };

  const compute = () => {
    if (!activeFormula) return;
    const { steps } = evaluateFormulaExpression(activeFormula.formula, vars as FormulaVariable[]);
    setSteps(steps);
  };

  const copyResult = () => {
    navigator.clipboard.writeText(steps.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const addCustom = () => {
    const id = `f-${Date.now()}`;
    const f: SavedFormula = { id, name: 'Custom Formula', formula: 'y = mx + b', variables: [
      { symbol: 'm', value: '', unit: '' }, { symbol: 'x', value: '', unit: '' }, { symbol: 'b', value: '', unit: '' },
    ]};
    setFormulas(prev => [...prev, f]);
    selectFormula(id);
  };

  if (formulas.length === 0) {
    return (
      <WorkspaceEmptyState
        message={emptyMessage ?? 'Upload notes to extract formulas from your material, or add a custom formula.'}
        onUpload={onUpload}
      />
    );
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary/40 shrink-0">
        <span className="text-xs font-semibold text-text-secondary">📐 Formula Scratchpad</span>
        <button onClick={addCustom} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-text-muted hover:text-text-secondary bg-surface-hover">
          <Plus className="w-3 h-3" /> Add Custom
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Formula list */}
        <div className="w-40 border-r border-border-subtle overflow-y-auto py-2 shrink-0">
          {formulas.map(f => (
            <button key={f.id} onClick={() => selectFormula(f.id)}
              className={cn('w-full text-left px-3 py-2 text-xs transition-all',
                active === f.id ? 'bg-brand-600/15 text-brand-300 border-l-2 border-brand-500' : 'text-text-secondary hover:bg-surface-hover')}>
              {f.name}
            </button>
          ))}
        </div>

        {/* Work area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeFormula && (
            <>
              {/* Formula display */}
              <div className="text-center">
                <p className="text-[10px] text-text-muted mb-1">{activeFormula.name}</p>
                <div className="text-2xl font-mono font-bold text-brand-300 py-3 px-6 rounded-xl bg-surface-primary/60 inline-block">
                  {activeFormula.formula}
                </div>
              </div>

              {/* Variable inputs */}
              <div className="space-y-2">
                <p className="text-[10px] text-text-muted font-medium">Variables</p>
                {vars.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono font-bold text-brand-400 text-sm w-12 shrink-0 text-right">{v.symbol}</span>
                    <span className="text-text-muted text-xs">=</span>
                    <input
                      type="text" value={v.value} onChange={e => updateVar(i, e.target.value)}
                      placeholder="value"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-surface-input border border-border-subtle text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50"
                    />
                    {v.unit && <span className="text-[10px] text-text-muted w-8">{v.unit}</span>}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button onClick={compute} className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all">
                  Compute Step-by-Step
                </button>
                <button onClick={() => { setVars(activeFormula.variables.map(v => ({ ...v, value: '' }))); setSteps([]); }}
                  className="p-2.5 rounded-xl border border-border-subtle text-text-muted hover:text-text-secondary hover:bg-surface-hover">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Steps output */}
              <AnimatePresence>
                {steps.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="p-4 rounded-xl bg-surface-primary/60 border border-border-subtle space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-text-muted font-medium">Solution</span>
                      <button onClick={copyResult} className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary">
                        {copied ? <><Check className="w-3 h-3 text-accent-emerald" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                    {steps.map((s, i) => (
                      <motion.p key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }}
                        className={cn('text-sm font-mono', s.startsWith('✓') ? 'text-accent-emerald font-semibold' : s.startsWith('⚠') ? 'text-accent-amber' : 'text-text-secondary')}>
                        {s}
                      </motion.p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
