# Synapse Learning

Note-grounded adaptive learning platform: upload your material, get a
structured course, study in an 11-tool workspace, and practice with tasks
derived from your own content — not demo templates.

## Quick start

```bash
cd synapse-learning
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

> Run commands from the **`synapse-learning`** folder (not the parent
> workspace root).

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | Client `tsc --noEmit` |
| `npm run typecheck:all` | Client + server typecheck |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright (auto-spawns dev server) |
| `npm run build` | Typecheck + Vite production build (code-split chunks) |
| `npm run build:fast` | Vite build without typecheck (CI uses this) |
| `npm run preview` | Preview production build |

## Optional: LLM proxy + sync server (Phase 6)

For grounded lesson generation, embeddings, Agent chat, library + session
sync, and Stripe billing without exposing API keys in the browser:

```bash
cd server
cp .env.example .env       # OPENAI_API_KEY, JWT_SECRET (required)
npm install
npm run migrate            # if DATABASE_URL is set
npm run dev                # http://localhost:8787
```

In the app: **Settings → Managed proxy URL** → `http://localhost:8787/v1`.

See [`server/README.md`](server/README.md) and [`API.md`](API.md) for the
full endpoint contract.

## Core workflow

1. **Upload** notes (PDF, PPTX, DOCX, TXT, Markdown, YouTube URL) via
   **Upload Material**.
2. **Content pipeline** extracts text (PDFs use `\f` page separators for
   citations), builds an outline (offline engine or LLM), and creates a
   course + glossary + tasks.
3. **Tasks** are generated from the course outline (lessons, review,
   practice, exam prep).
4. **Study Workspace** and **LessonView** ground all 11 tools in uploaded
   text (`hasSource` gate; never demo content unless explicitly enabled).
5. **Agent** uses BM25 (+ optional embedding rerank) over your uploads for
   citations.

Demo showcase courses (Microeconomics, Python, etc.) are **hidden by
default**. Enable in **Settings → Demo showcase content** only for demos.

## Environment / client settings

| Setting | Location | Notes |
| ------- | -------- | ----- |
| Managed proxy URL | Settings | OpenAI-compatible base URL |
| Language | Settings | `el` / `en` (UI partial i18n) |
| Demo showcase | Settings | Shows seeded mock courses/tasks |
| Theme | Settings / Shell | light / dark / system |
| Auth | Settings | Register/login, push/pull library + session |

Provider API keys can be entered in Settings for direct client calls;
production should use the proxy.

## Persistence (client)

| Key | Content |
| --- | ------- |
| `synapse:library-v1` | Uploaded files metadata, glossary, generated courses |
| `synapse:session-v2` | Learner model, tasks, activities, settings |
| IndexedDB `synapse-learning` | Large `extractedText` (>48 KB) offloaded from localStorage |
| `synapse:whiteboard-strokes` | Whiteboard strokes per workspace task (legacy `synapse.whiteboard.v1` migrated automatically) |
| `synapse:scratchpad-formulas` | Formula scratchpad state per workspace task |
| `synapse:concept-map-positions` | Concept map node positions per workspace task |
| `synapse:workspace-progress`, `synapse:workspace-notes` | Per-task workspace state |

Session backup exports all `synapse:*` keys from Settings. Full key list in
[`PERSISTENCE.md`](PERSISTENCE.md).

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — data flow, modules, extension
  points.
- [`CONTENT_PIPELINE.md`](CONTENT_PIPELINE.md) — upload → outline → course.
- [`STUDY_WORKSPACE.md`](STUDY_WORKSPACE.md) — the 11 tools, inputs/outputs,
  empty states.
- [`ALGORITHMS.md`](ALGORITHMS.md) — every learning/retrieval/content
  algorithm with file pointers.
- [`AGENT_RAG.md`](AGENT_RAG.md) — BM25 + embeddings + source modes.
- [`PERSISTENCE.md`](PERSISTENCE.md) — keys, scoping, sync.
- [`API.md`](API.md), [`server/README.md`](server/README.md) — server
  contract.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — frontend + server hosting.
- [`SECURITY.md`](SECURITY.md) — threat model + production checklist.
- [`TESTING.md`](TESTING.md) — Vitest + Playwright + smoke checklist.
- [`I18N.md`](I18N.md) — EL/EN coverage.
- [`ROADMAP.md`](ROADMAP.md) / [`CHANGELOG.md`](CHANGELOG.md) — direction +
  history.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to add features safely.

## Project structure

```
synapse-learning/
├── src/
│   ├── components/       Pages + workspace tools
│   ├── lib/              Content engine, RAG, upload, pedagogy, formula solver
│   ├── store/            useStore (Zustand-like hook store)
│   ├── data/             Real defaults (no demo content)
│   ├── demo/             Demo-only mock data (gated)
│   └── types/            Shared TypeScript types
├── server/               Phase 6 server (proxy + auth + sync + billing)
├── e2e/                  Playwright specs
└── *.md                  Documentation (above)
```

## Build notes

- Production build emits **multiple chunks** under `dist/assets/` (~281 KB
  main entry; Pyodide and Mermaid load on demand).
- Pyodide is copied on `postinstall` for in-browser Python exercises when
  notes contain code.
- `tsc --noEmit` is a build gate (CI runs `typecheck:all`).

## License

Private / project-specific — see repository owner.
