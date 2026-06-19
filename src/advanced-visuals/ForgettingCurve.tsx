import React, { useState } from 'react';

interface Point { day: number; recall: number; }

export const ForgettingCurveSimulator: React.FC = () => {
  const [reviews, setReviews] = useState<number[]>([0, 3, 10]);
  const [strength, setStrength] = useState(1.8);

  // Simple exponential decay model with spacing boost
  const generateCurve = (): Point[] => {
    const points: Point[] = [];
    const currentStrength = strength;

    for (let day = 0; day <= 30; day++) {
      // Decay
      const decay = Math.exp(-day / (currentStrength * 5));
      let recall = Math.max(0, decay * 100);

      // Apply review boosts
      reviews.forEach(r => {
        if (day >= r) {
          const timeSince = day - r;
          const boost = Math.exp(-timeSince / (currentStrength * 6)) * 35;
          recall = Math.min(100, recall + boost);
        }
      });

      points.push({ day, recall: Math.round(recall) });
    }
    return points;
  };

  const curve = generateCurve();
  const maxRecall = Math.max(...curve.map(p => p.recall));

  const addReview = () => {
    const nextDay = Math.max(...reviews) + 4;
    setReviews([...reviews, Math.min(28, nextDay)]);
  };

  const resetReviews = () => setReviews([0]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm font-semibold text-white">Forgetting Curve + Spaced Repetition Simulator</div>
          <div className="text-xs text-slate-400">Adjust reviews to see how spacing flattens the curve</div>
        </div>
        <div className="flex gap-2">
          <button onClick={addReview} className="rounded-xl bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/20">Add Review</button>
          <button onClick={resetReviews} className="rounded-xl bg-white/5 px-3 py-1 text-xs text-slate-300">Reset</button>
        </div>
      </div>

      <div className="mt-4 h-56 relative">
        <svg viewBox="0 0 600 200" className="w-full h-full">
          {/* Grid */}
          {[0, 25, 50, 75, 100].map((v, i) => (
            <g key={i}>
              <line x1="40" y1={180 - (v / 100) * 160} x2="580" y2={180 - (v / 100) * 160} className="stroke-white/10" strokeWidth="1" />
              <text x="25" y={185 - (v / 100) * 160} className="fill-slate-500 text-[9px]">{v}%</text>
            </g>
          ))}

          {/* Curve */}
          <polyline
            points={curve.map((p, i) => `${40 + (i / 30) * 540},${180 - (p.recall / 100) * 160}`).join(' ')}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Review markers */}
          {reviews.map((r, idx) => (
            <g key={idx}>
              <circle cx={40 + (r / 30) * 540} cy={180 - (curve[r]?.recall || 50) / 100 * 160} r="5" fill="#a78bfa" />
              <text x={40 + (r / 30) * 540} y="195" className="fill-violet-300 text-[8px]" textAnchor="middle">R{idx + 1}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        Current strength factor: {strength.toFixed(1)} — higher = slower forgetting after successful reviews.
      </div>
      <input 
        type="range" 
        min="1" max="4" step="0.1" 
        value={strength} 
        onChange={(e) => setStrength(parseFloat(e.target.value))}
        className="w-full accent-violet-400 mt-1" 
      />
    </div>
  );
};
