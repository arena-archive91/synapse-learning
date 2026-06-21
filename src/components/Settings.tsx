import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, BookOpen, Target, Zap,
  Gauge, Shield, Calendar, Palette, Database, KeyRound
} from 'lucide-react';
import type { UserSettings } from '../types';
import { cn } from '../utils/cn';
import { clearAllSessionData, downloadBackup, importSessionData } from '../lib/sessionBackup';
import { authLogin, authRegister, pushRemoteLibrary, createCheckoutSession, type AuthSession } from '../lib/authClient';
import { loadLibrarySync } from '../lib/libraryStorage';

interface SettingsProps {
  settings: UserSettings;
  onUpdate: (partial: Partial<UserSettings>) => void;
  onPullLibrary?: () => Promise<unknown>;
  onPullSession?: () => Promise<unknown>;
  onPushSession?: () => Promise<unknown>;
  onSyncAccount?: () => Promise<unknown>;
  onRefreshPlan?: () => Promise<unknown>;
}

export function Settings({
  settings,
  onUpdate,
  onPullLibrary,
  onPullSession,
  onPushSession,
  onSyncAccount,
  onRefreshPlan,
}: SettingsProps) {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState(settings.authEmail ?? '');
  const [authPassword, setAuthPassword] = useState('');
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    const text = await file.text();
    const result = importSessionData(text);
    if (result.ok) {
      setBackupStatus(`Imported ${result.keysImported} saved items. Reload to apply everywhere.`);
    } else {
      setBackupStatus(result.error);
    }
  };

  const proxyBase = (settings.authProxyBase ?? settings.llmProxyUrl ?? 'http://localhost:8787')
    .replace(/\/v1\/?$/, '')
    .replace(/\/$/, '');

  const finishAuth = async (session: AuthSession, label: string) => {
    onUpdate({
      authToken: session.token,
      authEmail: session.email,
      authPlan: session.plan ?? 'free',
      llmProxyUrl: settings.llmProxyUrl ?? `${proxyBase}/v1`,
    });
    if (onSyncAccount) {
      await onSyncAccount();
      setAuthStatus(`${label} ${session.email} — library & progress synced`);
      return;
    }
    if (onPullLibrary) await onPullLibrary();
    if (onPullSession) await onPullSession();
    if (onPushSession) await onPushSession();
    setAuthStatus(`${label} ${session.email}`);
  };

  const startCheckout = async (plan: 'pro' | 'team') => {
    if (!settings.authToken) {
      setAuthStatus('Sign in before upgrading');
      return;
    }
    try {
      const origin = window.location.origin;
      const { url } = await createCheckoutSession(settings.authToken, settings, plan, {
        successUrl: `${origin}/?billing=success`,
        cancelUrl: `${origin}/?billing=cancel`,
      });
      if (url) window.location.href = url;
      else setAuthStatus('Checkout URL missing — check Stripe configuration');
    } catch (e) {
      setAuthStatus(e instanceof Error ? e.message : 'Checkout failed');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:px-8 pb-24 lg:pb-6 w-full min-w-0 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold">Learning Preferences</h1>
        <p className="text-text-secondary mt-1">Customize how Synapse teaches you. These are UI preferences — the adaptive engine also learns from your behavior.</p>
      </motion.div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start [&>*]:mb-6 lg:[&>*]:mb-0">
      {/* Teaching Style */}
      <SettingsSection title="Teaching Approach" icon={<Brain className="w-5 h-5 text-brand-400" />} delay={0.05}>
        <ToggleRow label="Teaching style" options={[
          { value: 'socratic', label: 'Socratic' },
          { value: 'direct', label: 'Direct' },
          { value: 'mixed', label: 'Mixed' },
        ]} value={settings.teachingStyle} onChange={v => onUpdate({ teachingStyle: v as UserSettings['teachingStyle'] })} />
        <ToggleRow label="Explanation depth" options={[
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
          { value: 'expert', label: 'Expert' },
        ]} value={settings.explanationDepth} onChange={v => onUpdate({ explanationDepth: v as UserSettings['explanationDepth'] })} />
        <ToggleRow label="Feedback tone" options={[
          { value: 'gentle', label: 'Gentle' },
          { value: 'balanced', label: 'Balanced' },
          { value: 'strict', label: 'Strict' },
        ]} value={settings.feedbackTone} onChange={v => onUpdate({ feedbackTone: v as UserSettings['feedbackTone'] })} />
      </SettingsSection>

      {/* Content Balance */}
      <SettingsSection title="Content Balance" icon={<BookOpen className="w-5 h-5 text-accent-teal" />} delay={0.1}>
        <SliderRow label="Theory vs Practice" leftLabel="More theory" rightLabel="More practice" value={settings.theoryVsPractice} onChange={v => onUpdate({ theoryVsPractice: v })} />
        <ToggleRow label="Question frequency" options={[
          { value: 'minimal', label: 'Fewer' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'frequent', label: 'Frequent' },
        ]} value={settings.questionFrequency} onChange={v => onUpdate({ questionFrequency: v as UserSettings['questionFrequency'] })} />
        <ToggleRow label="Example density" options={[
          { value: 'fewer', label: 'Fewer' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'many', label: 'Many' },
        ]} value={settings.exampleDensity} onChange={v => onUpdate({ exampleDensity: v as UserSettings['exampleDensity'] })} />
        <ToggleRow label="Diagram frequency" options={[
          { value: 'minimal', label: 'Minimal' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'rich', label: 'Rich' },
        ]} value={settings.diagramFrequency} onChange={v => onUpdate({ diagramFrequency: v as UserSettings['diagramFrequency'] })} />
      </SettingsSection>

      {/* Pacing & Difficulty */}
      <SettingsSection title="Pacing & Difficulty" icon={<Gauge className="w-5 h-5 text-accent-amber" />} delay={0.15}>
        <ToggleRow label="Pacing" options={[
          { value: 'slow', label: 'Slow' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'fast', label: 'Fast' },
        ]} value={settings.pacing} onChange={v => onUpdate({ pacing: v as UserSettings['pacing'] })} />
        <ToggleRow label="Challenge level" options={[
          { value: 'low-stress', label: 'Low Stress' },
          { value: 'balanced', label: 'Balanced' },
          { value: 'high-challenge', label: 'High Challenge' },
        ]} value={settings.challengeLevel} onChange={v => onUpdate({ challengeLevel: v as UserSettings['challengeLevel'] })} />
        <ToggleRow label="Lesson length" options={[
          { value: 'short', label: 'Short (5-10m)' },
          { value: 'medium', label: 'Medium (15-20m)' },
          { value: 'long', label: 'Long (25-40m)' },
        ]} value={settings.lessonLength} onChange={v => onUpdate({ lessonLength: v as UserSettings['lessonLength'] })} />
        <SliderRow label="Mastery threshold" leftLabel="60%" rightLabel="100%" value={settings.masteryThreshold} onChange={v => onUpdate({ masteryThreshold: v })} min={60} max={100} />
      </SettingsSection>

      {/* Practice & Revision */}
      <SettingsSection title="Practice & Revision" icon={<Target className="w-5 h-5 text-accent-cyan" />} delay={0.2}>
        <ToggleRow label="Practice intensity" options={[
          { value: 'light', label: 'Light' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'intense', label: 'Intense' },
        ]} value={settings.practiceIntensity} onChange={v => onUpdate({ practiceIntensity: v as UserSettings['practiceIntensity'] })} />
        <ToggleRow label="Revision loops" options={[
          { value: 'fewer', label: 'Fewer' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'more', label: 'More' },
        ]} value={settings.revisionLoops} onChange={v => onUpdate({ revisionLoops: v as UserSettings['revisionLoops'] })} />
      </SettingsSection>

      {/* Source & Privacy */}
      <SettingsSection title="Source & Content Mode" icon={<Shield className="w-5 h-5 text-accent-emerald" />} delay={0.25}>
        <ToggleRow label="Source mode" options={[
          { value: 'strict', label: 'Strict (Notes Only)' },
          { value: 'enriched', label: 'Notes + Enrichment' },
          { value: 'notes-only', label: 'Notes Structure Only' },
        ]} value={settings.sourceMode} onChange={v => onUpdate({ sourceMode: v as UserSettings['sourceMode'] })} />
        <p className="text-xs text-text-muted mt-1 px-1">
          Strict mode only uses your uploaded material. Enriched mode adds trusted external explanations.
        </p>
      </SettingsSection>

      {/* Study Goals */}
      <SettingsSection title="Study Goals" icon={<Calendar className="w-5 h-5 text-accent-rose" />} delay={0.3}>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-text-secondary block mb-1">Daily study goal</label>
            <div className="flex items-center gap-3">
              {[15, 30, 45, 60, 90].map(m => (
                <button key={m} onClick={() => onUpdate({ dailyGoalMinutes: m })}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    settings.dailyGoalMinutes === m ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30' : 'border border-border-subtle text-text-tertiary'
                  )}>{m}m</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Exam date</label>
            <input type="date" value={settings.examDate || ''} onChange={e => onUpdate({ examDate: e.target.value })}
              className="px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-brand-500/50" />
          </div>
        </div>
      </SettingsSection>

      {/* AI / LLM */}
      <SettingsSection title="AI & LLM" icon={<Brain className="w-5 h-5 text-brand-400" />} delay={0.32}>
        <div>
          <label className="text-xs text-text-secondary block mb-2">OpenAI API key (stored locally in browser)</label>
          <input
            type="password"
            value={settings.openaiApiKey ?? ''}
            onChange={(e) => onUpdate({ openaiApiKey: e.target.value || undefined })}
            placeholder="sk-… or set VITE_OPENAI_API_KEY at build time"
            className="w-full px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-brand-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-2">Model</label>
          <input
            type="text"
            value={settings.llmModel ?? 'gpt-4o-mini'}
            onChange={(e) => onUpdate({ llmModel: e.target.value || undefined })}
            className="w-full px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-brand-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-2">API base URL (optional, for OpenAI-compatible proxies)</label>
          <input
            type="url"
            value={settings.llmBaseUrl ?? ''}
            onChange={(e) => onUpdate({ llmBaseUrl: e.target.value || undefined })}
            placeholder="https://api.openai.com/v1"
            className="w-full px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-brand-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-2">Managed proxy URL (keeps the API key off the browser)</label>
          <input
            type="url"
            value={settings.llmProxyUrl ?? ''}
            onChange={(e) => onUpdate({ llmProxyUrl: e.target.value || undefined })}
            placeholder="https://your-proxy.example.com/v1"
            className="w-full px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-brand-500/50"
          />
          <p className="text-[11px] text-text-muted mt-1.5">When set, chat & embeddings route here with no browser key — the proxy injects the secret server-side and can meter managed (paid) usage.</p>
        </div>
        <ToggleRow label="Use LLM for Agent & Feynman" options={[
          { value: 'true', label: 'Enabled' },
          { value: 'false', label: 'Offline only' },
        ]} value={settings.useLlm !== false ? 'true' : 'false'} onChange={v => onUpdate({ useLlm: v === 'true' })} />
        <p className="text-xs text-text-muted mt-1 px-1">
          Without a key, Agent and Feynman use offline templates. Keys never leave your browser except to your chosen API endpoint.
        </p>
      </SettingsSection>

      <SettingsSection title="Account & Sync" icon={<KeyRound className="w-5 h-5 text-accent-teal" />} delay={0.34}>
        {settings.authToken && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs px-2 py-1 rounded-lg bg-surface-hover border border-border-subtle">
              Plan: <strong className="text-brand-300">{settings.authPlan ?? 'free'}</strong>
            </span>
            {(settings.authPlan ?? 'free') === 'free' && (
              <>
                <button
                  type="button"
                  data-testid="upgrade-pro"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white"
                  onClick={() => void startCheckout('pro')}
                >
                  Upgrade to Pro
                </button>
                <button
                  type="button"
                  data-testid="upgrade-team"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-brand-500/40 text-brand-300"
                  onClick={() => void startCheckout('team')}
                >
                  Upgrade to Team
                </button>
              </>
            )}
            {onRefreshPlan && (
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle text-text-secondary"
                onClick={async () => {
                  try {
                    await onRefreshPlan();
                    setAuthStatus('Plan refreshed from server');
                  } catch (e) {
                    setAuthStatus(e instanceof Error ? e.message : 'Refresh failed');
                  }
                }}
              >
                Refresh plan
              </button>
            )}
          </div>
        )}
        <div>
          <label className="text-xs text-text-secondary block mb-2">Proxy base URL (auth + library sync)</label>
          <input
            type="url"
            value={settings.authProxyBase ?? settings.llmProxyUrl?.replace(/\/v1\/?$/, '') ?? ''}
            onChange={(e) => onUpdate({ authProxyBase: e.target.value || undefined })}
            placeholder="http://localhost:8787"
            className="w-full px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email"
            className="px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm"
          />
          <input
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password"
            className="px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white"
            onClick={async () => {
              try {
                const session = await authLogin(authEmail, authPassword, settings);
                await finishAuth(session, 'Signed in as');
              } catch (e) {
                setAuthStatus(e instanceof Error ? e.message : 'Login failed');
              }
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm font-medium border border-border-subtle"
            onClick={async () => {
              try {
                const session = await authRegister(authEmail, authPassword, settings);
                await finishAuth(session, 'Registered');
              } catch (e) {
                setAuthStatus(e instanceof Error ? e.message : 'Register failed');
              }
            }}
          >
            Register
          </button>
          {settings.authToken && (
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium border border-border-subtle"
              onClick={() => onUpdate({ authToken: undefined, authEmail: undefined, authPlan: undefined })}
            >
              Sign out
            </button>
          )}
          {settings.authToken && onPullLibrary && (
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium border border-border-subtle"
              onClick={async () => {
                try {
                  await onPullLibrary();
                  setAuthStatus('Library pulled from server');
                } catch (e) {
                  setAuthStatus(e instanceof Error ? e.message : 'Pull failed');
                }
              }}
            >
              Pull library
            </button>
          )}
          {settings.authToken && (
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium border border-accent-teal/40 text-accent-teal"
              onClick={async () => {
                try {
                  const lib = loadLibrarySync();
                  await pushRemoteLibrary(settings.authToken!, settings, lib);
                  setAuthStatus('Library synced to server');
                } catch (e) {
                  setAuthStatus(e instanceof Error ? e.message : 'Sync failed');
                }
              }}
            >
              Push library
            </button>
          )}
          {settings.authToken && onPullSession && (
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium border border-border-subtle"
              onClick={async () => {
                try {
                  await onPullSession();
                  setAuthStatus('Progress pulled from server');
                } catch (e) {
                  setAuthStatus(e instanceof Error ? e.message : 'Session pull failed');
                }
              }}
            >
              Pull progress
            </button>
          )}
          {settings.authToken && onPushSession && (
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium border border-accent-teal/40 text-accent-teal"
              onClick={async () => {
                try {
                  await onPushSession();
                  setAuthStatus('Progress synced to server');
                } catch (e) {
                  setAuthStatus(e instanceof Error ? e.message : 'Session push failed');
                }
              }}
            >
              Push progress
            </button>
          )}
        </div>
        {settings.authEmail && (
          <p className="text-xs text-text-secondary">Logged in: {settings.authEmail}</p>
        )}
        {authStatus && <p className="text-xs text-text-muted">{authStatus}</p>}
      </SettingsSection>

      {/* Interface */}
      <SettingsSection title="Interface" icon={<Palette className="w-5 h-5 text-brand-300" />} delay={0.35}>
        <ToggleRow label="Theme" options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
          { value: 'system', label: 'System' },
        ]} value={settings.theme} onChange={v => onUpdate({ theme: v as UserSettings['theme'] })} />
        <ToggleRow label="Language" options={[
          { value: 'en', label: 'English' },
          { value: 'el', label: 'Ελληνικά' },
        ]} value={settings.language} onChange={v => onUpdate({ language: v as UserSettings['language'] })} />
      </SettingsSection>

      {/* Data management */}
      <SettingsSection title="Data & Progress" icon={<Database className="w-5 h-5 text-accent-cyan" />} delay={0.38}>
        <ToggleRow label="Demo showcase content" options={[
          { value: 'off', label: 'Hidden' },
          { value: 'on', label: 'Show demo' },
        ]} value={settings.showDemoContent ? 'on' : 'off'} onChange={v => onUpdate({ showDemoContent: v === 'on' })} />
        <p className="text-[11px] text-text-muted">When hidden, only courses and tasks from your uploaded notes appear. Reload after toggling.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { downloadBackup(); setBackupStatus('Backup downloaded.'); }}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30"
          >
            Export backup
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-border-subtle text-text-secondary hover:border-brand-500/30"
          >
            Import backup
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear all Synapse local data? This cannot be undone.')) {
                const n = clearAllSessionData();
                setBackupStatus(`Cleared ${n} stored items. Reload recommended.`);
              }
            }}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-accent-rose/30 text-accent-rose hover:bg-accent-rose/10"
          >
            Clear local data
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
        />
        {backupStatus && (
          <p className="text-xs text-text-secondary px-1">{backupStatus}</p>
        )}
      </SettingsSection>
      </div>

      <div className="p-4 rounded-xl bg-surface-card border border-border-subtle">
        <p className="text-xs text-text-tertiary leading-relaxed flex items-start gap-2">
          <Zap className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
          These are your UI preferences. The adaptive engine also learns from your behavior — response time, accuracy, confidence calibration, error patterns, help-seeking rate, and retention over time. It adjusts independently of these settings.
        </p>
      </div>
    </div>
  );
}

function SettingsSection({ title, icon, children, delay }: { title: string; icon: React.ReactNode; children: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl border border-border-subtle bg-surface-card p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">{icon}{title}</h3>
      <div className="space-y-4">{children}</div>
    </motion.div>
  );
}

function ToggleRow({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-text-secondary block mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              value === opt.value ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30' : 'border border-border-subtle text-text-tertiary hover:text-text-secondary'
            )}>{opt.label}</button>
        ))}
      </div>
    </div>
  );
}

function SliderRow({ label, leftLabel, rightLabel, value, onChange, min = 0, max = 100 }: { label: string; leftLabel: string; rightLabel: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="text-xs text-text-secondary block mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-text-muted w-20 text-right">{leftLabel}</span>
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1" />
        <span className="text-[10px] text-text-muted w-20">{rightLabel}</span>
      </div>
    </div>
  );
}
