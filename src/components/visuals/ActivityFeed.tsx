import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Brain, Zap, RotateCcw, AlertTriangle, Star, Target } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'lesson_complete' | 'quiz_passed' | 'quiz_failed' | 'review_done' | 'streak' | 'mastery_up' | 'xp_earned' | 'mistake_fixed';
  description: string;
  xp?: number;
  timestamp: string;
}

const typeConfig = {
  lesson_complete: { icon: BookOpen, color: 'text-brand-400', bg: 'bg-brand-500/10' },
  quiz_passed: { icon: CheckCircle2, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
  quiz_failed: { icon: AlertTriangle, color: 'text-accent-rose', bg: 'bg-accent-rose/10' },
  review_done: { icon: RotateCcw, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
  streak: { icon: Star, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
  mastery_up: { icon: Brain, color: 'text-accent-teal', bg: 'bg-accent-teal/10' },
  xp_earned: { icon: Zap, color: 'text-brand-300', bg: 'bg-brand-500/10' },
  mistake_fixed: { icon: Target, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
};

const mockActivities: ActivityItem[] = [
  { id: 'a1', type: 'quiz_passed', description: 'Scored 4/5 on Elasticity quiz', xp: 30, timestamp: '10 min ago' },
  { id: 'a2', type: 'lesson_complete', description: 'Completed "Cournot Competition" lesson', xp: 50, timestamp: '25 min ago' },
  { id: 'a3', type: 'review_done', description: 'Reviewed Supply & Demand flashcards', xp: 15, timestamp: '1 hour ago' },
  { id: 'a4', type: 'streak', description: '12-day study streak! 🔥', timestamp: 'Today' },
  { id: 'a5', type: 'mastery_up', description: 'NumPy Arrays mastery → 82%', timestamp: 'Yesterday' },
  { id: 'a6', type: 'mistake_fixed', description: 'Fixed misconception: Elasticity formula', xp: 25, timestamp: 'Yesterday' },
  { id: 'a7', type: 'quiz_failed', description: 'Struggled with Consumer Surplus (2/5)', timestamp: '2 days ago' },
  { id: 'a8', type: 'xp_earned', description: 'Weekly XP goal reached: 680 XP', timestamp: '2 days ago' },
];

export function ActivityFeed({ maxItems = 6 }: { maxItems?: number }) {
  return (
    <div className="space-y-1">
      {mockActivities.slice(0, maxItems).map((item, i) => {
        const config = typeConfig[item.type];
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
              {item.xp && <span className="text-[10px] text-accent-amber font-medium">+{item.xp}</span>}
              <span className="text-[9px] text-text-muted">{item.timestamp}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
