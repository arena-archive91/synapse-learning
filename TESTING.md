# Testing

Synapse uses **Vitest** for unit tests, **Playwright** for end-to-end flows,
and **GitHub Actions** for CI.

## Quick commands

From `synapse-learning/`:

```bash
npm run typecheck      # client: tsc --noEmit
npm run typecheck:all  # client + server typecheck
npm test               # vitest run (unit)
npm run test:watch     # vitest in watch mode
npm run test:e2e       # playwright run (auto-starts dev server)
npm run test:e2e:ui    # playwright UI mode
npm run build          # typecheck:all + vite production build
npm run build:fast     # vite build without typecheck (CI uses this)
```

Server:

```bash
cd server
npm run typecheck
```

## Unit tests

| File | Covers |
| ---- | ------ |
| `src/lib/contentAnalysis.test.ts` | Sentence splitting, section detection, concept normalization, RAKE/TextRank phrasing, end-to-end outline |
| `src/lib/retentionAnalytics.test.ts` | Retention rate, retention curve, weekly mastery from activity log |
| `src/lib/formulaSolver.test.ts` | Arithmetic precedence, unary minus, trig/log/sqrt, constants, variable substitution, error paths (14 tests) |

Total today: **3 files / 24 tests**.

Add tests next to the module under test: `foo.test.ts` beside `foo.ts`.

### Writing tests

- Prefer pure functions (`retentionAnalytics`, `librarySync`, `courseMerge`,
  `formulaSolver`, pedagogy helpers, `feynmanRubric`).
- Mock `localStorage` / IndexedDB only when necessary; most lib code is sync
  and deterministic.
- Use `vitest` globals (`describe`, `it`, `expect`) — configured in
  `vitest.config.ts`.

Example:

```bash
npm run test:watch -- formulaSolver
```

## End-to-end (Playwright)

| Spec | Covers |
| ---- | ------ |
| `e2e/youtube-upload.spec.ts` | Onboarding → Upload modal → YouTube URL → mocked `/v1/youtube/transcript` → course appears in Library |

Configuration: `playwright.config.ts` (Chromium, auto-spawns `npm run dev`).

Run a single spec:

```bash
npx playwright test youtube-upload --headed
```

E2E uses `data-testid` selectors on key flows (Landing CTA, onboarding
continue, sidebar nav, upload modal, library list).

> **CI integration is on the roadmap** — current CI runs unit tests + build
> only, so add E2E to the workflow before relying on it as a gate.

## CI

`.github/workflows/ci.yml` on `push` / `pull_request` to `main`, `master`, or
`option-*`:

1. Node 22
2. `npm ci`
3. `npm run typecheck:all`  (client + server)
4. `npm test`
5. `npm run build:fast`

A failing step blocks merge.

## Manual smoke checklist

After substantive changes, verify locally:

### Upload → course

1. Settings → Demo showcase **Hidden**
2. Upload a `.txt` or `.md` file (or paste a YouTube URL)
3. Library shows a generated course; tasks appear on Dashboard/Tasks
4. Reader/Concept Map/Feynman in the workspace pull from the actual material

### Study workspace

1. Open workspace from a task or course
2. Press `1`–`0` — tools switch (verify all 11)
3. Press `L`/`T`/`S` — layout swaps focus modes
4. Resize to phone width — single-pane mode kicks in, swap toggle visible
5. Leitner rating updates mastery (check Analytics / concept bars after)
6. Quiz attempts log activities

### Agent / RAG

1. With proxy URL set, Agent answers with citations from your upload
   (citations should include `p.X` for PDFs, `¶X` for plain text)
2. With LLM off, offline template still references retrieved excerpt

### Auth, billing & sync

1. Start server (`cd server && npm run dev`)
2. Settings → Register → library + session auto-sync
3. Upload locally → switch profile → sign in → library + session present
4. Click **Upgrade to Pro** → Stripe checkout opens (test mode) → success
   redirect refreshes plan

### Build size

After code-splitting, `npm run build` emits multiple chunks under
`dist/assets/` (main entry ~281 KB vs former ~8.6 MB single file).
Pyodide/mermaid load only when their routes/components load.

## Debugging failures

| Symptom | Check |
| ------- | ----- |
| `tsc` errors | Run `npm run typecheck:all` locally before push |
| Vitest mismatch | Activity timestamps / rounding — see existing tests |
| CORS on auth | `ALLOWED_ORIGINS` includes your Vite origin |
| Library/session pull empty | Server memory mode resets on restart; set `DATABASE_URL` for persistence |
| White screen after lazy load | Browser console for failed dynamic import; verify `base` in Vite config if hosted under subpath |
| Stripe webhook 400 | `STRIPE_WEBHOOK_SECRET` mismatch; double-check raw-body middleware order |
| Playwright timeout on upload | Check `**/v1/youtube/transcript**` route mock |

## Test gaps to fill

- Server integration tests for `/auth/*`, `/v1/library`, `/v1/session`,
  `/v1/billing/*` with test Postgres
- Component tests for `LeitnerBox` → store wiring (mock `useAppStore`)
- More E2E specs: PDF upload → lesson → quiz → analytics; sign-in & sync flow
- Wire `npm run test:e2e` into CI
