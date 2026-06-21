import { MapPin } from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  onClick: () => void;
  label?: string;
  className?: string;
  lang?: 'en' | 'el';
}

export function GoToSourceButton({ onClick, label, className, lang = 'en' }: Props) {
  const text = label ?? (lang === 'el' ? 'Πήγαινε στη πηγή' : 'Go to source');
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium',
        'text-brand-300 hover:text-brand-200 hover:bg-brand-500/10 transition-colors',
        className,
      )}
    >
      <MapPin className="w-3 h-3 shrink-0" />
      {text}
    </button>
  );
}
