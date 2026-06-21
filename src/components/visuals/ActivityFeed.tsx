import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Brain, Zap, RotateCcw, AlertTriangle, Star, Target, Clock, Upload, Activity } from 'lucide-react';
import type { ActivityItem, ActivityType } from '../../types';
import { formatRelativeTime } from '../../lib/activityLog';

type ActivityVisual = { icon: typeof BookOpen; color: string; bg: string };

const typeConfig: Record<ActivityType, ActivityVisual> = {
  lesson_complete: { icon: BookOpen, color: 'text-brand-400', bg: 'bg-brand-500/10' },
  quiz_passed: { icon: CheckCircle2, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
  quiz_failed: { icon: AlertTriangle, color: 'text-accent-rose', bg: 'bg-accent-rose/10' },
  review_done: { icon: RotateCcw, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
  streak: { icon: Star, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
  mastery_up: { icon: Brain, color: 'text-accent-teal', bg: 'bg-accent-teal/10' },
  xp_earned: { icon: Zap, color: 'text-brand-300', bg: 'bg-brand-500/10' },
  mistake_fixed: { icon: Target, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
  task_complete: { icon: CheckCircle2, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
  study_time: { icon: Clock, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
  upload: { icon: Upload, color: 'text-brand-300', bg: 'bg-brand-500/10' },
};

const FALLBACK_VISUAL: ActivityVisual = { icon: Activity, color: 'text-text-secondary', bg: 'bg-surface-hover' };

interface Props {
  activities: ActivityItem[];
  maxItems?: number;
}

export function ActivityFeed({ activities, maxItems = 6 }: Props) {
  if (activities.length === 0) {
    return <p className="text-xs text-text-tertiary text-center py-4">No activity yet — complete a task or quiz to get started.</p>;
  }

  return (
    <div className="space-y-1">
      {activities.slice(0, maxItems).map((item, i) => {
        const config = typeConfig[item.type] ?? FALLBACK_VISUAL;
        const Icon = config.icon;
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover/50 transition-colors"
          >
            <div className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
            </div>
            <p className="text-xs text-text-secondary flex-1 truncate">{item.description}</p>
            <div className="flex items-center gap-2 shrink-0">
              {item.xp != null && <span className="text-[10px] text-accent-amber font-medium">+{item.xp}</span>}
              <span className="text-[9px] text-text-muted">{formatRelativeTime(item.timestamp)}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
