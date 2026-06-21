# Synapse Learning — Product-Scale Masterplan

> **Purpose.** This document is the authoritative, exhaustive enhancement plan
> that takes Synapse Learning from its current ~80% "post-MVP" state to a
> **state-of-the-art, product-scale, note-grounded adaptive learning platform**.
> It is the output of a full audit of every project Markdown file plus a
> ground-truth code verification of the upload→recognition→course→study→backend
> pipeline.
>
> It is written to the same engineering bar as `ALGORITHMS.md` and
> `ARCHITECTURE.md`: **deterministic, subject-agnostic, citable, unit-tested,
> no shortcuts for implementation speed, no omissions.** Every proposal cites
> the file/function it extends so it can be implemented without re-discovery.
>
> **Scope:** `synapse-learning/` only.
> **Status baseline:** audited June 2026 against the shipped client + `server/`.

---

## 0. How to read this plan

| Section | Content |
| ------- | ------- |
| §1 | **Documentation audit** — per-file findings + the critical doc⇄code drift table |
| §2 | **Grounded current-state capability matrix** — what *actually* ships today |
| §3 | **North-star principles** — the non-negotiable rules every enhancement obeys |
| §4 | **Workstream A — Note content-recognition algorithm** (primary emphasis) |
| §5 | **Workstream B — Course creation from notes** (primary emphasis) |
| §6 | **Workstream C — Study Workspace UI/UX + all 11 tools** (primary emphasis) |
| §7 | **Workstream D — Phase 6 backend to production scale** |
| §8 | **Cross-cutting** — testing, security/privacy, performance, a11y, i18n, observability |
| §9 | **Other surfaces** — Dashboard, Library, Analytics, Tasks, Agent, Settings, Onboarding, Landing |
| §10 | **Phased execution plan** — sequencing, dependencies, acceptance criteria, effort |
| §11 | **Risks & mitigations** |
| §12 | **Documentation reconciliation checklist** |
| §13 | **Appendix** — file/function pointer index |

Legend used throughout: **[SHIPS]** already on the production code path ·
**[PARTIAL]** built but dormant/narrowly wired · **[GAP]** genuinely missing ·
**[DOC-DRIFT]** code and docs disagree.

---

## 1. Documentation audit (scientific review of all `*.md`)

**Method.** Each of the 16 project docs was read in full and cross-checked
against the implementation in `src/lib/`, `src/components/`, and `server/src/`.
The vendored `public/pyodide/README.md` is a third-party package readme and is
**excluded** from project-documentation scope (it should not be treated as
authored docs; consider adding it to a docs-lint ignore list).

### 1.1 Headline finding — the documentation materially *understates* the product

The single most important audit result: **the code is significantly ahead of
the docs.** Several capabilities the docs describe as "placeholder", "roadmap",
or "not required" are in fact **shipped and wired**. This is the opposite of the
usual drift and it is actively misleading for contributors, investors, and any
"product-scale readiness" assessment. The `/health` endpoint already advertises
these features (`server/src/index.ts` lines 37–44: `ner: true`,
`refreshTokens: true`, `ocr: true`, `rag`, `rateLimitRpm`).

### 1.2 Critical doc⇄code drift table

| # | Doc claim | Reality in code | Evidence |
| - | --------- | --------------- | -------- |
| D1 | OCR is "a placeholder" / "on the roadmap but not wired" (`ALGORITHMS.md` §13, `CONTENT_PIPELINE.md` Limitations, `ROADMAP.md` §3) | **Full OCR pipeline ships**: text-layer gate → server Tesseract (proxy) → client `tesseract.js` fallback, image + scanned-PDF support, `eng+ell` | `src/lib/ocrExtract.ts` (`extractWithOcrFallback`, `needsOcr`, `renderPdfPagesToBase64`), wired in `pdfExtract.ts`; `server/src/routes/ocr.ts`, `server/src/lib/ocrServer.ts` |
| D2 | "All retrieval runs client-side. No server RAG endpoint is required" (`AGENT_RAG.md`); "Server-side RAG index" listed as remaining (`ROADMAP.md` §5) | **Server RAG endpoint ships**: `POST /v1/rag/query` semantic top-K over client chunks, metered | `server/src/routes/rag.ts`, `server/src/lib/ragServer.ts`, registered in `index.ts` |
| D3 | "Class management / teacher dashboard UI" remaining (`ROADMAP.md` §5); "Teacher/admin dashboard … ⏳" (`server/README.md`) | **Teacher dashboard endpoint ships**: `GET /v1/teacher/dashboard` (course/file/topic + usage aggregates + feature flags) | `server/src/routes/teacher.ts` |
| D4 | No server NER documented anywhere (`API.md` omits it) | **Server NER ships**: `POST /v1/nlp/entities`, consumed by the client enrichment path | `server/src/routes/nlp.ts`, `server/src/lib/ner.ts`, client `src/lib/entityExtract.ts` (`extractEntitiesEnriched`) |
| D5 | "no per-account RL beyond the monthly token quota"; per-account rate limiting is "roadmap" (`SECURITY.md`) | **Sliding-window RPM limiter ships** and is applied to all `/v1` routes (`app.use('/v1', rateLimit)`) | `server/src/middleware/rateLimit.ts`, `index.ts:49` |
| D6 | "Refresh tokens + token expiry/rotation", "Email verification + password reset" are roadmap (`SECURITY.md`, `server/README.md`) | **Token store ships** for `refresh` + `password_reset` kinds, Postgres-backed with hashing, TTL, revoke, hourly purge; `/health` reports `refreshTokens: true` | `server/src/store/tokenStore.ts`, `server/src/store/postgres.ts` (`createTokenRepo`) |
| D7 | `ALGORITHMS.md` describes recognition as RAKE+TextRank+PMI+definitions only | **Four additional recognition stages ship and are undocumented**: rule-based NER, embedding-space agglomerative clustering for topic discovery, concept→section salience binding, and sentence-level concept provenance spans | `src/lib/entityExtract.ts`, `src/lib/embeddingCluster.ts`, `src/lib/conceptSectionBinding.ts`, `src/lib/conceptProvenance.ts` (all wired; see §2) |
| D8 | `ARCHITECTURE.md`/`ALGORITHMS.md` say `processUpload` is the orchestrator "in `uploadPipeline.ts`" | `processUpload` actually lives in the **store** (`src/store/useStore.ts`); `uploadPipeline.ts` exposes the builders it calls | confirmed by usage search (`store.processUpload`, `onProcessUpload={store.processUpload}`) |
| D9 | "No hardcoded vocabulary on the production path" (`ALGORITHMS.md` design rule; `CONTRIBUTING.md`) | **A fallback production path still uses hardcoded economics vocabulary**: `TOPIC_KEYWORDS = ['supply','demand','elasticity','cournot','bertrand','pandas','numpy',…]` and `inferSubject()` defaults to `'Economics'` | `src/lib/uploadPipeline.ts:5–18, 169–175`; reached via `buildCourseFromUpload` when no outline is produced |

> **D9 is a genuine correctness defect**, not just drift: a notes set with no
> detected outline falls back to keyword-spotting econ terms and labels the
> course "Economics". This violates the platform's core promise and must be
> fixed (see §4.A0 and §5.B1).

### 1.3 Per-file verdicts

| File | Verdict | Required corrections (tracked in §12) |
| ---- | ------- | ------------------------------------- |
| `README.md` | Accurate, well-structured | Add OCR/image + server NER/RAG/teacher endpoints to feature list; fix "11-tool" if tool count changes |
| `ARCHITECTURE.md` | Mostly accurate; **D7, D8** drift | Add recognition stages (NER/cluster/section-binding/provenance); relocate `processUpload` to store; add `nlp/rag/ocr/teacher` server rows |
| `ALGORITHMS.md` | Best doc in repo, but **incomplete (D1, D7)** | Add §2.8 entity extraction, §2.9 embedding clustering, §2.10 concept→section binding, §5.5 concept provenance, §1 OCR branch; move OCR out of "roadmap" |
| `AGENT_RAG.md` | **D2** drift | Document optional `POST /v1/rag/query`; clarify client-side default vs server option |
| `CONTENT_PIPELINE.md` | **D1** drift | OCR is live (image + scanned PDF); only audio/Whisper remains |
| `STUDY_WORKSPACE.md` | Accurate to current tools | Expand once §6 tools land; document `MiniDashboard`, `InteractiveSimulator` |
| `API.md` | **Incomplete** — missing 4 route groups | Add `/v1/nlp/entities`, `/v1/rag/query`, `/v1/ocr`, `/v1/teacher/dashboard`, and any `/auth/refresh` + `/auth/password-reset` |
| `SECURITY.md` | **D5, D6** drift | Move rate limiting + refresh/reset tokens to "in place"; keep hardening items (rotation, audit log shipping) |
| `DEPLOYMENT.md` | Accurate | Add OCR/Tesseract resource notes; document `RATE_LIMIT_RPM` env |
| `PERSISTENCE.md` | Accurate | Add `conceptSpans` on `Course`; note any new keys from §6 |
| `ROADMAP.md` | Honest gap analysis but **stale (D1–D6)** | Re-baseline completion %; move OCR/server-RAG/teacher/rate-limit/refresh-tokens to "done"; import this plan's phasing |
| `CHANGELOG.md` | Good discipline | Add entries for OCR, NER, server RAG, teacher, rate limit, refresh tokens (apparently shipped without changelog entries) |
| `CONTRIBUTING.md` | Strong | Reinforce the "no hardcoded vocabulary" rule with the D9 fix as the cautionary example |
| `TESTING.md` | Accurate; coverage thin | Expand once §8 test pyramid lands |
| `I18N.md` | Accurate (~35% coverage) | Track to 100% per §8 i18n plan |
| `server/README.md` | **D3, D5, D6** drift | Mark teacher/rate-limit/refresh-tokens done; add nlp/rag/ocr rows |

**Net:** documentation quality is high but trust is compromised by drift.
A one-time **reconciliation pass (§12)** plus a CI doc-lint gate is the cheapest
high-leverage win in the entire plan.

---

## 2. Grounded current-state capability matrix

This is the *real* baseline (verified in code), correcting the docs. It is the
floor every workstream builds on.

### 2.1 Content recognition pipeline (the engine)

| Stage | Module / function | State | Notes |
| ----- | ----------------- | ----- | ----- |
| Text extraction (PDF/PPTX/DOCX/TXT/MD/CSV) | `pdfExtract.ts`, `uploadPipeline.extractFileContent` | **[SHIPS]** | `\f` page separators preserved for `p.X` citations |
| OCR (image + scanned PDF) | `ocrExtract.ts` (`extractWithOcrFallback`) + `server/lib/ocrServer.ts` | **[SHIPS]** (D1) | server Tesseract → client `tesseract.js`; `eng+ell`; ≤15 pages |
| YouTube transcript | `youtubeTranscript.ts` + `server/lib/youtubeCaptions.ts` | **[SHIPS]** | manual track preferred, ASR fallback |
| Audio (Whisper) | — | **[GAP]** | only genuinely missing ingestion mode |
| Sentence/section segmentation | `contentAnalysis.ts` (`splitSentences`, `detectSections`) | **[SHIPS]** | EN/EL punctuation + heading heuristics |
| Keyphrase extraction (RAKE+TextRank blend) | `contentAnalysis.ts` (`rakeScores`, `textRankScores`) | **[SHIPS]** | 0.6·RAKE + 0.4·TextRank |
| Rule-based NER | `entityExtract.ts` (`extractEntities`) | **[SHIPS]** (D7) | definitions+acronyms+keyphrases+proper nouns; **undocumented** |
| Server NER enrichment | `entityExtract.extractEntitiesEnriched` → `POST /v1/nlp/entities` | **[PARTIAL]** | only when proxy configured |
| Concept normalization (stem-lite) | `contentAnalysis.canonicalConcept` | **[SHIPS]** | EN/EL inflection stripping |
| Concept→section salience binding | `conceptSectionBinding.ts` (`filterConceptsForSection`) | **[SHIPS]** (D7) | prevents keyphrase bleed; **undocumented** |
| Embedding-space topic clustering | `embeddingCluster.ts` (`agglomerativeCluster`, `chooseClusterCount`, `medoidIndex`) | **[PARTIAL]** (D7) | wired but **requires embeddings/proxy**; no offline fallback |
| Definition + acronym mining | `contentAnalysis.extractDefinitions/extractAcronyms` | **[SHIPS]** | copula/colon/dash patterns EN/EL |
| Extractive summary (biased TextRank + MMR) | `contentAnalysis.extractiveSummary` | **[SHIPS]** | topic-aware teleport, lead bias, MMR dedup |
| Prerequisite inference | `contentAnalysis.ts` + `conceptEdges.ts` | **[SHIPS]** | title refs + shared-concept first-introducer |
| PMI co-occurrence edges | `noteContentExtractors.ts` | **[SHIPS]** | log-PMI>1, window=3 |
| Sentence-level concept provenance | `conceptProvenance.ts` (`buildConceptSpans`) | **[SHIPS]** (D7) | BM25+salience → `Course.conceptSpans`; **undocumented** |
| BM25 retrieval | `rag.ts` (`buildCorpus`, `retrieve`) | **[SHIPS]** | k1=1.5, b=0.75 |
| Hybrid embedding rerank | `sourceContext.ts` | **[PARTIAL]** | 0.6 BM25 + 0.4 cosine; proxy-gated |

### 2.2 Course creation + pedagogy

| Capability | Module | State |
| ---------- | ------ | ----- |
| Outline → Course (single sink) | `uploadPipeline.buildCourseFromOutline` | **[SHIPS]** |
| **Legacy fallback course builder** | `uploadPipeline.buildCourseFromUpload` | **[DOC-DRIFT/DEFECT]** (D9) hardcoded econ keywords |
| LLM outline | `courseGenerator.ts` | **[SHIPS]** proxy-gated, schema-bound |
| Offline outline | `contentAnalysis.analyzeContentToOutline` | **[SHIPS]** always-on fallback |
| Incremental merge | `courseMerge.ts` (`mergeOutlineIntoCourse`) | **[SHIPS]** |
| Task generation | `taskGenerator.ts`, `taskFlowContent.ts` | **[SHIPS]** |
| Bloom-aware objectives | `contentAnalysis.buildObjectives` | **[SHIPS]** |
| Beta-Bernoulli mastery | `pedagogy.ts` | **[SHIPS]** |
| FSRS-4 scheduling | `spacedRepetition.ts` | **[SHIPS]** but **independent** from mastery |
| Quiz generation (cloze/MC + near-miss distractors) | `noteContentExtractors.buildQuizFromNotes` | **[SHIPS]** |
| Feynman rubric (subject-agnostic) | `feynmanRubric.ts`, `feynmanCoach.ts` | **[SHIPS]** |

### 2.3 Study Workspace (the 11 tools + shell)

`StudyWorkspace.tsx` (53 KB) orchestrates: `DraggableConceptMap`, `CognitiveReader`,
`LeitnerBox`, comparison view, `StudyWhiteboard`, `FeynmanCheck`, `StudyTimer`,
`ArgumentMap`, `WorkspaceQuiz`, `FormulaScratchpad`, `AnnotationOverlay`, plus
`InteractiveSimulator`, `MiniDashboard`, and a `CommandPalette`. Mobile single-pane,
full keyboard surface, per-task scoped persistence — all **[SHIPS]**.

### 2.4 Backend (`server/`) — far more complete than documented

| Surface | Route/module | State |
| ------- | ------------ | ----- |
| OpenAI-compatible chat+embeddings proxy | `routes/proxy.ts`, `lib/upstream.ts` | **[SHIPS]** |
| JWT auth + `/auth/me` + usage | `routes/auth.ts`, `middleware/auth.ts` | **[SHIPS]** |
| Refresh + password-reset tokens | `store/tokenStore.ts` | **[SHIPS]** (D6) — verify routes expose them |
| Per-account metering + plan quotas | `middleware/usage.ts`, `store/accounts.ts` | **[SHIPS]** |
| Sliding-window rate limit | `middleware/rateLimit.ts` | **[SHIPS]** (D5) |
| Library + session sync (Postgres JSONB) | `routes/library.ts`, `routes/session.ts`, `store/postgres.ts` | **[SHIPS]** |
| Stripe checkout + webhook | `routes/billing.ts` | **[SHIPS]** |
| Admin stats | `routes/admin.ts` | **[SHIPS]** |
| YouTube transcript proxy | `routes/youtube.ts` | **[SHIPS]** |
| Server NER | `routes/nlp.ts`, `lib/ner.ts` | **[SHIPS]** (D4) |
| Server semantic RAG | `routes/rag.ts`, `lib/ragServer.ts` | **[SHIPS]** (D2) |
| Server OCR | `routes/ocr.ts`, `lib/ocrServer.ts` | **[SHIPS]** (D1) |
| Teacher dashboard aggregates | `routes/teacher.ts` | **[SHIPS]** (D3) |
| Postgres migrations | `migrations/` via `node-pg-migrate` | **[SHIPS]** |

**Conclusion:** the platform is *already past MVP*. The remaining distance to
"state-of-the-art product-scale" is **depth + reliability + breadth**, not
foundational gaps. The biggest single-line correctness fix is **D9**.

---

## 3. North-star principles (non-negotiable)

Every enhancement below MUST satisfy these. They extend `CONTRIBUTING.md`.

1. **Subject-agnostic.** No hardcoded domain vocabulary on any production path.
   (Fix D9; add a CI guard that greps for banned token lists in `src/lib/`.)
2. **Deterministic + reproducible.** Same notes → same course. All randomness
   seeded (`seedFromString`). Idempotent given `synapse:library-v1`.
3. **Citable + provenance-first.** Every concept, quiz item, edge, summary,
   and lesson sentence traces to a source span (`conceptProvenance.buildConceptSpans`
   extended platform-wide). Nothing the learner sees is unsourced.
4. **Offline-first, proxy-optional.** Every capability has a deterministic
   offline path; the proxy only *upgrades* quality (embeddings, LLM, server NER/RAG/OCR).
   Eliminate hard proxy dependencies (e.g. clustering needs an offline embedder).
5. **Grounded, never hallucinated.** LLM output is verified against source spans
   (numeric + entity span-check) before display; ungrounded claims are flagged.
6. **Accessible by default.** WCAG 2.2 AA; every SVG/canvas tool has a keyboard
   path + ARIA + screen-reader text. A11y is part of "done".
7. **Bilingual by default.** Every user-facing string flows through i18n (EN/EL)
   — drive `I18N.md` coverage to 100%.
8. **Measured.** Every algorithm ships with a gold-set eval + metric, not just a
   unit test (precision/recall/ROUGE/citation-accuracy). No "looks good" merges.
9. **Privacy-respecting.** Learner notes are sensitive. Local-first storage,
   explicit sync consent, deletion/export (GDPR), encryption in transit + at rest.
10. **No scope shortcuts.** Partial features are marked `[PARTIAL]` in docs and
    have a tracked completion task; we do not ship illusions of capability.

---

# 4. Workstream A — Note content-recognition algorithm

> **Primary emphasis.** This is the heart of the product: turning raw,
> heterogeneous notes into a faithful, structured, citable knowledge
> representation. The goal is a recognition engine that is *measurably* as good
> as a careful human reader at finding the concepts, definitions, structure,
> relationships, and evidence in a document — across subjects and languages —
> **without ever inventing content**.

**Architectural target.** Evolve the current linear pipeline into a typed,
multi-stage **Document Understanding Pipeline (DUP)** with a single canonical
intermediate representation (the `DocumentModel`) that every downstream consumer
(course builder, workspace tools, RAG, Agent) reads from. Today recognition
logic is split across `contentAnalysis.ts` (40 KB), `noteContentExtractors.ts`
(46 KB), `entityExtract.ts`, `conceptSectionBinding.ts`, `embeddingCluster.ts`,
and `conceptProvenance.ts` with overlapping responsibilities. Consolidate behind
a documented `DocumentModel` so improvements compound instead of fragment.

```
DocumentModel = {
  blocks: Block[]            // typed: heading | paragraph | list | table | code | figure | equation | caption
  readingOrder: number[]     // layout-aware order
  sentences: Sentence[]      // {text, blockId, charStart, charEnd, lang}
  sections: Section[]        // hierarchical (H1>H2>H3) with byte ranges
  entities: Entity[]         // typed concepts w/ provenance spans + salience
  definitions: Definition[]  // term → def + span + confidence
  relations: Relation[]      // typed edges (prereq | part-of | cause | contrast | example-of | defines)
  claims: Claim[]            // claim/evidence/counter with spans
  figures: Figure[]          // image/diagram regions + OCR/caption
  equations: Equation[]      // LaTeX/MathML + variables
  quality: QualityReport     // coverage, confidence, warnings
}
```

This `DocumentModel` becomes the contract documented in `ALGORITHMS.md`.

---

### 4.A0 — Fix the hardcoded-vocabulary defect (D9) — **P3, blocking**

**Problem.** `uploadPipeline.buildCourseFromUpload` + `extractTopicsFromText`
use `TOPIC_KEYWORDS` (econ/python terms) and `inferSubject()` defaults to
`'Economics'`. Reached whenever no outline is produced.

**Fix (minimal, root-cause).**
- Delete `TOPIC_KEYWORDS`, `extractTopicsFromText`, and `inferSubject`'s hardcoded
  branches. Route the no-outline case through `analyzeContentToOutline` (the
  offline engine already handles arbitrary text) so there is **one** path:
  notes → outline → `buildCourseFromOutline`.
- For genuinely empty/too-short input, produce an explicit "needs more material"
  course stub, **not** an econ-labeled course.
- Derive `subject` from the top cluster medoid label + entity types, never a
  hardcoded default; fall back to `"General"`.
- **Acceptance:** uploading a biology or law PDF never yields `subject: 'Economics'`;
  add a regression test in `uploadPipeline.test.ts` with non-econ fixtures.
- **CI guard:** a test that greps `src/lib/**` for domain token arrays and fails
  the build (enforces principle #1).

---

### 4.A1 — Ingestion depth: from "text out" to "structure out"

Current extraction flattens everything to a string with `\f` page breaks. To be
state-of-the-art we must preserve **layout and modality**.

| Upgrade | What | How / where | Priority |
| ------- | ---- | ----------- | -------- |
| **Layout-aware PDF** | Keep blocks, columns, reading order, headings vs body, headers/footers stripped | Use `pdfjs` text items' geometry (x/y/width/font-size) to cluster lines → blocks; infer headings from font-size percentiles. Extend `pdfExtract.ts` to emit `Block[]` not just text | High |
| **Table extraction** | Recover real tables (not just Markdown) from PDF/DOCX/PPTX | Geometric line/whitespace table detection → `table` blocks with cells; feeds `extractComparisons` tier-1 directly | High |
| **Math/equation recognition** | Detect inline + display math; capture LaTeX/MathML | PDF: font + symbol heuristics; images: server math-OCR (e.g. pix2tex/LaTeX-OCR) via a new `/v1/ocr?mode=math`; store `Equation{latex, variables}` | High |
| **Code-block recognition** | Detect source code regions + language | Monospace-font + indentation + lexical signals; language guess via lightweight classifier; feeds Pyodide practice (`pyodideRunner.ts`) | Medium |
| **Figure/diagram capture** | Extract images + nearby captions; OCR text inside figures | `pdfExtract` image ops → `Figure` blocks; reuse `ocrExtract`; caption binding by proximity | Medium |
| **Audio/video (Whisper)** | The one missing ingestion mode | Server job: upload → Whisper (whisper.cpp / faster-whisper) → timestamped transcript → same outline pipeline; client `audioTranscript.ts` mirrors `youtubeTranscript.ts` | High |
| **Handwriting (HTR)** | Handwritten notes | Server Tesseract LSTM / TrOCR for handwriting mode; confidence-gated | Low |
| **DOCX/PPTX structure** | Use the real XML (styles, headings, slide titles, speaker notes) | mammoth style map → headings; PPTX: title placeholder vs body vs notes | Medium |
| **EPUB / HTML / web import** | Broaden sources | `epubjs` + readability extraction; same `Block[]` output | Medium |
| **Encoding/language detection** | Robust UTF-8, mixed-script, RTL guard | per-block language tag (already partly in `detectedLanguage`); franc-style detector | Medium |

**Acceptance:** a multi-column PDF with tables, equations, and figures produces
a `DocumentModel` whose `readingOrder` matches human reading and whose tables and
equations are preserved as typed blocks (gold-set eval, §4.A8).

---

### 4.A2 — Segmentation & document structure

Current: regex sentence splitter + heading heuristics + flat fallback.

| Upgrade | Detail |
| ------- | ------ |
| **Hierarchical sections** | Build a real H1>H2>H3 tree (not flat `{heading,text}`), with byte ranges, so topics map to document structure. Extend `detectSections`. |
| **Discourse segmentation** | Detect intro/body/example/summary roles per paragraph (discourse markers already used in Feynman/debate — generalize into a `paragraphRole` classifier). |
| **Robust multilingual sentence splitting** | Replace brittle regex with an ICU/`Intl.Segmenter`-based splitter (handles EL abbreviations, decimals, ellipses, quotes). `Intl.Segmenter` is now broadly available; keep regex fallback. |
| **Reading-order repair** | Use layout geometry to fix multi-column / footnote interleaving before sentence splitting. |
| **De-duplication** | Detect repeated headers/footers/slide boilerplate and drop them so they don't pollute keyphrases. |

---

### 4.A3 — Concept & entity extraction (the recognition core)

Today: RAKE+TextRank blend → `entityExtract` (definitions+acronyms+keyphrases+proper)
→ `canonicalConcept` normalization → `filterConceptsForSection`. Strong baseline.
Upgrades to reach state-of-the-art **while staying offline-capable**:

| Upgrade | Detail | Where |
| ------- | ------ | ----- |
| **Offline embeddings (remove proxy dependency)** | Ship a small quantized embedding model via `transformers.js` (e.g. multilingual MiniLM / `bge-small`) running in a Web Worker + WASM. This unblocks clustering (`embeddingCluster`) and hybrid rerank (`sourceContext`) **without a proxy** — the #1 algorithm dependency to break | new `localEmbedder.ts`; wire into `sourceContext.ts`, `embeddingCluster` callers |
| **Embedding-augmented keyphrase ranking (KeyBERT-style)** | Re-rank RAKE/TextRank candidates by cosine to the document/section centroid → far better topicality than lexical-only | extend `rankKeyphrases` with optional embedding re-rank |
| **Multiword-term & terminology mining** | C-value/NC-value for nested multiword terms; glossary-aware boosting | new `termhood.ts`; feeds glossary + concepts |
| **Concept canonicalization v2** | Replace stem-lite with: lemmatization (small EL/EN lemma tables) + embedding-based synonym merge (cluster near-duplicate surface forms) + acronym↔expansion linking | extend `canonicalConcept`; back by `embeddingCluster` |
| **Salience model v2** | Combine TextRank centrality + embedding-centroid similarity + positional prior + definition-boost + frequency into a calibrated 0–1 salience; expose per-concept confidence | extend `conceptSalience` |
| **Entity typing** | Type concepts (term/method/person/dataset/theorem/event/metric) to drive richer UI + quiz variety | extend `ExtractedEntity.kind` taxonomy in `entityExtract.ts` |
| **Cross-lingual concepts** | Mixed EL/EN notes: map EL term ↔ EN term via embeddings so one concept node spans both | `localEmbedder` + canonicalization |
| **Coreference-lite** | Resolve "it/this/the model" back to the concept for better definition + relation mining | heuristic + window features |

**Determinism note.** Embeddings must be deterministic: pin model + quantization,
fixed tokenizer, no sampling. Cache by `(model, contentHash)` (pattern already in
`sourceContext.ts`). Offline embedder reuses that cache key.

---

### 4.A4 — Relations & knowledge graph

Today: prerequisite inference + PMI co-occurrence edges. Upgrade to a **typed
knowledge graph** — the substrate for concept maps, course ordering, and the
"explain how X relates to Y" Agent skill.

| Upgrade | Detail |
| ------- | ------ |
| **Typed relations** | Beyond `prereq`/`related`: `defines`, `part-of`, `example-of`, `causes`, `contrasts-with`, `depends-on`, `generalizes`. Mine from connective patterns (extend the debate/compare axis machinery) + dependency cues. Each edge stores its evidence sentence + confidence. |
| **Prerequisite DAG learning** | Combine: section order (weak), definitional dependency (term A used in def of B ⇒ A before B), and embedding-implied difficulty. Enforce acyclicity (topological repair). Drives course topic ordering (§5.B1) and Mastery Map. |
| **Pointwise→positive PMI + significance** | Replace raw PMI threshold with PPMI + a co-occurrence significance test (log-likelihood ratio) to cut spurious edges. |
| **Knowledge-graph object** | Persist a `ConceptGraph{nodes, edges}` on `Course` (alongside `conceptSpans`) so the workspace concept map and Analytics mastery map share one source of truth. |
| **Graph quality** | Detect orphan nodes, hubs, cycles; surface as `QualityReport` warnings. |

---

### 4.A5 — Definitions, claims & argument mining

Today: copula/colon definition patterns; heuristic debate-tree axes. Upgrade to
defensible **claim–evidence–counterclaim** extraction (the `ALGORITHMS.md` §13
roadmap item), still deterministic + citable.

| Upgrade | Detail |
| ------- | ------ |
| **Definition confidence + ranking** | Score each `(term, definition)` by pattern strength + salience + uniqueness; keep best per term; expose confidence in glossary UI. |
| **Claim detection v2** | Classify sentences into claim / evidence / elaboration / counter using connective + modality + numeric-density features (generalize `buildDebateTreeFromNotes`). |
| **Evidence linking** | Attach supporting/contradicting evidence sentences to each claim with spans → real argument graph (not a static tree). |
| **Stance & hedging** | Detect hedges ("may", "suggests", "ενδέχεται") to mark uncertainty in lessons + quizzes (don't quiz hedged claims as facts). |
| **Numeric/statistic extraction** | Pull figures, units, comparisons, dates → feeds scratchpad, exam numeric items, and grounding verification (§4.A6). |

---

### 4.A6 — Grounding & anti-hallucination (verification layer)

The platform's promise is "from your notes, not demo templates." When the LLM is
on (`courseGenerator`, `lessonGenerator`, `Agent`), we must **verify** its output
against source spans before showing it.

| Upgrade | Detail |
| ------- | ------ |
| **Span-level provenance everywhere** | Extend `conceptProvenance.buildConceptSpans` to lessons, quiz items, summaries, objectives — every generated unit carries `{fileId, charStart, charEnd}`. |
| **Numeric span-check** | (`ROADMAP.md` §3 item) Any number/date/quantity the LLM emits must match a number present in the cited chunk, else flag/strip. |
| **Entity span-check** | Named entities in generated text must appear in retrieved chunks; otherwise mark as "model-added background" (only allowed in `enriched` mode). |
| **Faithfulness score** | Per generated paragraph, compute lexical+embedding overlap with its citation; below threshold → regenerate or fall back to extractive. |
| **"Show the source" affordance** | Every generated sentence is click-to-source (drives Reader scroll-to-span; ties into §6 cross-tool deep links). |
| **Citation accuracy metric** | Track % of generated claims with a valid, verifiable citation (target ≥ 0.95 in strict mode). |

---

### 4.A7 — Pipeline orchestration, performance & resilience

| Upgrade | Detail |
| ------- | ------ |
| **Web Worker pipeline** | Move heavy recognition (embeddings, clustering, BM25 build) off the main thread into a worker; keep UI responsive on large PDFs. |
| **Streaming/progressive** | Emit the `DocumentModel` incrementally (sections first, then entities, then graph) so the course skeleton appears fast and enriches live. |
| **Incremental re-analysis** | Re-uploading an edited doc re-analyzes only changed sections (content-hash per block) before `mergeOutlineIntoCourse`. |
| **Backpressure + size limits** | Page caps, time budgets, and graceful degradation (offline-only when over budget). |
| **Telemetry (opt-in, local)** | Stage timings + confidence to surface in a "recognition report" and to find regressions. |

---

### 4.A8 — Evaluation harness (so quality is *measured*, not asserted)

Per principle #8, every algorithm above ships with a gold set + metric. This is
the difference between "MVP that looks fine" and "product-scale that we can trust".

| Eval | Metric | Gold set |
| ---- | ------ | -------- |
| Concept extraction | precision/recall/F1 vs human-annotated concepts | small multi-subject, multi-lingual corpus in `src/lib/__fixtures__/` |
| Definition mining | exact + fuzzy match accuracy | annotated term/def pairs |
| Section/structure | boundary F1, reading-order Kendall-τ | layout-annotated PDFs |
| Summarization | ROUGE-1/2/L + redundancy (MMR) check | reference summaries |
| Relations/prereq DAG | edge precision + cycle count | annotated graphs |
| Citation/grounding | citation accuracy, faithfulness | LLM-on transcripts with span checks |
| Quiz quality | distractor plausibility, answerability-from-source | item bank review |
| Determinism | byte-identical output across 3 runs | all fixtures |

Wire a `npm run eval` script (separate from unit tests) producing a scorecard;
gate algorithm PRs on "no regression vs baseline scorecard".

**Workstream A acceptance summary:** a single documented `DocumentModel`; no
proxy required for any recognition stage (offline embedder); typed knowledge
graph + claim graph on `Course`; span provenance + grounding verification on all
generated content; a reproducible eval scorecard checked into CI.

---

# 5. Workstream B — Course creation from notes

> **Primary emphasis.** Recognition (§4) produces a faithful `DocumentModel`;
> this workstream turns it into a **pedagogically sound, adaptive course** —
> ordered topics, scaffolded lessons, valid assessments, measurable objectives —
> entirely grounded in the learner's own material. The bar: a course a careful
> teacher would endorse, generated deterministically and offline-capably.

**Current path (verified):** `processUpload` (store) → `analyzeContentToOutline`
or `courseGenerator` → **single sink** `buildCourseFromOutline` →
`mergeCourseTasks` → `buildConceptSpans` → persist. The "single sink, two sources"
design is excellent and must be preserved. We deepen each stage and add quality
gates — never bypassing the sink.

---

### 5.B1 — Outline synthesis & topic structuring

| Upgrade | Detail | Where |
| ------- | ------ | ----- |
| **Cluster-driven topics (offline)** | Use §4 offline embeddings + `embeddingCluster.agglomerativeCluster` to discover topics from *semantic* structure, not just headings — works on heading-less notes. Medoid sentence → topic title candidate | `contentAnalysis.analyzeContentToOutline` |
| **Hybrid structure** | Reconcile document headings (strong signal) with semantic clusters (recovers missing structure / splits over-long sections) | new `outlineSynthesis.ts` |
| **Prerequisite-DAG ordering** | Order topics by the learned prereq DAG (§4.A4) with topological sort; break ties by document order + difficulty | `conceptEdges.ts` + DAG |
| **Difficulty calibration** | Per-topic difficulty from lexical complexity + concept density + prereq depth → drives Bloom ladder + pacing (replaces the static `beginner/intermediate` guess) | `buildObjectives` inputs |
| **Coverage guarantee** | Every salient concept (§4.A3) lands in exactly one topic via `filterConceptsForSection`; `QualityReport` flags orphans/duplicates | `conceptSectionBinding.ts` |
| **Title quality** | Human-readable topic titles from medoid + top noun-phrase, not raw keyphrase; de-duplicate near-identical titles | `outlineSynthesis.ts` |
| **Estimated time model** | Replace flat `estimatedMinutes` with a model: words × reading-rate + concept-count × practice-time + difficulty multiplier | `buildCourseFromOutline` |

---

### 5.B2 — Lesson generation (scaffolded, multi-panel)

Today: `groundedLesson.getNoteContentForLessonStep` (section-aware intro /
explanation / example / misconception / practice / summary) + optional LLM
panels (`lessonGenerator`, `workspaceLessonPanels`). Deepen into a real
instructional design.

| Upgrade | Detail |
| ------- | ------ |
| **Learning-science lesson template** | Each lesson follows a principled arc: hook → prior-knowledge link (prereq) → core explanation → worked example → guided practice → misconception check → retrieval practice → summary. Each panel grounded + cited. |
| **Worked-example mining v2** | (`ROADMAP.md` §3) Beyond detecting "Example" sentences: extract full problem→steps→answer structures and generate **scaffolded variants** (fade steps for practice). |
| **Misconception generation** | Derive likely misconceptions from near-miss distractors + contrastive concepts (§4) and address them explicitly. |
| **Multimodal lessons** | Render extracted equations (KaTeX), tables, figures, and code (with run via Pyodide) inline — not just prose. |
| **Worked example ↔ practice link** | Each example links to a generated practice item testing the same skill. |
| **Reading level adaptation** | Offer "explain simpler / deeper" that re-summarizes at a different complexity (extractive offline; LLM when on) — all grounded. |
| **Lesson faithfulness gate** | Apply §4.A6 verification to every generated panel; fall back to extractive when faithfulness < threshold. |

---

### 5.B3 — Assessment generation (valid, varied, psychometric)

Today: `buildQuizFromNotes` (cloze + MC, near-miss distractors, deterministic
shuffle) + exam/review/prereq flows (`taskFlowContent.ts`). Strong base; expand
into a real item bank with measurement.

| Upgrade | Detail |
| ------- | ------ |
| **Item-type variety** | Add: multi-select, ordering/sequence, matching, short-answer (rubric-graded via Feynman engine), numeric (with tolerance, from §4.A5 numerics), diagram-label, true/false-with-justification, code-output prediction. |
| **Item bank + blueprint** | Generate a *bank* per concept; assemble assessments by blueprint (concept coverage × Bloom level × difficulty) instead of one item per concept. |
| **Distractor quality v2** | Current Jaccard near-miss is good; add embedding-based plausibility + "common confusion" mining (from contrast relations §4.A4). |
| **IRT-lite calibration** | Track per-item difficulty/discrimination from real attempts (`activityLog`) → adaptive item selection (serve items near the learner's ability). |
| **Answerability check** | Every item must be answerable *from the cited span* (auto-verify the key is supported) — drop items that aren't. Ties to §4.A6. |
| **Cloze quality** | Blank the most *informative* term (TF-IDF/salience), not just glossary terms; avoid trivially guessable blanks. |
| **Free-response grading** | Reuse `feynmanRubric` (subject-agnostic) to grade short answers against objective key-terms + reference spans, with partial credit + feedback. |
| **Exam simulation** | Timed, blueprint-balanced mock exams with a results breakdown by topic/Bloom; feeds weak-area repair. |

---

### 5.B4 — Learning objectives & alignment

| Upgrade | Detail |
| ------- | ------ |
| **Objective ↔ assessment alignment** | Each objective maps to ≥1 assessment item and ≥1 lesson panel; surface a coverage matrix; flag unassessed objectives. |
| **Bloom calibration from content** | Choose Bloom ladder per topic from §5.B1 difficulty + concept relations (e.g. compare/contrast relations ⇒ Analyze items), not a fixed template. |
| **Measurable verbs + EL/EN** | Keep `buildObjectives` bilingual; expand verb templates; ensure objectives reference real concepts (`{{c1}}/{{c2}}`) only when present. |
| **Outcome tracking** | Per-objective mastery (not just per-concept) so progress maps to what the course *promised* to teach. |

---

### 5.B5 — Personalization & adaptivity (the "adaptive" in the tagline)

Today: Beta-Bernoulli mastery + FSRS-4 — but **independent** (`ALGORITHMS.md`
§13 flags this). This is the highest-value pedagogy upgrade.

| Upgrade | Detail |
| ------- | ------ |
| **Joint scheduler (FSRS × mastery)** | Combine FSRS stability/difficulty with the Beta posterior so review timing *and* item difficulty adapt together (the documented roadmap item). New `adaptiveScheduler.ts` unifying `spacedRepetition.ts` + `pedagogy.ts`. |
| **Knowledge-tracing** | Add a lightweight BKT/DKT-lite layer to predict per-concept recall and pick the next best activity (study vs review vs practice vs repair). |
| **Adaptive learning path** | A "what to do next" engine over the prereq DAG + mastery + retention risk → a daily plan (drives Dashboard "Next action" and `SessionQueueBar`). |
| **Prerequisite repair loop** | Already present (`pedagogy` repairs at mastery<0.45); upgrade to surface the *specific* prerequisite span + a targeted micro-lesson + recheck. |
| **Forgetting-risk surfacing** | Use the retention curve (`retentionAnalytics`) to proactively schedule reviews before predicted forgetting. |
| **Goal/exam-date pacing** | `examDate` already on `Course`; build a backward-planned schedule (spaced coverage of all topics before the date) with daily targets. |

---

### 5.B6 — Multi-document, merge & curriculum

| Upgrade | Detail |
| ------- | ------ |
| **Cross-document course** | Build one course from *several* uploads (lecture + textbook + slides), de-duplicating concepts and merging glossaries by canonical term (extend `courseMerge.mergeOutlineIntoCourse`). |
| **Conflict detection** | When two sources disagree (different definitions/numbers), surface both with citations rather than silently picking one. |
| **Curriculum / multi-course** | Group related courses into a program with cross-course prereqs (e.g. "Calculus I → II"). |
| **Versioned courses** | Re-upload edited notes → diff + version the course (what changed), preserving learner progress on unchanged topics (per-block content hash from §4.A7). |
| **Source freshness** | Track which course parts came from which file/version; "your notes changed — regenerate this topic?" |

---

### 5.B7 — Course quality gates (no low-quality courses ship)

A generated `Course` must pass an automated **rubric** before it's marked
`status: 'ready'` (today it's set unconditionally in `buildCourseFromOutline`):

| Gate | Check |
| ---- | ----- |
| Coverage | ≥ X% of salient concepts placed in a topic; no orphan topics |
| Grounding | every topic/lesson/glossary entry has ≥1 provenance span |
| Ordering | prereq graph is acyclic; no topic before its prerequisite |
| Assessment | every objective has an aligned, answerable item |
| Readability | titles/objectives pass a basic quality check (length, not raw keyphrase) |
| Determinism | re-running on the same notes yields the same course id + structure |

Below threshold → `status: 'needs_review'` with a `QualityReport` shown to the
learner ("we found limited structure in these notes — add headings or more
material"), never a silently bad course. Surface the report in the Library +
Upload result UI.

**Workstream B acceptance summary:** topics from semantic structure (offline);
DAG-ordered; lessons follow a learning-science arc with multimodal grounded
content; a calibrated item bank with varied, answerable, IRT-tracked items;
objectives aligned to items; a unified adaptive scheduler; multi-doc merge with
conflict surfacing; and an enforced course-quality rubric.

---

# 6. Workstream C — Study Workspace UI/UX & all tools

> **Primary emphasis.** The Study Workspace (`components/workspace/StudyWorkspace.tsx`,
> 53 KB) is where learning happens. Every tool must move from "functional" to
> "genuinely powerful + delightful + accessible", and the shell must feel like a
> cohesive professional study environment, not a tab bar over widgets.

**Design system first (foundation for everything below).** Before per-tool work,
establish a workspace design system so quality is consistent:

- **Tokens:** spacing, radius, typography scale, color (cyan/teal brand), elevation,
  motion — centralized in `index.css` + a `theme.ts` extension; light/dark/system
  already exists (`ThemeToggle.tsx`, `theme.ts`).
- **Primitives:** shared `Panel`, `Toolbar`, `EmptyState` (`WorkspaceEmptyState.tsx`
  exists — generalize), `Tooltip`, `Popover`, `Dialog`, `SegmentedControl`,
  `Slider`, `Tag`, `Skeleton`, `Toast` — so each tool stops re-inventing UI.
- **Interaction grammar:** consistent selection, hover, focus-ring, drag handles,
  context menus, and keyboard model across all canvas/SVG tools.
- **Motion:** one motion spec; honor `prefers-reduced-motion` everywhere (today
  only "some flows" — `ROADMAP.md` §4).

---

### 6.1 Per-tool deep enhancement

For each tool: **Now** (verified state) → **To product-scale** (concrete upgrades).

#### 6.1.1 Concept Map — `DraggableConceptMap.tsx` / `visuals/ConceptGraph.tsx`
- **Now:** drag/zoom of topic nodes + prereq/PMI edges; positions persisted per task.
- **To product-scale:**
  - **Editing** (`ROADMAP.md` §4 gap): add node, draw/delete typed edge, rename,
    merge/split — write back to the `ConceptGraph` (§4.A4) with provenance kept.
  - **Typed-edge rendering:** color/label by relation type (prereq/part-of/contrast…).
  - **Layout engine:** force-directed + hierarchical (DAG) toggle; auto-fit; cluster hulls.
  - **Mastery overlay:** node color = mastery band (`pedagogy`), size = salience.
  - **Filtering/search:** focus a concept + n-hop neighborhood; minimap for big graphs.
  - **Click-through:** node → Reader span (deep link §6.2), → quiz on that concept.
  - **Export:** PNG/SVG; share image.
  - **A11y:** keyboard graph navigation (arrow between nodes, Enter to focus), ARIA roles, text alternative listing nodes/edges.

#### 6.1.2 Reader — `CognitiveReader.tsx`
- **Now:** relevant excerpt via BM25; bionic + complexity heatmap.
- **To product-scale:**
  - **TTS** (`ROADMAP.md` §4 gap): Web Speech API read-aloud with word highlight,
    speed/voice control, EL/EN voices; pause/resume; sentence navigation.
  - **Click-to-define** (gap): tap any term → glossary popover (def + citation + "open in map").
  - **Dyslexia-friendly mode** (gap): OpenDyslexic/Atkinson font, line spacing, ruler/focus line.
  - **Scroll-to-span:** accept a `{fileId,charStart,charEnd}` target (from concept map / agent / quiz) and highlight+scroll (uses `conceptProvenance`).
  - **Full-source view:** toggle excerpt ↔ full document with all concept spans highlighted.
  - **Inline annotations:** integrate `AnnotationOverlay` so highlighting + notes happen in the Reader, not a separate tool.
  - **Reading progress + time:** track read coverage; feed analytics.

#### 6.1.3 Leitner / Flashcards — `LeitnerBox.tsx`
- **Now:** glossary/definition cards; FSRS-4 ratings → store (`submitLeitnerRating`).
- **To product-scale:**
  - **Card types:** cloze, image-occlusion (from figures §4.A1), term↔def, reverse, audio (TTS).
  - **Due-queue + heatmap:** show today's due, upcoming load, streak; honor joint scheduler (§5.B5).
  - **Card editing/suspend/bury/tag;** per-deck stats (retention, lapses).
  - **Keyboard-first review** (space=flip, 1–4=grade) + swipe on mobile; undo.
  - **Anki-style export/import** for power users.

#### 6.1.4 Compare — `extractComparisons` view
- **Now:** three-tier extraction; animated read-only render.
- **To product-scale** (`ROADMAP.md` §4 gap): sortable columns, dimension diff
  highlighting, add/remove dimensions, CSV/Markdown export, "compare these 3 concepts"
  picker, and provenance per cell.

#### 6.1.5 Whiteboard — `StudyWhiteboard.tsx`
- **Now:** canvas strokes + text + note-formula sidebar; per-task persistence.
- **To product-scale** (`ROADMAP.md` §4 gap): shape tools (rect/ellipse/arrow/line)
  with select/move/resize; **LaTeX rendering** of formulas (KaTeX) as objects; image
  import (incl. extracted figures); sticky notes; layers; infinite canvas + pan/zoom;
  templates (Cornell notes, mind-map); PNG/SVG export; optional real-time
  collaboration (§7). A11y: keyboard object nav + alt text.

#### 6.1.6 Feynman — `FeynmanCheck.tsx` + `feynmanRubric.ts` / `feynmanCoach.ts`
- **Now:** outline + gap hints + subject-agnostic rubric (accuracy/structure/plain-language/completeness).
- **To product-scale:** per-axis actionable feedback with cited reference spans;
  highlight which key terms were missed (link to Reader); voice input (speech-to-text);
  iterative attempts with score trend; "explain to a 10-year-old vs peer" modes;
  optional LLM coach that stays grounded (§4.A6).

#### 6.1.7 Timer — `StudyTimer.tsx`
- **Now:** session timer → activity stream.
- **To product-scale:** Pomodoro with configurable focus/break, auto-logging to the
  active concept, daily goal + streak, gentle break prompts, ambient focus sounds
  (opt-in), and integration with the adaptive plan ("review X for 10 min").

#### 6.1.8 Debate / Argument Map — `ArgumentMap.tsx`
- **Now:** static claim/support/refute tree from `buildDebateTreeFromNotes`.
- **To product-scale:** interactive argument graph from §4.A5 (claim↔evidence↔counter
  with spans), add/critique nodes, strength weighting, "steelman/counter" prompts,
  and grounded LLM counter-argument generation (the `ROADMAP.md` §3 item).

#### 6.1.9 Sandbox / Simulator — `InteractiveSimulator.tsx`
- **Now:** sliders + insight from notes (note-gated).
- **To product-scale:** generalize beyond economics-style sliders into a
  **parameter-explorer** driven by extracted formulas/relations: bind variables from
  `formulaSolver` + §4 numerics, plot outputs (charts), show the cited relationship,
  and support code-backed simulations (Pyodide) when notes contain code.

#### 6.1.10 Scratchpad — `FormulaScratchpad.tsx` + `formulaSolver.ts`
- **Now:** generic shunting-yard evaluator; per-task persistence.
- **To product-scale:** **symbolic CAS layer** (`ALGORITHMS.md` §13 roadmap) for real
  algebra steps (simplify/solve/differentiate) via a tiny CAS or `mathjs`; unit-aware
  computation; LaTeX input + render; step explanations; "insert into whiteboard/lesson";
  graphing of functions.

#### 6.1.11 Quiz — `WorkspaceQuiz.tsx`
- **Now:** single cloze/MC from notes, deterministic shuffle.
- **To product-scale:** all item types (§5.B3), immediate grounded feedback with the
  source span, confidence rating (`ConfidenceSelector.tsx` exists) → calibration
  (`CalibrationChip.tsx`), retry-wrong, adaptive difficulty, and per-attempt logging
  for IRT.

#### 6.1.12 Source / Annotations — `AnnotationOverlay.tsx`
- **Now:** whole-line local highlights per file.
- **To product-scale** (`ROADMAP.md` §4 gap): **sub-line text-selection** highlights,
  multi-color, margin notes, tags, jump-to-annotation index, and (with §7) shared
  annotations for teachers/peers. Merge visually into the Reader (6.1.2).

#### 6.1.13 Mini Dashboard — `MiniDashboard.tsx`
- Keep in-workspace; show concept mastery (`ConceptMasteryBars`), due reviews,
  session goal, and "next best action" from the adaptive engine (§5.B5).

---

### 6.2 Cross-tool integration

| Upgrade | Detail |
| ------- | ------ |
| **Deep links** (`ROADMAP.md` §4 gap) | A shared `workspaceFocus` (concept + optional source span) so map→reader, scratchpad→whiteboard, quiz→reader, feynman→map all navigate with context. Today only Feynman→map exists. |
| **Command palette v2** | `workspace/CommandPalette.tsx` exists; add fuzzy actions across tools, recent/most-used, and "jump to concept X in tool Y". |
| **Unified selection bus** | Selecting a concept anywhere updates all open tools (split view) to that concept. |
| **Session continuity** | Resume exactly where left off (tool + step + scroll + selection), per task. |
| **Notes everywhere** | The `N` session-notes panel becomes a persistent side-rail usable from any tool. |

---

### 6.3 Workspace shell, layout & navigation

- **Layouts:** lesson-only / tool-only / split (exists) → add resizable split,
  pop-out tool to window, and a 2×2 grid for power users.
- **Tool launcher:** a visual tool switcher (not just number keys) with descriptions
  + which tools have content for this concept (gray out empty ones).
- **Progress rail:** the step rail gets completion ticks, time-on-step, and quiz score.
- **Breadcrumbs:** course ▸ topic ▸ concept ▸ tool, all clickable.
- **Onboarding/coachmarks:** first-run guided tour of the workspace (dismissible).

---

### 6.4 Accessibility (WCAG 2.2 AA) — workspace-wide

This is currently the **weakest** area (`ROADMAP.md` §4: "A11y on SVG/canvas …
Limited"). Treat as release-blocking, not optional.

- Keyboard path for every action incl. canvas/SVG tools (concept map, whiteboard, argument map).
- ARIA roles/labels + live regions for dynamic content (quiz feedback, timer, agent).
- Visible focus rings; logical tab order; skip links; ESC/return stack already partial.
- Screen-reader text alternatives for every visualization (e.g. concept map → a navigable list/tree).
- Color-contrast audit in both themes; never color-only signals (add icons/labels).
- Respect `prefers-reduced-motion` for all animation/transitions.
- Target sizes ≥ 24px (2.2 AA); mobile touch targets generous.
- Automated a11y tests (axe) in CI on key screens.

---

### 6.5 Responsive, mobile & offline (PWA)

- **Mobile:** single-pane stacking exists; add bottom tool dock, gesture nav, and
  touch-optimized canvas (pinch-zoom, two-finger pan).
- **PWA:** installable, offline-first (service worker caches app + Pyodide + embedder),
  background sync of library/session when reconnected; "available offline" badge.
- **Performance:** virtualize long lists (glossary, cards, annotations); lazy-load tool
  bundles (already code-split); keep main-thread free via the §4 worker; target
  interaction-to-next-paint < 200ms on a mid-range phone.

---

### 6.6 Workspace empty/error/quality states

- Per-tool empty states exist; upgrade to **actionable** ("no formulas found in
  these notes — upload material with equations, or try the Reader").
- Surface the §5.B7 `QualityReport` in-workspace ("this concept has thin source
  coverage").
- Graceful degradation when proxy/LLM is down (offline templates) with a clear,
  non-alarming indicator.

**Workstream C acceptance summary:** a coherent workspace design system; every tool
upgraded from functional to powerful (editing, TTS, LaTeX, CAS, interactive compare,
sub-line annotations, varied quizzes); cross-tool deep linking via a shared focus
bus; WCAG 2.2 AA across all SVG/canvas tools; PWA offline; mobile-class touch UX.

---

# 7. Workstream D — Phase 6 backend to production scale

> **Important correction.** The premise "the client is ready for proxy, but the
> server (accounts, key vault, metering, RAG server, teacher dashboard) is a
> separate backend project outside this client-only repo" is **out of date**.
> This repo already contains a real, running server under `server/` (Express +
> Postgres + Stripe) that implements **accounts, key vault (server-held LLM key),
> metering, server RAG, NER, OCR, teacher dashboard, rate limiting, and
> refresh/password-reset tokens** (verified — see §2.4 and the drift table D1–D6).
>
> So the question is **not** "should we scaffold a skeleton?" — the skeleton
> exists. The real work is **hardening it to production scale** and **fully wiring
> the client to the advanced endpoints**. (If you'd still like a *separate*
> minimal Node/Edge proxy as an alternative lightweight deployment, that's a small
> add — see §7.6.)

### 7.1 Reconcile + fully wire what already exists

| Endpoint (exists) | Client wiring status | Action |
| ----------------- | -------------------- | ------ |
| `POST /v1/rag/query` | unclear — client RAG is local (`rag.ts`) | Add optional server-RAG path in `sourceContext.ts` for large libraries; document in `AGENT_RAG.md` |
| `POST /v1/nlp/entities` | wired (`extractEntitiesEnriched`) | Confirm enabled when proxy set; add to `API.md` |
| `/v1/ocr` | wired (`ocrExtract`) | Add to `API.md`; document math-OCR mode (§4.A1) |
| `GET /v1/teacher/dashboard` | **no client UI** | Build the teacher/class UI (§7.4) |
| refresh / password-reset tokens | `tokenStore` exists; verify `/auth/*` routes expose them | Wire `/auth/refresh`, `/auth/forgot`, `/auth/reset`; client silent-refresh in `authClient.ts` |
| `rateLimit` | active server-side | Surface 429 handling in client; document `RATE_LIMIT_RPM` |

**First task: an integration test sweep** hitting every server route so we *know*
the real contract, then rewrite `API.md` to match (it currently omits nlp/rag/ocr/teacher).

### 7.2 Security & secrets hardening (key vault, the right way)

The LLM key is already server-only (`lib/upstream.ts`). To "key vault" standard:
- **Secrets manager** integration (env → AWS Secrets Manager / GCP Secret Manager /
  Vault) instead of raw `.env` in prod; documented rotation.
- **JWT hardening:** short-lived access + refresh rotation (token store exists),
  `exp`/`iat`, key rotation w/ force-logout (`SECURITY.md` item).
- **Password hashing audit** (`SECURITY.md`): confirm scrypt cost / move to argon2id.
- **Audit log shipping:** structured logs for `/auth/*`, `/v1/billing/*`, `/v1/admin/*`
  → aggregator (today `console.log`).
- **Input validation everywhere:** zod schemas on all route bodies; payload size caps
  (already `15mb` global — tighten per route).
- **Content moderation** pass on Agent prompts (`SECURITY.md` roadmap).
- **CSP, HSTS, security headers** at the edge; CORS already allowlisted.
- **GDPR:** data export + delete endpoints; retention policy; encryption at rest for JSONB.

### 7.3 Server-side RAG at scale (real vector index)

Today `lib/ragServer.ts` retrieves over **client-supplied** chunks per request —
fine for small libraries, not for cross-device/large corpora.
- **Persistent vector store:** `pgvector` (Postgres extension — minimal infra add)
  storing per-account chunk embeddings; index on upload/sync.
- **Hybrid server retrieval:** BM25 (Postgres FTS / tsvector) + pgvector cosine,
  reranked — mirrors the client `sourceContext` blend.
- **Incremental indexing job** on `PUT /v1/library`; re-embed only changed files.
- **Privacy:** per-account isolation enforced in SQL (parameterized — already the pattern).

### 7.4 Teacher / class dashboard (real product surface)

The endpoint exists; build the product:
- **Org/multi-tenant accounts** (`ROADMAP.md` §5): institution → classes → students.
- **Class management:** invite/roster, assign courses/decks, due dates.
- **Per-student progress:** mastery, retention risk, time-on-task, weak areas
  (read from session/analytics) — privacy-gated, consented.
- **Cohort analytics:** class-level mastery heatmap, common misconceptions, item stats.
- **Assignment + grading:** push assessments; collect; rubric/IRT-graded; export grades.
- **Roles & permissions:** student / teacher / org-admin; RBAC middleware.

### 7.5 Async jobs, scaling & ops

- **Job queue** (BullMQ + Redis) for heavy work: Whisper transcription, OCR batches,
  embedding/indexing, course (re)generation — with progress polling (client already
  has the polling pattern in sibling projects).
- **Horizontal scale:** stateless API (rate-limit + token buckets move to Redis;
  today rate-limit is in-memory `Map` — **won't work multi-replica**, fix for scale).
- **Observability:** OpenTelemetry traces, metrics (latency, token usage, error rate),
  health/readiness probes (exists `/health`), dashboards + alerts.
- **Infra-as-code:** Dockerfile + docker-compose (Postgres+Redis+API) + Helm chart /
  Fly/Render config; the `DEPLOYMENT.md` "Helm/Compose example" gap.
- **Backups + migrations in CI** (already `node-pg-migrate`); PITR for Postgres.
- **Cost controls:** per-account + global LLM spend caps, model routing (cheap model
  for outline, better model for lessons), caching of identical generations.

### 7.6 Optional: standalone minimal Node/Edge proxy

If a lightweight, separately-deployable proxy is wanted (e.g. Cloudflare Workers /
Vercel Edge) as an alternative to the full Express server for users who only need
key-hiding + metering:
- A ~200-line Edge function mirroring `/v1/chat/completions` + `/v1/embeddings` with
  a KV-based monthly meter and the same auth header contract.
- Keep it API-compatible so the client's `llmClient.ts` is unchanged.
- **This is the "skeleton" offer** — say the word and it can be scaffolded; but note
  the full server already covers these capabilities.

**Workstream D acceptance summary:** `API.md` matches reality; client fully wired to
nlp/rag/ocr/teacher + token refresh; secrets in a vault with rotation + audit logs;
pgvector server RAG; a real multi-tenant teacher dashboard; Redis-backed rate-limit +
job queue for horizontal scale; IaC + observability; GDPR export/delete.

---

# 8. Cross-cutting concerns

### 8.1 Testing & QA (current ~55% → product-scale)
- **Unit:** broaden beyond the 3 files; cover `noteContentExtractors`, `pedagogy`,
  `spacedRepetition`, `courseMerge`, `librarySync`, `sessionSync`, new modules.
- **Eval harness (§4.A8):** `npm run eval` scorecard, gated in CI.
- **Component tests:** workspace tools (e.g. `LeitnerBox`→store), with mocked store.
- **E2E (Playwright):** expand the single spec to: PDF upload→course→lesson→quiz→analytics;
  sign-in & sync; teacher flow; offline/PWA — and **wire E2E into CI** (`TESTING.md` gap).
- **Server integration tests:** every route against ephemeral Postgres (`TESTING.md` gap).
- **A11y tests:** axe on key screens.
- **Visual regression** (Playwright snapshots) for the workspace tools.
- **Determinism tests:** same notes → same course (principle #2).

### 8.2 CI/CD
- Add eval + E2E + a11y + server-integration jobs; **doc-lint** job (§12); bundle-size
  budget check; preview deploys per PR.

### 8.3 Security & privacy
- See §7.2. Plus client: never log notes; clear sync consent UX; local "delete all my
  data" in Settings; encrypted backup export option.

### 8.4 Performance
- Recognition in a Web Worker (§4.A7); virtualized lists; route/tool code-splitting
  (exists); image/figure lazy-load; Lighthouse budget in CI; cache embeddings + generations.

### 8.5 Observability (client)
- Opt-in, privacy-preserving telemetry: recognition stage timings, error rates,
  feature usage — to find regressions and guide UX; surfaced in a "recognition report".

### 8.6 Internationalization (35% → 100%)
- Per `I18N.md` roadmap: audit Analytics/Agent/Landing for full EL; locale-aware
  dates/numbers; server error localization; keep content language independent of UI.
- CI check: no untranslated `t()` keys; lint for hardcoded user-facing strings.

### 8.7 Design system & content style
- Tokens + primitives (§6); a writing style guide for generated content (tone,
  citation format, EL/EN parity).

---

# 9. Other surfaces (page-by-page enrichment)

| Surface | Now | To product-scale |
| ------- | --- | ---------------- |
| **Dashboard** (`Dashboard.tsx`) | KPIs, activity, readiness | "Next best action" from adaptive engine (§5.B5); due-today; retention-risk; streak; weekly review; per-course progress; goals/exam countdown |
| **Library** (`Library.tsx`) | uploads, courses, glossary | Course quality badges (§5.B7); re-analyze/version; multi-doc course builder; search/filter/tag; bulk ops; storage usage; per-file recognition report |
| **Upload** (`UploadModal.tsx`) | files/paste/YouTube, extend mode | Audio upload; image/scanned (OCR exists — expose); drag-drop; progress with stage breakdown; live quality preview; source-mode explainer |
| **Analytics** (`Analytics.tsx`) | mastery map from real data | Per-objective outcomes; calibration; forgetting curve; time analytics; cohort compare (teacher); export; full i18n |
| **Tasks** (`Tasks.tsx`) | generated tasks | Adaptive daily plan; spaced-coverage scheduler to exam date; task types (study/review/practice/repair/exam); snooze/reorder |
| **Agent** (`Agent.tsx`) | RAG chat + citations | Grounding verification (§4.A6); multi-turn over course graph; "quiz me / explain / compare" skills; voice; server-RAG for big libraries; strict/enriched toggle in UI |
| **Settings** (`Settings.tsx`) | proxy, language, demo, theme, auth/sync | Account lifecycle (verify/reset via existing tokens); data export/delete (GDPR); offline-model toggle; accessibility prefs; notification prefs |
| **Onboarding** (`Onboarding.tsx`) | initial flow | Goal/exam setup; first-upload guided; sample-course try; workspace tour |
| **Landing** (`Landing.tsx`) | marketing | Honest capability messaging (post-audit); accessibility; full i18n; demo gated |
| **Notifications** (`NotificationsPanel.tsx`) | basic | Due reviews, streak risk, exam countdown, course-ready — opt-in push (FCM) |

---

# 10. Phased execution plan

Phases are ordered by dependency and value. Each item has an owner-agnostic
acceptance criterion; nothing merges without tests + docs (principle #10).

### Phase 3 — Truth & foundations (unblockers)
1. **Doc reconciliation (§12)** + CI doc-lint. *(highest leverage, lowest risk)*
2. **Fix D9** hardcoded-vocab defect (§4.A0) + regression test + CI vocab guard.
3. **Server route integration sweep** → rewrite `API.md` to reality (§7.1).
4. **Offline embedder** (`localEmbedder.ts`) → unblocks clustering + hybrid rerank
   without proxy (§4.A3). *Single biggest algorithm unlock.*
5. **`DocumentModel` contract** + Web Worker scaffold (§4 architecture).
6. **Eval harness** `npm run eval` + baseline scorecard (§4.A8).

### Phase 4 — Recognition & course depth (primary emphasis)
7. Layout-aware PDF + tables + equations + code/figure blocks (§4.A1).
8. Typed knowledge graph + prereq DAG + PPMI (§4.A4); persist `ConceptGraph` on `Course`.
9. Concept/entity v2 (embedding rerank, terminology, canonicalization v2, typing) (§4.A3).
10. Grounding/anti-hallucination verification layer (§4.A6).
11. Course quality gates + `QualityReport` UI (§5.B7); outline synthesis v2 (§5.B1).
12. Lesson learning-science arc + worked-example v2 + multimodal (§5.B2).
13. Assessment item bank + variety + answerability + IRT-lite (§5.B3); objective alignment (§5.B4).
14. Audio/Whisper ingestion (§4.A1) via server job (depends Phase 5 queue).

### Phase 5 — Workspace UX (primary emphasis) + adaptivity
15. Workspace design system + primitives + motion (§6 foundation).
16. Cross-tool deep-link focus bus (§6.2).
17. Tool upgrades batch 1: Concept-map editing, Reader (TTS/define/dyslexia), Quiz variety, Annotations sub-line (§6.1).
18. Tool upgrades batch 2: Whiteboard (shapes/LaTeX/images), Scratchpad CAS, Compare interactive, Argument map, Simulator, Leitner v2 (§6.1).
19. **Unified adaptive scheduler** (FSRS × mastery) + knowledge-tracing + daily plan (§5.B5).
20. WCAG 2.2 AA pass across workspace + axe in CI (§6.4).
21. PWA offline + mobile touch UX (§6.5).

### Phase 6 — Backend to production scale
22. Client wiring of nlp/rag/ocr/teacher + token refresh (§7.1).
23. Secrets vault + JWT/argon2 hardening + audit logs + zod validation + GDPR (§7.2).
24. pgvector server RAG + incremental indexing (§7.3).
25. Redis-backed rate-limit + BullMQ job queue (Whisper/OCR/index/generation) (§7.5).
26. Teacher/class dashboard UI + multi-tenant + RBAC + assignments/grading (§7.4).
27. IaC (Docker Compose + Helm) + OpenTelemetry + alerts + backups (§7.5).
28. *(Optional)* standalone Edge proxy (§7.6).

### Phase 7 — Breadth & polish
29. Full i18n to 100% (§8.6); other-surface enrichments (§9).
30. Collaboration (shared annotations/whiteboard via CRDT) (§7/§6).
31. Curriculum/multi-course + course versioning (§5.B6).
32. Notifications/push; visual regression; performance budgets.

**Sequencing rule:** Phase 3 before everything (it removes false assumptions and the
proxy dependency). §4/§5 (recognition+course) and §6 (workspace) can run in parallel
once the `DocumentModel` + design system land.

---

# 11. Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| **Doc drift recurs** | CI doc-lint + "docs are part of done" (CONTRIBUTING) + per-PR checklist |
| **Offline embedder bundle size/perf** | Quantized model, Web Worker, lazy-load, cache; feature-flag with graceful BM25-only fallback |
| **Determinism breaks** with embeddings/LLM | Pin models, seed everything, determinism tests in CI; LLM paths always have deterministic fallback |
| **Hallucination in LLM paths** | §4.A6 verification gate; default to extractive when faithfulness low; strict mode |
| **In-memory rate-limit/token buckets** don't scale | Move to Redis before multi-replica (§7.5) |
| **Scope explosion** | Phase gates; each item independently shippable; `[PARTIAL]` honesty |
| **Privacy/GDPR exposure** | Local-first, consent, export/delete, encryption (§7.2) |
| **A11y treated as optional** | Release-blocking + axe in CI (§6.4) |
| **Eval gold-set bias** | Multi-subject, multi-lingual fixtures; community-reviewed |

---

# 12. Documentation reconciliation checklist (do first)

The cheapest, highest-trust win. Apply these corrections (all derived from §1):

- [ ] `ALGORITHMS.md`: add §2.8 NER (`entityExtract`), §2.9 embedding clustering
      (`embeddingCluster`), §2.10 concept→section binding (`conceptSectionBinding`),
      §5.5 concept provenance (`conceptProvenance`), and an OCR branch in §1; move OCR
      out of §13 roadmap.
- [ ] `AGENT_RAG.md`: document optional `POST /v1/rag/query`; correct "no server RAG".
- [ ] `CONTENT_PIPELINE.md`: OCR is live (image + scanned PDF); only audio remains.
- [ ] `API.md`: add `/v1/nlp/entities`, `/v1/rag/query`, `/v1/ocr`,
      `/v1/teacher/dashboard`, and auth refresh/reset routes; verify exact shapes via §7.1 sweep.
- [ ] `SECURITY.md`: move rate-limiting + refresh/reset tokens to "in place"; keep
      hardening items (rotation, audit shipping, argon2).
- [ ] `server/README.md`: mark teacher/rate-limit/refresh done; add nlp/rag/ocr rows.
- [ ] `ARCHITECTURE.md`: relocate `processUpload` to the store; add recognition stages
      + server routes; reference `DocumentModel`.
- [ ] `ROADMAP.md`: re-baseline %; move OCR/server-RAG/teacher/rate-limit/refresh to done;
      import this plan's phasing.
- [ ] `CHANGELOG.md`: backfill entries for OCR, NER, server RAG, teacher, rate-limit, tokens.
- [ ] `PERSISTENCE.md`: document `Course.conceptSpans` (+ future `ConceptGraph`).
- [ ] `README.md`: add image/OCR + advanced server endpoints to features.
- [ ] `CONTRIBUTING.md`: cite D9 as the cautionary example for the no-hardcoded-vocab rule.
- [ ] Add `public/pyodide/README.md` to a docs-lint ignore (vendored, not project docs).
- [ ] Add CI **doc-lint** (link check, drift markers, untranslated-string check).

---

# 13. Appendix — file/function pointer index

**Client recognition/course:** `uploadPipeline.ts` (`buildCourseFromOutline`,
`buildCourseFromUpload`⚠️D9), `contentAnalysis.ts` (`analyzeContentToOutline`,
`extractiveSummary`, `buildObjectives`, `canonicalConcept`, `rankKeyphrases`,
`detectSections`, `splitSentences`), `noteContentExtractors.ts` (`buildQuizFromNotes`,
`extractComparisons`, `buildConceptMapFromCourse`, `buildDebateTreeFromNotes`),
`entityExtract.ts`, `embeddingCluster.ts`, `conceptSectionBinding.ts`,
`conceptProvenance.ts` (`buildConceptSpans`), `conceptEdges.ts`, `courseGenerator.ts`,
`courseMerge.ts`, `taskGenerator.ts`, `taskFlowContent.ts`, `groundedLesson.ts`,
`lessonGenerator.ts`, `practiceExercises.ts`.

**Retrieval/pedagogy:** `rag.ts`, `sourceContext.ts`, `pedagogy.ts`,
`spacedRepetition.ts`, `skillNodes.ts`, `retentionAnalytics.ts`, `activityLog.ts`,
`feynmanRubric.ts`, `feynmanCoach.ts`, `formulaSolver.ts`.

**Ingestion:** `pdfExtract.ts`, `ocrExtract.ts`, `youtubeTranscript.ts`, `pyodideRunner.ts`.

**Workspace UI:** `workspace/StudyWorkspace.tsx` + `DraggableConceptMap`, `CognitiveReader`,
`LeitnerBox`, `StudyWhiteboard`, `FeynmanCheck`, `StudyTimer`, `ArgumentMap`,
`WorkspaceQuiz`, `FormulaScratchpad`, `AnnotationOverlay`, `InteractiveSimulator`,
`MiniDashboard`, `CommandPalette`, `WorkspaceEmptyState`; `visuals/*`, `grounded/GroundedLessonContent.tsx`.

**Store/persistence:** `store/useStore.ts` (`processUpload`), `libraryStorage.ts`,
`indexedDbStorage.ts`, `librarySync.ts`, `sessionSync.ts`, `workspacePersistence.ts`,
`authClient.ts`, `i18n.ts`, `identity.ts`, `demoMode.ts`.

**Server:** `server/src/index.ts`; `routes/` (`auth`, `proxy`, `usage`, `library`,
`session`, `youtube`, `billing`, `admin`, `nlp`, `rag`, `ocr`, `teacher`);
`middleware/` (`auth`, `usage`, `rateLimit`); `lib/` (`upstream`, `ner`, `ragServer`,
`ocrServer`, `youtubeCaptions`); `store/` (`accounts`, `libraryStore`, `sessionStore`,
`tokenStore`, `postgres`); `migrations/`.

**New modules proposed:** `localEmbedder.ts`, `outlineSynthesis.ts`, `termhood.ts`,
`adaptiveScheduler.ts`, `audioTranscript.ts`, `documentModel.ts`, recognition worker.

---

> **Status:** this plan supersedes the forward-looking sections of `ROADMAP.md`
> once §12 is applied. Maintain it as the single source of truth for product-scale
> direction. Every phase item is independently shippable, tested, documented, and
> measured — **no shortcuts, no omissions, no illusions of capability.**
