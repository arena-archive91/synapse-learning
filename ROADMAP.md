# Roadmap & Gap Analysis

**Status baseline:** June 2026 — post P0/P1/P2 sweep covering Stripe billing, account session sync, real YouTube transcript ingestion, `node-pg-migrate`, Playwright E2E, generic formula solver, BM25-unified deterministic tools, identity isolation, and a subject-agnostic Feynman rubric.

This document separates **done**, **partial**, and **missing** against the product goal: *note-grounded adaptive learning at product scale, not MVP/demo-first.*

---

## Executive summary

| Layer | Completion | Notes |
| ----- | ---------- | ----- |
| Content engine (offline v2) | **~90%** | RAKE+TextRank, sections, prerequisites, BM25 unified across deterministic tools, PMI co-occurrence edges |
| Upload → course pipeline | **~85%** | PDF/DOCX/PPTX/TXT/MD/CSV + YouTube transcript live; OCR/audio still placeholders |
| Study Workspace (11 tools) | **~80%** | Note-grounded, scoped persistence, mobile stacking, full keyboard shortcut surface |
| Lesson surfaces | **~80%** | LessonView + PracticalLessonView fully note/LLM-grounded |
| Tasks & pedagogy | **~80%** | Generated tasks, FSRS→store, Beta-Bernoulli mastery, course-derived prereq edges |
| Analytics & Dashboard | **~75%** | Mastery map now derived from real `learnerModel + courses`; some metric depth still partial |
| RAG / Agent | **~80%** | BM25 + hybrid embedding rerank; chunk-level page citations after PDF `\f` fix |
| Client persistence | **~85%** | localStorage + IndexedDB + backup; whiteboard/scratchpad/concept-map scoped per task |
| Auth & full sync | **~80%** | JWT login/register, library + session pull/push, plan refresh, identity isolation |
| Phase 6 server | **~80%** | Proxy + JWT + metering + library + session + YouTube + Stripe + admin + Postgres migrations |
| Documentation | **~85%** | 11 MD files + new SECURITY/API/CHANGELOG/ALGORITHMS docs |
| Tests & CI | **~55%** | Vitest: contentAnalysis + retentionAnalytics + formulaSolver; Playwright E2E (1 spec) |
| i18n | **~35%** | Shell + onboarding EL; analytics/feynman/argument labels still EN-only |

**Overall product-scale readiness: ~80%** — past the MVP boundary; remaining work is depth (offline embeddings, OCR, full i18n, multi-user collaboration) rather than gaps.

---

## 1. Completed (stable)

### Content & pipeline
- `contentAnalysis.ts` v2 — segmentation, RAKE+TextRank, definitions, prerequisite inference, LexRank-lite summarization
- `processUpload()` — extract → LLM or offline outline → course → tasks → skill nodes
- `mergeOutlineIntoCourse()` — incremental extend mode
- `youtubeCaptions.ts` (server) + `youtubeTranscript.ts` (client) — full caption fetch including manual/ASR track selection and json3/XML parsing
- `formulaSolver.ts` — generic shunting-yard evaluator with `sin/cos/tan/log/ln/exp/sqrt/abs/round/floor/ceil/min/max`, `pi`/`e` constants, unary minus/plus, scientific notation; **14 unit tests**
- `pdfExtract.ts` — page boundaries serialized as `\f` so the RAG chunker can attach `p.X` citations
- BM25 unification — `noteContentExtractors.relevantExcerpt` and `topRelevantChunks` now retrieve through the same corpus the Agent uses
- PMI-based co-occurrence edges in concept map (sliding-sentence window, log-PMI > 0 filter)
- Distractor ranking — near-miss glossary picks via term-Jaccard + length similarity instead of "first 3"

### Study Workspace
- `workspaceNoteContent.ts` — 11-tool bundle, `hasSource` gate
- Section-aware steps (`buildWorkspaceStepsFromNotes`)
- Leitner → `submitLeitnerRating` → FSRS/mastery in store
- Concept map co-occurrence edges from source text
- **Mobile stacking** — `<md` viewports run single-pane with a swap toggle
- **Full keyboard surface** — `1-0` switch tool, `L/T/S` layout focus, `N` notes, `?` overlay (overlay now documents 8 bindings)
- **Scoped persistence** — whiteboard, scratchpad, concept-map positions all keyed per task (`progressKey`); legacy global key migrated on first run
- Subject-agnostic Feynman rubric — `accuracy` derives from concept + reference notes + glossary
- Empty states + upload CTA (no demo when empty)

### Surfaces & identity
- `LessonView.tsx` — note-grounded via `GroundedLessonContent` + LLM panels
- `PracticalLessonView.tsx` — exercises derived from notes, no demo stubs
- `Analytics` Mastery Map — built from `learnerModel + courses`, not hardcoded econ graph
- `buildInitialUser()` — production users start as a clean `Learner` identity (auth/onboarding populates name/email); `Alex Chen / Level 7` only appears with `showDemoContent: true`
- Layout: full-width pages, Shell `lg:ml-64`
- Demo isolation: `showDemoContent: false` default, `visibleCourses()` filter, `INITIAL_MISTAKES` lives in `src/demo/`

### RAG / Agent
- `rag.ts`, `sourceContext.ts` — BM25, optional embedding rerank, citations with real page numbers (after `\f` fix)
- `tokenize()` shared between RAG and content tools

### Persistence & sync
- `synapse:library-v1`, `synapse:session-v2`, IndexedDB for large text
- Auto-pull library + session on login
- Server `DATABASE_URL` → Postgres `accounts`, `account_libraries`, `account_sessions` (managed by `node-pg-migrate`)

### Backend (Phase 6)
- Express OpenAI-compatible proxy (`/v1/chat/completions`, `/v1/embeddings`)
- JWT `/auth/register`, `/auth/login`, `/auth/me`
- Usage metering + plan-aware quotas (`free` / `pro` / `team`)
- `/v1/library` GET/PUT, `/v1/session` GET/PUT
- `/v1/youtube/transcript` (CORS-bypassing transcript proxy)
- `/v1/billing/checkout`, `/v1/billing/status`, `/v1/billing/webhook` (real Stripe)
- `/v1/admin/stats` gated by `ADMIN_SECRET`
- Postgres migrations (`node-pg-migrate`) — `npm run migrate` + optional `RUN_MIGRATIONS_ON_START`

### Build & quality
- Code-split Vite build (~281 KB main entry vs former ~8.6 MB monolith)
- `npm run typecheck:all` gates client + server before build
- CI: client typecheck + test + build; server typecheck
- Vitest test suite: `contentAnalysis.test.ts`, `retentionAnalytics.test.ts`, `formulaSolver.test.ts` (24 unit tests)
- Playwright `e2e/youtube-upload.spec.ts` (run with `npm run test:e2e`; not yet in CI)

### Documentation (current)
| File | Covers |
| ---- | ------ |
| `README.md` | Quick start, scripts, persistence summary |
| `ARCHITECTURE.md` | Data flow, modules, server seam |
| `CONTENT_PIPELINE.md` | Offline + LLM, source modes, transcript ingestion |
| `STUDY_WORKSPACE.md` | 11 tools, persistence keys, shortcuts |
| `AGENT_RAG.md` | Retrieval, BM25 + hybrid rerank, Agent flow |
| `PERSISTENCE.md` | Keys, IndexedDB, backup, server sync |
| `DEPLOYMENT.md` | Frontend, proxy, Postgres, Stripe, migrations |
| `TESTING.md` | Vitest, Playwright, CI |
| `I18N.md` | Coverage matrix, hardcoded English list |
| `ROADMAP.md` | This file |
| `server/README.md` | Endpoints, auth, metering, migrations |
| `SECURITY.md` *(new)* | Threat model, JWT, Stripe webhook verification, `ADMIN_SECRET` semantics |
| `API.md` *(new)* | Authoritative `/auth/*` + `/v1/*` reference |
| `ALGORITHMS.md` *(new)* | RAKE+TextRank, BM25, PMI edges, FSRS, formula solver internals |
| `CHANGELOG.md` *(new)* | Versioned shipping log |
| `CONTRIBUTING.md` *(new)* | Local dev, branch convention, gates, doc-maintenance checklist |

---

## 2. Demo isolation — clean

After the recent sweep, no demo concept (Cournot/Bertrand/Elasticity/Pandas/Microeconomics) reaches the production user path:

| Path | State |
| ---- | ----- |
| `mockUser` identity | Gated: production users start as `Learner` and pick up name from auth/onboarding |
| Analytics Mastery Map | Derived from `learnerModel + courses`; no hardcoded econ graph |
| `feynmanRubric.computeRubric` | Subject-agnostic via `RubricContext` (concept + glossary + notes) |
| Prerequisite repairs | Source from `Course.topic.prerequisites`; `ECON_CONCEPT_EDGES` only when `showDemoContent: true` |
| `data/mockData.ts` shim | **Removed** |
| `SupplyDemandDiagram` | **Removed** (was unused) |
| `marketStructures` / `microeconomics` i18n keys | **Removed** (were unused) |
| `INITIAL_MISTAKES` | Moved to `src/demo/mockData.ts` (`DEMO_INITIAL_MISTAKES`) |
| `StudyWorkspace` default `quizConcept` | Now generic `'Study concept'`, never `'Market Structures'` |

---

## 3. Remaining algorithm depth (P1.5)

| Gap | Current | Target |
| --- | ------- | ------ |
| Local embeddings | Server-side via `/v1/embeddings` (proxy/key required) | Optional local model (transformers.js / WASM) |
| OCR / audio | UI types only | Tesseract.js OCR + Whisper-WASM audio pipeline |
| Worked examples | Section-aware paragraph picks | Step-by-step problem mining + scaffolded variants |
| Compare detection | Pattern + glossary | Markdown/HTML table mining + diff highlighting |
| Multi-turn debate | Static argument tree | Counter-argument generation via LLM with note grounding |
| Grounding verification | Source-cited prompts | Numeric span check between LLM output and chunk text |

---

## 4. Remaining UI/UX depth (P2)

| Gap | Status |
| --- | ------ |
| Concept map editing (add node / draw edge / delete) | Drag/zoom only; no edit affordances yet |
| Whiteboard pro features (image import, LaTeX render, shape select) | Drawing + text + formula label; no LaTeX render |
| Reader TTS + dyslexia font + click-to-define | Bionic + complexity heatmap; no TTS yet |
| Comparison interactive (sort/diff/CSV export) | Animated read-only render |
| Annotation sub-line text selection | Whole-line highlights only |
| A11y on SVG/canvas (aria, role, keyboard focus) | Limited; reduced-motion respected only in some flows |
| Cross-tool deep links (map → reader scroll, scratchpad → whiteboard render) | Feynman → map switch only |

---

## 5. Backend Phase 6 — current vs remaining

**Already shipped:**

| Done | Remaining |
| ---- | --------- |
| Express OpenAI-compatible proxy | Refresh tokens / email verify / password reset |
| JWT `/auth/*` | Server-side RAG index (post-sync) |
| Usage metering + plan-aware quotas | Per-route rate limiting + audit logs |
| `/v1/library` GET/PUT | Class management / teacher dashboard UI |
| `/v1/session` GET/PUT | TLS deploy guide + Helm/Compose example |
| `/v1/youtube/transcript` | Offline embedding model option |
| Stripe checkout + webhook + status | Multi-tenant org accounts |
| Admin stats endpoint | Collaborative whiteboard / annotations |
| Postgres `accounts`/`account_libraries`/`account_sessions` via `node-pg-migrate` | |

---

## 6. Phase ordering — current state

### Phase P0 — **done**
- [x] Mock isolation (`demoMode.ts` + `src/demo/`)
- [x] LessonView + PracticalLessonView note-grounded rewrites
- [x] `processUpload` only in App default path
- [x] Tasks from course, real activity heatmap/streak
- [x] Purge demo from production fallbacks (Analytics, identity, Feynman, prereq edges)

### Phase P0 correctness — **done**
- [x] `formulaSolver`: real `sin/cos/log/sqrt`, signed numbers, units, scientific notation
- [x] `pdfExtract`: `\f` page joining so citations resolve to `p.X`
- [x] `skillNodes`: token-Jaccard `isSameConcept` replaces `slice(0, 8)` collisions

### Phase P1 — **done**
- [x] Section-aware lesson steps
- [x] Cloze quiz with near-miss distractors
- [x] BM25-unified concept extractors
- [x] Concept map PMI co-occurrence edges
- [x] Leitner → store FSRS
- [x] IndexedDB large uploads
- [x] Client auth + library + session sync
- [x] YouTube transcript pipeline (server + client)
- [x] Generic formula solver
- [x] Whiteboard ↔ notes (formula insert)
- [x] Workspace mobile stacking + full keyboard surface
- [x] Scoped persistence per workspace task

### Phase P2 — **partly done, partly future**
- [x] Server session sync
- [x] Stripe + admin
- [x] Postgres + node-pg-migrate
- [x] Playwright E2E (one spec; CI integration pending)
- [ ] Offline embeddings model
- [ ] Full i18n (Analytics, Feynman, Argument labels still EN)
- [ ] Collaborative annotations / whiteboard
- [ ] Class / teacher dashboard
- [ ] OCR + audio pipelines

---

## 7. TypeScript & build gates

- `npm run typecheck` — client strict mode ✅ **0 errors**
- `npm run typecheck:all` — client + server ✅
- `npm run build` — runs `typecheck:all` then Vite build ✅
- `npm test` — Vitest (3 files / 24 tests) ✅
- `npm run test:e2e` — Playwright (1 spec) ✅ (not yet wired to CI)
- CI runs client typecheck/test/build + server typecheck

Previously reported latent issues (`navItems`, `studyTimeWeek`, duplicate imports) remain **resolved** — `tsc --noEmit` is the build gate.

---

## 8. Doc maintenance checklist

When changing behavior, update:

1. `ARCHITECTURE.md` — module map
2. `CONTENT_PIPELINE.md` — algorithm changes
3. `STUDY_WORKSPACE.md` — tool I/O
4. `ALGORITHMS.md` — algorithm internals (new file)
5. `API.md` — endpoint changes (new file)
6. `SECURITY.md` — auth/billing/secret changes (new file)
7. `CHANGELOG.md` — append release entry
8. `ROADMAP.md` — this file
9. `TESTING.md` — new test commands

---

See also: [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [TESTING.md](TESTING.md), [AGENT_RAG.md](AGENT_RAG.md), [SECURITY.md](SECURITY.md), [API.md](API.md), [ALGORITHMS.md](ALGORITHMS.md), [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md).
