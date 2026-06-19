import React from 'react';

interface CalibrationPoint {
  predicted: number;
  actual: number;
}

const sampleData: CalibrationPoint[] = [
  { predicted: 25, actual: 0 }, { predicted: 30, actual: 100 },
  { predicted: 45, actual: 0 }, { predicted: 55, actual: 100 },
  { predicted: 60, actual: 100 }, { predicted: 65, actual: 0 },
  { predicted: 75, actual: 100 }, { predicted: 80, actual: 100 },
  { predicted: 85, actual: 0 }, { predicted: 90, actual: 100 },
];

export const ConfidenceCalibrationScatter: React.FC<{ points?: CalibrationPoint[] }> = ({ points = sampleData }) => {
  const avgGap = points.reduce((sum, p) => sum + (p.predicted - p.actual), 0) / points.length;
  const calibrationScore = Math.max(0, Math.round(100 - Math.abs(avgGap) * 1.2));

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5" role="img" aria-label={`Calibration score ${calibrationScore}`}>
      <div className="flex justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Confidence Calibration</div>
          <div className="text-xs text-slate-400">Predicted vs actual performance (metacognition)</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-300">{calibrationScore}</div>
          <div className="text-[10px] text-slate-400 -mt-1">Calibration Score</div>
        </div>
      </div>

      <div className="mt-4 h-64 relative bg-slate-900/60 rounded-2xl">
        <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
          <line x1="10" y1="90" x2="90" y2="90" stroke="#334155" strokeWidth="0.8" />
          <line x1="10" y1="10" x2="10" y2="90" stroke="#334155" strokeWidth="0.8" />
          <line x1="10" y1="90" x2="90" y2="10" stroke="#64748b" strokeWidth="0.6" strokeDasharray="2 2" />

          {points.map((p, i) => {
            const x = 10 + (p.predicted / 100) * 80;
            const y = 90 - (p.actual / 100) * 80;
            const isOver = p.predicted > p.actual;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="2.2" fill={isOver ? '#f87171' : '#6ee7b7'} />
              </g>
            );
          })}

          <text x="50" y="97" textAnchor="middle" className="fill-slate-400 text-[5px]">Predicted Confidence →</text>
          <text x="5" y="52" transform="rotate(-90 5 52)" className="fill-slate-400 text-[5px]">Actual Accuracy →</text>
        </svg>
      </div>

      <div className="mt-3 text-xs text-slate-300">
        {avgGap > 5 && 'You tend to be overconfident. Consider lowering your pre-answer confidence ratings.'}
        {avgGap < -5 && 'You tend to be underconfident. Trust your knowledge more on retrieval tasks.'}
        {Math.abs(avgGap) <= 5 && 'Excellent calibration — your internal feeling matches reality.'}
      </div>
    </div>
  );
};
