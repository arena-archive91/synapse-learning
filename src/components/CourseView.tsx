import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Clock, BarChart3, Calendar, FileText,
  Lock, CheckCircle2, Circle, ChevronRight, Brain, Target,
  AlertTriangle, Sparkles, Play, MapPin, Network
} from 'lucide-react';
import type { Course, Topic } from '../types';
import { cn } from '../utils/cn';
import { ConceptGraph } from './visuals/ConceptGraph';
import { ProgressTimeline } from './visuals/DiagramGenerator';
import { ReadinessRing } from './visuals/ReadinessRing';

interface CourseViewProps {
  course: Course;
  onBack: () => void;
  onStartLesson: () => void;
  onOpenAgent: () => void;
}

type CourseTab = 'path' | 'map' | 'sources' | 'analytics';

export function CourseView({ course, onBack, onStartLesson, onOpenAgent }: CourseViewProps) {
  const [tab, setTab] = useState<CourseTab>('path');
  const progress = (course.completedLessons / Math.max(course.totalLessons, 1)) * 100;

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="text-4xl">{course.icon}</div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{course.title}</h1>
              <p className="text-text-secondary mt-1 text-sm max-w-xl">{course.description}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-text-tertiary">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {course.totalLessons} lessons
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {course.estimatedHours}h estimated
                </span>
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3.5 h-3.5" />
                  {course.mastery}% mastery
                </span>
                {course.examDate && (
                  <span className="flex items-center gap-1 text-accent-amber">
                    <Calendar className="w-3.5 h-3.5" />
                    Exam: {new Date(course.examDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={onOpenAgent}
              className="flex items-center gap-2 px-4 py-2.5 border border-border-default hover:border-brand-500/30 rounded-xl text-sm font-medium transition-all"
            >
              <Sparkles className="w-4 h-4 text-brand-400" />
              Ask Agent
            </button>
            <button
              onClick={onStartLesson}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl text-sm font-medium hover:from-brand-500 hover:to-brand-400 transition-all"
            >
              <Play className="w-4 h-4" />
              Continue
            </button>
          </div>
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border-subtle bg-surface-card p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Course Progress</span>
          <span className="text-sm text-text-secondary">{course.completedLessons}/{course.totalLessons} lessons</span>
        </div>
        <div className="w-full bg-surface-hover rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, backgroundColor: course.color }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-tertiary">
          <span>{Math.round(progress)}% complete</span>
          <span>~{Math.round(course.estimatedHours * (1 - progress / 100))}h remaining</span>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border-subtle">
          <div className="text-center"><p className="text-lg font-bold">{course.conceptCount}</p><p className="text-[10px] text-text-muted">Concepts</p></div>
          <div className="text-center"><p className="text-lg font-bold">{course.glossaryCount}</p><p className="text-[10px] text-text-muted">Glossary</p></div>
          <div className="text-center"><p className="text-lg font-bold">{course.exerciseCount}</p><p className="text-[10px] text-text-muted">Exercises</p></div>
          <div className="text-center"><p className="text-lg font-bold capitalize text-xs">{course.sourceMode}</p><p className="text-[10px] text-text-muted">Source Mode</p></div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border-subtle">
        {[
          { key: 'path' as CourseTab, label: 'Learning Path', icon: MapPin },
          { key: 'map' as CourseTab, label: 'Concept Map', icon: Network },
          { key: 'sources' as CourseTab, label: 'Source Files', icon: FileText },
          { key: 'analytics' as CourseTab, label: 'Analytics', icon: BarChart3 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'pb-3 text-sm font-medium transition-all border-b-2 flex items-center gap-1.5',
              tab === t.key
                ? 'text-brand-400 border-brand-400'
                : 'text-text-tertiary border-transparent hover:text-text-secondary'
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'path' && (
        <div className="space-y-4">
          {course.topics.map((topic, i) => (
            <TopicCard key={topic.id} topic={topic} index={i} courseColor={course.color} onStart={onStartLesson} />
          ))}
          {course.topics.length === 0 && (
            <div className="text-center py-16">
              <Brain className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary">Course is being generated... Topics will appear soon.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'map' && <ConceptMap course={course} />}
      {tab === 'sources' && <SourceFiles course={course} />}
      {tab === 'analytics' && <CourseAnalytics course={course} />}
    </div>
  );
}

function TopicCard({ topic, index, courseColor, onStart }: { topic: Topic; index: number; courseColor: string; onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-2xl border bg-surface-card overflow-hidden transition-all',
        topic.isLocked ? 'border-border-subtle opacity-60' : 'border-border-subtle hover:border-brand-500/20'
      )}
    >
      <div className="flex items-center gap-4 p-5">
        <div className="relative">
          {topic.isLocked ? (
            <div className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center">
              <Lock className="w-5 h-5 text-text-muted" />
            </div>
          ) : topic.mastery >= 90 ? (
            <div className="w-10 h-10 rounded-xl bg-accent-emerald/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-accent-emerald" />
            </div>
          ) : topic.mastery > 0 ? (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: courseColor + '15' }}>
              <Circle className="w-5 h-5" style={{ color: courseColor }} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center">
              <Circle className="w-5 h-5 text-text-muted" />
            </div>
          )}
          <span className="absolute -top-1 -left-1 text-[10px] font-bold text-text-muted">{index + 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{topic.title}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">{topic.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
            <span>{topic.estimatedMinutes}m</span>
            <span>{topic.lessons.length || '3-5'} lessons</span>
            {topic.prerequisites.length > 0 && (
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {topic.prerequisites.length} prereq
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!topic.isLocked && (
            <>
              <div className="hidden sm:block w-20">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-muted">Mastery</span>
                  <span className="font-medium">{topic.mastery}%</span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${topic.mastery}%`,
                      backgroundColor: topic.mastery >= 80 ? '#34d399' : courseColor
                    }}
                  />
                </div>
              </div>
              <button
                onClick={onStart}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-text-tertiary" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ConceptMap({ course }: { course: Course }) {
  const topics = course.topics.filter(t => !t.isLocked);
  // Generate graph nodes from topics
  const graphNodes = topics.map((t, i) => ({
    id: t.id, label: t.title, mastery: t.mastery,
    type: 'concept' as const,
    x: 100 + (i % 3) * 200, y: 80 + Math.floor(i / 3) * 140,
  }));
  const graphEdges = topics.flatMap(t => t.prerequisites.map(p => ({
    from: p, to: t.id, relation: 'prerequisite' as const,
  }))).filter(e => graphNodes.some(n => n.id === e.from));

  return (
    <div className="space-y-6">
      {graphNodes.length > 0 && (
        <ConceptGraph nodes={graphNodes} edges={graphEdges} width={640} height={Math.max(280, Math.ceil(topics.length / 3) * 140 + 80)} />
      )}

      <ProgressTimeline
        title="Learning Milestones"
        milestones={topics.map(t => ({
          label: t.title,
          completed: t.mastery >= 80,
          date: t.mastery >= 80 ? 'Mastered' : `${t.mastery}% progress`,
          xp: t.mastery >= 80 ? t.estimatedMinutes * 2 : undefined,
        }))}
      />

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5 flex items-center justify-center">
        <ReadinessRing value={course.mastery} size={160} label="Course Readiness" sublabel="Based on weighted concept mastery across all topics" />
      </div>
    </div>
  );
}

function SourceFiles({ course }: { course: Course }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-400" />
        Source Files
      </h3>
      <div className="space-y-2">
        {course.sourceFiles.map((file, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-primary/50 border border-border-subtle">
            <FileText className="w-5 h-5 text-text-tertiary shrink-0" />
            <span className="text-sm font-medium flex-1">{file}</span>
            <span className="text-xs text-text-muted">Analyzed</span>
          </div>
        ))}
      </div>
      <div className="mt-4 p-4 rounded-xl bg-surface-hover/50 border border-border-subtle">
        <p className="text-xs text-text-tertiary mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-accent-amber" />
          Source Analysis Report
        </p>
        <ul className="text-xs text-text-secondary space-y-1">
          <li>• All content is source-grounded from your uploaded materials</li>
          <li>• 2 possible gaps detected in welfare economics coverage</li>
          <li>• No contradictions found between sources</li>
          <li>• External enrichment available for 4 topics</li>
        </ul>
      </div>
    </div>
  );
}

function CourseAnalytics({ course }: { course: Course }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h4 className="text-sm font-semibold mb-3">Study Time Distribution</h4>
        <div className="space-y-2">
          {course.topics.slice(0, 5).map(topic => (
            <div key={topic.id} className="flex items-center gap-2">
              <span className="text-xs text-text-secondary w-24 truncate">{topic.title}</span>
              <div className="flex-1 bg-surface-hover rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-brand-500"
                  style={{ width: `${Math.random() * 80 + 20}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h4 className="text-sm font-semibold mb-3">Retention Predictions</h4>
        <div className="space-y-2">
          {course.topics.filter(t => t.mastery > 0).slice(0, 5).map(topic => {
            const retention = Math.max(20, topic.mastery - Math.random() * 20);
            return (
              <div key={topic.id} className="flex items-center justify-between">
                <span className="text-xs text-text-secondary truncate w-24">{topic.title}</span>
                <span className={cn(
                  'text-xs font-medium',
                  retention >= 70 ? 'text-accent-emerald' : retention >= 50 ? 'text-accent-amber' : 'text-accent-rose'
                )}>
                  {Math.round(retention)}% predicted
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5 sm:col-span-2">
        <h4 className="text-sm font-semibold mb-3">Learning Velocity</h4>
        <p className="text-xs text-text-secondary mb-4">How quickly you're acquiring new concepts relative to baseline</p>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-accent-emerald">1.15×</div>
          <div>
            <p className="text-sm font-medium">Above average pace</p>
            <p className="text-xs text-text-tertiary">You learn 15% faster than the baseline for this difficulty level</p>
          </div>
        </div>
      </div>
    </div>
  );
}
