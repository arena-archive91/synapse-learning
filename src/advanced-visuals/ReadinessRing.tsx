import React from 'react';

interface ReadinessRingProps {
  value: number;
  label?: string;
  description?: string;
  size?: number;
}

export const ReadinessRing: React.FC<ReadinessRingProps> = ({
  value,
  label = 'Exam Readiness',
  description,
  size = 140,
}) => {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#6ee7b7' : value >= 60 ? '#67e8f9' : value >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div
      className="flex flex-col items-center justify-center rounded-[26px] bg-slate-950/30 p-4 text-center"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${value} percent`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e2937" strokeWidth="11" />
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
          <div className="text-3xl font-semibold text-white tabular-nums">{value}%</div>
          <div className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">{label}</div>
        </div>
      </div>
      {description ? (
        <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">{description}</p>
      ) : null}
    </div>
  );
};
