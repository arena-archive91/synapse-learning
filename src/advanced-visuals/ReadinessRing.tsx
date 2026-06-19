import React from 'react';

interface ReadinessRingProps {
  value: number; // 0-100
  label?: string;
  size?: number;
}

export const ReadinessRing: React.FC<ReadinessRingProps> = ({ value, label = "Exam Readiness", size = 140 }) => {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color = value >= 80 ? '#6ee7b7' : value >= 60 ? '#67e8f9' : value >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e2937"
            strokeWidth="11"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-semibold text-white tabular-nums">{value}</div>
          <div className="text-xs -mt-1 text-slate-400">/ 100</div>
        </div>
      </div>
      <div className="mt-2 text-sm font-medium text-white">{label}</div>
    </div>
  );
};
