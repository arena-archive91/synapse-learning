import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./utils/cn";

// Advanced visual components
import { BayesianMasteryPosterior } from "./advanced-visuals/BayesianMastery";
import { ForgettingCurveSimulator } from "./advanced-visuals/ForgettingCurve";
import { InteractiveKnowledgeGraph } from "./advanced-visuals/KnowledgeGraph";
import { ConfidenceCalibrationScatter } from "./advanced-visuals/ConfidenceCalibration";

export type Lang = "en" | "el";

// ═══════════════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ToolTab = 
  | "leitner" | "heatmap" | "sankey" | "timeline" | "colorcode" | "treemap" | "compare" | "waterfall" 
  | "radar" | "feynman" | "errorlog" | "pomodoro"
  | "bayesian" | "forgetting" | "knowledgegraph" | "calibration";

type LeitnerCard = { id: string; front: string; back: string; box: number; correct: number; total: number; streak: number; lastReview: number; nextDue: number };
type HeatmapCell = { concept: string; day: number; value: number };
type SankeyLink = { from: string; to: string; value: number; color: string };
type TimelineEvent = { id: string; day: number; label: string; type: "lesson" | "quiz" | "review" | "error" | "mastery"; detail: string; delta: number };
type TreemapBlock = { id: string; label: string; value: number; mastery: number; tone: string; prereqs: string[] };
type CompareItem = { dim: string; left: string; right: string; tip: string };
type WaterfallStep = { label: string; delta: number; note: string; type: "gain" | "loss" | "neutral" };
type RadarAxis = { label: string; value: number; max: number };

// ═══════════════════════════════════════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════════════════════════════════════

const LEITNER_INITIAL: LeitnerCard[] = [
  { id: "c1", front: "What is a reference point?", back: "The starting benchmark against which gains and losses are evaluated.", box: 1, correct: 0, total: 0, streak: 0, lastReview: 0, nextDue: 0 },
  { id: "c2", front: "Define loss aversion", back: "Losses are psychologically weighted more heavily than equivalent gains.", box: 1, correct: 1, total: 2, streak: 0, lastReview: 1, nextDue: 1 },
  { id: "c3", front: "What is anchoring?", back: "Judgment is biased toward an initial value or piece of information.", box: 2, correct: 2, total: 3, streak: 2, lastReview: 2, nextDue: 4 },
  { id: "c4", front: "Explain framing effect", back: "The way options are presented can change the decision without changing the facts.", box: 3, correct: 3, total: 3, streak: 3, lastReview: 3, nextDue: 7 },
  { id: "c5", front: "What is choice architecture?", back: "The design of the environment in which people make decisions.", box: 2, correct: 2, total: 4, streak: 1, lastReview: 2, nextDue: 4 },
  { id: "c6", front: "Bias vs heuristic?", back: "A heuristic is a mental shortcut. A bias is a systematic deviation.", box: 1, correct: 0, total: 1, streak: 0, lastReview: 1, nextDue: 1 },
  { id: "c7", front: "Prospect theory vs expected utility", back: "Prospect theory adds reference dependence, loss aversion, and probability weighting.", box: 4, correct: 4, total: 4, streak: 4, lastReview: 5, nextDue: 12 },
  { id: "c8", front: "What is bounded rationality?", back: "Decision-makers have limited information, time, and cognitive capacity.", box: 5, correct: 5, total: 5, streak: 5, lastReview: 7, nextDue: 21 },
  { id: "c9", front: "Explain the endowment effect", back: "People value things they own more than identical things they don't own.", box: 1, correct: 0, total: 0, streak: 0, lastReview: 0, nextDue: 0 },
  { id: "c10", front: "What is status quo bias?", back: "Tendency to prefer the current state of affairs and resist change.", box: 2, correct: 1, total: 2, streak: 1, lastReview: 3, nextDue: 5 },
];

const CONCEPTS = ["Reference point", "Loss aversion", "Anchoring", "Framing", "Choice arch.", "Bias vs heuristic"];

const heatmapData: HeatmapCell[] = CONCEPTS.flatMap((concept, ci) =>
  Array.from({ length: 21 }, (_, day) => ({
    concept, day,
    value: Math.max(0, Math.min(100, 25 + ci * 9 + Math.sin(day * 0.6 + ci * 1.2) * 18 + day * 2.8 + (day > 10 ? 8 : 0))),
  }))
);

const sankeyLinks: SankeyLink[] = [
  { from: "Upload", to: "OCR / Parse", value: 100, color: "#67e8f9" },
  { from: "OCR / Parse", to: "Chunk & Embed", value: 96, color: "#a78bfa" },
  { from: "Chunk & Embed", to: "Extract concepts", value: 92, color: "#a78bfa" },
  { from: "Extract concepts", to: "Generate lesson", value: 88, color: "#6ee7b7" },
  { from: "Generate lesson", to: "Quiz attempt", value: 80, color: "#fbbf24" },
  { from: "Quiz attempt", to: "Correct 1st", value: 52, color: "#6ee7b7" },
  { from: "Quiz attempt", to: "Wrong 1st", value: 28, color: "#f87171" },
  { from: "Correct 1st", to: "Mastered", value: 38, color: "#67e8f9" },
  { from: "Correct 1st", to: "Review queue", value: 14, color: "#fbbf24" },
  { from: "Wrong 1st", to: "Error diagnosis", value: 28, color: "#f87171" },
  { from: "Error diagnosis", to: "Retry queue", value: 22, color: "#fbbf24" },
  { from: "Error diagnosis", to: "Prereq repair", value: 6, color: "#a78bfa" },
  { from: "Prereq repair", to: "Generate lesson", value: 6, color: "#6ee7b7" },
  { from: "Retry queue", to: "Quiz attempt", value: 18, color: "#fbbf24" },
];

const timelineEvents: TimelineEvent[] = [
  { id: "t1", day: 0, label: "Uploaded lecture notes", type: "lesson", detail: "82 slides, 14 concepts extracted", delta: 0 },
  { id: "t2", day: 1, label: "First quiz — 4/8 correct", type: "quiz", detail: "Anchoring and framing were confused", delta: -12 },
  { id: "t3", day: 2, label: "Review: loss aversion", type: "review", detail: "Spaced recall at optimal interval", delta: 6 },
  { id: "t4", day: 3, label: "Error: bias vs heuristic", type: "error", detail: "Collapsed the two; needs a counterexample", delta: -8 },
  { id: "t5", day: 4, label: "Mastered: reference point", type: "mastery", detail: "3 correct first-attempts in a row", delta: 14 },
  { id: "t6", day: 5, label: "Review: anchoring + framing", type: "review", detail: "Side-by-side comparison helped", delta: 8 },
  { id: "t7", day: 7, label: "Retry quiz — 6/8 correct", type: "quiz", detail: "Still slow on framing vs anchoring", delta: 4 },
  { id: "t8", day: 9, label: "Mastered: anchoring", type: "mastery", detail: "Consistent under transfer questions", delta: 12 },
  { id: "t9", day: 11, label: "Spaced review session", type: "review", detail: "Forgetting curve flattened", delta: 5 },
  { id: "t10", day: 14, label: "Exam simulation — 82%", type: "quiz", detail: "Time pressure practice completed", delta: 10 },
];

const treemapBlocks: TreemapBlock[] = [
  { id: "b1", label: "Reference point", value: 18, mastery: 85, tone: "cyan", prereqs: [] },
  { id: "b2", label: "Loss aversion", value: 22, mastery: 62, tone: "violet", prereqs: ["Reference point"] },
  { id: "b3", label: "Anchoring", value: 16, mastery: 74, tone: "amber", prereqs: [] },
  { id: "b4", label: "Framing effect", value: 20, mastery: 48, tone: "emerald", prereqs: ["Reference point", "Anchoring"] },
  { id: "b5", label: "Choice architecture", value: 14, mastery: 56, tone: "cyan", prereqs: ["Framing effect", "Loss aversion"] },
  { id: "b6", label: "Bias vs heuristic", value: 10, mastery: 38, tone: "rose", prereqs: [] },
];

const compareItems: CompareItem[] = [
  { dim: "Definition", left: "Judgment pulled toward an initial value", right: "Identical options presented differently change choice", tip: "Exams test whether you can name the mechanism, not just the label." },
  { dim: "Mechanism", left: "Starting number narrows the estimate", right: "Context shifts perception of gain or loss", tip: "Draw a short causal chain to show the step that matters." },
  { dim: "Example", left: "Salary negotiation starts at a high offer", right: "90% fat-free vs 10% fat changes preference", tip: "Pick your own example and explain why the mechanism fits." },
  { dim: "Common mistake", left: "Thinking it only applies to numbers", right: "Thinking it is just about wording", tip: "Write a sentence that shows why the mistake is wrong." },
  { dim: "Exam tip", left: "Name the anchor and the direction of bias", right: "Name the frame and what shifted", tip: "Practice writing 3-sentence exam answers under time pressure." },
  { dim: "Prerequisite", left: "None — standalone concept", right: "Reference point must be understood first", tip: "If you can't explain the prerequisite, go back before going forward." },
];

const waterfallSteps: WaterfallStep[] = [
  { label: "Initial quiz", delta: 42, note: "Baseline after the first lesson", type: "neutral" },
  { label: "Worked examples", delta: 14, note: "Two guided walkthroughs with source citations", type: "gain" },
  { label: "Quiz errors", delta: -9, note: "Framing and bias questions were wrong", type: "loss" },
  { label: "Error repair", delta: 11, note: "Misconception corrected with a counterexample", type: "gain" },
  { label: "Spaced review", delta: 7, note: "Interval-based recall at optimal spacing", type: "gain" },
  { label: "Transfer test", delta: -5, note: "New context — only partial success", type: "loss" },
  { label: "Interleaving", delta: 4, note: "Mixed concept practice reduced interference", type: "gain" },
  { label: "Exam simulation", delta: 8, note: "Timed practice under pressure", type: "gain" },
];

const radarAxes: RadarAxis[] = [
  { label: "Retrieval", value: 72, max: 100 },
  { label: "Transfer", value: 48, max: 100 },
  { label: "Speed", value: 55, max: 100 },
  { label: "Confidence", value: 64, max: 100 },
  { label: "Depth", value: 78, max: 100 },
  { label: "Retention", value: 60, max: 100 },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const toolTabs: { id: ToolTab; label: string; desc: string; icon: string }[] = [
  { id: "leitner", label: "Leitner Box", desc: "5-box spaced-repetition with FSRS scheduling", icon: "📦" },
  { id: "heatmap", label: "Mastery Heatmap", desc: "Concept × day color matrix over 21 days", icon: "🟩" },
  { id: "sankey", label: "Knowledge Flow", desc: "Upload → mastery pipeline with error loops", icon: "🔀" },
  { id: "timeline", label: "Learning Timeline", desc: "Events, errors, breakthroughs, and delta", icon: "📅" },
  { id: "colorcode", label: "Color System", desc: "Emphatic color coding for cognitive load", icon: "🎨" },
  { id: "treemap", label: "Concept Treemap", desc: "Area = exam weight, color = mastery depth", icon: "🗺️" },
  { id: "compare", label: "Side-by-Side", desc: "Structured concept comparison with exam tips", icon: "⚖️" },
  { id: "waterfall", label: "Mastery Waterfall", desc: "Step-by-step mastery gain and loss chart", icon: "📊" },
  { id: "radar", label: "Skill Radar", desc: "Multi-axis learner profile at a glance", icon: "🕸️" },
  { id: "feynman", label: "Feynman Check", desc: "Explain it simply — AI finds the gaps", icon: "💬" },
  { id: "errorlog", label: "Error Notebook", desc: "Persistent mistake log with root cause", icon: "📕" },
  { id: "pomodoro", label: "Study Timer", desc: "Pomodoro + adaptive session control", icon: "⏱️" },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdvancedVisualToolsSection({ lang = "en" as Lang }: { lang?: Lang }) {
  const [activeTab, setActiveTab] = useState<ToolTab>("leitner");

  // Bilingual helper — English terminology is always preserved (e.g. "Leitner Box / Κουτί Leitner")
  const tv = (en: string, el: string) => (lang === "en" ? en : `${en} / ${el}`);

  const t = (key: string) => {
    const map: Record<string, { en: string; el: string }> = {
      title: { en: "Advanced visual learning tools", el: "Προηγμένα οπτικά εργαλεία μάθησης" },
      desc: { en: "Patterns, graphs, shapes, and emphatic colors that make learning visible", el: "Μοτίβα, γραφήματα, σχήματα και έντονα χρώματα που κάνουν τη μάθηση ορατή" },
      leitner: { en: "Leitner Box", el: "Leitner Box / Κουτί Leitner" },
      heatmap: { en: "Mastery Heatmap", el: "Mastery Heatmap / Χάρτης Κατοχής" },
      sankey: { en: "Knowledge Flow", el: "Knowledge Flow / Ροή Γνώσης" },
      timeline: { en: "Learning Timeline", el: "Learning Timeline / Χρονολόγιο Μάθησης" },
      colorcode: { en: "Color System", el: "Color System / Σύστημα Χρωμάτων" },
      treemap: { en: "Concept Treemap", el: "Concept Treemap / Χάρτης Εννοιών" },
      compare: { en: "Side-by-Side", el: "Side-by-Side / Σύγκριση" },
      waterfall: { en: "Mastery Waterfall", el: "Mastery Waterfall / Καταρράκτης Κατοχής" },
      radar: { en: "Skill Radar", el: "Skill Radar / Ραντάρ Δεξιοτήτων" },
      feynman: { en: "Feynman Check", el: "Feynman Check / Έλεγχος Feynman" },
      errorlog: { en: "Error Notebook", el: "Error Notebook / Τετράδιο Λαθών" },
      pomodoro: { en: "Study Timer", el: "Study Timer / Χρονόμετρο Μελέτης" },
    };
    return map[key]?.[lang] ?? map[key]?.en ?? key;
  };

  return (
    <section className="py-6">
      <Panel>
        <Eyebrow>Advanced visual learning tools</Eyebrow>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Patterns, graphs, shapes, and emphatic colors that make learning visible
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Every visual is driven by the learner model. Color coding reduces cognitive load, shapes reveal structure, and interactive diagrams turn passive reading into active manipulation.
        </p>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {toolTabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={cn("group min-w-[12rem] shrink-0 rounded-2xl border px-4 py-3 text-left transition-all duration-300",
                activeTab === tab.id ? "border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_24px_rgba(103,232,249,0.08)]" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
              )}>
              <div className="flex items-center gap-2">
                <span className="text-base">{tab.icon}</span>
                <span className="text-sm font-semibold text-white">{tab.label}</span>
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{tab.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 motion-safe:animate-[fadeUp_0.4s_ease-out]" key={activeTab}>
          {activeTab === "leitner" && <LeitnerBoxTool />}
          {activeTab === "heatmap" && <MasteryHeatmap />}
          {activeTab === "sankey" && <KnowledgeFlowSankey />}
          {activeTab === "timeline" && <LearningTimeline />}
          {activeTab === "colorcode" && <ColorCodingSystem />}
          {activeTab === "treemap" && <ConceptTreemap />}
          {activeTab === "compare" && <SideBySideCompare />}
          {activeTab === "waterfall" && <MasteryWaterfall />}
          {activeTab === "radar" && <SkillRadar />}
          {activeTab === "feynman" && <FeynmanCheck />}
           {activeTab === "errorlog" && <ErrorNotebook />}
           {activeTab === "pomodoro" && <StudyTimer />}
           {activeTab === "bayesian" && <BayesianMasteryPosterior alpha={4.2} beta={2.8} label="Loss Aversion (Beta Posterior)" evidence={7} />}
           {activeTab === "forgetting" && <ForgettingCurveSimulator />}
           {activeTab === "knowledgegraph" && <InteractiveKnowledgeGraph />}
           {activeTab === "calibration" && <ConfidenceCalibrationScatter />}
         </div>
      </Panel>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1. LEITNER BOX — FSRS-aware spaced repetition with animated card movement
// ═══════════════════════════════════════════════════════════════════════════════

function LeitnerBoxTool() {
  const [cards, setCards] = useState(LEITNER_INITIAL);
  const [flipped, setFlipped] = useState<string | null>(null);
  const [filterBox, setFilterBox] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(60);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const boxes = useMemo(() => {
    const g: Record<number, LeitnerCard[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const c of cards) g[c.box]?.push(c);
    return g;
  }, [cards]);

  const stats = useMemo(() => {
    const total = cards.length;
    const mastered = cards.filter((c) => c.box >= 4).length;
    const dueNow = cards.filter((c) => c.nextDue <= 0).length;
    const accuracy = cards.reduce((s, c) => s + c.correct, 0) / Math.max(1, cards.reduce((s, c) => s + c.total, 0));
    return { total, mastered, dueNow, accuracy: Math.round(accuracy * 100) };
  }, [cards]);

  const boxMeta = [
    null,
    { label: "New / Wrong", schedule: "Every session", color: "border-rose-400/30 bg-rose-500/15", dot: "bg-rose-400", glow: "shadow-rose-500/8" },
    { label: "Learning", schedule: "Every 2 days", color: "border-amber-400/30 bg-amber-500/15", dot: "bg-amber-400", glow: "shadow-amber-500/8" },
    { label: "Reviewing", schedule: "Every 4 days", color: "border-sky-400/30 bg-sky-500/15", dot: "bg-sky-400", glow: "shadow-sky-500/8" },
    { label: "Almost known", schedule: "Every week", color: "border-emerald-400/30 bg-emerald-500/15", dot: "bg-emerald-400", glow: "shadow-emerald-500/8" },
    { label: "Mastered", schedule: "Every 2+ weeks", color: "border-cyan-400/30 bg-cyan-500/15", dot: "bg-cyan-400", glow: "shadow-cyan-500/8" },
  ];

  const promote = (id: string) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, box: Math.min(5, c.box + 1), correct: c.correct + 1, total: c.total + 1, streak: c.streak + 1, lastReview: 0, nextDue: Math.pow(2, c.box) } : c));
    setFlipped(null);
    setLastAction(`✓ Card promoted — confidence ${confidence}%`);
  };

  const demote = (id: string) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, box: 1, total: c.total + 1, streak: 0, lastReview: 0, nextDue: 0 } : c));
    setFlipped(null);
    setLastAction("✗ Card returned to Box 1 for immediate review");
  };

  const visible = filterBox != null ? (boxes[filterBox] ?? []) : cards;

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
      {/* Sidebar: boxes + stats */}
      <div className="space-y-4">
        <SubTitle icon="📦" title="Leitner spaced repetition" />
        <p className="text-sm leading-6 text-slate-300">Cards move forward when correct and fall back to Box 1 when wrong. Each box has a longer review interval based on FSRS spacing.</p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2">
          {([["Due now", stats.dueNow], ["Mastered", stats.mastered], ["Total", stats.total], ["Accuracy", `${stats.accuracy}%`]] as const).map(([label, value]) => (
            <MiniStat key={label} label={label} value={String(value)} />
          ))}
        </div>

        {/* Box buttons */}
        <div className="space-y-2">
          {([1, 2, 3, 4, 5] as const).map((box) => {
            const meta = boxMeta[box]!;
            const count = boxes[box]?.length ?? 0;
            return (
              <button key={box} type="button" onClick={() => setFilterBox(filterBox === box ? null : box)}
                className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-300", meta.color, filterBox === box && `ring-2 ring-white/20 ${meta.glow}`)}>
                <div className={cn("h-3 w-3 rounded-full", meta.dot)} />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold text-white">Box {box} — {meta.label}</span><span className="text-xs text-slate-400">{count}</span></div>
                  <div className="text-[10px] text-slate-500">{meta.schedule}</div>
                </div>
                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-white/40 transition-all duration-500" style={{ width: `${(count / Math.max(1, cards.length)) * 100}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        {lastAction && <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-xs text-slate-300">{lastAction}</div>}
      </div>

      {/* Card grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.28em] text-slate-500">{filterBox != null ? `Box ${filterBox}` : "All cards"} — {visible.length} cards</span>
          {filterBox != null && <button onClick={() => setFilterBox(null)} className="text-xs text-cyan-200 hover:underline">Show all</button>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((card) => {
            const isFlipped = flipped === card.id;
            const meta = boxMeta[card.box]!;
            return (
              <div key={card.id} onClick={() => setFlipped(isFlipped ? null : card.id)}
                className={cn("group cursor-pointer rounded-[26px] border p-4 transition-all duration-500 hover:shadow-lg", meta.color, isFlipped && "ring-2 ring-cyan-300/25")}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold text-white", card.box <= 2 ? "bg-rose-500/30" : card.box <= 3 ? "bg-amber-500/30" : "bg-emerald-500/30")}>Box {card.box}</span>
                  <span className="text-slate-500">{card.correct}/{card.total} · streak {card.streak}</span>
                </div>
                <div className="mt-3 min-h-[70px]">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{isFlipped ? "Answer" : "Question"}</div>
                  <p className="mt-1 text-sm leading-6 text-white">{isFlipped ? card.back : card.front}</p>
                </div>
                {isFlipped && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Confidence:</span>
                      <input type="range" min={10} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-300" />
                      <span className="text-xs font-semibold text-cyan-200">{confidence}%</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); promote(card.id); }} className="flex-1 rounded-xl bg-emerald-500/20 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30">✓ Correct</button>
                      <button onClick={(e) => { e.stopPropagation(); demote(card.id); }} className="flex-1 rounded-xl bg-rose-500/20 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/30">✗ Wrong</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  2. MASTERY HEATMAP — 21-day concept × day color-encoded matrix
// ═══════════════════════════════════════════════════════════════════════════════

function MasteryHeatmap() {
  const days = Array.from({ length: 21 }, (_, i) => i);
  const [hover, setHover] = useState<HeatmapCell | null>(null);

  const bandColor = (v: number) => (v >= 80 ? "#6ee7b7" : v >= 60 ? "#67e8f9" : v >= 40 ? "#fbbf24" : "#f87171");

  return (
    <div className="space-y-4">
      <SubTitle icon="🟩" title="Mastery heatmap — 21-day window" />
      <p className="text-sm leading-6 text-slate-300">Each cell encodes mastery for one concept on one day. Green = strong, cyan = proficient, amber = developing, red = weak. Hover for detail.</p>

      {hover && (
        <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: bandColor(hover.value) }} />
          <span className="font-semibold text-white">{hover.concept}</span>
          <span className="text-slate-400">Day {hover.day}</span>
          <span className="font-semibold text-cyan-200">{Math.round(hover.value)}%</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
        <div className="min-w-[700px]">
          <div className="mb-2 flex"><div className="w-28 shrink-0" />{days.map((d) => <div key={d} className="flex-1 text-center text-[9px] text-slate-600">{d}</div>)}</div>
          {CONCEPTS.map((concept) => (
            <div key={concept} className="mb-1 flex items-center">
              <div className="w-28 shrink-0 truncate pr-2 text-xs text-slate-300">{concept}</div>
              {days.map((day) => {
                const cell = heatmapData.find((c) => c.concept === concept && c.day === day);
                const v = cell?.value ?? 0;
                return (
                  <div key={day} className="flex flex-1 justify-center px-px">
                    <div className="h-5 w-full max-w-[28px] rounded-[5px] transition-all duration-150 hover:scale-125 hover:ring-2 hover:ring-white/30"
                      style={{ backgroundColor: bandColor(v), opacity: 0.3 + (v / 100) * 0.7 }}
                      onMouseEnter={() => cell && setHover(cell)} onMouseLeave={() => setHover(null)} />
                  </div>
                );
              })}
            </div>
          ))}
          <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-400">
            {[["Weak", "#f87171"], ["Developing", "#fbbf24"], ["Proficient", "#67e8f9"], ["Strong", "#6ee7b7"]].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: c }} />{l}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  3. KNOWLEDGE FLOW SANKEY — full pipeline with error loops
// ═══════════════════════════════════════════════════════════════════════════════

function KnowledgeFlowSankey() {
  const nodeNames = [...new Set(sankeyLinks.flatMap((l) => [l.from, l.to]))];
  const colMap: Record<string, number> = {};
  const order = ["Upload", "OCR / Parse", "Chunk & Embed", "Extract concepts", "Generate lesson", "Quiz attempt", "Correct 1st", "Wrong 1st", "Mastered", "Review queue", "Error diagnosis", "Retry queue", "Prereq repair"];
  order.forEach((name, i) => { colMap[name] = i; });
  const maxCol = order.length - 1;

  const ySlots: Record<string, number> = {
    "Upload": 50, "OCR / Parse": 50, "Chunk & Embed": 50, "Extract concepts": 50,
    "Generate lesson": 42, "Quiz attempt": 42,
    "Correct 1st": 28, "Wrong 1st": 65,
    "Mastered": 20, "Review queue": 42, "Error diagnosis": 65, "Retry queue": 52, "Prereq repair": 78,
  };

  return (
    <div className="space-y-4">
      <SubTitle icon="🔀" title="Knowledge flow — from upload to mastery" />
      <p className="text-sm leading-6 text-slate-300">This Sankey diagram shows the complete pipeline with error diagnosis, prerequisite repair, and retry loops. Line thickness = volume of learner activity.</p>

      <div className="overflow-x-auto rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
        <svg viewBox="0 0 1000 240" className="h-[300px] w-full min-w-[700px]">
          {sankeyLinks.map((link) => {
            const x1 = (colMap[link.from] ?? 0) / maxCol * 920 + 40;
            const x2 = (colMap[link.to] ?? 0) / maxCol * 920 + 40;
            const y1 = (ySlots[link.from] ?? 50) / 100 * 220;
            const y2 = (ySlots[link.to] ?? 50) / 100 * 220;
            const thickness = Math.max(2.5, link.value / 12);
            return <path key={`${link.from}-${link.to}`} d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`} fill="none" stroke={link.color} strokeWidth={thickness} strokeOpacity={0.4} strokeLinecap="round" />;
          })}
          {nodeNames.map((name) => {
            const cx = (colMap[name] ?? 0) / maxCol * 920 + 40;
            const cy = (ySlots[name] ?? 50) / 100 * 220;
            const col = name.includes("Wrong") || name.includes("Error") ? "#f87171" : name.includes("Mastered") ? "#6ee7b7" : name.includes("Retry") || name.includes("Review") ? "#fbbf24" : "#67e8f9";
            return (
              <g key={name}>
                <circle cx={cx} cy={cy} r="16" fill={col} opacity={0.18} />
                <circle cx={cx} cy={cy} r="8" fill={col} opacity={0.85} />
                <text x={cx} y={cy + 28} textAnchor="middle" className="fill-white text-[9px] font-medium">{name}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  4. LEARNING TIMELINE — events with delta bars
// ═══════════════════════════════════════════════════════════════════════════════

function LearningTimeline() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const typeStyle: Record<string, { border: string; bg: string; text: string; icon: string }> = {
    lesson: { border: "border-cyan-400/30", bg: "bg-cyan-400/12", text: "text-cyan-100", icon: "📖" },
    quiz: { border: "border-violet-400/30", bg: "bg-violet-400/12", text: "text-violet-100", icon: "✏️" },
    review: { border: "border-emerald-400/30", bg: "bg-emerald-400/12", text: "text-emerald-100", icon: "🔄" },
    error: { border: "border-rose-400/30", bg: "bg-rose-400/12", text: "text-rose-100", icon: "⚠️" },
    mastery: { border: "border-amber-400/30", bg: "bg-amber-400/12", text: "text-amber-100", icon: "✅" },
  };

  return (
    <div className="space-y-4">
      <SubTitle icon="📅" title="Learning timeline — 14-day history" />
      <p className="text-sm leading-6 text-slate-300">Each event shows what happened, why it mattered, and how much mastery changed. Tap to expand details and delta bars.</p>

      <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
        <div className="relative ml-8 border-l-2 border-white/10 pl-6">
          {timelineEvents.map((event) => {
            const style = typeStyle[event.type];
            const isExpanded = expanded === event.id;
            return (
              <div key={event.id} className="relative mb-4 last:mb-0">
                <div className="absolute -left-[31px] top-2 text-base">{style.icon}</div>
                <button type="button" onClick={() => setExpanded(isExpanded ? null : event.id)}
                  className={cn("w-full rounded-2xl border p-3 text-left transition-all duration-300 hover:scale-[1.005]", style.border, style.bg, style.text)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{event.label}</span>
                    <div className="flex items-center gap-2">
                      {event.delta !== 0 && <span className={cn("text-xs font-bold", event.delta > 0 ? "text-emerald-300" : "text-rose-300")}>{event.delta > 0 ? "+" : ""}{event.delta}</span>}
                      <span className="text-[10px] uppercase tracking-widest opacity-60">Day {event.day}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      <p className="text-sm text-slate-200">{event.detail}</p>
                      {event.delta !== 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Mastery Δ</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div className={cn("h-full rounded-full transition-all duration-700", event.delta > 0 ? "bg-emerald-400" : "bg-rose-400")}
                              style={{ width: `${Math.min(100, Math.abs(event.delta) * 4)}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  5. COLOR CODING SYSTEM — emphatic palette with cognitive rationale
// ═══════════════════════════════════════════════════════════════════════════════

function ColorCodingSystem() {
  const palette = [
    { name: "Mastered", hex: "#6ee7b7", swatch: "bg-emerald-300", use: "Concepts the learner has demonstrated mastery over. Safe for interleaving and transfer.", cog: "Signals safety and completion — reduces anxiety and frees working memory.", wcag: "AA on dark bg" },
    { name: "Proficient", hex: "#67e8f9", swatch: "bg-cyan-300", use: "Mostly understood but needs one more retrieval check before it is considered stable.", cog: "Cool tone maintains focus without urgency. Ideal for steady review.", wcag: "AA on dark bg" },
    { name: "Developing", hex: "#fbbf24", swatch: "bg-amber-400", use: "Partial understanding. Needs worked examples, guided practice, or error repair.", cog: "Warm tone draws attention without alarm. Signals 'progress is happening'.", wcag: "AA Large on dark bg" },
    { name: "Weak / Error", hex: "#f87171", swatch: "bg-rose-400", use: "Concepts the learner has gotten wrong or has not yet attempted.", cog: "High-arousal color demands attention. Used sparingly to avoid learned helplessness.", wcag: "AA on dark bg" },
    { name: "Source-grounded", hex: "#a78bfa", swatch: "bg-violet-400", use: "Claims that come directly from uploaded material with a verifiable citation.", cog: "Distinguishes trusted source knowledge from AI inference or enrichment.", wcag: "AA on dark bg" },
    { name: "Inferred", hex: "#94a3b8", swatch: "bg-slate-400", use: "Claims the AI generated without a direct citation. Labeled for transparency.", cog: "Muted tone reduces perceived authority. Invites the learner to verify.", wcag: "AA on dark bg" },
  ];

  return (
    <div className="space-y-5">
      <SubTitle icon="🎨" title="Emphatic color system — cognitive purpose for every color" />
      <p className="text-sm leading-6 text-slate-300">Color reduces cognitive load by encoding mastery level, source trust, and task urgency into a single visual channel. Each color has a specific cognitive purpose based on research.</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {palette.map((c) => (
          <div key={c.name} className="rounded-[26px] border border-white/8 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-2xl shadow-lg", c.swatch)} />
              <div><div className="text-sm font-semibold text-white">{c.name}</div><div className="text-[10px] text-slate-500">{c.hex} · {c.wcag}</div></div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{c.use}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400 italic">{c.cog}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
        <div className="flex items-center gap-3"><span className="text-sm font-semibold text-white">60-30-10 Rule</span></div>
        <p className="mt-2 text-sm leading-6 text-slate-300">60% dark background for cognitive rest. 30% muted structure colors. 10% emphatic accent for mastery signals, errors, and calls to action. Never exceed 3 emphatic colors per screen.</p>
        <div className="mt-3 flex h-6 overflow-hidden rounded-full">
          <div className="w-[60%] bg-slate-800" /><div className="w-[30%] bg-slate-600" /><div className="w-[5%] bg-cyan-400" /><div className="w-[3%] bg-emerald-400" /><div className="w-[2%] bg-rose-400" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  6. CONCEPT TREEMAP — area = exam weight, color = mastery, with prereqs
// ═══════════════════════════════════════════════════════════════════════════════

function ConceptTreemap() {
  const [active, setActive] = useState<TreemapBlock | null>(null);
  const total = treemapBlocks.reduce((s, b) => s + b.value, 0);
  const toneMap: Record<string, string> = {
    cyan: "from-cyan-400/25 to-cyan-400/8 border-cyan-400/25", violet: "from-violet-400/25 to-violet-400/8 border-violet-400/25",
    amber: "from-amber-400/25 to-amber-400/8 border-amber-400/25", emerald: "from-emerald-400/25 to-emerald-400/8 border-emerald-400/25",
    rose: "from-rose-400/25 to-rose-400/8 border-rose-400/25",
  };

  return (
    <div className="space-y-4">
      <SubTitle icon="🗺️" title="Concept treemap — area = exam weight, color = mastery" />
      <p className="text-sm leading-6 text-slate-300">Larger blocks are more important for the exam. Brighter color = higher mastery. Tap a block to see prerequisites and revision advice.</p>

      <div className="flex flex-wrap gap-2 rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
        {treemapBlocks.map((b) => {
          const pct = (b.value / total) * 100;
          const isActive = active?.id === b.id;
          return (
            <button key={b.id} type="button" onClick={() => setActive(isActive ? null : b)}
              className={cn("rounded-2xl border bg-gradient-to-br p-4 text-left transition-all duration-300", toneMap[b.tone] ?? toneMap.cyan, isActive && "ring-2 ring-white/20 scale-[1.02]")}
              style={{ flexBasis: `${Math.max(26, pct * 1.5)}%`, flexGrow: 1 }}>
              <div className="text-sm font-semibold text-white">{b.label}</div>
              <div className="mt-1 text-xs text-slate-300">Mastery {b.mastery}% · Weight {b.value}%</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/60 transition-all" style={{ width: `${b.mastery}%` }} /></div>
              {b.prereqs.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{b.prereqs.map((p) => <span key={p} className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-slate-300">{p}</span>)}</div>}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm text-slate-300">
          <span className="font-semibold text-white">{active.label}</span> — exam weight {active.value}%, mastery {active.mastery}%.
          {active.mastery < 50 && " ⚠️ This concept needs focused revision before the exam."}
          {active.mastery >= 50 && active.mastery < 75 && " 🔄 Close to proficient — one more retrieval session should stabilize it."}
          {active.mastery >= 75 && " ✅ Safe for transfer questions and interleaving."}
          {active.prereqs.length > 0 && <span className="block mt-1 text-slate-400">Prerequisites: {active.prereqs.join(", ")}</span>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  7. SIDE-BY-SIDE COMPARE — with exam tips per row
// ═══════════════════════════════════════════════════════════════════════════════

function SideBySideCompare() {
  const [showTips, setShowTips] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SubTitle icon="⚖️" title="Side-by-side comparison — anchoring vs framing" />
        <button onClick={() => setShowTips(!showTips)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300 hover:bg-white/[0.08]">{showTips ? "Hide tips" : "Show tips"}</button>
      </div>
      <p className="text-sm leading-6 text-slate-300">When two concepts are commonly confused, lay them out in structured rows with exam tips.</p>

      <div className="overflow-hidden rounded-[24px] border border-white/8 bg-slate-950/35">
        <div className="grid grid-cols-[0.8fr_1fr_1fr] border-b border-white/8 bg-white/[0.04] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Dimension</div>
          <div className="text-center text-sm font-semibold text-amber-200">Anchoring</div>
          <div className="text-center text-sm font-semibold text-emerald-200">Framing</div>
        </div>
        {compareItems.map((row, i) => (
          <div key={row.dim}>
            <div className={cn("grid grid-cols-[0.8fr_1fr_1fr] gap-3 px-4 py-3", i % 2 === 0 ? "bg-white/[0.02]" : "")}>
              <div className="text-sm font-semibold text-white">{row.dim}</div>
              <div className="text-sm leading-6 text-slate-300">{row.left}</div>
              <div className="text-sm leading-6 text-slate-300">{row.right}</div>
            </div>
            {showTips && (
              <div className="border-t border-white/5 bg-cyan-400/5 px-4 py-2 text-xs text-cyan-200/80">💡 {row.tip}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  8. MASTERY WATERFALL — gain/loss per activity with running total
// ═══════════════════════════════════════════════════════════════════════════════

function MasteryWaterfall() {
  const cumulative = useMemo(() => {
    let running = 0;
    return waterfallSteps.map((step) => { const start = running; running += step.delta; return { ...step, start, end: running }; });
  }, []);
  const maxVal = Math.max(...cumulative.map((c) => Math.max(c.start, c.end)), 1);

  return (
    <div className="space-y-4">
      <SubTitle icon="📊" title="Mastery waterfall — step-by-step gain and loss" />
      <p className="text-sm leading-6 text-slate-300">Each bar shows how a specific learning activity changed mastery. Green = gain, red = loss. The running total makes it clear which actions helped most.</p>

      <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
        <svg viewBox="0 0 780 280" className="h-[300px] w-full">
          {cumulative.map((step, i) => {
            const x = i * (780 / cumulative.length) + 12;
            const w = (780 / cumulative.length) - 16;
            const top = 230 - (Math.max(step.start, step.end) / maxVal) * 190;
            const bottom = 230 - (Math.min(step.start, step.end) / maxVal) * 190;
            const h = Math.max(4, bottom - top);
            const isGain = step.delta >= 0;
            return (
              <g key={step.label}>
                <rect x={x} y={top} width={w} height={h} rx={6} fill={isGain ? "#6ee7b7" : "#f87171"} opacity={0.75} className="transition-all duration-300 hover:opacity-100" />
                <text x={x + w / 2} y={top - 8} textAnchor="middle" className={cn("text-[11px] font-bold", isGain ? "fill-emerald-300" : "fill-rose-300")}>{isGain ? "+" : ""}{step.delta}</text>
                <text x={x + w / 2} y={252} textAnchor="middle" className="fill-slate-400 text-[8px]">{step.label}</text>
                {/* Running total line */}
                {i > 0 && <line x1={x - 8} y1={230 - (step.start / maxVal) * 190} x2={x + 4} y2={230 - (step.start / maxVal) * 190} className="stroke-white/25" strokeWidth="1.5" strokeDasharray="3 3" />}
              </g>
            );
          })}
          <line x1="0" y1="230" x2="780" y2="230" className="stroke-white/10" strokeWidth="1" />
          <text x="770" y="228" textAnchor="end" className="fill-slate-500 text-[9px]">0%</text>
        </svg>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {waterfallSteps.map((s) => (
          <div key={s.label} className={cn("rounded-2xl border p-3 text-sm", s.delta >= 0 ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-100" : "border-rose-400/20 bg-rose-400/8 text-rose-100")}>
            <div className="font-semibold">{s.delta >= 0 ? "+" : ""}{s.delta} — {s.label}</div>
            <div className="mt-1 text-xs opacity-80">{s.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  9. SKILL RADAR — multi-axis learner profile
// ═══════════════════════════════════════════════════════════════════════════════

function SkillRadar() {
  const cx = 200, cy = 200, maxR = 160;
  const n = radarAxes.length;
  const points = radarAxes.map((axis, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (axis.value / axis.max) * maxR;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, lx: cx + Math.cos(angle) * (maxR + 24), ly: cy + Math.sin(angle) * (maxR + 24), label: axis.label, value: axis.value };
  });
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="space-y-4">
      <SubTitle icon="🕸️" title="Skill radar — multi-axis learner profile" />
      <p className="text-sm leading-6 text-slate-300">Six dimensions of learning ability at a glance. The shape reveals strengths and gaps without needing numbers.</p>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="flex items-center justify-center rounded-[24px] border border-white/8 bg-slate-950/35 p-6">
          <svg viewBox="0 0 400 400" className="h-[360px] w-[360px]">
            {[0.25, 0.5, 0.75, 1].map((ring) => (
              <polygon key={ring} points={Array.from({ length: n }, (_, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return `${cx + Math.cos(a) * maxR * ring},${cy + Math.sin(a) * maxR * ring}`; }).join(" ")}
                className="fill-none stroke-white/8" strokeWidth="1" />
            ))}
            {points.map((_, i) => <line key={i} x1={cx} y1={cy} x2={cx + Math.cos((Math.PI * 2 * i) / n - Math.PI / 2) * maxR} y2={cy + Math.sin((Math.PI * 2 * i) / n - Math.PI / 2) * maxR} className="stroke-white/8" strokeWidth="1" />)}
            <polygon points={polygon} className="fill-cyan-300/15 stroke-cyan-300" strokeWidth="2.5" strokeLinejoin="round" />
            {points.map((p) => (
              <g key={p.label}>
                <circle cx={p.x} cy={p.y} r="5" className="fill-cyan-300" />
                <text x={p.lx} y={p.ly + 4} textAnchor="middle" className="fill-white text-[11px] font-medium">{p.label}</text>
                <text x={p.lx} y={p.ly + 18} textAnchor="middle" className="fill-cyan-200 text-[10px]">{p.value}%</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-3">
          {radarAxes.map((axis) => (
            <div key={axis.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between text-sm"><span className="text-white">{axis.label}</span><span className="text-cyan-200">{axis.value}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${axis.value}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  10. FEYNMAN CHECK — explain simply, AI finds the gaps
// ═══════════════════════════════════════════════════════════════════════════════

function FeynmanCheck() {
  const [text, setText] = useState("");
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const feedback = useMemo(() => {
    if (wordCount < 10) return null;
    const issues: string[] = [];
    if (!text.toLowerCase().includes("because")) issues.push("Missing causal explanation — add a 'because' or 'this happens when'.");
    if (!text.toLowerCase().includes("example")) issues.push("No concrete example — try adding 'for example' or 'such as'.");
    if (text.length > 400 && wordCount > 60) issues.push("Getting long — can you compress the core idea into fewer words?");
    if (wordCount < 20) issues.push("Very brief — try expanding the mechanism, not just the label.");
    return { score: Math.max(20, Math.min(95, 40 + wordCount * 1.2 - issues.length * 12)), issues: issues.length > 0 ? issues : ["Good structure — now test whether you can still recall this tomorrow."] };
  }, [text, wordCount]);

  return (
    <div className="space-y-4">
      <SubTitle icon="💬" title="Feynman check — explain it simply, find the gaps" />
      <p className="text-sm leading-6 text-slate-300">Write your explanation of a concept as if teaching a beginner. The system checks for causal reasoning, examples, and completeness.</p>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Explain the concept here as if teaching a friend who has never heard of it..."
            className="w-full rounded-3xl border border-white/8 bg-slate-950/55 p-4 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/30" />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{wordCount} words</span>
            {feedback && <span className="font-semibold text-cyan-200">Clarity score: {Math.round(feedback.score)}%</span>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">AI feedback</div>
          {feedback ? feedback.issues.map((issue) => (
            <div key={issue} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">{issue}</div>
          )) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm text-slate-400">Start writing to receive feedback...</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  11. ERROR NOTEBOOK — persistent mistake log with root cause
// ═══════════════════════════════════════════════════════════════════════════════

function ErrorNotebook() {
  const errors = [
    { id: "e1", question: "Is framing just about wording?", wrongAnswer: "Yes — it's how the question is phrased", rootCause: "Confused surface wording with the deeper mechanism of context-shifting", correction: "Framing changes what the learner attends to, not just the words used", concept: "Framing", status: "open" as const, day: 3 },
    { id: "e2", question: "What is the difference between a bias and a heuristic?", wrongAnswer: "They are the same thing", rootCause: "Collapsed two related but distinct concepts into one", correction: "A heuristic is the shortcut; a bias is the systematic error it sometimes causes", concept: "Bias vs heuristic", status: "open" as const, day: 4 },
    { id: "e3", question: "Does anchoring only apply to numbers?", wrongAnswer: "Yes", rootCause: "Overgeneralized from one example type", correction: "Anchoring can apply to any initial piece of information — names, images, or estimates", concept: "Anchoring", status: "resolved" as const, day: 6 },
  ];

  return (
    <div className="space-y-4">
      <SubTitle icon="📕" title="Error notebook — every mistake is a learning opportunity" />
      <p className="text-sm leading-6 text-slate-300">The system stores wrong first-attempts, identifies the root cause, and tracks whether the misconception has been resolved.</p>

      <div className="space-y-3">
        {errors.map((err) => (
          <div key={err.id} className={cn("rounded-[24px] border p-4", err.status === "open" ? "border-rose-400/20 bg-rose-400/8" : "border-emerald-400/20 bg-emerald-400/8")}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white">{err.concept} — Day {err.day}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", err.status === "open" ? "bg-rose-500/30 text-rose-200" : "bg-emerald-500/30 text-emerald-200")}>{err.status}</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3"><div className="text-[10px] uppercase tracking-widest text-slate-500">Question</div><p className="mt-1 text-sm text-slate-200">{err.question}</p></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3"><div className="text-[10px] uppercase tracking-widest text-slate-500">Wrong answer</div><p className="mt-1 text-sm text-rose-200">{err.wrongAnswer}</p></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3"><div className="text-[10px] uppercase tracking-widest text-slate-500">Root cause</div><p className="mt-1 text-sm text-amber-200">{err.rootCause}</p></div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3"><div className="text-[10px] uppercase tracking-widest text-slate-500">Correction</div><p className="mt-1 text-sm text-emerald-200">{err.correction}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  12. STUDY TIMER — Pomodoro with adaptive sessions
// ═══════════════════════════════════════════════════════════════════════════════

function StudyTimer() {
  const [mode, setMode] = useState<"focus" | "break" | "deep">("focus");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const durations = { focus: 25 * 60, break: 5 * 60, deep: 50 * 60 };
  const target = durations[mode];
  const remaining = Math.max(0, target - seconds);
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = (seconds / target) * 100;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const reset = useCallback(() => { setRunning(false); setSeconds(0); }, []);

  return (
    <div className="space-y-4">
      <SubTitle icon="⏱️" title="Study timer — Pomodoro + adaptive sessions" />
      <p className="text-sm leading-6 text-slate-300">Choose a session length, start the timer, and the system tracks study time per concept. Breaks are built in to manage cognitive load.</p>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="flex flex-col items-center rounded-[28px] border border-white/8 bg-slate-950/35 p-6">
          <div className="relative h-44 w-44">
            <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
              <circle cx="90" cy="90" r="76" className="fill-none stroke-white/8" strokeWidth="10" />
              <circle cx="90" cy="90" r="76" className="fill-none stroke-cyan-300" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 76} strokeDashoffset={2 * Math.PI * 76 * (1 - progress / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-semibold tabular-nums text-white">{String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-slate-500">{mode}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setRunning(!running)} className={cn("rounded-xl px-5 py-2.5 text-sm font-semibold transition", running ? "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30" : "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30")}>{running ? "Pause" : "Start"}</button>
            <button onClick={reset} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/15">Reset</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Session modes</div>
          {([["focus", "25 min", "One lesson, two recall checks, one recap."], ["break", "5 min", "Rest. Let the subconscious consolidate."], ["deep", "50 min", "Full concept map, examples, practice, and mini-test."]] as const).map(([m, dur, desc]) => (
            <button key={m} type="button" onClick={() => { setMode(m); reset(); }}
              className={cn("w-full rounded-2xl border p-4 text-left transition-all", mode === m ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/8 bg-white/[0.04] hover:bg-white/[0.07]")}>
              <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white capitalize">{m}</span><span className="text-xs text-slate-400">{dur}</span></div>
              <p className="mt-1 text-sm leading-6 text-slate-300">{desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">{children}</section>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">{children}</p>;
}

function SubTitle({ icon, title }: { icon: string; title: string }) {
  return <div className="flex items-center gap-2"><span className="text-lg">{icon}</span><span className="text-lg font-semibold text-white">{title}</span></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-center"><div className="text-lg font-semibold text-white">{value}</div><div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{label}</div></div>;
}
