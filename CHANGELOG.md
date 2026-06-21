# Changelog

Notable changes to Synapse Learning. Dates use ISO format. Until 1.0, the
client and server are versioned together.

## [Unreleased]

### Added

- **Documentation sweep** — new `API.md`, `ALGORITHMS.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, `CHANGELOG.md`. Existing docs (`ROADMAP.md`,
  `ARCHITECTURE.md`, `CONTENT_PIPELINE.md`, `PERSISTENCE.md`,
  `DEPLOYMENT.md`, `TESTING.md`, `server/README.md`) updated to match
  shipped behavior.
- **`src/lib/identity.ts`** — production-safe user identity helper
  (`buildInitialUser`, `applyAuthIdentity`, `levelFromXp`,
  `nameFromEmail`).
- **`src/lib/conceptEdges.ts`** — derive prerequisite edges from generated
  course topics; replaces hardcoded `ECON_CONCEPT_EDGES` on the production
  path.
- **`src/lib/formulaSolver.test.ts`** — 14 Vitest cases covering arithmetic,
  unary minus, scientific notation, trig/log/sqrt, constants, and error
  paths.
- **`src/lib/noteContentExtractors.test.ts`** — 6 Vitest cases covering
  Markdown-table comparison parsing, quiz `correctIndex` correctness,
  deterministic option ordering, distinct correct positions across
  concepts, and near-miss distractor ranking.
- **`src/lib/contentAnalysis.test.ts`** — extended with biased-TextRank,
  MMR redundancy filtering, and Bloom-aware objective tests (10 cases
  total).
- **Mobile workspace** — single-pane stacking and a top-bar pane-swap toggle
  in `StudyWorkspace.tsx`.
- **Keyboard shortcuts** — `1`–`0` switch tools, `L`/`T`/`S` rotate layout,
  `N` toggles notes; documented in the in-app overlay.
- **Command palette** — `⌘K` / `Ctrl+K` opens a searchable palette for every
  tool, layout, and session action (notes, agent, upload, shortcuts, close)
  with grouped results and arrow-key navigation. Available even while
  typing into text fields.
- **Scoped persistence** — whiteboard strokes, scratchpad formulas, and
  concept-map positions persist per workspace task (`workspacePersistence`
  exposes `loadWhiteboardStrokes` / `loadScratchpadFormulas` and friends).

### Changed

- **Summarizer** rewritten as **biased TextRank with MMR** — topic-aware
  teleport vector (sentences mentioning the title/key concepts attract
  rank mass), mild lead bias, and Maximal Marginal Relevance reranker so
  near-duplicate sentences don't both appear in the top-K. Used by course
  summary, topic descriptions, lesson `intro`/`summary`, sandbox insights,
  and the Feynman reference rewrite.
- **Learning objectives** are now **Bloom-aware**: each topic walks down
  its concept list while walking up Bloom's cognitive ladder (Remember →
  Understand → Apply → Analyze → Evaluate → Create), scaled to the topic's
  difficulty and bilingual (EN/EL).
- **Comparison detection** upgraded to a three-tier pipeline: **(1)**
  Markdown tables (`parseMarkdownTables` emits `(dim, col_i, col_j)`
  rows); **(2)** "X vs Y" / "compared to" / "ενώ" sentence patterns;
  **(3)** glossary + definition fallback.
- **Debate-tree mining** now scores each sentence on three independent
  axes (claim / support / refute) using rich connective + modality cues
  (e.g. `because`, `for example`, `studies show` for support; `however`,
  `fails to`, `μη` for refutation; `therefore`, `is`, `must` for claims),
  plus numerical density as an evidence cue. Refutation and support nodes
  now live in separate subtrees of the layout.
- **Quiz options** use a **deterministic seeded Fisher–Yates shuffle**
  (`seedFromString(concept + correct)`), fixing the prior bug where the
  correct answer always landed at index 0 in the MC variant and the
  options would re-order on every React render.
- **`Analytics` Mastery Map** dynamically builds nodes/edges from
  `learnerModel + courses` (no more hardcoded Microeconomics graph).
- **Feynman rubric** is now subject-agnostic — key terms are derived from
  the concept and reference notes/glossary instead of hardcoded
  Cournot/Bertrand vocabulary.
- **Formula solver** rewritten as a generic shunting-yard evaluator with
  function support (`sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `log`,
  `ln`, `sqrt`, `exp`, `abs`, `floor`, `ceil`, `round`, `min`, `max`),
  unary minus, scientific notation, constants (`pi`, `e`), and clear error
  messages.
- **Skill-node concept matching** uses `isSameConcept` (Jaccard similarity
  over normalized token sets) instead of `slice(0, 8)` prefix collisions.
  `taskFlows.ts` follows the same pattern.
- **PDF / PPTX extraction** uses the form-feed character (`\f`) as a page
  separator so RAG chunking can attach `p.X` citations.
- **Quiz distractors** are picked by token-set Jaccard similarity ("near
  misses") over the glossary and excerpt sentences instead of the previous
  random selection.
- **Note retrieval** in `noteContentExtractors.ts` now goes through a
  one-shot BM25 corpus (`rag.ts`) for excerpts and chunks; concept-map
  edges are inferred via PMI over sliding sentence windows.
- **`ROADMAP.md`** rewritten to reflect actual progress (Stripe, session
  sync, E2E spec, migrations, code-splitting all complete).
- **`StudyWorkspace`** default `quizConcept` is now the generic
  `Study concept` instead of `Market Structures`.

### Removed

- `src/data/mockData.ts` (deprecated shim) deleted; demo content lives in
  `src/demo/mockData.ts`.
- `SupplyDemandDiagram` component (unused demo artifact).
- `marketStructures` / `microeconomics` keys from i18n.

### Fixed

- ~20 latent TypeScript errors (e.g. `Shell.tsx navItems`, `studyTimeWeek`
  on `DashboardStats`, duplicate `UserSettings` import) — `tsc --noEmit`
  is now green and used as a build gate.
- "Alex Chen · Level 7" leak when the user signs in fresh — the user
  identity is now derived from `buildInitialUser` and refreshed via
  `applyAuthIdentity` on auth/login.
- Pedagogy `pedagogyMetrics` no longer falls back to economics edges when a
  generated course is present.

## Earlier history

Pre-`Unreleased` history is summarized in `ROADMAP.md` and reachable from
`git log`. Major milestones:

- **Phase 6 server skeleton** — Express proxy, JWT auth, metering,
  Stripe checkout + webhook, library + session sync, YouTube transcript
  endpoint, admin stats, `node-pg-migrate` schema.
- **Offline content engine v2** — `contentAnalysis.ts` (segmentation,
  RAKE+TextRank, definitions, prerequisites, outline) + `analyzeContentToOutline`
  used by `processUpload` whenever the LLM is off.
- **Workspace note bundle** — eleven study tools wired through
  `noteContentExtractors.ts` and `workspaceNoteContent.ts` with `hasSource`
  empty states and citations.
- **RAG / Agent grounding** — `rag.ts` (BM25 + optional embeddings),
  `sourceContext.ts` (strict / enriched modes), citations on Agent
  responses.
- **Code-splitting build** — `dist/assets/` is now multi-chunk
  (~281 KB main entry instead of the former 8.6 MB single file).
