import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, TrendingUp, Clock, Target, AlertTriangle, BarChart3,
  Zap, Calendar, CheckCircle2, XCircle, Lightbulb,
  Activity, Shield, Eye, HelpCircle
} from 'lucide-react';
import type { LearnerModel, DashboardStats, Course, ActivityItem } from '../types';
import { computeCalibration, type PrerequisiteRepair } from '../lib/pedagogy';
import {
  adaptiveRecommendations,
  retentionCurveFromActivities,
  weeklyMasteryFromActivities,
} from '../lib/retentionAnalytics';
import { CalibrationChip } from './visuals/CalibrationChip';
import { cn } from '../utils/cn';
import { ReadinessRing } from './visuals/ReadinessRing';
import { RetentionCurve } from './visuals/DiagramGenerator';
import { ConceptGraph } from './visuals/ConceptGraph';

interface AnalyticsProps {
  learnerModel: LearnerModel;
  stats: DashboardStats;
  courses: Course[];
  activities?: ActivityItem[];
  prerequisiteRepairs?: PrerequisiteRepair[];
}

type AnalyticsTab = 'overview' | 'mastery' | 'behavior' | 'insights';

type GraphNode = {
  id: string;
  label: string;
  mastery: number;
  type: 'concept' | 'formula' | 'definition' | 'theory';
  x: number;
  y: number;
};
type GraphEdge = { from: string; to: string; relation: 'prerequisite' | 'related' | 'contrasts' | 'example-of' };

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'n';

function classifyNode(label: string): GraphNode['type'] {
  const lower = label.toLowerCase();
  if (/(formula|equation|=|theorem|law of)/.test(lower)) return 'formula';
  if (/(definition|defined|is the|means)/.test(lower)) return 'definition';
  if (/(theory|model|principle)/.test(lower)) return 'theory';
  return 'concept';
}

/** Lay out N nodes on a circle inside the SVG viewport. */
function radialLayout(count: number, width: number, height: number): { x: number; y: number }[] {
  if (count === 0) return [];
  if (count === 1) return [{ x: width / 2, y: height / 2 }];
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 60;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

/**
 * Build a concept-mastery graph from the learner's actual data:
 *   - Nodes from course topics (with their mastery), plus learner skill nodes if not already present.
 *   - Prerequisite edges from each topic's `prerequisites` field, resolving by title similarity.
 *   - Falls back to an empty graph when there is no real data.
 */
function buildMasteryGraph(
  learnerModel: LearnerModel,
  courses: Course[],
): { nodes: GraphNode[]; edges: GraphEdge[]; height: number } {
  const generated = courses.filter((c) => c.status !== 'generating');
  const skills = [
    ...learnerModel.strongAreas,
    ...learnerModel.almostKnown,
    ...learnerModel.weakAreas,
  ];
  const labelToId = new Map<string, string>();
  const items: { label: string; mastery: number }[] = [];

  for (const c of generated) {
    for (const t of c.topics) {
      const key = t.title.trim();
      if (!key || labelToId.has(key.toLowerCase())) continue;
      const id = `t-${slug(key)}`;
      labelToId.set(key.toLowerCase(), id);
      items.push({ label: key, mastery: Math.round(t.mastery) });
    }
  }
  for (const s of skills) {
    const key = s.concept.trim();
    if (!key || labelToId.has(key.toLowerCase())) continue;
    const id = `s-${slug(key)}`;
    labelToId.set(key.toLowerCase(), id);
    items.push({ label: key, mastery: Math.round(s.mastery) });
  }

  if (items.length === 0) return { nodes: [], edges: [], height: 380 };

  const width = 660;
  const height = Math.max(380, 200 + items.length * 18);
  const positions = radialLayout(items.length, width, height);
  const nodes: GraphNode[] = items.map((it, i) => ({
    id: labelToId.get(it.label.toLowerCase())!,
    label: it.label,
    mastery: it.mastery,
    type: classifyNode(it.label),
    x: positions[i]!.x,
    y: positions[i]!.y,
  }));

  const edges: GraphEdge[] = [];
  for (const c of generated) {
    for (const t of c.topics) {
      const toId = labelToId.get(t.title.toLowerCase());
      if (!toId) continue;
      for (const pre of t.prerequisites ?? []) {
        const fromId = labelToId.get(pre.toLowerCase());
        if (fromId && fromId !== toId) edges.push({ from: fromId, to: toId, relation: 'prerequisite' });
      }
    }
  }
  return { nodes, edges, height };
}

export function Analytics({
  learnerModel,
  stats,
  courses,
  activities = [],
  prerequisiteRepairs = [],
}: AnalyticsProps) {
  const [tab, setTab] = useState<AnalyticsTab>('overview');

  return (
    <div className="p-4 sm:p-6 lg:px-8 pb-24 lg:pb-6 w-full min-w-0 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold">Learning Analytics</h1>
        <p className="text-text-secondary mt-1">Your adaptive learner profile — built from real behavior, not assumptions</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border-subtle" role="tablist" aria-label="Analytics sections">
        {([
          { key: 'overview' as AnalyticsTab, label: 'Overview', icon: BarChart3 },
          { key: 'mastery' as AnalyticsTab, label: 'Mastery Map', icon: Brain },
          { key: 'behavior' as AnalyticsTab, label: 'Behavior', icon: Activity },
          { key: 'insights' as AnalyticsTab, label: 'AI Insights', icon: Lightbulb },
        ]).map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn('pb-3 text-sm font-medium transition-all border-b-2 flex items-center gap-1.5',
              tab === t.key ? 'text-brand-400 border-brand-400' : 'text-text-tertiary border-transparent hover:text-text-secondary'
            )}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab learnerModel={learnerModel} stats={stats} courses={courses} activities={activities} />
      )}
      {tab === 'mastery' && <MasteryTab learnerModel={learnerModel} courses={courses} />}
      {tab === 'behavior' && <BehaviorTab learnerModel={learnerModel} />}
      {tab === 'insights' && (
        <InsightsTab learnerModel={learnerModel} activities={activities} repairs={prerequisiteRepairs} />
      )}
    </div>
  );
}

function OverviewTab({
  learnerModel,
  stats,
  courses,
  activities,
}: {
  learnerModel: LearnerModel;
  stats: DashboardStats;
  courses: Course[];
  activities: ActivityItem[];
}) {
  const calibration = computeCalibration(learnerModel.confidenceCalibration);
  const retentionPoints = retentionCurveFromActivities(activities);
  const weekly = learnerModel.weeklyMastery.some((v) => v > 0)
    ? learnerModel.weeklyMastery
    : weeklyMasteryFromActivities(activities);
  const hasRetentionData = activities.some(
    (a) => a.type === 'quiz_passed' || a.type === 'quiz_failed' || a.type === 'review_done',
  );
  return (
    <div className="space-y-6">
      {calibration && (
        <CalibrationChip score={calibration.score} direction={calibration.direction} />
      )}
      {/* Readiness Ring + Retention Curve */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-6 flex items-center justify-center">
          <ReadinessRing value={learnerModel.overallMastery} size={200} sublabel="Derived from graded first-attempts only — never from self-reported skill." />
        </div>
        <RetentionCurve dataPoints={hasRetentionData ? retentionPoints : [{ day: 0, retention: 100 }]} />
      </motion.div>

      {/* Metrics */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={<Brain className="w-5 h-5 text-brand-400" />} label="Overall Mastery" value={`${learnerModel.overallMastery}%`} sub={`${stats.conceptsMastered}/${stats.totalConcepts} concepts`} />
        <MetricCard icon={<Clock className="w-5 h-5 text-accent-teal" />} label="Total Study Time" value={`${Math.round(learnerModel.totalStudyTime / 60)}h`} sub={`${learnerModel.totalSessions} sessions`} />
        <MetricCard icon={<Target className="w-5 h-5 text-accent-cyan" />} label="Retention Rate" value={`${Math.round(learnerModel.retentionRate * 100)}%`} sub="7-day recall" />
        <MetricCard icon={<Zap className="w-5 h-5 text-accent-amber" />} label="Learning Velocity" value={`${learnerModel.learningVelocity}×`} sub="vs baseline" />
      </motion.div>

      {/* Weekly mastery + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-accent-emerald" />Weekly Mastery Trend</h3>
          <div className="flex items-end gap-1.5 h-28">
            {weekly.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-text-muted font-medium">{val}%</span>
                <div className="w-full rounded-t transition-all duration-500" style={{ height: `${val * 1.2}%`, backgroundColor: i === weekly.length - 1 ? '#818cf8' : 'var(--viz-track)' }} />
                <span className="text-[9px] text-text-muted">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Study Heatmap */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-accent-teal" />Study Heatmap (90 days)</h3>
          <div className="grid grid-cols-[repeat(13,1fr)] gap-[3px]">
            {learnerModel.heatmapData.slice(-91).map((day, i) => {
              const intensity = day.minutes === 0 ? 0 : day.minutes < 15 ? 1 : day.minutes < 30 ? 2 : day.minutes < 60 ? 3 : 4;
              const colors = ['bg-surface-hover', 'bg-brand-900', 'bg-brand-700', 'bg-brand-500', 'bg-brand-400'];
              return (
                <div key={i} className={cn('w-full aspect-square rounded-[2px]', colors[intensity])} title={`${day.date}: ${day.minutes}m`} />
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-1 mt-2 text-[9px] text-text-muted">
            <span>Less</span>
            {['bg-surface-hover', 'bg-brand-900', 'bg-brand-700', 'bg-brand-500', 'bg-brand-400'].map((c, i) => (
              <div key={i} className={cn('w-2.5 h-2.5 rounded-[2px]', c)} />
            ))}
            <span>More</span>
          </div>
        </motion.div>
      </div>

      {/* Confidence Calibration */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Eye className="w-4 h-4 text-accent-amber" />Confidence Calibration</h3>
        <p className="text-xs text-text-tertiary mb-4">How well does your predicted confidence match actual performance?</p>
        <div className="space-y-2">
          {learnerModel.confidenceCalibration.map((point, i) => {
            const gap = Math.abs(point.predicted - point.actual);
            const overconfident = point.predicted > point.actual;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-text-secondary w-28 truncate">{point.concept}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 relative h-6 bg-surface-hover rounded-lg overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-brand-500/30 rounded-lg" style={{ width: `${point.predicted * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-accent-emerald/40 rounded-lg" style={{ width: `${point.actual * 100}%` }} />
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-medium">
                      <span className="text-brand-300">You: {Math.round(point.predicted * 100)}%</span>
                      <span className="text-accent-emerald">Actual: {Math.round(point.actual * 100)}%</span>
                    </div>
                  </div>
                </div>
                <span className={cn('text-[10px] font-medium w-20 text-right', gap > 0.2 ? (overconfident ? 'text-accent-rose' : 'text-accent-amber') : 'text-accent-emerald')}>
                  {gap > 0.2 ? (overconfident ? '⚠ Overconfident' : '↑ Underconfident') : '✓ Calibrated'}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Course mastery */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h3 className="text-sm font-semibold mb-4">Course Mastery</h3>
        <div className="space-y-3">
          {courses.filter(c => c.status !== 'generating').map(course => (
            <div key={course.id} className="flex items-center gap-3">
              <span className="text-lg">{course.icon}</span>
              <span className="text-sm text-text-secondary w-36 truncate">{course.title}</span>
              <div className="flex-1 bg-surface-hover rounded-full h-2.5">
                <div className="h-2.5 rounded-full transition-all" style={{ width: `${course.mastery}%`, backgroundColor: course.color }} />
              </div>
              <span className="text-xs font-medium w-10 text-right">{course.mastery}%</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function MasteryTab({ learnerModel, courses }: { learnerModel: LearnerModel; courses: Course[] }) {
  const graph = buildMasteryGraph(learnerModel, courses);
  return (
    <div className="space-y-6">
      {/* Concept Graph */}
      {graph.nodes.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <ConceptGraph
            nodes={graph.nodes}
            edges={graph.edges}
            width={660}
            height={Math.max(380, graph.height)}
          />
        </motion.div>
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-8 text-center text-sm text-text-secondary">
          Upload your notes and complete a few activities to see your concept mastery map.
        </div>
      )}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><CheckCircle2 className="w-4 h-4 text-accent-emerald" />Strong Areas</h3>
        <div className="space-y-3">
          {learnerModel.strongAreas.map(a => (
            <SkillBar key={a.concept} concept={a.concept} mastery={a.mastery} retention={a.retentionPrediction} count={a.practiceCount} color="emerald" />
          ))}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><XCircle className="w-4 h-4 text-accent-rose" />Weak Areas</h3>
        <div className="space-y-3">
          {learnerModel.weakAreas.map(a => (
            <SkillBar key={a.concept} concept={a.concept} mastery={a.mastery} retention={a.retentionPrediction} count={a.practiceCount} color="rose" />
          ))}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-accent-amber/20 bg-accent-amber/5 p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><AlertTriangle className="w-4 h-4 text-accent-amber" />Almost Known — Needs 1-2 More Practice</h3>
        <div className="space-y-3">
          {learnerModel.almostKnown.map(a => (
            <SkillBar key={a.concept} concept={a.concept} mastery={a.mastery} retention={a.retentionPrediction} count={a.practiceCount} color="amber" />
          ))}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Brain className="w-4 h-4 text-accent-rose" />Active Misconceptions</h3>
        <div className="space-y-3">
          {learnerModel.misconceptions.map(m => (
            <div key={m.id} className="p-3 rounded-xl bg-accent-rose/5 border border-accent-rose/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-accent-rose">{m.concept}</span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', m.corrected ? 'bg-accent-emerald/10 text-accent-emerald' : 'bg-accent-rose/10 text-accent-rose')}>
                  {m.corrected ? 'Corrected' : 'Active'}
                </span>
              </div>
              <p className="text-xs text-text-secondary">{m.description}</p>
              <p className="text-[10px] text-accent-teal mt-1.5 flex items-center gap-1"><Zap className="w-3 h-3" />{m.suggestedFix}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
    </div>
  );
}

function BehaviorTab({ learnerModel }: { learnerModel: LearnerModel }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={<Clock className="w-5 h-5 text-text-tertiary" />} label="Avg Session" value={`${learnerModel.averageSessionLength}m`} sub="preferred length" />
        <MetricCard icon={<Target className="w-5 h-5 text-text-tertiary" />} label="Confidence" value={`${Math.round(learnerModel.averageConfidence * 100)}%`} sub="avg self-rating" />
        <MetricCard icon={<HelpCircle className="w-5 h-5 text-text-tertiary" />} label="Help-Seeking" value={`${Math.round(learnerModel.helpSeekingRate * 100)}%`} sub="hint usage" />
        <MetricCard icon={<Shield className="w-5 h-5 text-text-tertiary" />} label="Persistence" value={`${Math.round(learnerModel.persistenceScore * 100)}%`} sub="retry rate" />
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><AlertTriangle className="w-4 h-4 text-accent-orange" />Error Patterns</h3>
        <div className="space-y-3">
          {learnerModel.errorPatterns.map((p, i) => (
            <div key={i} className="p-4 rounded-xl bg-surface-primary/50 border border-border-subtle">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{p.type}</span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize',
                  p.category === 'calculation' ? 'bg-accent-amber/10 text-accent-amber' :
                  p.category === 'conceptual' ? 'bg-accent-rose/10 text-accent-rose' :
                  'bg-accent-cyan/10 text-accent-cyan'
                )}>{p.category}</span>
              </div>
              <p className="text-xs text-text-tertiary">{p.frequency} occurrences across: {p.concepts.join(', ')}</p>
              <p className="text-xs text-accent-teal mt-1.5 flex items-center gap-1"><Zap className="w-3 h-3" />{p.suggestedRemedy}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h3 className="text-sm font-semibold mb-4">Adaptive Model Variables</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Retrieval Performance', value: `${Math.round(learnerModel.retrievalPerformance * 100)}%` },
            { label: 'Transfer Ability', value: `${Math.round(learnerModel.transferAbility * 100)}%` },
            { label: 'Cognitive Load Pref.', value: learnerModel.cognitiveLoadPreference },
            { label: 'Best Study Time', value: learnerModel.bestTimeOfDay },
            { label: 'Learning Velocity', value: `${learnerModel.learningVelocity}×` },
            { label: 'Streak Days', value: `${learnerModel.streakDays}` },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl bg-surface-primary/50 border border-border-subtle text-center">
              <p className="text-[10px] text-text-muted mb-1">{item.label}</p>
              <p className="text-sm font-semibold capitalize">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-4 leading-relaxed">
          Your learner model tracks: prior knowledge, mastery level, retrieval performance, response latency, confidence calibration, error types, cognitive load, spacing intervals, help-seeking behavior, persistence, misconceptions, transfer ability, and retention decay.
        </p>
      </motion.div>
    </div>
  );
}

function InsightsTab({
  learnerModel,
  activities,
  repairs,
}: {
  learnerModel: LearnerModel;
  activities: ActivityItem[];
  repairs: PrerequisiteRepair[];
}) {
  const tips = adaptiveRecommendations(learnerModel, activities, repairs);
  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Lightbulb className="w-4 h-4 text-brand-400" />What We've Learned About Your Learning</h3>
        <p className="text-xs text-text-tertiary mb-4">These insights are discovered from your behavior — not declared by you.</p>
        <div className="space-y-3">
          {(learnerModel.interactionInsights.length > 0 ? learnerModel.interactionInsights : tips.slice(0, 2)).map((insight, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-start gap-3 p-3 rounded-xl bg-surface-card border border-border-subtle">
              <div className="w-6 h-6 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb className="w-3 h-3 text-brand-400" />
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{insight}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h3 className="text-sm font-semibold mb-3">Adaptive Recommendations</h3>
        <div className="space-y-2 text-sm text-text-secondary">
          {tips.length > 0 ? tips.map((tip, i) => (
            <p key={i}>• {tip}</p>
          )) : (
            <p>Complete lessons and reviews from your uploaded material to unlock personalized recommendations.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="p-4 rounded-xl border border-border-subtle bg-surface-card">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-text-tertiary font-medium">{label}</span></div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>
    </div>
  );
}

function SkillBar({ concept, mastery, retention, count, color }: { concept: string; mastery: number; retention: number; count: number; color: string }) {
  const barColor = color === 'emerald' ? 'bg-accent-emerald' : color === 'rose' ? 'bg-accent-rose' : 'bg-accent-amber';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium">{concept}</span>
        <span className={cn('text-xs font-medium', `text-accent-${color}`)}>{mastery}%</span>
      </div>
      <div className="w-full bg-surface-hover rounded-full h-2">
        <div className={cn('h-2 rounded-full transition-all', barColor)} style={{ width: `${Math.max(mastery, 3)}%` }} />
      </div>
      <div className="flex gap-3 mt-1 text-[10px] text-text-muted">
        <span>Retention: {Math.round(retention * 100)}%</span>
        <span>Practiced {count}×</span>
      </div>
    </div>
  );
}
