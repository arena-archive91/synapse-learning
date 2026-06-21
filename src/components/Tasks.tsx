import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Clock, Zap, AlertTriangle, RotateCcw,
  Brain, Target, BookOpen, Timer, ChevronDown, Play, Flame,
  GraduationCap, Lightbulb, Code, MessageSquare, Sparkles,
  Mic, ArrowDownRight, GitCompare, Shield, Calendar
} from 'lucide-react';
import type { Task, TaskType, MistakeRecord } from '../types';
import { cn } from '../utils/cn';
import { buildStudyPlanBlocks } from '../lib/pedagogy';
import type { FsrsRating } from '../lib/pedagogy';
import { filterTasksForSession, startButtonLabel, type SessionType } from '../lib/taskFlows';
import { ErrorNotebook } from './visuals/ErrorNotebook';

interface TasksProps {
  tasks: Task[];
  onComplete: (taskId: string) => void;
  onReviewRating?: (taskId: string, rating: FsrsRating) => void;
  onStartTask?: (taskId: string) => void;
  onStartSession?: (session: SessionType) => void;
  daysToExam?: number | null;
  expandedTaskId?: string | null;
  onExpandedTaskChange?: (taskId: string | null) => void;
  openMistakes?: MistakeRecord[];
  onResolveMistake?: (id: string) => void;
}

type TaskFilter = 'all' | 'learn' | 'review' | 'practice' | 'exam' | 'fix' | 'completed';

const taskTypeConfig: Record<TaskType, { icon: typeof BookOpen; color: string; label: string }> = {
  lesson: { icon: BookOpen, color: 'text-brand-400', label: 'Lesson' },
  quiz: { icon: Brain, color: 'text-accent-cyan', label: 'Quiz' },
  review: { icon: RotateCcw, color: 'text-accent-amber', label: 'Review' },
  practice: { icon: Code, color: 'text-accent-teal', label: 'Practice' },
  'exam-prep': { icon: GraduationCap, color: 'text-accent-rose', label: 'Exam Prep' },
  flashcards: { icon: Sparkles, color: 'text-accent-emerald', label: 'Flashcards' },
  'mistake-retry': { icon: AlertTriangle, color: 'text-accent-orange', label: 'Retry Mistakes' },
  'concept-check': { icon: Lightbulb, color: 'text-accent-cyan', label: 'Concept Check' },
  'deep-dive': { icon: MessageSquare, color: 'text-brand-300', label: 'Deep Dive' },
  'timed-test': { icon: Timer, color: 'text-accent-rose', label: 'Timed Test' },
  'self-explanation': { icon: MessageSquare, color: 'text-brand-200', label: 'Self-Explain' },
  comparison: { icon: GitCompare, color: 'text-accent-cyan', label: 'Compare' },
  'prerequisite-repair': { icon: ArrowDownRight, color: 'text-accent-orange', label: 'Prereq Repair' },
  'oral-exam': { icon: Mic, color: 'text-accent-rose', label: 'Oral Exam' },
};

const sessionTypes: { type: SessionType; label: string; desc: string; minutes: number; icon: typeof Play }[] = [
  { type: '10min', label: 'Quick Sprint', desc: 'Fast review & flashcards', minutes: 10, icon: Zap },
  { type: '25min', label: 'Focused Session', desc: 'Deep learning & practice', minutes: 25, icon: Target },
  { type: '50min', label: 'Deep Session', desc: 'Complex topics & exercises', minutes: 50, icon: Brain },
  { type: 'cram', label: 'Exam Cram', desc: 'Priority exam material', minutes: 60, icon: Flame },
  { type: 'review', label: 'Spaced Review', desc: 'Due spaced repetitions', minutes: 15, icon: RotateCcw },
];

export function Tasks({ tasks, onComplete, onReviewRating, onStartTask, onStartSession, daysToExam = null, expandedTaskId = null, onExpandedTaskChange, openMistakes = [], onResolveMistake }: TasksProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [showSessions, setShowSessions] = useState(false);
  const [localExpanded, setLocalExpanded] = useState<string | null>(null);
  const expandedTask = expandedTaskId ?? localExpanded;
  const setExpandedTask = (id: string | null) => {
    setLocalExpanded(id);
    onExpandedTaskChange?.(id);
  };

  useEffect(() => {
    if (expandedTaskId) setLocalExpanded(expandedTaskId);
  }, [expandedTaskId]);

  const studyPlan = buildStudyPlanBlocks(tasks);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'completed') return t.status === 'completed';
    if (filter === 'all') return true;
    return t.category === filter && t.status !== 'completed';
  });

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const reviewCount = tasks.filter(t => t.isSpacedRepetition && t.status === 'pending').length;
  const totalXP = tasks.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.xpReward, 0);
  const dangerTasks = tasks.filter(t => t.status === 'pending' && (t.priority === 'critical' || (t.type === 'prerequisite-repair')));

  const filterCounts: Record<TaskFilter, number> = {
    all: tasks.length,
    learn: tasks.filter(t => t.category === 'learn' && t.status !== 'completed').length,
    review: tasks.filter(t => t.category === 'review' && t.status !== 'completed').length,
    practice: tasks.filter(t => t.category === 'practice' && t.status !== 'completed').length,
    exam: tasks.filter(t => t.category === 'exam' && t.status !== 'completed').length,
    fix: tasks.filter(t => t.category === 'fix' && t.status !== 'completed').length,
    completed: completedCount,
  };

  return (
    <div className="p-4 sm:p-6 lg:px-8 pb-24 lg:pb-6 w-full min-w-0 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Tasks</h1>
          <p className="text-text-secondary mt-1">{pendingCount} pending · {completedCount} done · {totalXP} XP available</p>
        </div>
        <button onClick={() => setShowSessions(!showSessions)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-medium text-sm hover:from-brand-500 hover:to-brand-400 transition-all">
          <Play className="w-4 h-4" />
          Start Session
          <ChevronDown className={cn('w-4 h-4 transition-transform', showSessions && 'rotate-180')} />
        </button>
      </motion.div>

      {/* Session Picker */}
      <AnimatePresence>
        {showSessions && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pb-4">
              {sessionTypes.map(s => {
                const sessionTasks = filterTasksForSession(tasks, s.type);
                return (
                <button
                  key={s.type}
                  onClick={() => { onStartSession?.(s.type); setShowSessions(false); }}
                  disabled={sessionTasks.length === 0}
                  className={cn(
                    'p-4 rounded-xl border bg-surface-card transition-all text-left group',
                    sessionTasks.length === 0
                      ? 'border-border-subtle opacity-50 cursor-not-allowed'
                      : 'border-border-subtle hover:border-brand-500/30',
                  )}
                >
                  <s.icon className="w-5 h-5 text-brand-400 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{s.desc}</p>
                  <p className="text-xs text-brand-400 mt-2">{s.minutes} min · {sessionTasks.length} task{sessionTasks.length === 1 ? '' : 's'}</p>
                </button>
              );})}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily study plan */}
      {studyPlan.length > 0 && filter !== 'completed' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-brand-400" />
            Today&apos;s study plan
          </h3>
          <div className="space-y-3">
            {studyPlan.map((block) => (
              <div key={block.label} className="p-3 rounded-xl bg-surface-card border border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-primary">{block.label}</span>
                  <span className="text-[10px] text-text-tertiary">{block.minutes} min</span>
                </div>
                <ul className="space-y-1">
                  {block.items.map((item) => (
                    <li key={item} className="text-xs text-text-secondary truncate">· {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Error notebook */}
      {openMistakes.length > 0 && filter !== 'completed' && (
        <ErrorNotebook mistakes={openMistakes} onResolve={onResolveMistake} />
      )}

      {/* Danger Zone */}
      {dangerTasks.length > 0 && filter !== 'completed' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl border border-accent-rose/30 bg-accent-rose/5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-accent-rose">
            <Shield className="w-4 h-4" />
            Danger Zone — Needs Immediate Attention
          </h3>
          <div className="space-y-2">
            {dangerTasks.slice(0, 3).map(task => (
              <button
                key={task.id}
                onClick={() => onStartTask?.(task.id)}
                className="w-full flex items-center gap-3 text-sm text-left hover:bg-surface-hover rounded-lg p-1.5 -m-1.5 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-accent-rose animate-pulse shrink-0" />
                <span className="flex-1 truncate">{task.title}</span>
                <span className="text-xs text-accent-rose">{task.estimatedMinutes}m</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Stats */}
      <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar">
        {reviewCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-sm shrink-0">
            <RotateCcw className="w-4 h-4 text-accent-amber" />
            <span className="text-accent-amber font-medium">{reviewCount} reviews due</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-border-subtle text-sm shrink-0">
          <Clock className="w-4 h-4 text-text-tertiary" />
          <span className="text-text-secondary">~{Math.round(tasks.filter(t => t.status === 'pending').reduce((s, t) => s + t.estimatedMinutes, 0))} min total</span>
        </div>
        {daysToExam !== null ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-sm shrink-0">
            <Calendar className="w-4 h-4 text-accent-rose" />
            <span className="text-accent-rose font-medium">
              {daysToExam === 0 ? 'Exam today' : `Exam in ${daysToExam} day${daysToExam === 1 ? '' : 's'}`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-border-subtle text-sm shrink-0">
            <Calendar className="w-4 h-4 text-text-tertiary" />
            <span className="text-text-secondary">No exam date set</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        {(['all', 'learn', 'review', 'practice', 'fix', 'exam', 'completed'] as TaskFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize shrink-0 flex items-center gap-1.5',
            filter === f ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30' : 'text-text-tertiary hover:text-text-secondary border border-border-subtle'
          )}>
            {f}
            {filterCounts[f] > 0 && <span className="text-[10px] opacity-60">({filterCounts[f]})</span>}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filteredTasks.map((task, i) => {
            const config = taskTypeConfig[task.type];
            const isExpanded = expandedTask === task.id;
            const isCompleted = task.status === 'completed';
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.03 }}
                className={cn('rounded-xl border bg-surface-card transition-all', isCompleted ? 'border-border-subtle opacity-60' : 'border-border-subtle hover:border-brand-500/30', task.priority === 'critical' && !isCompleted && 'border-accent-rose/30')}
              >
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                  <button onClick={e => { e.stopPropagation(); if (!isCompleted) onComplete(task.id); }} className="shrink-0">
                    {isCompleted ? <CheckCircle2 className="w-5 h-5 text-accent-emerald" /> : <Circle className="w-5 h-5 text-text-muted hover:text-brand-400 transition-colors" />}
                  </button>
                  <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: task.courseColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm">{task.courseIcon}</span>
                      <config.icon className={cn('w-3.5 h-3.5 shrink-0', config.color)} />
                      <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">{config.label}</span>
                    </div>
                    <p className={cn('text-sm font-medium truncate', isCompleted && 'line-through text-text-tertiary')}>{task.title}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-xs text-text-tertiary">{task.estimatedMinutes}m</span>
                    <span className="text-xs text-accent-amber font-medium">+{task.xpReward}</span>
                    {task.priority === 'critical' && <span className="w-2 h-2 rounded-full bg-accent-rose animate-pulse" />}
                    <ChevronDown className={cn('w-4 h-4 text-text-muted transition-transform', isExpanded && 'rotate-180')} />
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 ml-8 border-t border-border-subtle pt-3">
                        <p className="text-sm text-text-secondary mb-3">{task.description}</p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {task.tags.map(tag => (<span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover text-text-tertiary">{tag}</span>))}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-text-tertiary flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimatedMinutes} min</span>
                          <span className="text-xs text-text-tertiary">{task.courseName}</span>
                          {task.isSpacedRepetition && <span className="text-xs text-accent-amber flex items-center gap-1"><RotateCcw className="w-3 h-3" />Spaced repetition</span>}
                          {task.retentionPrediction !== undefined && task.retentionPrediction < 0.8 && (
                            <span className="text-xs text-accent-rose flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Retention: {Math.round(task.retentionPrediction * 100)}%</span>
                          )}
                        </div>
                        {!isCompleted && task.isSpacedRepetition && task.category === 'review' && onReviewRating ? (
                          <div className="mt-3">
                            <p className="text-xs text-text-tertiary mb-2">How well did you recall this?</p>
                            <div className="flex flex-wrap gap-2">
                              {([
                                { rating: 'again' as FsrsRating, label: 'Again', color: 'bg-accent-rose/15 text-accent-rose border-accent-rose/30' },
                                { rating: 'hard' as FsrsRating, label: 'Hard', color: 'bg-accent-orange/15 text-accent-orange border-accent-orange/30' },
                                { rating: 'good' as FsrsRating, label: 'Good', color: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30' },
                                { rating: 'easy' as FsrsRating, label: 'Easy', color: 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30' },
                              ]).map(({ rating, label, color }) => (
                                <button
                                  key={rating}
                                  onClick={() => onReviewRating(task.id, rating)}
                                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-90', color)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : !isCompleted && (
                          <button
                            onClick={() => (onStartTask ? onStartTask(task.id) : onComplete(task.id))}
                            className="mt-3 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-all"
                          >
                            {startButtonLabel(task)}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filteredTasks.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-accent-emerald mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">All done!</h3>
            <p className="text-text-secondary text-sm">No tasks match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
