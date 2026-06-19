import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, BookOpen, Sparkles, Users, Building2,
  ArrowRight, ArrowLeft, Upload, Target, Brain,
  Calendar, Clock, CheckCircle2
} from 'lucide-react';
import { cn } from '../utils/cn';

interface OnboardingProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'role' | 'goals' | 'preferences' | 'upload';

const roles = [
  { id: 'university', icon: GraduationCap, label: 'University Student', desc: 'Exam preparation from lecture materials' },
  { id: 'highschool', icon: BookOpen, label: 'High School Student', desc: 'Structured learning and exam prep' },
  { id: 'selflearner', icon: Sparkles, label: 'Self-Learner', desc: 'Learn any subject at your own pace' },
  { id: 'tutor', icon: Users, label: 'Tutor / Teacher', desc: 'Create interactive lessons for students' },
  { id: 'company', icon: Building2, label: 'Company / Training', desc: 'Transform documents into training' },
];

const goals = [
  { id: 'exam', label: 'Pass an upcoming exam', icon: '🎯' },
  { id: 'understand', label: 'Deeply understand material', icon: '🧠' },
  { id: 'review', label: 'Quick review & revision', icon: '⚡' },
  { id: 'practice', label: 'Get more practice problems', icon: '💪' },
  { id: 'organize', label: 'Organize & structure my notes', icon: '📚' },
  { id: 'explore', label: 'Explore a new subject', icon: '🔍' },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [dailyTime, setDailyTime] = useState(30);

  const stepIndex = ['welcome', 'role', 'goals', 'preferences', 'upload'].indexOf(step);
  const progress = ((stepIndex + 1) / 5) * 100;

  const next = () => {
    const steps: Step[] = ['welcome', 'role', 'goals', 'preferences', 'upload'];
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  };
  const prev = () => {
    const steps: Step[] = ['welcome', 'role', 'goals', 'preferences', 'upload'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-surface-primary flex flex-col">
      {/* Progress */}
      <div className="h-1 bg-surface-hover">
        <div className="h-1 bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold">Welcome to Synapse</h1>
                <p className="text-text-secondary leading-relaxed max-w-md mx-auto">
                  Let's personalize your learning experience. This takes about 60 seconds.
                  The adaptive engine will also learn from your behavior over time.
                </p>
                <button onClick={next} className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-medium hover:from-brand-500 hover:to-brand-400 transition-all">
                  Let's Go <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {step === 'role' && (
              <motion.div key="role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">How will you use Synapse?</h2>
                  <p className="text-text-secondary mt-1 text-sm">This helps us set up the right defaults</p>
                </div>
                <div className="space-y-2">
                  {roles.map(role => (
                    <button key={role.id} onClick={() => setSelectedRole(role.id)}
                      className={cn('w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                        selectedRole === role.id ? 'border-brand-500/50 bg-brand-500/10' : 'border-border-subtle hover:border-brand-500/20'
                      )}>
                      <role.icon className={cn('w-6 h-6', selectedRole === role.id ? 'text-brand-400' : 'text-text-tertiary')} />
                      <div>
                        <p className="font-medium text-sm">{role.label}</p>
                        <p className="text-xs text-text-tertiary">{role.desc}</p>
                      </div>
                      {selectedRole === role.id && <CheckCircle2 className="w-5 h-5 text-brand-400 ml-auto" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'goals' && (
              <motion.div key="goals" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">What are your goals?</h2>
                  <p className="text-text-secondary mt-1 text-sm">Select all that apply</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {goals.map(goal => (
                    <button key={goal.id} onClick={() => toggleGoal(goal.id)}
                      className={cn('p-4 rounded-xl border transition-all text-left',
                        selectedGoals.includes(goal.id) ? 'border-brand-500/50 bg-brand-500/10' : 'border-border-subtle hover:border-brand-500/20'
                      )}>
                      <span className="text-xl mb-2 block">{goal.icon}</span>
                      <p className="text-sm font-medium">{goal.label}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'preferences' && (
              <motion.div key="prefs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">Quick Preferences</h2>
                  <p className="text-text-secondary mt-1 text-sm">You can change these anytime in settings</p>
                </div>
                <div className="space-y-5">
                  <div className="p-4 rounded-xl border border-border-subtle">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-text-tertiary" />
                      <span className="text-sm font-medium">Daily study goal</span>
                    </div>
                    <div className="flex gap-2">
                      {[15, 30, 45, 60, 90].map(m => (
                        <button key={m} onClick={() => setDailyTime(m)}
                          className={cn('flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                            dailyTime === m ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30' : 'border border-border-subtle text-text-tertiary'
                          )}>{m}m</button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-border-subtle">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-text-tertiary" />
                      <span className="text-sm font-medium">Upcoming exam?</span>
                    </div>
                    <input type="date" className="px-4 py-2 rounded-xl bg-surface-input border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-brand-500/50" />
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover/50 text-xs text-text-muted flex items-start gap-2">
                    <Brain className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                    The adaptive engine will also learn from your behavior — response time, accuracy, confidence, error patterns — to optimize your path automatically.
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold">You're All Set! 🎉</h2>
                <p className="text-text-secondary leading-relaxed max-w-md mx-auto">
                  Upload your first document to generate an interactive course, or explore the dashboard first.
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={onComplete} className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-medium hover:from-brand-500 hover:to-brand-400 transition-all">
                    <Upload className="w-4 h-4" /> Upload My First Material
                  </button>
                  <button onClick={onComplete} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                    Skip — explore the demo first
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 flex items-center justify-between max-w-lg mx-auto w-full">
        {stepIndex > 0 ? (
          <button onClick={prev} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"><ArrowLeft className="w-4 h-4" /> Back</button>
        ) : <div />}
        {step !== 'upload' && step !== 'welcome' && (
          <button onClick={next} className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-all">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
