import { motion } from 'framer-motion';
import {
  Brain, BookOpen, Target, Zap,
  Gauge, Shield, Calendar, Palette
} from 'lucide-react';
import type { UserSettings } from '../types';
import { cn } from '../utils/cn';

interface SettingsProps {
  settings: UserSettings;
  onUpdate: (partial: Partial<UserSettings>) => void;
}

export function Settings({ settings, onUpdate }: SettingsProps) {
  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold">Learning Preferences</h1>
        <p className="text-text-secondary mt-1">Customize how Synapse teaches you. These are UI preferences — the adaptive engine also learns from your behavior.</p>
      </motion.div>

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
