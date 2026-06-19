import React from 'react';

interface CalibrationPoint {
  predicted: number;   // 0-100 (user's pre-answer confidence)
  actual: number;      // 0 or 100 (correct or not)
}

const sampleData: CalibrationPoint[] = [
  { predicted: 25, actual: 0 }, { predicted: 30, actual: 100 },
  { predicted: 45, actual: 0 }, { predicted: 55, actual: 100 },
  { predicted: 60, actual: 100 }, { predicted: 65, actual: 0 },
  { predicted: 75, actual: 100 }, { predicted: 80, actual: 100 },
  { predicted: 85, actual: 0 }, { predicted: 90, actual: 100 },
];

export const ConfidenceCalibrationScatter: React.FC = () => {
  const avgGap = sampleData.reduce((sum, p) => sum + (p.predicted - p.actual), 0) / sampleData.length;
  const calibrationScore = Math.max(0, Math.round(100 - Math.abs(avgGap) * 1.2));

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <div className="flex justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Confidence Calibration</div>
          <div className="text-xs text-slate-400">Predicted vs Actual performance (metacognition)</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-300">{calibrationScore}</div>
          <div className="text-[10px] text-slate-400 -mt-1">Calibration Score</div>
        </div>
      </div>

      <div className="mt-4 h-64 relative bg-slate-900/60 rounded-2xl">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Axes */}
          <line x1="10" y1="90" x2="90" y2="90" stroke="#334155" strokeWidth="0.8" />
          <line x1="10" y1="10" x2="10" y2="90" stroke="#334155" strokeWidth="0.8" />

          {/* Perfect calibration line */}
          <line x1="10" y1="90" x2="90" y2="10" stroke="#64748b" strokeWidth="0.6" strokeDasharray="2 2" />

          {/* Points */}
          {sampleData.map((p, i) => {
            const x = 10 + (p.predicted / 100) * 80;
            const y = 90 - (p.actual / 100) * 80;
            const isOver = p.predicted > p.actual;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="2.2" fill={isOver ? "#f87171" : "#6ee7b7"} />
              </g>
            );
          })}

          {/* Labels */}
          <text x="50" y="97" textAnchor="middle" className="fill-slate-400 text-[5px]">Predicted Confidence →</text>
          <text x="5" y="52" transform="rotate(-90 5 52)" className="fill-slate-400 text-[5px]">Actual Accuracy →</text>
        </svg>
      </div>

      <div className="mt-3 text-xs text-slate-300">
        {avgGap > 5 && "You tend to be overconfident. Consider lowering your pre-answer confidence ratings."}
        {avgGap < -5 && "You tend to be underconfident. Trust your knowledge more on retrieval tasks."}
        {Math.abs(avgGap) <= 5 && "Excellent calibration — your internal feeling matches reality."}
      </div>
    </div>
  );
};
