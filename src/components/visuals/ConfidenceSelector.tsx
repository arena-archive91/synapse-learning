import { cn } from '../../utils/cn';

interface ConfidenceSelectorProps {
  value: number | null;
  onChange: (v: number) => void;
  required?: boolean;
}

const levels = [
  { value: 25, label: 'Just guessing', emoji: '🤷', color: 'border-accent-rose/50 bg-accent-rose/5 text-accent-rose' },
  { value: 60, label: 'Fairly sure', emoji: '🤔', color: 'border-accent-amber/50 bg-accent-amber/5 text-accent-amber' },
  { value: 90, label: 'Certain', emoji: '😎', color: 'border-accent-emerald/50 bg-accent-emerald/5 text-accent-emerald' },
];

export function ConfidenceSelector({ value, onChange, required }: ConfidenceSelectorProps) {
  return (
    <div>
      <p className="text-xs text-text-tertiary mb-2 flex items-center gap-1">
        How confident are you?
        {required && !value && <span className="text-accent-rose text-[9px]">*required before submitting</span>}
      </p>
      <div className="flex gap-2">
        {levels.map(l => (
          <button
            key={l.value}
            onClick={() => onChange(l.value)}
            className={cn(
              'flex-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all text-center',
              value === l.value ? l.color : 'border-border-subtle text-text-tertiary hover:border-brand-500/20'
            )}
          >
            <span className="block text-lg mb-0.5">{l.emoji}</span>
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
