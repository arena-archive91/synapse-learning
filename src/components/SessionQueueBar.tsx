import { X, Play } from 'lucide-react';
import { sessionLabel, type SessionType } from '../lib/taskFlows';

interface SessionQueueBarProps {
  sessionType: SessionType;
  currentIndex: number;
  total: number;
  onEndSession: () => void;
}

export function SessionQueueBar({ sessionType, currentIndex, total, onEndSession }: SessionQueueBarProps) {
  if (total <= 0) return null;

  const progress = Math.round((currentIndex / total) * 100);

  return (
    <div className="sticky top-0 z-40 border-b border-brand-500/20 bg-brand-600/10 px-4 py-2">
      <div className="w-full min-w-0 px-4 sm:px-6 flex items-center gap-3">
        <Play className="w-3.5 h-3.5 text-brand-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold text-brand-300 truncate">
              {sessionLabel(sessionType)} · Task {currentIndex} of {total}
            </p>
            <button
              onClick={onEndSession}
              className="text-[10px] text-text-tertiary hover:text-text-secondary shrink-0"
            >
              End session
            </button>
          </div>
          <div className="h-1 rounded-full bg-surface-hover overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          onClick={onEndSession}
          className="p-1 rounded-lg hover:bg-surface-hover text-text-muted shrink-0"
          title="End session"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
