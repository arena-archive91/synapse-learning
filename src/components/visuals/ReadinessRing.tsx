import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface ReadinessRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  showBand?: boolean;
}

const getBand = (v: number) => {
  if (v >= 80) return { label: 'Strong', color: '#34d399', bg: 'bg-accent-emerald/10', text: 'text-accent-emerald' };
  if (v >= 60) return { label: 'Proficient', color: '#fbbf24', bg: 'bg-accent-amber/10', text: 'text-accent-amber' };
  if (v >= 40) return { label: 'Developing', color: '#38bdf8', bg: 'bg-sky-400/10', text: 'text-sky-400' };
  return { label: 'Weak', color: '#fb7185', bg: 'bg-accent-rose/10', text: 'text-accent-rose' };
};

export function ReadinessRing({ value, size = 180, strokeWidth = 12, label = 'Exam Readiness', sublabel, showBand = true }: ReadinessRingProps) {
  const band = getBand(value);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle cx={center} cy={center} r={r} fill="none" stroke="#1e1740" strokeWidth={strokeWidth} />
          {/* Gradient arc */}
          <defs>
            <linearGradient id={`ring-grad-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={band.color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={band.color} />
            </linearGradient>
          </defs>
          <motion.circle
            cx={center} cy={center} r={r} fill="none"
            stroke={`url(#ring-grad-${value})`}
            strokeWidth={strokeWidth}
            strokeDasharray={c}
            strokeLinecap="round"
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
          {/* Glow dot at tip */}
          <motion.circle
            cx={center + r * Math.cos(((value / 100) * 360 - 90) * (Math.PI / 180))}
            cy={center + r * Math.sin(((value / 100) * 360 - 90) * (Math.PI / 180))}
            r={strokeWidth / 2 + 2}
            fill={band.color}
            opacity={0.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 1.2 }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-black"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            style={{ color: band.color }}
          >
            {value}%
          </motion.span>
          <span className="text-xs text-text-tertiary font-medium">{label}</span>
        </div>
      </div>
      {showBand && (
        <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', band.bg, band.text)}>
          {band.label}
        </span>
      )}
      {sublabel && <p className="text-[10px] text-text-muted text-center max-w-[200px]">{sublabel}</p>}
    </div>
  );
}
