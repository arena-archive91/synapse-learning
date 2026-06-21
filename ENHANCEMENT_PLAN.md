# Synapse Learning — Comprehensive Enhancement Plan

**Audit baseline:** All 15 MD files + full source tree reviewed.  
**Goal:** State-of-the-art production-scale adaptive learning platform.

---

## 1. Content Recognition & Course Generation Engine

### 1.1 Multi-Pass Deep Content Analysis
- **Discourse structure parsing** — RST-lite: nucleus-satellite, elaboration, cause-effect chains for richer lesson sequencing
- **Cross-section reference resolution** — Track anaphoric references to build document-level coherence graph
- **Hierarchical concept taxonomy** — Build `is-a` / `part-of` / `related-to` typed edges from definition patterns
- **Implicit prerequisite detection** — IDF-weighted first-occurrence tracking per concept
- **Multi-document synthesis** — Unified concept graph with conflict detection across multiple uploads

### 1.2 Advanced Keyphrase & Entity Extraction
- **TF-IDF corpus contrast** — Keyphrase importance vs. background corpus (~50K terms EN+EL static asset)
- **N-gram keyphrase candidates** — 3/4-gram phrases with POS-pattern filters (Adj+Noun, Noun+Prep+Noun)
- **Greek morphological analysis** — Lookup table for 2000 most common Greek word families
- **Named entity linking** — Link entities to Wikipedia/Wikidata concepts (offline compressed lookup)
- **Formula & equation detection** — Detect LaTeX/inline math, tag sections as "quantitative"
- **Code block detection** — Classify language (Python, JS, SQL), route to CodeEditor tool

### 1.3 Intelligent Course Structure
- **Topological sort** — Kahn's algorithm on prerequisite DAG for optimal topic ordering
- **Difficulty estimation** — Per-topic readability + vocabulary density + formula density
- **Adaptive splitting** — Auto-split topics >2000 words / merge topics <200 words
- **Learning objective alignment** — Validate Bloom objectives against actual content
- **Scaffolded example generation** — Same structure/different values, fill-in, reversed variants
- **Practice exercise taxonomy** — Classify by Bloom level, ensure 3+ levels per topic

### 1.4 Glossary Intelligence
- **Semantic grouping** — Cluster terms by embedding similarity into concept families
- **Cross-reference enrichment** — Hyperlinked glossary terms within definitions
- **Example sentence mining** — Best illustrative sentence per term from source
- **Difficulty ordering** — Terms ordered by prerequisite depth

---

## 2. Study Workspace — UI/UX & Functional Depth

### 2.1 Architecture Refactor
- Split `StudyWorkspace.tsx` (53KB) into: Shell, ToolRouter, LessonRail, Toolbar
- Lazy-mount tools on first activation (currently all 11 render simultaneously)
- Resizable split pane with draggable divider (min 25%, max 75%)
- Floating tool windows (picture-in-picture for Timer, Concept Map)

### 2.2 Concept Map
- **Interactive editing** — Add/delete nodes and edges, context menu, Delete key
- **Node types** — Visual distinction: concept (circle), definition (rect), example (diamond)
- **Mastery coloring** — Red < 0.3, yellow 0.3-0.7, green > 0.7
- **Cluster view** — Toggle auto-clustered view via `embeddingCluster.ts`
- **Click-to-drill** — Click node → Reader at provenance span; double-click → lesson step
- **Export** — PNG/SVG/JSON; minimap for large maps (>20 nodes)

### 2.3 Reader / Cognitive Reader
- **TTS** — Web Speech API with play/pause, speed control, sentence highlighting
- **Click-to-define** — Word lookup in glossary (exact + stem), fallback to Agent
- **Dyslexia mode** — OpenDyslexic font, 1.8 line spacing, wider letter spacing
- **Sub-line annotations** — Precise text selection (`window.getSelection()`) replacing whole-line
- **Reading progress** — Scroll position + time-on-section → analytics
- **Focus mode** — Dim everything except current paragraph, advance with spacebar

### 2.4 Whiteboard
- **Shape tools** — Rectangle, circle, arrow, connector line
- **Image import** — Paste/drag images onto canvas
- **LaTeX rendering** — KaTeX within canvas labels
- **Infinite canvas** — Pan beyond viewport with minimap
- **Layer management** — Lock background layers
- **Export** — PNG, SVG, PDF

### 2.5 Scratchpad / Formula Solver
- **Symbolic CAS** — Simplify, solve for variable, factor polynomials (degree ≤ 4)
- **Unit support** — Track physical units, warn on mismatches
- **Graph plotting** — Plot y=f(x) with interactive zoom/hover
- **Step-by-step solutions** — Show substitution and simplification steps
- **Matrix operations** — 2x2/3x3 multiplication, determinant, inverse
- **Calculation history** — Scrollable history per task, bookmark results

### 2.6 Leitner / Flashcards
- **Card templates** — Cloze, image-occlusion, Q&A, diagram-label
- **Reverse mode** — Definition → term
- **Audio cards** — TTS pronunciation on flip
- **Card editor** — Create/edit/flag cards
- **Deck management** — Group by topic, study mixed or focused
- **Bulk ops** — Mark all known, reset, export to Anki (TSV)

### 2.7 Debate / Argument Map
- **Interactive editing** — Add nodes, draw edges, reposition
- **LLM counter-arguments** — Generate grounded counter-arguments via Agent
- **Strength rating** — Weak/moderate/strong based on evidence density
- **Socratic questioning** — Generate probing questions per claim

### 2.8 Feynman Check
- **Voice input** — Web Audio + SpeechRecognition for spoken explanations
- **Progressive disclosure** — Reveal ideal explanation section by section after submission
- **Jargon detector** — Flag unexplained technical terms
- **Historical tracking** — Feynman scores over time per concept

### 2.9 Timer
- **Pomodoro mode** — 25/5 cycles with audio notification
- **Focus score** — Idle detection → estimated focus quality
- **Daily/weekly goals** — Study time targets with progress bar
- **Session summary** — Time, tools used, cards reviewed, mastery changes

### 2.10 New Tools
- **Mind Map** — Free-form hierarchical map, export as image
- **Cornell Notes** — Structured template with auto-populated cues from concepts
- **Practice Quiz Builder** — Create custom quizzes, share with peers
- **Progress Journal** — Per-session reflective journaling
- **Spaced Writing** — Periodic short-paragraph prompts, FSRS-scheduled

---

## 3. RAG / Agent Intelligence

### 3.1 Advanced Retrieval
- **Configurable BM25/embedding weights** — Auto-tune by document type
- **Cross-encoder reranking** — Rerank top-20 with cross-encoder model
- **Query expansion** — Synonyms from glossary + concept graph
- **Multi-hop retrieval** — Auto-fetch referenced definition chunks (up to 2 hops)
- **Sequential context** — Prefer chunks from same/adjacent sections
- **Server-side persistent vector index** — pgvector in Postgres

### 3.2 Agent Intelligence
- **Conversation memory** — Reference earlier Q&A in follow-ups
- **Clarification questions** — Ask when retrieval scores are low
- **Socratic mode** — Respond with guiding questions (configurable)
- **Multi-document grounding** — Explicit file-level citation
- **Structured output** — Bullet summary, table, timeline, flashcard suggestions
- **Action commands** — `/quiz X`, `/explain X`, `/compare X Y`, `/summarize ch.3`

### 3.3 Citation Quality
- **Verification** — Check token overlap between claim and cited chunk
- **Page-level deep links** — Click citation → Reader scrolls to page + highlights span
- **Confidence scores** — Show confidence indicator per citation

---

## 4. Pedagogy & Adaptive Learning

### 4.1 Unified Adaptive Scheduler
- Joint FSRS + Beta-mastery: use mastery posterior to modulate FSRS difficulty
- ZPD targeting: select tasks in 0.4-0.7 mastery range
- Per-concept forgetting rate after 10+ data points

### 4.2 Knowledge Tracing
- Bayesian Knowledge Tracing: P(learned), P(guess), P(slip), P(transit)
- DKT-ready data schema for future ML integration

### 4.3 Metacognitive Support
- Confidence calibration (Brier score chart)
- Error pattern detection ("You confuse X with Y")
- Study strategy suggestions based on learning patterns

### 4.4 Learning Path Optimization
- Prerequisite-aware task ordering (check prereqs before assigning)
- Interleaved practice across topics
- Desirable difficulties (intentional spacing after mastery 0.6+)

---

## 5. Backend (Phase 6) — Full Server Build-Out

### 5.1 Authentication
- Refresh tokens (15min access + 30d refresh in httpOnly cookie)
- Password reset (time-limited email link)
- Email verification (limited quotas until verified)
- OAuth: Google, GitHub, Apple Sign-In
- Account deletion with cascade
- Profile management (name, avatar, timezone, language)

### 5.2 Server-Side RAG Index
- pgvector extension: `chunks` table with `embedding vector(1536)`
- Auto-index on library sync (diff + embed new chunks)
- `POST /v1/rag/search` for cross-device retrieval
- Incremental indexing (only re-embed changed content hashes)

### 5.3 Teacher / Class Dashboard
- Class management (create, invite, join)
- Student progress view (mastery, activity, quiz accuracy)
- Assignment creation (deadline, topic filter, mastery target)
- Aggregate analytics (common misconceptions, at-risk students)
- Teacher annotations visible to class

### 5.4 Admin & Analytics
- Structured JSON logging (Winston/Pino)
- Usage analytics endpoint (DAU/WAU/MAU, token consumption, feature usage)
- Audit trail for auth + data mutations
- Multi-tenant organizations

### 5.5 Content Processing
- BullMQ async job queue for heavy processing (OCR, embeddings, LLM outline)
- Server-side PDF extraction (reduce client bundle)
- Webhook notifications (course complete, mastery milestone)

### 5.6 Billing
- Enterprise plan with custom quotas + SSO
- Usage-based overflow billing
- Stripe Customer Portal (`POST /v1/billing/portal`)
- 14-day Pro trial, auto-downgrade
- Coupon/promo codes

### 5.7 Real-Time
- WebSocket/Socket.IO for collaboration + notifications
- SSE for live mastery updates + streak notifications

---

## 6. Upload Pipeline & Formats

### New Formats
- EPUB, HTML/URL scraping, LaTeX (.tex), Jupyter (.ipynb)
- Audio (Whisper API server-side / Whisper.cpp WASM client)
- Video (extract audio → transcribe)
- Handwritten notes (specialized OCR model)

### Upload UX
- Drag-and-drop anywhere, batch upload, real progress bar
- Resume interrupted uploads (chunked)
- Clipboard paste, URL scraping (Readability.js)

### Preprocessing
- Table detection in PDFs (structured data → Compare tool)
- Figure/chart detection with caption extraction
- Bibliography parsing + citation linking
- PPTX speaker notes extraction

---

## 7. Analytics & Learner Intelligence

- Study time distribution (pie: time per tool)
- Learning velocity (concepts mastered/week trend)
- Predicted exam readiness (date → readiness %)
- Topic heatmap (topics × days)
- Forgetting curve visualization (actual vs. predicted)
- Concept dependency blocking analysis
- Engagement patterns (time-of-day, duration, day-of-week)
- Smart notifications (review reminders, streak alerts, milestone celebrations)
- Export reports as PDF

---

## 8. Collaboration & Multi-User

- Study groups with shared material + courses
- Shared annotations (filter by author)
- Collaborative concept map (real-time, color-coded by author)
- Discussion threads per concept/section
- Peer quiz exchange + explanation exchange
- Study buddy matching (server-side)
- Teacher material distribution + graded assignments

---

## 9. i18n — Full Coverage

- Complete EL: Analytics, Agent prompts, errors, Landing, Feynman, Onboarding
- Locale-aware dates/numbers/durations
- i18n linting script (detect unwrapped strings)
- Translation management JSON export for additional languages

---

## 10. Testing & Quality

- **Unit tests target 80%** on `src/lib/` (priority: noteContentExtractors, rag, pedagogy, uploadPipeline, taskFlowContent, courseMerge, feynmanRubric)
- **Server integration tests** — Supertest + test Postgres for all endpoints
- **E2E** — Upload→course→study, auth+sync, quiz flow, mobile viewport
- **Wire E2E into CI** + coverage threshold + bundle size budget + Lighthouse CI

---

## 11. Performance & Infrastructure

- Service Worker + offline PWA + background sync
- Web Worker for contentAnalysis (prevent UI jank)
- Virtual scrolling for large lists
- Server: connection pooling, ETag caching, embedding cache (Redis), CDN

---

## 12. Security

- bcrypt audit, brute-force protection (5 attempts → lock)
- 2FA (TOTP), session management (list/revoke)
- Encryption at rest, GDPR data export, retention policy
- Zod input validation, CSP headers, HSTS, dependency auditing

---

## 13. Accessibility

- WCAG 2.1 AA audit, screen reader ARIA attributes
- Focus management (trap in modals, return on close)
- Skip navigation, high contrast mode, keyboard-only navigation

---

## 14. Priority Matrix (Top 12 — Implement First)

| # | Enhancement | Effort | Impact |
|---|------------|--------|--------|
| 1 | Hierarchical concept taxonomy (typed edges) | Medium | High |
| 2 | Topological sort topic ordering | Low | High |
| 3 | Concept Map interactive editing | Medium | High |
| 4 | Reader TTS + click-to-define | Medium | High |
| 5 | Unified adaptive scheduler (FSRS + mastery) | Medium | High |
| 6 | Prerequisite-aware task ordering | Low | High |
| 7 | Refresh tokens + password reset (server) | Medium | High |
| 8 | Agent action commands (/quiz, /explain) | Medium | High |
| 9 | Scaffolded example generation | High | High |
| 10 | Unit test coverage to 80% | High | High |
| 11 | Full EL i18n | Medium | Medium |
| 12 | Wire E2E into CI | Low | Medium |

---

## Server Status

**The server already exists and is functional** (`server/` with 12 route files, Postgres, Stripe, OCR, NER, RAG, rate limiting, teacher dashboard). It is NOT just a proxy skeleton — it is a real backend. The remaining work is depth (refresh tokens, pgvector, class management, job queue) rather than scaffolding.

**Recommendation:** Yes, proceed with enriching the existing server. No new skeleton needed — extend the current `server/` with the §5 enhancements above.
