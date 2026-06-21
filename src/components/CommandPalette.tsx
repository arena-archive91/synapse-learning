import { useEffect, useState, useCallback } from 'react';
import { Search, BookOpen, CheckSquare, Bot, LayoutDashboard, BarChart3, Settings, Play } from 'lucide-react';
import type { AppView, Task } from '../types';
import { cn } from '../utils/cn';
import { useI18n } from '../lib/i18n';

export type CommandAction =
  | { type: 'navigate'; view: AppView; label: string; icon: typeof Search }
  | { type: 'task'; taskId: string; label: string; icon: typeof Play }
  | { type: 'session'; session: '10min' | '25min' | 'review'; label: string; icon: typeof Play };

interface Props {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onNavigate: (view: AppView) => void;
  onStartTask: (taskId: string) => void;
  onStartSession: (session: '10min' | '25min' | 'review') => void;
}

const NAV: { view: AppView; label: string; icon: typeof LayoutDashboard }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'library', label: 'Library', icon: BookOpen },
  { view: 'tasks', label: 'Tasks', icon: CheckSquare },
  { view: 'agent', label: 'Agent', icon: Bot },
  { view: 'analytics', label: 'Analytics', icon: BarChart3 },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function CommandPalette({ open, onClose, tasks, onNavigate, onStartTask, onStartSession }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.toLowerCase();
  const navActions: CommandAction[] = NAV
    .filter((n) => n.label.toLowerCase().includes(q))
    .map((n) => ({ type: 'navigate', view: n.view, label: n.label, icon: n.icon }));

  const taskActions: CommandAction[] = tasks
    .filter((t) => t.status === 'pending' && (t.title.toLowerCase().includes(q) || t.courseName.toLowerCase().includes(q)))
    .slice(0, 6)
    .map((t) => ({ type: 'task', taskId: t.id, label: t.title, icon: Play }));

  const sessionActions: CommandAction[] = [
    { type: 'session' as const, session: '10min' as const, label: 'Start Quick Sprint (10 min)', icon: Play },
    { type: 'session' as const, session: '25min' as const, label: 'Start Focused Session (25 min)', icon: Play },
    { type: 'session' as const, session: 'review' as const, label: 'Start Spaced Review', icon: Play },
  ].filter((s) => s.label.toLowerCase().includes(q));

  const actions = [...navActions, ...taskActions, ...sessionActions];

  const run = (a: CommandAction) => {
    if (a.type === 'navigate') onNavigate(a.view);
    if (a.type === 'task') onStartTask(a.taskId);
    if (a.type === 'session') onStartSession(a.session);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border-subtle bg-surface-secondary shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPages')}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border-subtle text-text-muted">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {actions.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">{t('noMatches')}</p>
          ) : actions.map((a, i) => (
            <button
              key={`${a.type}-${i}`}
              onClick={() => run(a)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm',
                'hover:bg-surface-hover transition-colors',
              )}
            >
              <a.icon className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, toggle, close, setOpen };
}
