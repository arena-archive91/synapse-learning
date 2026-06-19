import { ReactNode } from 'react';
import {
  BookOpen, CheckSquare, Bot, LayoutDashboard, Settings,
  Sparkles, Menu, X, Upload, Bell, Search, ChevronRight,
  BarChart3
} from 'lucide-react';
import type { AppView, User, DashboardStats } from '../types';
import { cn } from '../utils/cn';

interface ShellProps {
  children: ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  sidebarOpen: boolean;
  onToggleSidebar: (open: boolean) => void;
  user: User;
  stats: DashboardStats;
  onUpload: () => void;
}

const navItems: { view: AppView; icon: typeof BookOpen; label: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { view: 'library', icon: BookOpen, label: 'Library' },
  { view: 'tasks', icon: CheckSquare, label: 'Tasks' },
  { view: 'agent', icon: Bot, label: 'Agent' },
  { view: 'analytics', icon: BarChart3, label: 'Analytics' },
  { view: 'settings', icon: Settings, label: 'Settings' },
];

export function Shell({ children, currentView, onNavigate, sidebarOpen, onToggleSidebar, user, stats, onUpload }: ShellProps) {
  return (
    <div className="min-h-screen bg-surface-primary flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border-subtle bg-surface-secondary/50 fixed inset-y-0 left-0 z-30">
        <div className="p-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">Synapse</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                currentView === item.view
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.view === 'tasks' && stats.reviewsDue > 0 && (
                <span className="ml-auto text-xs bg-accent-rose/20 text-accent-rose px-2 py-0.5 rounded-full font-semibold">
                  {stats.reviewsDue}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3">
          <button
            onClick={onUpload}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-medium text-sm hover:from-brand-500 hover:to-brand-400 transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Material
          </button>
        </div>

        <div className="p-3 border-t border-border-subtle">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center text-white text-sm font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-text-tertiary">Level {user.level} · {user.xp} XP</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => onToggleSidebar(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface-secondary border-r border-border-subtle flex flex-col">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Synapse</span>
              </div>
              <button onClick={() => onToggleSidebar(false)} className="p-1.5 rounded-lg hover:bg-surface-hover">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {navItems.map(item => (
                <button
                  key={item.view}
                  onClick={() => onNavigate(item.view)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                    currentView === item.view
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="p-3 border-t border-border-subtle">
              <button
                onClick={() => { onUpload(); onToggleSidebar(false); }}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-medium text-sm"
              >
                <Upload className="w-4 h-4" />
                Upload Material
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 glass-strong border-b border-border-subtle">
          <div className="flex items-center justify-between px-4 sm:px-6 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleSidebar(true)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-surface-hover"
              >
                <Menu className="w-5 h-5 text-text-secondary" />
              </button>
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-text-tertiary">
                <span className="text-text-secondary font-medium capitalize">{currentView}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-input border border-border-subtle text-sm text-text-tertiary">
                <Search className="w-4 h-4" />
                <span>Search...</span>
                <kbd className="text-xs bg-surface-hover px-1.5 py-0.5 rounded border border-border-subtle ml-4">⌘K</kbd>
              </div>

              <button className="relative p-2 rounded-lg hover:bg-surface-hover transition-colors">
                <Bell className="w-5 h-5 text-text-secondary" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-rose rounded-full" />
              </button>

              <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center text-white text-xs font-bold">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden sm:flex items-center gap-1">
                  <span className="text-xs font-medium text-accent-amber">🔥 {stats.streak}</span>
                  <ChevronRight className="w-3 h-3 text-text-tertiary" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-border-subtle">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.slice(0, 5).map(item => (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[60px]',
                  currentView === item.view
                    ? 'text-brand-400'
                    : 'text-text-tertiary'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
