import { motion } from 'framer-motion';

interface Signal {
  label: string;
  value: number;
  icon: string;
  color: string;
  detail?: string;
}

interface SignalBarsProps {
  signals: Signal[];
}

export function SignalBars({ signals }: SignalBarsProps) {
  return (
    <div className="space-y-3">
      {signals.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <span>{s.icon}</span>
              {s.label}
            </span>
            <span className="text-xs font-bold" style={{ color: s.color }}>{s.value}%</span>
          </div>
          <div className="relative h-2.5 bg-surface-hover rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ backgroundColor: s.color }}
              initial={{ width: 0 }}
              animate={{ width: `${s.value}%` }}
              transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
            />
            {/* Marker lines at 25%, 50%, 75% */}
            {[25, 50, 75].map(mark => (
              <div key={mark} className="absolute inset-y-0" style={{ left: `${mark}%`, width: 1, backgroundColor: '#1a1333' }} />
            ))}
          </div>
          {s.detail && <p className="text-[9px] text-text-muted mt-0.5">{s.detail}</p>}
        </motion.div>
      ))}
    </div>
  );
}
