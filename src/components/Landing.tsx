import { motion } from 'framer-motion';
import {
  Upload, BookOpen, Brain, Zap, BarChart3, Target, Clock,
  Sparkles, ChevronRight, GraduationCap, Users, Building2,
  ArrowRight, Check, Star
} from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
}

const features = [
  { icon: Upload, title: 'Upload Anything', desc: 'PDFs, slides, notes, images, code files, lecture transcripts — the AI handles it all.', color: 'text-brand-400' },
  { icon: Brain, title: 'AI Course Generation', desc: 'Automatically extracts topics, concepts, prerequisites, and builds a structured learning path.', color: 'text-accent-teal' },
  { icon: Target, title: 'Adaptive Tutoring', desc: 'The system learns how you learn — adjusting pace, depth, and practice based on real behavior.', color: 'text-accent-cyan' },
  { icon: Zap, title: 'Interactive Practice', desc: 'Quizzes, coding challenges, Socratic dialogues, exam simulations, and problem-solving loops.', color: 'text-accent-amber' },
  { icon: Clock, title: 'Spaced Repetition', desc: 'Scientifically-timed reviews based on your forgetting curve and retention predictions.', color: 'text-accent-emerald' },
  { icon: BarChart3, title: 'Learning Analytics', desc: 'See mastery maps, weak spots, error patterns, misconceptions, and predicted retention.', color: 'text-accent-rose' },
];

const userTypes = [
  { icon: GraduationCap, label: 'University Students', desc: 'Turn lecture notes into exam-ready courses' },
  { icon: BookOpen, label: 'High School Students', desc: 'Structured tutoring and exam preparation' },
  { icon: Sparkles, label: 'Self-Learners', desc: 'Learn anything from your own materials' },
  { icon: Users, label: 'Tutors & Teachers', desc: 'Generate interactive lessons instantly' },
  { icon: Building2, label: 'Companies', desc: 'Transform manuals into training modules' },
];

const steps = [
  { num: '01', title: 'Upload Your Material', desc: 'Drop your notes, PDFs, slides, or paste any content.' },
  { num: '02', title: 'AI Analyzes & Structures', desc: 'Topics, concepts, prerequisites, gaps — all extracted automatically.' },
  { num: '03', title: 'Learn Interactively', desc: 'Step-by-step lessons, practice, quizzes, and Socratic tutoring.' },
  { num: '04', title: 'Adapt & Master', desc: 'The platform discovers how you learn and optimizes your path.' },
];

export function Landing({ onGetStarted }: LandingProps) {
  return (
    <div className="min-h-screen bg-surface-primary overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-text-primary">Synapse</span>
            </div>
            <button
              onClick={onGetStarted}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium text-sm transition-all"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-[128px] animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-teal/15 rounded-full blur-[128px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-cyan/10 rounded-full blur-[160px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              AI-Powered Adaptive Learning Platform
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-black leading-tight mb-6"
          >
            From Static Notes to{' '}
            <span className="gradient-text">Adaptive Tutoring</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            Upload your notes, PDFs, or slides. The AI builds a personalized interactive
            tutor-course — then discovers how you actually learn through your behavior,
            errors, and progress.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              onClick={onGetStarted}
              className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white rounded-xl font-semibold text-lg transition-all glow-brand"
            >
              Start Learning Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 px-8 py-4 border border-border-default hover:border-brand-500/50 text-text-primary rounded-xl font-semibold text-lg transition-all hover:bg-surface-hover"
            >
              See Demo
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12 flex flex-wrap justify-center gap-6 text-text-tertiary text-sm"
          >
            {['No credit card required', 'Works with any subject', 'Source-grounded AI'].map(item => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-accent-emerald" />
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* User Types */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-3">
            {userTypes.map((ut, i) => (
              <motion.div
                key={ut.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border-subtle bg-surface-card hover:border-brand-500/40 transition-all cursor-default group"
              >
                <ut.icon className="w-4 h-4 text-brand-400 group-hover:text-brand-300" />
                <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary">{ut.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">Four simple steps from raw material to mastery</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 * i }}
                className="relative p-6 rounded-2xl border border-border-subtle bg-surface-card hover:border-brand-500/40 transition-all group"
              >
                <div className="text-5xl font-black text-brand-500/20 group-hover:text-brand-500/30 transition-colors mb-4">{step.num}</div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-6 text-border-default">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-secondary/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need to Master Any Subject</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">Powered by cognitive science, not gimmicks</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className="p-6 rounded-2xl border border-border-subtle bg-surface-card hover:border-brand-500/30 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiation */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Not Just Another AI Chat</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">Synapse doesn't guess how you learn. It discovers it through your behavior.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { wrong: '❌ Fixed "learning styles" (visual/auditory)', right: '✅ Evidence-based adaptive model from real behavior' },
              { wrong: '❌ Generic AI chat with no structure', right: '✅ Full interactive course with mastery tracking' },
              { wrong: '❌ Flashcards only or summaries only', right: '✅ Lessons, quizzes, practice, Socratic tutoring, exam prep' },
              { wrong: '❌ Hallucinated content without sources', right: '✅ Source-grounded with citation verification' },
              { wrong: '❌ One-size-fits-all pacing', right: '✅ Adapts difficulty, depth, and pace to your errors' },
              { wrong: '❌ Passive reading without recall', right: '✅ Anti-passive learning with active recall prompts' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                className="p-4 rounded-xl border border-border-subtle bg-surface-card">
                <p className="text-xs text-text-muted mb-2">{item.wrong}</p>
                <p className="text-sm font-medium text-accent-emerald">{item.right}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-accent-amber fill-accent-amber" />
            ))}
          </div>
          <blockquote className="text-xl sm:text-2xl font-medium text-text-primary mb-6 leading-relaxed">
            "I uploaded my entire semester's notes and Synapse turned them into an interactive course 
            that actually taught me better than re-reading ever could. I went from a C to an A."
          </blockquote>
          <div className="text-text-secondary">
            <span className="font-medium text-text-primary">Sarah K.</span> · Economics Major, University of Amsterdam
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative p-8 sm:p-12 rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-950 to-surface-card overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-[80px]" />
            <div className="relative text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Transform How You Learn?</h2>
              <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
                Upload your first document and experience AI-powered adaptive tutoring in minutes.
              </p>
              <button
                onClick={onGetStarted}
                className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-600 to-accent-teal text-white rounded-xl font-semibold text-lg transition-all hover:shadow-lg hover:shadow-brand-500/25"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-accent-teal flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-text-secondary">Synapse</span>
          </div>
          <p className="text-text-tertiary text-sm">
            © 2026 Synapse Learning. From static notes to adaptive tutoring.
          </p>
        </div>
      </footer>
    </div>
  );
}
