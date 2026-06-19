import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Play, CheckCircle2, AlertTriangle, Lightbulb, 
  ChevronRight, ArrowRight, Sparkles, RotateCcw,
  Terminal, Eye, Gauge, Zap
} from 'lucide-react';
import { cn } from '../utils/cn';

interface PracticalLessonViewProps {
  onClose: () => void;
  onOpenAgent: () => void;
}

export function PracticalLessonView({ onClose, onOpenAgent }: PracticalLessonViewProps) {
  const [code, setCode] = useState(`import pandas as pd

# Load the dataset
df = pd.read_csv('sales_data.csv')

# TODO: Group by 'region' and calculate total revenue
# Your code here:
result = `);
  const [output, setOutput] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [testsPassed, setTestsPassed] = useState<boolean | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  const hints = [
    '💡 Hint 1: Use the .groupby() method on the DataFrame.',
    '💡 Hint 2: After groupby("region"), apply .sum() or .agg() to select the revenue column.',
    '💡 Full approach: df.groupby("region")["revenue"].sum()',
  ];

  const runCode = () => {
    setOutput(`region
East     45200
North    38900
South    52100
West     41800
Name: revenue, dtype: int64`);
    setTestsPassed(true);
  };

  const runTests = () => {
    setTestsPassed(true);
    setOutput(`✓ Test 1: result is a Series — PASSED
✓ Test 2: result has 4 regions — PASSED
✓ Test 3: Total matches expected — PASSED

All tests passed! 🎉`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-primary flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-surface-secondary/50">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover"><X className="w-5 h-5 text-text-secondary" /></button>
          <div>
            <p className="text-sm font-semibold">Pandas GroupBy Operations</p>
            <p className="text-xs text-text-tertiary">Python for Data Science · Practice</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenAgent} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-brand-500/30 transition-all">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Ask Agent
          </button>
          <span className="text-xs text-accent-amber font-medium">+40 XP</span>
        </div>
      </div>

      {/* Split screen */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Instructions */}
        <div className="lg:w-[40%] border-b lg:border-b-0 lg:border-r border-border-subtle overflow-y-auto">
          <div className="p-5 space-y-5">
            <div>
              <span className="text-xs text-accent-teal font-medium uppercase tracking-wider">Interactive Exercise</span>
              <h2 className="text-xl font-bold mt-1">GroupBy: Total Revenue by Region</h2>
            </div>

            <div className="p-4 rounded-xl bg-surface-card border border-border-subtle">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-brand-400" /> Learning Objective
              </h4>
              <p className="text-sm text-text-secondary">
                Use <code className="px-1.5 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">.groupby()</code> to 
                aggregate data by category and compute summary statistics.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Minimal Theory</h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                <code className="px-1 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">df.groupby(column)</code> splits 
                the DataFrame into groups, then you apply an aggregation function like 
                <code className="px-1 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">.sum()</code>, 
                <code className="px-1 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">.mean()</code>, or 
                <code className="px-1 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">.count()</code>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">📋 Task</h4>
              <ol className="text-sm text-text-secondary space-y-1.5 list-decimal ml-4">
                <li>Group the DataFrame by the <code className="px-1 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">"region"</code> column</li>
                <li>Select the <code className="px-1 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">"revenue"</code> column</li>
                <li>Apply <code className="px-1 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">.sum()</code> to get total revenue per region</li>
                <li>Store the result in the <code className="px-1 py-0.5 rounded bg-surface-hover text-brand-300 text-xs font-mono">result</code> variable</li>
              </ol>
            </div>

            {/* Hints */}
            <div className="space-y-2">
              {hints.slice(0, hintLevel).map((hint, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-accent-amber/5 border border-accent-amber/20 text-xs text-text-secondary">
                  {hint}
                </motion.div>
              ))}
              {hintLevel < hints.length && (
                <button onClick={() => setHintLevel(prev => prev + 1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle hover:border-accent-amber/30 text-text-secondary transition-all">
                  <Lightbulb className="w-3 h-3 text-accent-amber" />
                  {hintLevel === 0 ? 'Show hint' : hintLevel === 1 ? 'Show more help' : 'Show full approach'}
                </button>
              )}
            </div>

            {/* Solution toggle */}
            {showSolution && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-4 rounded-xl bg-accent-emerald/5 border border-accent-emerald/20">
                <h4 className="text-sm font-semibold text-accent-emerald mb-2">Step-by-Step Solution</h4>
                <pre className="text-xs font-mono text-text-secondary bg-surface-primary p-3 rounded-lg overflow-x-auto">
{`# Step 1: Group by region
grouped = df.groupby("region")

# Step 2: Select revenue and sum
result = grouped["revenue"].sum()

# Equivalent one-liner:
result = df.groupby("region")["revenue"].sum()`}</pre>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowSolution(!showSolution)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary transition-all">
                {showSolution ? '🙈 Hide solution' : '👀 Show solution'}
              </button>
              <button onClick={onOpenAgent} className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary transition-all">
                🔰 Explain like I'm a beginner
              </button>
              <button onClick={onOpenAgent} className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary transition-all">
                🎯 Show next step only
              </button>
              <button onClick={onOpenAgent} className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-border-subtle hover:border-brand-500/30 text-text-secondary transition-all">
                🔄 Generate similar exercise
              </button>
            </div>
          </div>
        </div>

        {/* Right: Code editor + Output */}
        <div className="lg:w-[60%] flex flex-col">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-secondary/30">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-text-tertiary" />
              <span className="text-xs font-medium text-text-secondary">script.py</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={runCode} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20 transition-all">
                <Play className="w-3 h-3" /> Run
              </button>
              <button onClick={runTests} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 text-brand-300 hover:bg-brand-500/20 transition-all">
                <CheckCircle2 className="w-3 h-3" /> Run Tests
              </button>
              <button onClick={() => { setCode(''); setOutput(''); setTestsPassed(null); }} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Code editor */}
          <div className="flex-1 min-h-[200px]">
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full h-full p-4 bg-[#0d0b14] text-sm font-mono text-accent-emerald focus:outline-none resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Output panel */}
          <div className="border-t border-border-subtle bg-surface-secondary/30">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-xs font-medium text-text-secondary">Output</span>
              </div>
              {testsPassed !== null && (
                <span className={cn('text-xs font-medium flex items-center gap-1',
                  testsPassed ? 'text-accent-emerald' : 'text-accent-rose'
                )}>
                  {testsPassed ? <><CheckCircle2 className="w-3 h-3" /> All tests passed</> : <><AlertTriangle className="w-3 h-3" /> Tests failed</>}
                </span>
              )}
            </div>
            <pre className="p-4 text-xs font-mono text-text-secondary min-h-[100px] max-h-[200px] overflow-y-auto">
              {output || 'Click "Run" to execute your code...'}
            </pre>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border-subtle bg-surface-secondary/50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">Exercise 3/5</span>
            {testsPassed && <span className="text-xs text-accent-emerald flex items-center gap-1"><Zap className="w-3 h-3" />+40 XP earned</span>}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1">
              Try similar <ChevronRight className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-all">
              Try harder <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
