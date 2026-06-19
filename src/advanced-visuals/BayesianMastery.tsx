import React from 'react';

interface BetaPosteriorProps {
  alpha: number;
  beta: number;
  label: string;
  evidence: number;
}

export const BayesianMasteryPosterior: React.FC<BetaPosteriorProps> = ({ alpha, beta, label, evidence }) => {
  const mastery = alpha / (alpha + beta);
  const confidence = Math.min(1, evidence / 5);

  // Simple discrete approximation of Beta PDF for visualization
  const points = Array.from({ length: 40 }, (_, i) => {
    const x = i / 39;
    const y = Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1);
    return { x: x * 100, y };
  });
  const maxY = Math.max(...points.map(p => p.y)) || 1;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex justify-between items-baseline">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs text-cyan-200">
          Mastery: {(mastery * 100).toFixed(0)}% • Evidence: {evidence}
        </div>
      </div>

      <div className="mt-3 h-20 relative bg-slate-900/60 rounded-xl overflow-hidden">
        <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full">
          <polyline
            points={points.map(p => `${p.x},${60 - (p.y / maxY) * 52}`).join(' ')}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="1.5"
          />
          {/* Mean line */}
          <line 
            x1={mastery * 100} y1="8" 
            x2={mastery * 100} y2="52" 
            stroke="#a78bfa" strokeWidth="1" strokeDasharray="2 2" 
          />
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <div>Low certainty</div>
        <div>High certainty</div>
      </div>
      <div className="mt-1 text-[10px] text-emerald-300">
        Confidence in estimate: {(confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
};