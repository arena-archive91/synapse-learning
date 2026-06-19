import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "./utils/cn";
import AdvancedVisualToolsSection from "./VisualTools";
import { ReadinessRing } from "./advanced-visuals/ReadinessRing";
import { useLearnerModel } from "./store/LearnerModelContext";

type Section = "library" | "tasks" | "agent" | "progress" | "settings";
type Lens = "Theory" | "Practice";
type Lang = "en" | "el";

type MetricRow = { label: string; value: string; note: string };
type PillRow = { label: string; value: string; note: string };
type BlueprintBlock = { eyebrow: string; title: string; summary: string; items: string[] };
type TimelineStep = { phase: string; title: string; body: string; outcome: string };
type VisualMode = "source" | "concept" | "mastery" | "retention" | "exam" | "formula";
type WorkspaceTab = "map" | "source" | "formula" | "lesson" | "dashboard";
type WorkspaceNode = { id: string; label: string; x: number; y: number; tone: string; note: string };
type Annotation = { id: string; title: string; text: string; top: number; left: number; width: number; tone: string };

type Curriculum = {
  headline: string;
  subheadline: string;
  audience: string;
  promise: string;
  heroSteps: { title: string; body: string }[];
  library: {
    title: string;
    files: { name: string; meta: string; state: string }[];
    topics: string[];
    prerequisites: string[];
    examples: string[];
    gaps: string[];
    contradictions: string[];
    enrichments: string[];
    excerpt: { citation: string; text: string };
    actions: string[];
  };
  tasks: {
    today: { title: string; body: string; tag: string }[];
    reviewQueue: { title: string; due: string; note: string }[];
    weakAreas: string[];
    sessionModes: { name: string; duration: string; detail: string }[];
    dangerZone: string;
    rationale: string;
  };
  agent: {
    modes: { name: string; description: string }[];
    transcript: { speaker: string; text: string }[];
    followUps: string[];
    signals: { label: string; value: string; note: string }[];
    nextStep: string;
  };
};

const sections: { id: Section; label: string; summary: string }[] = [
  { id: "library", label: "Library", summary: "Upload, structure, and source-ground your material." },
  { id: "tasks", label: "Tasks", summary: "Turn study into a schedule of high-value actions." },
  { id: "agent", label: "Agent", summary: "Teach with modes, feedback, and adaptive practice." },
  { id: "progress", label: "Progress", summary: "See mastery, confidence, and retention clearly." },
  { id: "settings", label: "Settings", summary: "Tune pedagogy, privacy, and pacing." },
];

const lensOptions: Lens[] = ["Theory", "Practice"];

const curriculumByLens: Record<Lens, Curriculum> = {
  Theory: {
    headline: "Upload notes. Build an exam-ready tutor-course.",
    subheadline:
      "QuillLoop turns lecture material, readings, and past papers into a source-grounded learning path that checks understanding, repairs misconceptions, and schedules recall before you forget.",
    audience: "Best for theory-heavy subjects, exam revision, and concept-first learning.",
    promise: "From static notes to adaptive tutoring.",
    heroSteps: [
      { title: "1. Ingest", body: "PDFs, slides, scans, transcripts, textbook excerpts, and old exam papers." },
      { title: "2. Analyze", body: "Topics, prerequisites, definitions, contradictions, and missing explanations are extracted." },
      { title: "3. Teach", body: "The system generates a guided lesson with recall loops, examples, and Socratic prompts." },
      { title: "4. Adapt", body: "Mastery, confidence, latency, and error patterns reshape the next lesson automatically." },
    ],
    library: {
      title: "Behavioral Economics pack - notes, slides, and a past paper",
      files: [
        { name: "Week 4 lecture slides.pdf", meta: "82 slides · 14 extracted concepts", state: "Mapped" },
        { name: "Seminar notes.docx", meta: "9 pages · 3 gaps flagged", state: "Needs clarification" },
        { name: "Exam 2024.pdf", meta: "Paper-only source · recurring question shapes", state: "Practice source" },
      ],
      topics: ["bounded rationality", "anchoring", "prospect theory", "choice architecture", "framing effects"],
      prerequisites: ["expected utility", "probability basics", "utility curves", "reading graphs"],
      examples: ["How a reference point changes the perceived value of the same outcome.", "Why loss aversion affects policy, pricing, and decision framing."],
      gaps: ["No worked bridge from heuristic to bias in the notes.", "Loss aversion is named but not explained with an example."],
      contradictions: ["One slide implies framing always changes preference, another says it changes attention first."],
      enrichments: ["Add a concise definition of reference dependence.", "Add a real-world example from public policy."],
      excerpt: {
        citation: "Lecture notes, p. 14",
        text: "When the reference point shifts, the same outcome can feel like a gain or a loss.",
      },
      actions: ["Show me where this came from", "Use only my notes", "Beginner-friendly version", "Exam-focused version"],
    },
    tasks: {
      today: [
        { title: "10-minute recall warmup", body: "Retrieve key definitions without looking at the notes.", tag: "Warmup" },
        { title: "25-minute concept lesson", body: "Study anchoring, framing, and loss aversion with examples.", tag: "Core" },
        { title: "Error repair loop", body: "Retry the two questions you missed yesterday and explain the misconception.", tag: "Fix" },
      ],
      reviewQueue: [
        { title: "Prospect theory derivation", due: "Due now", note: "Low confidence after two misses." },
        { title: "Choice architecture examples", due: "Due in 2 days", note: "Almost known, high retention risk." },
        { title: "Exam-style short answer", due: "Due in 4 days", note: "Time pressure practice." },
      ],
      weakAreas: ["Distinguishing framing from anchoring", "Writing concise exam answers", "Applying the theory to a new case"],
      sessionModes: [
        { name: "10-minute session", duration: "Fast", detail: "1 recall set + 1 correction loop." },
        { name: "25-minute focused session", duration: "Medium", detail: "One lesson, two checks, one recap." },
        { name: "50-minute deep session", duration: "Deep", detail: "Full concept map, examples, and a mini-test." },
      ],
      dangerZone: "Your exam is 9 days away. The scheduler is prioritizing weak concepts with the highest forgetting risk.",
      rationale: "The planner ranks tasks by exam proximity, mastery gap, confidence mismatch, and last retrieval time.",
    },
    agent: {
      modes: [
        { name: "Socratic Tutor", description: "Asks one step at a time instead of giving the answer immediately." },
        { name: "Exam Coach", description: "Focuses on likely questions, structure, and marks per minute." },
        { name: "Deep Theory", description: "Explains the mechanism rigorously, with careful distinctions." },
        { name: "Error Diagnosis", description: "Finds the misconception that caused the wrong answer." },
        { name: "Oral Exam", description: "Simulates a professor probing the depth of understanding." },
      ],
      transcript: [
        { speaker: "You", text: "I keep mixing up anchoring and framing. Can you help?" },
        { speaker: "QuillLoop", text: "Yes. First, tell me where each bias changes the decision process. Use your notes only for the first attempt." },
        { speaker: "You", text: "Anchoring starts with the first number or example. Framing changes how the same choice is described." },
        { speaker: "QuillLoop", text: "Good. Now apply that to a salary offer so I can see whether the distinction is stable." },
      ],
      followUps: ["Generate 3 similar questions", "Switch to oral exam", "Ask for a simpler explanation", "Create an exam answer outline"],
      signals: [
        { label: "Mastery", value: "61%", note: "Concepts known in isolation but not yet stable under transfer." },
        { label: "Confidence", value: "42%", note: "Often underestimates performance on retrieval tasks." },
        { label: "Latency", value: "8.2s", note: "Slows down on short-answer recall and definition naming." },
        { label: "Misconception", value: "Framing = just wording", note: "Needs a counterexample and comparison." },
      ],
      nextStep: "Ask one contrast question, then generate a 90-second recall drill with source-grounded feedback.",
    },
  },
  Practice: {
    headline: "Turn a notebook or workbook into a guided practice environment.",
    subheadline:
      "QuillLoop converts code, worked problems, screenshots, and transcripts into stepwise practice with hints, tests, debugging, and mastery updates.",
    audience: "Best for programming, math, statistics, finance, and other problem-solving subjects.",
    promise: "From static material to adaptive tutoring.",
    heroSteps: [
      { title: "1. Ingest", body: "Lab instructions, code files, screenshots, slides, CSVs, and transcripts." },
      { title: "2. Parse", body: "The AI identifies formulas, steps, test cases, dependencies, and common failure points." },
      { title: "3. Practice", body: "A split-screen lesson pairs explanation with code editor, notebook, or solver." },
      { title: "4. Improve", body: "Hints, retry queues, and mistake-specific feedback adapt to your exact errors." },
    ],
    library: {
      title: "Python regression workshop - notebook, transcript, and lab sheet",
      files: [
        { name: "regression_lab.ipynb", meta: "16 cells · 6 tests available", state: "Interactive" },
        { name: "teacher transcript.txt", meta: "Transcript · 4 incomplete steps detected", state: "Needs support" },
        { name: "exercise_sheet.pdf", meta: "Problem set · timed challenge prepared", state: "Practice source" },
      ],
      topics: ["loading CSV data", "handling missing values", "linear regression", "interpreting coefficients", "residuals"],
      prerequisites: ["basic Python syntax", "arrays and data frames", "graph reading", "algebra"],
      examples: ["How to clean a column with missing values before model fitting.", "How to interpret a coefficient and explain it in plain language."],
      gaps: ["No explanation for why NaNs break the fit step.", "The lab jumps straight to results without validating assumptions."],
      contradictions: ["The notebook uses both mean imputation and row deletion without explaining the tradeoff."],
      enrichments: ["Add a plain-language explanation of residuals.", "Add a diagnostic step for multicollinearity."],
      excerpt: {
        citation: "Lab instructions, step 3",
        text: "Fit the model after cleaning the data, then inspect the residual plot for structure.",
      },
      actions: ["Show me the next step, not the full solution", "Explain like I am a beginner", "Use my notebook only", "Generate a similar exercise"],
    },
    tasks: {
      today: [
        { title: "10-minute coding warmup", body: "Recall the data loading steps before opening the notebook.", tag: "Warmup" },
        { title: "25-minute guided lab", body: "Fix the cleaning bug and explain each line of code.", tag: "Core" },
        { title: "Timed challenge", body: "Solve one unseen regression interpretation problem under time pressure.", tag: "Apply" },
      ],
      reviewQueue: [
        { title: "Why missing values break a model", due: "Due now", note: "High error probability without a reminder." },
        { title: "Coefficient interpretation", due: "Due in 1 day", note: "Almost known, needs transfer practice." },
        { title: "Residual diagnostic", due: "Due in 3 days", note: "Retention curve is dropping." },
      ],
      weakAreas: ["Debugging before fitting", "Translating output into plain language", "Choosing the right cleaning strategy"],
      sessionModes: [
        { name: "10-minute session", duration: "Fast", detail: "One bug, one hint, one retry." },
        { name: "25-minute focused session", duration: "Medium", detail: "Worked example, guided practice, and feedback." },
        { name: "50-minute deep session", duration: "Deep", detail: "Full notebook flow, tests, and transfer tasks." },
      ],
      dangerZone: "The next assessment is in 6 days. The scheduler is pushing coding drills and test-style questions first.",
      rationale: "The planner uses mastery, recent mistakes, response time, and forgetting risk to choose the next task.",
    },
    agent: {
      modes: [
        { name: "Coding Tutor", description: "Uses hints, tests, and debugging instead of immediate solutions." },
        { name: "Practical Mode", description: "Focuses on implementation, not theory overload." },
        { name: "Error Diagnosis", description: "Points to the failing line and the likely misconception." },
        { name: "Memory Coach", description: "Turns the lesson into spaced retrieval and repeat practice." },
        { name: "Motivation Coach", description: "Keeps the task small and doable when the user feels stuck." },
      ],
      transcript: [
        { speaker: "You", text: "I got a ValueError after dropping the missing values." },
        { speaker: "QuillLoop", text: "Let's inspect the shape before and after cleaning. What changed, and why might the target column be the issue?" },
        { speaker: "You", text: "I removed rows from the features but not from the target, so the lengths no longer match." },
        { speaker: "QuillLoop", text: "That is the right diagnosis. Now fix it without pasting the full answer into the notebook." },
      ],
      followUps: ["Show the next step", "Give me a tiny hint", "Run a similar problem", "Explain the error message"],
      signals: [
        { label: "Mastery", value: "68%", note: "Can complete the procedure with guidance but still misses data-shape checks." },
        { label: "Confidence", value: "53%", note: "Overconfident on syntax, underconfident on debugging." },
        { label: "Latency", value: "11.4s", note: "Slows when interpreting error messages and choosing the next move." },
        { label: "Misconception", value: "Cleaning only affects features", note: "Needs a reminder that target alignment matters too." },
      ],
      nextStep: "Open a guided exercise that asks for the first fix, then checks the outcome against the tests.",
    },
  },
};

const learningSignals = [
  ["Prior knowledge", "Mastery level before the lesson begins"],
  ["Retrieval performance", "How often the user can recall without hints"],
  ["Response latency", "How long a response takes"],
  ["Confidence calibration", "Whether the user feels more or less certain than they should"],
  ["Error type", "Conceptual, procedural, careless, or transfer failure"],
  ["Cognitive load", "How much support the current step requires"],
  ["Spacing interval", "How soon the next review should appear"],
  ["Help-seeking", "When the learner asks for hints or scaffolds"],
  ["Persistence", "Whether they continue after friction"],
  ["Retention decay", "How quickly the knowledge fades over time"],
];

const theoryLesson = [
  "Lesson title and outcome",
  "Why the concept matters",
  "Prerequisites and concept map",
  "Core explanation and step-by-step breakdown",
  "Definitions, distinctions, and examples",
  "Common misconception and why students get stuck",
  "Short recall question and Socratic exchange",
  "Exam-style answer, self-check quiz, and next lesson",
];

const practiceLesson = [
  "Lesson title and learning objective",
  "Minimal theory and worked example",
  "Guided practice with hints",
  "Interactive task and step-by-step solution",
  "Error-specific feedback and retry",
  "Similar question, harder question, timed challenge",
  "Reflection, mastery update, and next step",
];

const progressMetrics: MetricRow[] = [
  { label: "Mastery map", value: "61% average", note: "Stable on isolated concepts, weaker on transfer and timed recall." },
  { label: "Confidence calibration", value: "-19 pts", note: "The learner underestimates some topics and overestimates others." },
  { label: "Retention curve", value: "Review in 24h", note: "High-value topics are scheduled before the forgetting curve drops too far." },
  { label: "Error signature", value: "Concept + procedure", note: "The next lesson should mix explanation with guided practice." },
];

const settingsControls: PillRow[] = [
  { label: "Question frequency", value: "Adaptive", note: "Increase checks when passive reading is detected." },
  { label: "Explanation depth", value: "Balanced", note: "Expand when the learner is confused, compress when mastery is high." },
  { label: "Practice intensity", value: "High", note: "Prefer retrieval, applied tasks, and exam simulations." },
  { label: "Visual density", value: "Medium", note: "Use diagrams when they clarify structure; avoid clutter." },
  { label: "Pace", value: "User-controlled", note: "Slow down for novices and accelerate as recall improves." },
  { label: "Feedback tone", value: "Supportive, direct", note: "Correct errors clearly without shaming." },
  { label: "Source mode", value: "Strict notes first", note: "Label enrichment separately and preserve citations." },
  { label: "Language", value: "EN / EL", note: "English-first UI with Greek support for the first niche." },
];

const blueprintTimeline: TimelineStep[] = [
  {
    phase: "Phase 1",
    title: "Build the spine",
    body: "Ship auth, upload, text extraction, source storage, a simple course outline, and a readable Library view.",
    outcome: "A user can upload notes and see an initial structured course in under a minute.",
  },
  {
    phase: "Phase 2",
    title: "Teach from the source",
    body: "Generate source-grounded lessons, citations, quizzes, flashcards, and a first adaptive Tasks queue.",
    outcome: "The app becomes a tutor, not a document viewer.",
  },
  {
    phase: "Phase 3",
    title: "Learn the learner",
    body: "Track confidence, latency, error types, and retention to tune explanation depth and spacing.",
    outcome: "The system discovers how the learner actually learns through behavior.",
  },
  {
    phase: "Phase 4",
    title: "Add proof and scale",
    body: "Build Progress analytics, teacher tools, offline packs, export flows, and B2B onboarding later.",
    outcome: "The product becomes commercially and operationally durable.",
  },
];

const blueprintBlocks: BlueprintBlock[] = [
  {
    eyebrow: "Brand and scope",
    title: "Name, positioning, and first wedge",
    summary: "Make the product a tutor that turns the learner's own notes into an exam-ready course.",
    items: [
      "Recommended name: QuillLoop. Alternatives: TutorForge, NotePilot, StudyWeave, SyllabusAI, LearnGraph, RecallRoom, CourseMint, InsightTutor, AtlasLearn, Epoch Tutor.",
      "Positioning: Upload your material and the platform builds a personalized interactive tutor-course from it.",
      "First wedge: university exam prep from messy lecture notes, slides, and old papers.",
      "Primary promise: from static notes to adaptive tutoring.",
      "The brand should feel calm, rigorous, and private rather than playful or gamified.",
    ],
  },
  {
    eyebrow: "Learning design",
    title: "What the pedagogy must do",
    summary: "Use retrieval, spacing, worked examples, and error correction instead of passive summaries.",
    items: [
      "Retrieval practice every few steps so learners recall rather than reread.",
      "Spaced repetition governed by mastery and forgetting risk.",
      "Worked examples first for novices, fading guidance as performance improves.",
      "Interleaving once a concept is stable enough to handle variation.",
      "Metacognitive calibration so confidence is compared with actual performance.",
      "No learning-style personalization beyond interface preferences like visual density or pace.",
    ],
  },
  {
    eyebrow: "Core product",
    title: "Library, Tasks, Agent, Progress, Settings",
    summary: "These five surfaces are enough for a strong MVP and map cleanly to the learner's workflow.",
    items: [
      "Library: ingestion, source analysis, citations, concept maps, enrichment controls, and source viewer.",
      "Tasks: today plan, weak spots, reviews due, retry queue, and exam simulations.",
      "Agent: Socratic, direct, beginner, exam coach, error diagnosis, math tutor, and coding tutor modes.",
      "Progress: mastery map, retention trend, confidence calibration, and learning pattern discovery.",
      "Settings: frequency, depth, practice intensity, source strictness, language, and privacy.",
    ],
  },
  {
    eyebrow: "Technical stack",
    title: "Best long-term implementation choice",
    summary: "Prefer a secure, modular, source-grounded architecture that can scale without microservice sprawl.",
    items: [
      "Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion, Radix or shadcn for accessible primitives.",
      "API: Python FastAPI modular monolith for ingestion, AI orchestration, and retrieval workflows.",
      "Database: PostgreSQL with pgvector for source chunks, courses, learners, and analytics.",
      "File storage: S3-compatible object storage with signed URLs and deletion workflows.",
      "Queue and jobs: Redis with Celery or RQ for OCR, parsing, embeddings, and lesson generation.",
      "Security: OAuth/email auth, tenant scoping, audit logs, encryption at rest, and GDPR deletion support.",
    ],
  },
  {
    eyebrow: "AI pipeline",
    title: "From upload to adaptive course",
    summary: "The system should diagnose, structure, teach, assess, and adapt in a loop.",
    items: [
      "Ingest files, OCR scans, preserve source locations, chunk intelligently, and store citations.",
      "Diagnose subject, difficulty, topics, prerequisites, missing explanations, ambiguities, and likely exam content.",
      "Build a knowledge graph with prerequisite, contrast, example-of, and often-confused-with edges.",
      "Generate module outlines, lessons, practice units, review units, and exam simulations.",
      "Generate assessments of multiple formats and keep them answerable from the source.",
      "Update the learner model after every interaction and regenerate tasks accordingly.",
    ],
  },
  {
    eyebrow: "Data model and APIs",
    title: "What the database and endpoints should look like",
    summary: "Keep the schema narrow, auditable, and source-aware from day one.",
    items: [
      "Core entities: User, Organization, Course, SourceFile, SourceChunk, Concept, ConceptGraph, Lesson, Task, Question, Answer, Mistake, LearnerProfile, MasteryRecord, ReviewSchedule, AgentConversation, Citation, Subscription, TeacherClassroom.",
      "API surface: auth, upload, parse, course generation, lesson generation, assessment generation, progress, planner, agent chat, citations, export, and deletion.",
      "Every generated lesson should reference source chunks and mark inferred content separately.",
      "Teachers or learners must be able to approve, edit, or reject generated content.",
      "Generated data must remain deletable and isolated by tenant.",
    ],
  },
  {
    eyebrow: "MVP and roadmap",
    title: "What to build first, and what to delay",
    summary: "Start with exam prep from uploaded notes, then add durability and breadth.",
    items: [
      "MVP: auth, upload, extraction, source-grounded outline, one theoretical lesson mode, one practical lesson mode, quizzes, flashcards, progress basics, and study plan.",
      "Do not start with a marketplace, live classes, excessive gamification, or full social networking.",
      "V1: better OCR, better course editing, progress heatmaps, offline review packs, and teacher-invite flows.",
      "V2: class dashboards, organization licensing, collaborative rooms, and richer subject-specific tooling.",
      "The first shippable loop is upload -> course -> lesson -> quiz -> review -> adapt.",
    ],
  },
  {
    eyebrow: "Business and proof",
    title: "Monetization, metrics, and risk control",
    summary: "Make the product valuable before making it expansive.",
    items: [
      "Primary business model: B2C student subscription, then tutor tools and B2B training later.",
      "North star: verified mastered concepts per active learner per week.",
      "Track activation, first lesson completion, quiz completion, review completion, retention, churn, and AI cost per active user.",
      "Main risks: hallucinations, copyright, high AI cost, and generic-learning-app drift.",
      "Main defenses: source-grounded RAG, strict mode, approval flows, deletion support, caching, and a strong exam-prep niche.",
    ],
  },
  {
    eyebrow: "Examples and UX",
    title: "What users should see and feel",
    summary: "The interface should always make the next action obvious and the evidence visible.",
    items: [
      "Show where each claim came from and whether it is source-derived, inferred, or externally enriched.",
      "Provide explain-differently, test-me, compress, expand, and similar-exercise controls.",
      "For practical subjects, use split-screen lesson plus workspace with hints and test cases.",
      "For theory subjects, use concept maps, definitions, distinctions, and exam-ready answer structures.",
      "Progress should show mastery, weak spots, confidence calibration, retention, and next best action.",
    ],
  },
];

const visualModes: { id: VisualMode; title: string; subtitle: string; hint: string }[] = [
  { id: "source", title: "Source flow", subtitle: "How raw files become grounded lessons", hint: "Best for uploads, OCR, and trust." },
  { id: "concept", title: "Concept map", subtitle: "Prerequisites and contrasts made visible", hint: "Best for theory-heavy topics." },
  { id: "mastery", title: "Mastery ring", subtitle: "A course-level read on readiness", hint: "Best for progress and exam prep." },
  { id: "retention", title: "Retention curve", subtitle: "Spacing and forgetting over time", hint: "Best for review planning." },
  { id: "exam", title: "Exam path", subtitle: "Countdown to the next assessment", hint: "Best for cram planning and revision." },
  { id: "formula", title: "Formula explorer", subtitle: "Symbols, variables, and hidden steps", hint: "Best for math, finance, and stats." },
];

const sourceVisualTiles = [
  { label: "PDF notes", symbol: "PDF", visual: "extract headings, tables, and formulas" },
  { label: "Slides", symbol: "SLD", visual: "turn into concept blocks and sequence maps" },
  { label: "Scans / photos", symbol: "OCR", visual: "highlight regions and recover handwritten structure" },
  { label: "Exam paper", symbol: "EXM", visual: "cluster question types and mark likelihood" },
  { label: "Code files", symbol: "{}", visual: "split into editor, tests, and error tracing" },
  { label: "Audio / transcript", symbol: "A/V", visual: "turn into topic timeline and recall prompts" },
];

const progressFeed = [
  "Solved a concept-check question on the first attempt.",
  "Reopened a source chunk after the explanation felt too dense.",
  "Used one hint, then answered correctly on retry.",
  "Confidence was higher than accuracy on the last recall prompt.",
  "Prerequisite repair is now due before the next exam drill.",
];

const masteryBars = [
  { label: "Core concepts", value: 78 },
  { label: "Transfer", value: 54 },
  { label: "Timed recall", value: 46 },
  { label: "Prerequisites", value: 68 },
  { label: "Confidence calibration", value: 59 },
];

const retentionPoints = [
  { day: 0, value: 96 },
  { day: 1, value: 84 },
  { day: 3, value: 71 },
  { day: 5, value: 64 },
  { day: 7, value: 57 },
  { day: 10, value: 68 },
  { day: 14, value: 61 },
];

const conceptGraphNodes = [
  { id: "reference", label: "Reference point", x: 28, y: 26, tone: "cyan" },
  { id: "loss", label: "Loss aversion", x: 60, y: 18, tone: "violet" },
  { id: "framing", label: "Framing effect", x: 74, y: 44, tone: "emerald" },
  { id: "anchoring", label: "Anchoring", x: 44, y: 50, tone: "amber" },
  { id: "choice", label: "Choice architecture", x: 56, y: 72, tone: "cyan" },
  { id: "bias", label: "Bias vs heuristic", x: 28, y: 72, tone: "slate" },
];

const conceptGraphEdges = [
  ["reference", "loss"],
  ["reference", "framing"],
  ["anchoring", "framing"],
  ["bias", "anchoring"],
  ["framing", "choice"],
  ["loss", "choice"],
];

function App() {
  const [section, setSection] = useState<Section>("library");
  const [lens, setLens] = useState<Lens>("Theory");
  const [visualMode, setVisualMode] = useState<VisualMode>("concept");
  const [lang, setLang] = useState<Lang>("en");
  const [toast, setToast] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const toolsRef = useRef<HTMLElement | null>(null);
  const sectionsRef = useRef<HTMLElement | null>(null);
  const { readiness } = useLearnerModel();

  const scrollToRef = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  // Bilingual translation helper (EN + EL) — keeps English terminology visible
  const t = (key: string): string => {
    const translations: Record<string, { en: string; el: string }> = {
      brand_tagline: { en: "Adaptive tutoring from your own material", el: "Προσαρμοστική διδασκαλία από το δικό σας υλικό" },
      source_grounded: { en: "Source grounded", el: "Source grounded" },
      pwa_ready: { en: "PWA ready", el: "PWA ready" },
      offline_reviews: { en: "Works offline for reviews", el: "Λειτουργεί offline για reviews" },
      explore_studio: { en: "Explore the studio", el: "Εξερεύνηση studio" },
      view_engine: { en: "View the learning engine", el: "Προβολή μαθησιακού κινητήρα" },
      nav_library: { en: "Library", el: "Library / Βιβλιοθήκη" },
      nav_tasks: { en: "Tasks", el: "Tasks / Εργασίες" },
      nav_agent: { en: "Agent", el: "Agent / Πράκτορας" },
      nav_progress: { en: "Progress", el: "Progress / Πρόοδος" },
      nav_settings: { en: "Settings", el: "Settings / Ρυθμίσεις" },
    };
    return translations[key]?.[lang] ?? key;
  };

  const toggleLang = () => setLang(lang === "en" ? "el" : "en");

  // Global bilingual dictionary (English terminology stays visible)
  const dict: Record<string, { en: string; el: string }> = {
    "brand.tagline": { en: "Adaptive tutoring from your own material", el: "Προσαρμοστική διδασκαλία από το δικό σας υλικό" },
    "badge.source": { en: "Source grounded", el: "Source grounded" },
    "badge.pwa": { en: "PWA ready", el: "PWA ready" },
    "badge.offline": { en: "Works offline for reviews", el: "Λειτουργεί offline για reviews" },
    "nav.library": { en: "Library", el: "Library / Βιβλιοθήκη" },
    "nav.tasks": { en: "Tasks", el: "Tasks / Εργασίες" },
    "nav.agent": { en: "Agent", el: "Agent / Πράκτορας" },
    "nav.progress": { en: "Progress", el: "Progress / Πρόοδος" },
    "nav.settings": { en: "Settings", el: "Settings / Ρυθμίσεις" },
    "hero.explore": { en: "Explore the studio", el: "Εξερεύνηση studio" },
    "hero.engine": { en: "View the learning engine", el: "Προβολή μαθησιακού κινητήρα" },
    "common.nextBest": { en: "Next best action", el: "Επόμενη καλύτερη ενέργεια" },
  };

  // t() is the active bilingual translator (English terms preserved)

  const curriculum = useMemo(() => curriculumByLens[lens], [lens]);

  const heroIndex = lens === "Theory" ? 0 : 1;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50 selection:bg-cyan-300 selection:text-slate-950">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.15),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#020617_100%)]" />
      <div className="absolute left-4 top-14 -z-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl motion-safe:animate-[float_10s_ease-in-out_infinite]" />
      <div className="absolute right-2 top-44 -z-10 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl motion-safe:animate-[float_12s_ease-in-out_infinite_reverse]" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-30 -mx-4 border-b border-white/8 bg-slate-950/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                <div className="flex h-6 w-6 flex-col justify-between">
                  <span className="h-1.5 rounded-full bg-gradient-to-r from-cyan-300 to-cyan-500" />
                  <span className="h-1.5 rounded-full bg-gradient-to-r from-violet-300 to-violet-500" />
                  <span className="h-1.5 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500" />
                </div>
              </div>
               <div>
                 <p className="text-sm font-medium uppercase tracking-[0.32em] text-cyan-200/70">QuillLoop</p>
                 <p className="text-xs text-slate-400">{t("brand.tagline")}</p>
               </div>
            </div>

             <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
               <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">{t("badge.source")}</span>
               <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">{t("badge.pwa")}</span>
               <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1">{t("badge.offline")}</span>

               {/* Language Toggle - Bilingual EN/EL, keeps English terminology visible */}
               <button
                 onClick={toggleLang}
                 className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-medium transition hover:border-cyan-300/30 hover:bg-white/10"
                 title={lang === "en" ? "Switch to Greek (Ελληνικά)" : "Switch to English"}
               >
                 <span className={cn("px-1.5 py-0.5 rounded", lang === "en" ? "bg-cyan-300/20 text-cyan-200" : "text-slate-400")}>EN</span>
                 <span className="text-slate-500">/</span>
                 <span className={cn("px-1.5 py-0.5 rounded", lang === "el" ? "bg-cyan-300/20 text-cyan-200" : "text-slate-400")}>ΕΛ</span>
               </button>
             </div>
          </div>
        </header>

        <section className="grid gap-6 py-6 xl:min-h-[calc(100vh-5.5rem)] xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              {curriculum.audience}
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {curriculum.headline}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{curriculum.subheadline}</p>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                The tutor does not assume a fixed learning style. It adapts to what the learner actually does: the errors they make, the time they take, the hints they need, and the confidence they show.
              </p>
            </div>

             <div className="flex flex-col gap-3 sm:flex-row">
               <button
                 type="button"
                 onClick={() => scrollToRef(workspaceRef)}
                 className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform duration-300 hover:-translate-y-0.5 hover:bg-cyan-50"
               >
                 {dict["hero.explore"][lang]}
               </button>
               <button
                 type="button"
                 onClick={() => scrollToRef(toolsRef)}
                 className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/10"
               >
                 {dict["hero.engine"][lang]}
               </button>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
                {lensOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLens(option)}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300",
                      lens === option ? "bg-cyan-300 text-slate-950 shadow-[0_0_0_1px_rgba(103,232,249,0.25)]" : "text-slate-300 hover:bg-white/[0.06]"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {curriculum.heroSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-3xl border border-white/8 bg-white/[0.04] p-4 backdrop-blur motion-safe:animate-[fadeUp_0.6s_ease-out]"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">0{index + 1}</p>
                  <h2 className="mt-2 text-sm font-semibold text-white">{step.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Live build preview</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{curriculum.promise}</h2>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                Strict source grounding on
              </div>
            </div>

            <div className="space-y-3">
              {curriculum.heroSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="group flex gap-4 rounded-2xl border border-white/8 bg-slate-950/30 p-4 transition-colors duration-300 hover:border-cyan-300/20 hover:bg-slate-900/50"
                >
                  <div className="relative flex w-10 flex-col items-center">
                    <span className={cn("h-3 w-3 rounded-full", index === heroIndex ? "bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.55)]" : "bg-white/20")} />
                    {index < curriculum.heroSteps.length - 1 ? <span className="mt-2 h-full w-px flex-1 bg-gradient-to-b from-white/15 to-transparent" /> : null}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                      <span className="text-xs uppercase tracking-[0.28em] text-slate-500">{index === heroIndex ? "Active" : "Queued"}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          index === heroIndex ? "w-[82%] bg-gradient-to-r from-cyan-300 to-violet-400" : "w-[35%] bg-white/20"
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-3xl border border-white/8 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">What the system watches</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-white">Known from the notes</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Topics, definitions, examples, formulas, source citations, dependencies, and likely exam patterns.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Learned from behavior</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Errors, confidence, help-seeking, latency, persistence, transfer, and retention decay determine the next move.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <VisualLabSection lens={lens} visualMode={visualMode} setVisualMode={setVisualMode} />

        <StudyWorkspaceSection lens={lens} curriculum={curriculum} sectionRef={workspaceRef} />

        <div ref={toolsRef}>
          <AdvancedVisualToolsSection lang={lang} />
        </div>

        <section
          ref={sectionsRef}
          className="sticky top-[4.4rem] z-20 -mx-4 border-y border-white/8 bg-slate-950/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
           <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product sections">
             {sections.map((item) => (
               <button
                 key={item.id}
                 type="button"
                 role="tab"
                 aria-selected={section === item.id}
                 onClick={() => setSection(item.id)}
                 className={cn(
                   "min-w-[14rem] rounded-2xl border px-4 py-3 text-left transition-all duration-300",
                   section === item.id
                     ? "border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.18)]"
                     : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                 )}
               >
                 <div className="text-sm font-semibold text-white">{t(`nav.${item.id}`)}</div>
                 <div className="mt-1 text-xs leading-5 text-slate-400">{item.summary}</div>
               </button>
             ))}
           </div>
        </section>

        <section className="space-y-6 py-6" role="tabpanel">
          {section === "library" ? <LibrarySection curriculum={curriculum} onAction={notify} /> : null}
          {section === "tasks" ? <TasksSection curriculum={curriculum} onStart={() => { setSection("agent"); notify("Session started — agent mode activated"); }} /> : null}
          {section === "agent" ? <AgentSection curriculum={curriculum} onFollowUp={notify} /> : null}
          {section === "progress" ? <ProgressSection readiness={readiness} /> : null}
          {section === "settings" ? <SettingsSection /> : null}
        </section>

        <section className="grid gap-6 py-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Surface>
            <SectionTitle eyebrow="Who it serves" title="Built for five user groups" subtitle="One system, different outcomes. The AI creates the same tutoring core, but the experience changes by role and goal." />
            <div className="mt-5 space-y-3">
              {[
                ["University students", "Exam-focused tutoring from lecture notes, slides, and old papers."],
                ["High-school students", "Structured support, step-by-step guidance, and safe practice loops."],
                ["Self-learners", "Books, docs, tutorials, and transcripts become a personal course."],
                ["Tutors and teachers", "Generate lessons and assignments from their own teaching materials."],
                ["Companies and training teams", "Convert manuals and onboarding docs into interactive training."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-300">{body}</div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface>
            <SectionTitle eyebrow="Learning science" title="Adaptive variables replace learning-style myths" subtitle="Personalization is driven by evidence-informed signals, not visual/auditory/kinesthetic labels." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {learningSignals.map(([label, body]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-300">{body}</div>
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-6 py-6 lg:grid-cols-2">
          <Surface>
            <SectionTitle
              eyebrow="Lesson format A"
              title="Theoretical lessons"
              subtitle="Use this for economics, philosophy, history, law, psychology, sociology, and conceptual mathematics."
            />
            <ol className="mt-5 space-y-3">
              {theoryLesson.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-semibold text-cyan-200">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-slate-300">{item}</span>
                </li>
              ))}
            </ol>
          </Surface>

          <Surface>
            <SectionTitle
              eyebrow="Lesson format B"
              title="Practical and interactive lessons"
              subtitle="Use this for programming, statistics, math, finance, data analysis, coding labs, and problem-solving tasks."
            />
            <ol className="mt-5 space-y-3">
              {practiceLesson.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-300/15 text-xs font-semibold text-violet-200">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-slate-300">{item}</span>
                </li>
              ))}
            </ol>
          </Surface>
        </section>

        <section className="grid gap-6 py-6 lg:grid-cols-[1fr_1fr_1fr]">
          <Surface>
            <SectionTitle eyebrow="Product promise" title="A course that builds itself from your material" subtitle="Upload first, then let the system create structure, practice, and a review plan." />
          </Surface>
          <Surface>
            <SectionTitle eyebrow="Safety and trust" title="Source-grounded by default" subtitle="The agent separates what the source says, what it infers, what enrichment adds, and what is uncertain." />
          </Surface>
          <Surface>
            <SectionTitle eyebrow="MVP scope" title="Build the smallest useful tutor" subtitle="Start with upload, source analysis, lesson generation, adaptive tasks, and a conversational tutor that stays grounded." />
          </Surface>
        </section>

        <BlueprintSection />
      </div>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-cyan-300/30 bg-slate-900/95 px-4 py-3 text-sm text-cyan-50 shadow-2xl backdrop-blur"
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function LibrarySection({ curriculum, onAction }: { curriculum: Curriculum; onAction: (msg: string) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Surface className="motion-safe:animate-[fadeUp_0.6s_ease-out]">
        <SectionTitle
          eyebrow="Library"
          title="Upload material and inspect what the AI extracted"
          subtitle="Sources are organized by course, subject, semester, difficulty, source type, and completion status."
        />

        <div className="mt-5 rounded-3xl border border-dashed border-cyan-300/20 bg-cyan-300/5 p-4">
          <p className="text-sm font-semibold text-white">Drop files here</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">PDF, DOCX, PPTX, TXT, Markdown, images, screenshots, scanned notes, CSV, code files, transcripts, and audio lecture exports.</p>
        </div>

        <div className="mt-5 space-y-3">
          {curriculum.library.files.map((file) => (
            <div key={file.name} className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <div>
                <div className="text-sm font-semibold text-white">{file.name}</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">{file.meta}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{file.state}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {curriculum.library.actions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(`Action queued: ${action}`)}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-white transition-colors duration-300 hover:border-cyan-300/25 hover:bg-white/[0.07]"
            >
              {action}
            </button>
          ))}
        </div>
      </Surface>

      <div className="space-y-6">
        <Surface className="motion-safe:animate-[fadeUp_0.7s_ease-out]">
          <SectionTitle
            eyebrow="Source analysis"
            title="What the AI builds from the raw material"
            subtitle="The course generator extracts structure before it ever starts teaching."
          />

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <InfoStack title="Topics and prerequisites" items={curriculum.library.topics} secondary={curriculum.library.prerequisites} />
            <InfoStack title="Examples and enrichment" items={curriculum.library.examples} secondary={curriculum.library.enrichments} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <MiniAlert title="Possible missing explanation" body={curriculum.library.gaps[0]} tone="amber" />
            <MiniAlert title="Possible contradiction" body={curriculum.library.contradictions[0]} tone="violet" />
          </div>
        </Surface>

        <Surface className="motion-safe:animate-[fadeUp_0.8s_ease-out]">
          <SectionTitle
            eyebrow="Source viewer"
            title="Show me where this came from"
            subtitle="Every generated answer can point back to a citation or mark a claim as inferred or uncertain."
          />

          <div className="mt-5 rounded-3xl border border-white/8 bg-slate-950/45 p-5">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">{curriculum.library.excerpt.citation}</div>
            <p className="mt-3 text-lg leading-8 text-slate-100">{curriculum.library.excerpt.text}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">Source grounded</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Use my notes only</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Trusted external enrichment</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Strict mode</span>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function TasksSection({ curriculum, onStart }: { curriculum: Curriculum; onStart: () => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
      <Surface className="motion-safe:animate-[fadeUp_0.6s_ease-out]">
        <SectionTitle
          eyebrow="Tasks"
          title="Turn study into a queue of precise actions"
          subtitle="The planner prioritizes review, practice, and repair based on mastery, spacing, and exam proximity."
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {curriculum.tasks.sessionModes.map((mode) => (
            <button
              key={mode.name}
              type="button"
              onClick={onStart}
              className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-left transition-colors hover:border-cyan-300/25 hover:bg-white/[0.07]"
            >
              <div className="text-sm font-semibold text-white">{mode.name}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">{mode.duration}</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">{mode.detail}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-amber-400/15 bg-amber-400/8 p-4 text-sm leading-6 text-amber-100">
          {curriculum.tasks.dangerZone}
        </div>

        <div className="mt-5 space-y-3">
          {curriculum.tasks.today.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{item.tag}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
            </div>
          ))}
        </div>
      </Surface>

      <div className="space-y-6">
        <Surface className="motion-safe:animate-[fadeUp_0.7s_ease-out]">
          <SectionTitle
            eyebrow="Adaptive scheduling"
            title="The next review is chosen by the forgetting curve, not a fixed calendar"
            subtitle="Upcoming tasks are ranked by recency, difficulty, confidence, and error history."
          />

          <div className="mt-5 space-y-3">
            {curriculum.tasks.reviewQueue.map((item, index) => (
              <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className={cn("text-xs uppercase tracking-[0.28em]", index === 0 ? "text-cyan-200" : "text-slate-500")}>{item.due}</div>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{item.note}</div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="motion-safe:animate-[fadeUp_0.8s_ease-out]">
          <SectionTitle eyebrow="Weak areas" title="Retry the mistakes before they become the exam" subtitle="The queue separates active errors from concepts that are almost known." />
          <div className="mt-5 space-y-3">
            {curriculum.tasks.weakAreas.map((area) => (
              <div key={area} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                {area}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-400">{curriculum.tasks.rationale}</p>
        </Surface>
      </div>
    </div>
  );
}

function AgentSection({ curriculum, onFollowUp }: { curriculum: Curriculum; onFollowUp: (msg: string) => void }) {
  const { concepts, readiness, calibrationGap } = useLearnerModel();
  const [extraLines, setExtraLines] = useState<{ speaker: string; text: string }[]>([]);

  const followUpResponses: Record<string, string> = {
    "Generate 3 similar questions": "Here are 3 transfer questions on framing vs anchoring, grounded in your lecture notes.",
    "Switch to oral exam": "Oral mode activated — I'll ask one concept at a time and wait for your spoken answer.",
    "Ask for a simpler explanation": "Think of anchoring as a starting number pulling your estimate; framing is how the same facts are packaged.",
    "Create an exam answer outline": "Outline: (1) define mechanism, (2) give example, (3) name common mistake, (4) one-sentence contrast.",
    "Show the next step": "Next: run a 3-item retrieval quiz on loss aversion with confidence rating.",
    "Give me a tiny hint": "Hint: what changes if the reference point shifts?",
    "Run a similar problem": "Similar problem loaded — compare two policy frames with identical outcomes.",
    "Explain the error message": "The error means you treated a heuristic as a bias without naming the systematic deviation.",
  };

  const handleFollowUp = (item: string) => {
    const response = followUpResponses[item] ?? `Processing: ${item}`;
    setExtraLines((prev) => [
      ...prev,
      { speaker: "You", text: item },
      { speaker: "QuillLoop", text: response },
    ]);
    onFollowUp(`Agent: ${item}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Surface className="motion-safe:animate-[fadeUp_0.6s_ease-out]">
        <SectionTitle
          eyebrow="Agent"
          title="A tutor that changes style without changing the truth"
          subtitle="The agent always knows whether it is explaining, inferring, or asking the learner to try again."
        />

        <div className="mt-5 grid gap-3">
          {curriculum.agent.modes.map((mode) => (
            <div key={mode.name} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 transition-colors duration-300 hover:border-cyan-300/20 hover:bg-white/[0.06]">
              <div className="text-sm font-semibold text-white">{mode.name}</div>
              <div className="mt-1 text-sm leading-6 text-slate-300">{mode.description}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Next best action</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{curriculum.agent.nextStep}</p>
        </div>
      </Surface>

      <div className="space-y-6">
        <Surface className="motion-safe:animate-[fadeUp_0.7s_ease-out]">
          <SectionTitle eyebrow="Conversation" title="Teach, test, and repair in one loop" subtitle="The tutor never stops at the answer. It always generates the next practice step." />

          <div className="mt-5 space-y-3">
            {[...curriculum.agent.transcript, ...extraLines].map((line) => (
              <div
                key={`${line.speaker}-${line.text}`}
                className={cn(
                  "max-w-[92%] rounded-3xl border px-4 py-3 text-sm leading-6",
                  line.speaker === "QuillLoop" ? "ml-auto border-cyan-300/20 bg-cyan-300/10 text-cyan-50" : "border-white/8 bg-white/[0.04] text-slate-100"
                )}
              >
                <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{line.speaker}</div>
                <p className="mt-1">{line.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {curriculum.agent.followUps.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleFollowUp(item)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition-colors duration-300 hover:border-cyan-300/20 hover:bg-white/[0.08]"
              >
                {item}
              </button>
            ))}
          </div>
        </Surface>

        <Surface className="motion-safe:animate-[fadeUp_0.8s_ease-out]">
          <SectionTitle
            eyebrow="Learner model"
            title="The tutor learns from behavior, not labels"
            subtitle="These signals drive the next explanation, hint, review interval, and practice type."
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Mastery", value: `${readiness}%`, note: "Unified across workspace, Leitner, and progress views." },
              { label: "Confidence", value: `${Math.round(concepts.reduce((s, c) => s + c.confidence, 0) / concepts.length)}%`, note: "Average self-reported confidence from recent reviews." },
              { label: "Calibration gap", value: `${calibrationGap} pts`, note: "Distance between predicted and actual performance." },
              { label: "Active concepts", value: `${concepts.length}`, note: "Concepts tracked in the live learner model." },
            ].map((signal) => (
              <div key={signal.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{signal.label}</div>
                  <div className="text-sm font-semibold text-cyan-200">{signal.value}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{signal.note}</p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function ProgressSection({ readiness }: { readiness: number }) {
  const { concepts, calibrationGap, retention } = useLearnerModel();

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Surface className="motion-safe:animate-[fadeUp_0.6s_ease-out]">
        <SectionTitle
          eyebrow="Progress"
          title="The learner model becomes visible"
          subtitle="Progress is not a single score. It is mastery, retention, confidence, error type, and readiness for transfer."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-white/8 bg-slate-950/35 p-4">
            <ReadinessRing value={readiness} label="Exam readiness" description="Unified readiness from concept mastery and confidence calibration across all tools." />
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
              {[
                { label: "Retention", value: `${retention}%` },
                { label: "Calibration gap", value: `${calibrationGap} pts` },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <div className="font-semibold text-white">{metric.label}</div>
                  <div className="mt-1 text-cyan-200">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {progressMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-white">{metric.label}</div>
                  <div className="text-sm font-semibold text-cyan-200">{metric.value}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{metric.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            "You learn faster after worked examples than after dense theory.",
            "You make procedural errors under time pressure, not pure comprehension errors.",
            "You understand definitions but need transfer practice to apply them.",
            "You benefit from one hint, then an attempt, rather than full solutions.",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </Surface>

      <div className="space-y-6">
        <Surface className="motion-safe:animate-[fadeUp_0.7s_ease-out]">
          <SectionTitle
            eyebrow="Analytics"
            title="Mastery, retention, and calibration in one view"
            subtitle="These graphs are meant to make the invisible learner model legible to the student and the tutor."
          />

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[26px] border border-white/8 bg-slate-950/35 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Mastery bands</div>
              <div className="mt-4 space-y-3">
                {masteryBars.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-200">{bar.label}</span>
                      <span className="text-cyan-200">{bar.value}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-400 to-emerald-300" style={{ width: `${bar.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[26px] border border-white/8 bg-slate-950/35 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Retention curve</div>
              <div className="mt-4">
                <RetentionSparkline points={retentionPoints} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-400">
                {[
                  ["1 day", "84%"],
                  ["1 week", "57%"],
                  ["After review", "68%"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                    <div className="text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="motion-safe:animate-[fadeUp_0.8s_ease-out]">
          <SectionTitle
            eyebrow="Discovery"
            title="What the system learns about the learner"
            subtitle="The tutor makes evidence-based inferences from behavior instead of locking users into assumed learning styles."
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "You need prerequisite repair before exam-level questioning.",
              "You overestimate mastery when confidence is high but latency is also high.",
              "You benefit from guided steps first, then independent practice.",
              "You prefer diagrams for structure, but only where they reduce cognitive load.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-emerald-400/15 bg-emerald-400/8 p-4 text-sm leading-6 text-emerald-100">
            Next best action: teach the missing prerequisite, then return to a slightly harder variation of the original task.
          </div>

          <div className="mt-5 rounded-[26px] border border-white/8 bg-slate-950/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Activity feed</div>
                <div className="mt-1 text-sm font-semibold text-white">Recent learner events</div>
              </div>
              <div className="text-xs text-slate-400">Append-only</div>
            </div>
            <div className="mt-4 space-y-3">
              {progressFeed.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-sm text-slate-300">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function VisualLabSection({
  lens,
  visualMode,
  setVisualMode,
}: {
  lens: Lens;
  visualMode: VisualMode;
  setVisualMode: (mode: VisualMode) => void;
}) {
  return (
    <section className="py-2">
      <Surface className="motion-safe:animate-[fadeUp_0.6s_ease-out]">
        <SectionTitle
          eyebrow="Visual learning layer"
          title="Diagrams, graphs, and shapes that make the tutor easier to understand"
          subtitle="The AI can turn uploads into visual explanations when the content benefits from structure, comparison, timelines, symbols, or review maps."
        />

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {visualModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setVisualMode(mode.id)}
              className={cn(
                "min-w-[12.5rem] rounded-2xl border px-4 py-3 text-left transition-colors duration-300",
                visualMode === mode.id ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
              )}
            >
              <div className="text-sm font-semibold text-white">{mode.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{mode.subtitle}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border border-white/8 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Current visual mode</div>
                <div className="mt-1 text-lg font-semibold text-white">{visualModes.find((mode) => mode.id === visualMode)?.title}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{lens === "Theory" ? "Theory-first visual aid" : "Practice-first visual aid"}</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{visualModes.find((mode) => mode.id === visualMode)?.hint}</p>

            <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.03] p-3">
              {visualMode === "source" ? <SourceFlowDiagram /> : null}
              {visualMode === "concept" ? <ConceptGraphDiagram /> : null}
              {visualMode === "mastery" ? <MasteryRingBoard /> : null}
              {visualMode === "retention" ? <RetentionBoard /> : null}
              {visualMode === "exam" ? <ExamPathDiagram /> : null}
              {visualMode === "formula" ? <FormulaExplorerDiagram /> : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/8 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">How the system should visualize source material</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>Use diagrams when structure matters, not as decoration.</p>
                <p>Use shapes to show dependency, sequence, comparison, or uncertainty.</p>
                <p>Use graphs for mastery, retention, and progress through time.</p>
                <p>Use icons to help the user recognize source type, task type, and review status at a glance.</p>
                <p>Do not tie visual choice to fixed learning styles. Tie it to content type, observed behavior, and explicit UI preferences.</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Source-to-visual mapping</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {sourceVisualTiles.map((tile) => (
                  <div key={tile.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{tile.label}</div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-xs font-bold text-cyan-200">
                        {tile.symbol}
                      </div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">{tile.visual}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </section>
  );
}

function StudyWorkspaceSection({
  lens,
  curriculum,
  sectionRef,
}: {
  lens: Lens;
  curriculum: Curriculum;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("map");
  const { readiness } = useLearnerModel();

  const pack = useMemo(() => {
    if (lens === "Theory") {
      return {
        title: "Behavioral economics study room",
        objective: "Learn how framing, anchoring, and loss aversion fit together.",
        prompt: "Explain the difference between framing and anchoring in one exam-ready paragraph.",
        sourceNote: curriculum.library.excerpt.text,
        question: "What changed in the decision process when the reference point shifted?",
        lessonSteps: [
          "Read the source chunk and identify the exact claim.",
          "Map the concept graph: reference point -> loss aversion -> framing.",
          "Answer one retrieval question without looking back.",
          "Use the example prompt to generate an exam-style response.",
        ],
        weakSpots: curriculum.tasks.weakAreas.slice(0, 3),
        nodes: [
          { id: "reference", label: "Reference point", x: 20, y: 22, tone: "cyan", note: "Where evaluation starts." },
          { id: "loss", label: "Loss aversion", x: 52, y: 18, tone: "violet", note: "Losses loom larger than gains." },
          { id: "anchoring", label: "Anchoring", x: 38, y: 48, tone: "amber", note: "First number or example pulls judgment." },
          { id: "framing", label: "Framing effect", x: 72, y: 38, tone: "emerald", note: "The same outcome feels different by wording or context." },
          { id: "choice", label: "Choice architecture", x: 60, y: 72, tone: "cyan", note: "Design changes decisions." },
          { id: "misconception", label: "Bias vs heuristic", x: 22, y: 72, tone: "slate", note: "Do not collapse the two." },
        ],
        edges: [
          ["reference", "loss"],
          ["reference", "framing"],
          ["anchoring", "framing"],
          ["misconception", "anchoring"],
          ["framing", "choice"],
          ["loss", "choice"],
        ] as Array<[string, string]>,
        annotations: [
          { id: "a1", title: "Reference point", text: "The same outcome can be interpreted as a gain or a loss depending on where you start.", top: 18, left: 8, width: 46, tone: "cyan" },
          { id: "a2", title: "Framing", text: "Framing affects how options are perceived. It is not just wording; it can change attention and choice.", top: 42, left: 48, width: 42, tone: "emerald" },
          { id: "a3", title: "Anchoring", text: "Anchoring comes from the first value or example. It narrows the estimate around that starting point.", top: 62, left: 18, width: 44, tone: "violet" },
        ],
        formula: "Utility change = perceived gain - perceived loss\nMastery = alpha / (alpha + beta)",
      };
    }

    return {
      title: "Regression study room",
      objective: "Fix the data issue, understand the model, and explain the output.",
      prompt: "Show the first repair step before you fit the model.",
      sourceNote: curriculum.library.excerpt.text,
      question: "Why did the target column become misaligned after cleaning?",
      lessonSteps: [
        "Inspect the source chunk and locate the bug.",
        "Repair the missing-value handling without breaking alignment.",
        "Run the test case and check the residuals.",
        "Explain the coefficient in plain language.",
      ],
      weakSpots: curriculum.tasks.weakAreas.slice(0, 3),
      nodes: [
        { id: "missing", label: "Missing values", x: 18, y: 22, tone: "cyan", note: "What broke the data." },
        { id: "cleaning", label: "Cleaning", x: 50, y: 18, tone: "violet", note: "Rows or columns changed." },
        { id: "fit", label: "Fit model", x: 70, y: 42, tone: "emerald", note: "Run after data is aligned." },
        { id: "residuals", label: "Residual plot", x: 42, y: 50, tone: "amber", note: "Check structure after fitting." },
        { id: "coef", label: "Coefficient", x: 60, y: 72, tone: "cyan", note: "Translate output into plain language." },
        { id: "debug", label: "Debugging", x: 24, y: 72, tone: "slate", note: "Find the line that fails." },
      ],
      edges: [
        ["missing", "cleaning"],
        ["cleaning", "fit"],
        ["fit", "residuals"],
        ["fit", "coef"],
        ["debug", "cleaning"],
      ] as Array<[string, string]>,
      annotations: [
        { id: "b1", title: "Missing values", text: "Rows cannot be dropped from X without applying the same removal to y.", top: 18, left: 8, width: 48, tone: "cyan" },
        { id: "b2", title: "Alignment", text: "The target must stay aligned with the features when cleaning happens.", top: 44, left: 46, width: 44, tone: "amber" },
        { id: "b3", title: "Residuals", text: "A clean model can still be wrong if the residual plot shows structure.", top: 66, left: 18, width: 44, tone: "violet" },
      ],
      formula: "y = beta0 + beta1 x + epsilon\nR^2 = 1 - SSE / SST",
    };
  }, [lens, curriculum]);

  return (
    <section id="study-workspace" ref={sectionRef} className="py-6" aria-labelledby="workspace-heading">
      <Surface className="motion-safe:animate-[fadeUp_0.7s_ease-out]">
        <SectionTitle
          eyebrow="Interactive study workspace"
          title="Drag concepts, annotate sources, write formulas, and study in split screen"
          subtitle="This is the working area where the AI does not only explain. It helps the learner manipulate the material until the idea clicks."
        />

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {[
            ["map", "Draggable concept map"],
            ["source", "Annotation overlays"],
            ["formula", "Formula scratchpad"],
            ["lesson", "Split-screen lesson player"],
            ["dashboard", "Mini dashboard"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setWorkspaceTab(id as WorkspaceTab)}
              className={cn(
                "min-w-[12.5rem] rounded-2xl border px-4 py-3 text-left transition-colors duration-300",
                workspaceTab === id ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
              )}
            >
              <div className="text-sm font-semibold text-white">{label}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <SplitScreenLessonPanel pack={pack} />

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/8 bg-slate-950/40 p-4">
              {workspaceTab === "map" ? <DraggableConceptMap pack={pack} /> : null}
              {workspaceTab === "source" ? <SourceAnnotationWorkspace pack={pack} /> : null}
              {workspaceTab === "formula" ? <FormulaScratchpad pack={pack} /> : null}
              {workspaceTab === "lesson" ? <LessonAssistWorkspace pack={pack} /> : null}
              {workspaceTab === "dashboard" ? <MiniCourseDashboard pack={pack} /> : null}
            </div>

            <div className="rounded-[28px] border border-white/8 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Mini dashboard</div>
                  <div className="mt-1 text-sm font-semibold text-white">Course readiness and weak spots</div>
                </div>
                <ReadinessRing value={readiness} label="Ready" description="Live readiness from the unified learner model." />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {pack.weakSpots.map((spot: string) => (
                  <div key={spot} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">
                    {spot}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </section>
  );
}

function SplitScreenLessonPanel({ pack }: { pack: ReturnType<typeof useWorkspacePack> }) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-3 border-b border-white/8 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Split-screen lesson player</div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{pack.title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{pack.objective}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            "Explain differently",
            "I don't get it",
            "Ask Agent",
            "Test me now",
          ].map((item) => (
            <button key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition-colors duration-300 hover:border-cyan-300/20 hover:bg-white/[0.08]">
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
        <div className="space-y-4 rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Lesson flow</div>
          <div className="space-y-3">
            {pack.lessonSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-semibold text-cyan-200">{index + 1}</span>
                <span className="text-sm leading-6 text-slate-300">{step}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/8 p-4 text-sm leading-6 text-emerald-100">
            Next best action: {pack.question}
          </div>
        </div>

        <div className="space-y-4 rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Source-grounded prompt</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{pack.prompt}</p>

          <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Source note</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{pack.sourceNote}</p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Question</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{pack.question}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraggableConceptMap({ pack }: { pack: ReturnType<typeof useWorkspacePack> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<WorkspaceNode[]>(pack.nodes);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState(pack.nodes[0]?.id ?? null);

  useEffect(() => {
    setNodes(pack.nodes);
    setActiveNodeId(pack.nodes[0]?.id ?? null);
  }, [pack]);

  useEffect(() => {
    const handleUp = () => setDraggingId(null);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  const updatePosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nextX = Math.min(88, Math.max(12, ((event.clientX - rect.left) / rect.width) * 100));
    const nextY = Math.min(82, Math.max(12, ((event.clientY - rect.top) / rect.height) * 100));
    setNodes((current) => current.map((node) => (node.id === draggingId ? { ...node, x: nextX, y: nextY } : node)));
  };

  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? nodes[0];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Draggable concept map</div>
          <div className="mt-1 text-lg font-semibold text-white">Move nodes to show the dependency structure</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Drag nodes to reorganize the map</div>
      </div>

      <div
        ref={containerRef}
        className="relative mt-4 h-[360px] overflow-hidden rounded-[28px] border border-white/8 bg-gradient-to-br from-slate-950/70 via-slate-950/40 to-slate-900/70"
        onPointerMove={updatePosition}
        onPointerLeave={() => setDraggingId(null)}
      >
        <svg className="absolute inset-0 h-full w-full">
          {pack.edges.map(([from, to]) => {
            const a = nodes.find((node) => node.id === from);
            const b = nodes.find((node) => node.id === to);
            if (!a || !b) return null;
            return <line key={`${from}-${to}`} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} className="stroke-white/15" strokeWidth="2.5" strokeLinecap="round" />;
          })}
        </svg>

        {nodes.map((node) => {
          const tone =
            node.tone === "cyan"
              ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-50"
              : node.tone === "violet"
                ? "border-violet-300/30 bg-violet-300/12 text-violet-50"
                : node.tone === "emerald"
                  ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-50"
                  : node.tone === "amber"
                    ? "border-amber-300/30 bg-amber-300/12 text-amber-50"
                    : "border-white/10 bg-white/8 text-slate-50";

          return (
            <button
              key={node.id}
              type="button"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDraggingId(node.id);
                setActiveNodeId(node.id);
              }}
              onClick={() => setActiveNodeId(node.id)}
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-3xl border px-4 py-3 text-left shadow-[0_16px_34px_rgba(0,0,0,0.24)] transition-transform duration-150",
                tone,
                activeNodeId === node.id ? "ring-2 ring-cyan-300/40" : "hover:scale-[1.02]"
              )}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div className="text-sm font-semibold">{node.label}</div>
              <div className="mt-1 max-w-[12rem] text-xs leading-5 opacity-90">{node.note}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Selected concept</div>
          <div className="mt-2 text-sm font-semibold text-white">{activeNode?.label}</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{activeNode?.note}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Map instruction</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">Drag each node to cluster related ideas. If two nodes overlap too much, the system can infer that the learner is merging concepts and should ask for a comparison question.</p>
        </div>
      </div>
    </div>
  );
}

function SourceAnnotationWorkspace({ pack }: { pack: ReturnType<typeof useWorkspacePack> }) {
  const [activeAnnotationId, setActiveAnnotationId] = useState(pack.annotations[0]?.id ?? null);
  const activeAnnotation = pack.annotations.find((annotation) => annotation.id === activeAnnotationId) ?? pack.annotations[0];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Annotation overlays</div>
          <div className="mt-1 text-lg font-semibold text-white">Pin notes directly onto the source page</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Tap a highlight to inspect the source claim</div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Source page</div>
            <div className="text-xs text-slate-400">Source integrity viewer</div>
          </div>

          <div className="relative mt-4 rounded-[24px] bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-4">
            <div className="space-y-3 text-sm leading-6 text-slate-200">
              {[
                "When the reference point shifts, the same outcome can feel like a gain or a loss.",
                "Framing does not merely alter wording. It can alter what the learner notices first.",
                "Anchoring begins when an early number, example, or starting value biases the estimate.",
                "In exams, students often confuse the mechanism with the surface wording of the explanation.",
              ].map((line, index) => (
                <div
                  key={line}
                  className={cn(
                    "rounded-2xl px-3 py-2 transition-colors duration-300",
                    activeAnnotation && index === pack.annotations.findIndex((annotation) => annotation.id === activeAnnotation.id)
                      ? "bg-cyan-300/10 ring-1 ring-cyan-300/20"
                      : "bg-white/[0.03]"
                  )}
                >
                  {line}
                </div>
              ))}
            </div>

            {pack.annotations.map((annotation) => (
              <button
                key={annotation.id}
                type="button"
                onClick={() => setActiveAnnotationId(annotation.id)}
                className={cn(
                  "absolute rounded-full border px-3 py-1 text-xs shadow-lg transition-all duration-300",
                  activeAnnotation?.id === annotation.id ? "border-white/20 bg-cyan-300 text-slate-950" : "border-white/10 bg-slate-900/95 text-slate-200"
                )}
                style={{ left: `${annotation.left}%`, top: `${annotation.top}%` }}
              >
                {annotation.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-[28px] border border-white/8 bg-slate-950/35 p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Selected annotation</div>
          <div className="text-lg font-semibold text-white">{activeAnnotation?.title}</div>
          <p className="text-sm leading-6 text-slate-300">{activeAnnotation?.text}</p>

          <div className={cn("rounded-2xl border p-4 text-sm leading-6", activeAnnotation?.tone === "emerald" ? "border-emerald-400/15 bg-emerald-400/8 text-emerald-100" : "border-white/8 bg-white/[0.04] text-slate-300") }>
            Show me where this came from and compare it against the other highlighted lines.
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Why it matters</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">Annotations make the source legible on mobile. The learner can inspect one claim at a time without losing the original context.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormulaScratchpad({ pack }: { pack: ReturnType<typeof useWorkspacePack> }) {
  const [scratchpad, setScratchpad] = useState(pack.formula);
  const lines = scratchpad.split("\n").filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Formula scratchpad</div>
          <div className="mt-1 text-lg font-semibold text-white">Write the formula, then unpack the symbols</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Best for math, economics, statistics, finance</div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
          <div className="flex flex-wrap gap-2">
            {["alpha", "beta", "sigma", "sqrt", "->", "=", "+", "-"] .map((token) => (
              <button
                key={token}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200 transition-colors duration-300 hover:border-cyan-300/20 hover:bg-white/[0.08]"
                onClick={() => setScratchpad((current) => `${current}${current.endsWith("\n") ? "" : " "}${token}`)}
              >
                {token}
              </button>
            ))}
          </div>

          <textarea
            value={scratchpad}
            onChange={(event) => setScratchpad(event.target.value)}
            className="mt-4 min-h-[180px] w-full rounded-3xl border border-white/8 bg-slate-950/55 p-4 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
            placeholder="Write a formula or step here..."
          />
        </div>

        <div className="space-y-3 rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">AI breakdown</div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-2xl font-semibold text-white">
            {lines[0] ?? "Enter a formula"}
          </div>
          <div className="space-y-2 text-sm leading-6 text-slate-300">
            {lines.map((line, index) => (
              <div key={`${line}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                Step {index + 1}: {line}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
            The scratchpad should explain hidden algebra, symbol meaning, and the shortest path from the source formula to the exam answer.
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonAssistWorkspace({ pack }: { pack: ReturnType<typeof useWorkspacePack> }) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-[0.28em] text-slate-500">AI tutoring mode</div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
        {pack.title} can switch between Socratic tutor, direct explanation, exam coach, and error diagnosis. The workspace should reveal the next step first, then the full solution only when the learner asks for it.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          "Explain differently",
          "Show hidden steps",
          "Compare concepts",
          "Generate similar exercise",
          "Teach from zero",
          "Compress lesson",
        ].map((item) => (
          <button key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-left text-sm text-white transition-colors duration-300 hover:border-cyan-300/20 hover:bg-white/[0.08]">
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniCourseDashboard({ pack }: { pack: ReturnType<typeof useWorkspacePack> }) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Course dashboard</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Readiness</div>
          <div className="mt-2 text-3xl font-semibold text-white">{pack.title.includes("economics") ? "72%" : "68%"}</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">Exam readiness is derived from first-attempt evidence and concept importance.</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Next review</div>
          <div className="mt-2 text-xl font-semibold text-white">Tomorrow</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">Spacing will bring back the most fragile concepts before they decay.</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Weak spots</div>
        <div className="mt-3 space-y-2">
          {pack.weakSpots.map((spot) => (
            <div key={spot} className="rounded-2xl border border-white/8 bg-slate-950/35 p-3 text-sm text-slate-300">
              {spot}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
        This dashboard keeps the learner oriented: what is ready, what is weak, and what to do next.
      </div>
    </div>
  );
}

function useWorkspacePack(lens: Lens) {
  return lens === "Theory"
    ? {
        title: "Behavioral economics study room",
        objective: "Learn how framing, anchoring, and loss aversion fit together.",
        prompt: "Explain the difference between framing and anchoring in one exam-ready paragraph.",
        sourceNote: "When the reference point shifts, the same outcome can feel like a gain or a loss.",
        question: "What changed in the decision process when the reference point shifted?",
        lessonSteps: [
          "Read the source chunk and identify the exact claim.",
          "Map the concept graph: reference point -> loss aversion -> framing.",
          "Answer one retrieval question without looking back.",
          "Use the example prompt to generate an exam-style response.",
        ],
        weakSpots: ["Distinguishing framing from anchoring", "Writing concise exam answers", "Applying the theory to a new case"],
        nodes: [
          { id: "reference", label: "Reference point", x: 20, y: 22, tone: "cyan", note: "Where evaluation starts." },
          { id: "loss", label: "Loss aversion", x: 52, y: 18, tone: "violet", note: "Losses loom larger than gains." },
          { id: "anchoring", label: "Anchoring", x: 38, y: 48, tone: "amber", note: "First number or example pulls judgment." },
          { id: "framing", label: "Framing effect", x: 72, y: 38, tone: "emerald", note: "The same outcome feels different by wording or context." },
          { id: "choice", label: "Choice architecture", x: 60, y: 72, tone: "cyan", note: "Design changes decisions." },
          { id: "misconception", label: "Bias vs heuristic", x: 22, y: 72, tone: "slate", note: "Do not collapse the two." },
        ] satisfies WorkspaceNode[],
        edges: [
          ["reference", "loss"],
          ["reference", "framing"],
          ["anchoring", "framing"],
          ["misconception", "anchoring"],
          ["framing", "choice"],
          ["loss", "choice"],
        ] as Array<[string, string]>,
        annotations: [
          { id: "a1", title: "Reference point", text: "The same outcome can be interpreted as a gain or a loss depending on where you start.", top: 18, left: 8, width: 46, tone: "cyan" },
          { id: "a2", title: "Framing", text: "Framing affects how options are perceived. It is not just wording; it can change attention and choice.", top: 42, left: 48, width: 42, tone: "emerald" },
          { id: "a3", title: "Anchoring", text: "Anchoring comes from the first value or example. It narrows the estimate around that starting point.", top: 62, left: 18, width: 44, tone: "violet" },
        ] satisfies Annotation[],
        formula: "Utility change = perceived gain - perceived loss\nMastery = alpha / (alpha + beta)",
      }
    : {
        title: "Regression study room",
        objective: "Fix the data issue, understand the model, and explain the output.",
        prompt: "Show the first repair step before you fit the model.",
        sourceNote: "Fit the model after cleaning the data, then inspect the residual plot for structure.",
        question: "Why did the target column become misaligned after cleaning?",
        lessonSteps: [
          "Inspect the source chunk and locate the bug.",
          "Repair the missing-value handling without breaking alignment.",
          "Run the test case and check the residuals.",
          "Explain the coefficient in plain language.",
        ],
        weakSpots: ["Debugging before fitting", "Translating output into plain language", "Choosing the right cleaning strategy"],
        nodes: [
          { id: "missing", label: "Missing values", x: 18, y: 22, tone: "cyan", note: "What broke the data." },
          { id: "cleaning", label: "Cleaning", x: 50, y: 18, tone: "violet", note: "Rows or columns changed." },
          { id: "fit", label: "Fit model", x: 70, y: 42, tone: "emerald", note: "Run after data is aligned." },
          { id: "residuals", label: "Residual plot", x: 42, y: 50, tone: "amber", note: "Check structure after fitting." },
          { id: "coef", label: "Coefficient", x: 60, y: 72, tone: "cyan", note: "Translate output into plain language." },
          { id: "debug", label: "Debugging", x: 24, y: 72, tone: "slate", note: "Find the line that fails." },
        ] satisfies WorkspaceNode[],
        edges: [
          ["missing", "cleaning"],
          ["cleaning", "fit"],
          ["fit", "residuals"],
          ["fit", "coef"],
          ["debug", "cleaning"],
        ] as Array<[string, string]>,
        annotations: [
          { id: "b1", title: "Missing values", text: "Rows cannot be dropped from X without applying the same removal to y.", top: 18, left: 8, width: 48, tone: "cyan" },
          { id: "b2", title: "Alignment", text: "The target must stay aligned with the features when cleaning happens.", top: 44, left: 46, width: 44, tone: "amber" },
          { id: "b3", title: "Residuals", text: "A clean model can still be wrong if the residual plot shows structure.", top: 66, left: 18, width: 44, tone: "violet" },
        ] satisfies Annotation[],
        formula: "y = beta0 + beta1 x + epsilon\nR^2 = 1 - SSE / SST",
      };
}

function SettingsSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
      <Surface className="motion-safe:animate-[fadeUp_0.6s_ease-out]">
        <SectionTitle
          eyebrow="Settings"
          title="Pedagogy, privacy, and pace are explicit choices"
          subtitle="Users should be able to tell the tutor how much help they want without giving up adaptive control."
        />

        <div className="mt-5 space-y-3">
          {settingsControls.map((control) => (
            <div key={control.label} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-semibold text-white">{control.label}</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{control.value}</div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{control.note}</p>
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="motion-safe:animate-[fadeUp_0.7s_ease-out]">
        <SectionTitle
          eyebrow="Safety"
          title="Privacy and trust defaults"
          subtitle="The platform should feel safe for students, tutors, and organizations from the start."
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            "Private by default with clear tenant boundaries.",
            "User files are not used for model training without explicit consent.",
            "Generated outputs stay editable and deletable.",
            "Strict notes-only mode is always available.",
            "External enrichment is labeled separately.",
            "GDPR-aware data export and deletion flows are required.",
            "Accessible UI with keyboard navigation and screen-reader support.",
            "English and Greek support should be planned from the first niche.",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-white/8 bg-slate-950/40 p-4">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">User controls</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "More theory",
              "More practice",
              "More diagrams",
              "More Socratic guidance",
              "Exam mode",
              "Strict notes only",
              "Enriched mode",
              "Gentle feedback",
            ].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {item}
              </span>
            ))}
          </div>
        </div>
      </Surface>
    </div>
  );
}

function BlueprintSection() {
  return (
    <section className="space-y-6 py-6">
      <Surface>
        <SectionTitle
          eyebrow="Implementation blueprint"
          title="Step-by-step build plan and product decisions"
          subtitle="This is the practical path from prototype to durable product: choose the right stack, ship the learning loop first, and delay everything that adds surface area without improving learning outcomes."
        />

        <div className="mt-6 grid gap-3 lg:grid-cols-4">
          {blueprintTimeline.map((step) => (
            <div key={step.phase} className="rounded-3xl border border-white/8 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">{step.phase}</div>
              <div className="mt-2 text-sm font-semibold text-white">{step.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">Outcome: {step.outcome}</p>
            </div>
          ))}
        </div>
      </Surface>

      <div className="grid gap-6 lg:grid-cols-2">
        {blueprintBlocks.map((block) => (
          <Surface key={block.title}>
            <SectionTitle eyebrow={block.eyebrow} title={block.title} subtitle={block.summary} />
            <div className="mt-5 space-y-3">
              {block.items.map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </Surface>
        ))}
      </div>
    </section>
  );
}

function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl", className)}>{children}</section>;
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-slate-300">{subtitle}</p>
    </div>
  );
}

function InfoStack({ title, items, secondary }: { title: string; items: string[]; secondary: string[] }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-slate-950/40 p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-sm leading-6 text-slate-300">
            {item}
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/8 pt-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Connected prerequisites or enrichments</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {secondary.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniAlert({ title, body, tone }: { title: string; body: string; tone: "amber" | "violet" }) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-4",
        tone === "amber" ? "border-amber-400/15 bg-amber-400/8 text-amber-100" : "border-violet-400/15 bg-violet-400/8 text-violet-100"
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-300">{body}</div>
    </div>
  );
}

function RetentionSparkline({ points }: { points: { day: number; value: number }[] }) {
  const width = 100;
  const height = 56;
  const maxValue = Math.max(...points.map((point) => point.value));
  const minValue = Math.min(...points.map((point) => point.value));
  const span = Math.max(1, maxValue - minValue);
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - ((point.value - minValue) / span) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 56" className="h-40 w-full overflow-visible rounded-2xl bg-gradient-to-b from-cyan-300/5 to-transparent p-2">
      <defs>
        <linearGradient id="retentionStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="55%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      <path d={`${path}`} className="fill-none stroke-white/12" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`${path}`} className="fill-none stroke-[url(#retentionStroke)]" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => {
        const x = (index / Math.max(1, points.length - 1)) * width;
        const y = height - ((point.value - minValue) / span) * (height - 8) - 4;
        return <circle key={`${point.day}`} cx={x} cy={y} r="1.8" className="fill-cyan-200" />;
      })}
    </svg>
  );
}

function SourceFlowDiagram() {
  return (
    <svg viewBox="0 0 760 300" className="h-[300px] w-full">
      <defs>
        <linearGradient id="flowGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="760" height="300" rx="28" className="fill-slate-950/10" />
      {[
        [78, 88, "Upload", "Notes, PDFs, scans"],
        [226, 88, "OCR / Parse", "Recover structure"],
        [372, 88, "Chunk", "Source-aware segments"],
        [522, 88, "Graph", "Concept links"],
        [622, 198, "Tutor", "Lessons + feedback"],
      ].map(([x, y, title, body], index) => (
        <g key={title as string}>
          <rect x={x as number} y={y as number} width="110" height="76" rx="18" className="fill-white/6 stroke-white/12" strokeWidth="1.2" />
          <text x={(x as number) + 55} y={(y as number) + 28} textAnchor="middle" className="fill-white text-[14px] font-semibold">
            {title as string}
          </text>
          <text x={(x as number) + 55} y={(y as number) + 49} textAnchor="middle" className="fill-slate-300 text-[10px]">
            {body as string}
          </text>
          {index < 4 ? <line x1={(x as number) + 110} y1={(y as number) + 38} x2={(x as number) + 140} y2={(y as number) + 38} className="stroke-[url(#flowGlow)]" strokeWidth="3" strokeLinecap="round" /> : null}
        </g>
      ))}
      <path d="M 562 126 C 602 142, 610 160, 622 198" className="fill-none stroke-[url(#flowGlow)]" strokeWidth="3" strokeLinecap="round" />
      <path d="M 564 126 C 620 104, 646 112, 664 142" className="fill-none stroke-white/20" strokeWidth="1.5" strokeDasharray="5 5" />
      <g>
        <circle cx="690" cy="232" r="32" className="fill-cyan-300/15 stroke-cyan-300/35" strokeWidth="2" />
        <text x="690" y="228" textAnchor="middle" className="fill-white text-[12px] font-semibold">Review</text>
        <text x="690" y="246" textAnchor="middle" className="fill-slate-300 text-[9px]">spaced recall</text>
      </g>
    </svg>
  );
}

function ConceptGraphDiagram() {
  const toneFill: Record<string, string> = {
    cyan: "#67e8f9",
    violet: "#a78bfa",
    emerald: "#6ee7b7",
    amber: "#fbbf24",
    slate: "#94a3b8",
  };

  return (
    <svg viewBox="0 0 760 340" className="h-[340px] w-full">
      <rect x="0" y="0" width="760" height="340" rx="28" className="fill-slate-950/10" />
      {conceptGraphEdges.map(([from, to]) => {
        const a = conceptGraphNodes.find((node) => node.id === from);
        const b = conceptGraphNodes.find((node) => node.id === to);
        if (!a || !b) return null;
        return <line key={`${from}-${to}`} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} className="stroke-white/18" strokeWidth="2" strokeLinecap="round" />;
      })}
      {conceptGraphNodes.map((node) => (
        <g key={node.id}>
          <circle cx={`${node.x}%`} cy={`${node.y}%`} r="20" fill={toneFill[node.tone]} opacity="0.18" />
          <circle cx={`${node.x}%`} cy={`${node.y}%`} r="14" fill={toneFill[node.tone]} opacity="0.72" />
          <text x={`${node.x}%`} y={`${node.y + 8}%`} textAnchor="middle" className="fill-slate-950 text-[10px] font-semibold">
            {node.label.slice(0, 2).toUpperCase()}
          </text>
          <text x={`${node.x}%`} y={`${node.y + 28}%`} textAnchor="middle" className="fill-white text-[11px] font-medium">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function MasteryRingBoard() {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <ReadinessRing value={68} label="Mastery" description="The AI surfaces the strongest and weakest regions of the course to guide the next study step." />
      <div className="space-y-3 rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">What this means</div>
        <div className="space-y-3 text-sm leading-6 text-slate-300">
          <p>Strong concepts are safe for interleaving and transfer questions.</p>
          <p>Developing concepts should get worked examples or prerequisite repair.</p>
          <p>Weak concepts should be scheduled for recall, hints, and immediate correction.</p>
          <p>Confidence should be compared with accuracy to detect overconfidence or underconfidence.</p>
        </div>
      </div>
    </div>
  );
}

function RetentionBoard() {
  return (
    <div className="space-y-4">
      <RetentionSparkline points={retentionPoints} />
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
        {retentionPoints.slice(0, 3).map((point) => (
          <div key={point.day} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
            <div className="text-slate-500">Day {point.day}</div>
            <div className="mt-1 text-sm font-semibold text-white">{point.value}% recall</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamPathDiagram() {
  return (
    <div className="space-y-4">
      <svg viewBox="0 0 760 200" className="h-[220px] w-full">
        <rect x="0" y="0" width="760" height="200" rx="28" className="fill-slate-950/10" />
        <line x1="70" y1="110" x2="690" y2="110" className="stroke-white/14" strokeWidth="3" strokeLinecap="round" />
        {[
          [100, "Now", "Review now"],
          [230, "2d", "Weak spots"],
          [380, "5d", "Timed test"],
          [540, "8d", "Exam sim"],
          [670, "Exam", "Final recall"],
        ].map(([x, label, sub]) => (
          <g key={label as string}>
            <circle cx={x as number} cy="110" r="18" className="fill-cyan-300/20 stroke-cyan-300/60" strokeWidth="2" />
            <circle cx={x as number} cy="110" r="6" className="fill-cyan-200" />
            <text x={x as number} y="70" textAnchor="middle" className="fill-white text-[12px] font-semibold">
              {label as string}
            </text>
            <text x={x as number} y="150" textAnchor="middle" className="fill-slate-300 text-[10px]">
              {sub as string}
            </text>
          </g>
        ))}
      </svg>
      <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">Exam focus increases as the date gets closer.</div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">Weak concepts receive more retrieval and fewer passive explanations.</div>
      </div>
    </div>
  );
}

function FormulaExplorerDiagram() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Example formula</div>
        <div className="mt-4 rounded-3xl border border-white/8 bg-white/[0.04] p-4 text-center text-2xl font-semibold text-white">mastery = α / (α + β)</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {[
            ["α", "Correct evidence"],
            ["β", "Incorrect evidence"],
            ["first attempts", "Only gradeable first tries count"],
            ["gate", "Low evidence should not inflate readiness"],
          ].map(([symbol, meaning]) => (
            <div key={symbol} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <div className="font-semibold text-cyan-200">{symbol}</div>
              <div className="mt-1 text-slate-300">{meaning}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Hidden steps</div>
        <p className="mt-3">The system should reveal the missing algebra, definitions, or substitutions that professors often skip.</p>
        <p className="mt-3">For economics and statistics, each symbol should be clickable so learners can see what it means in context and how it appears in source material.</p>
      </div>
    </div>
  );
}

export default App;