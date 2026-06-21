# Contributing

Thanks for working on Synapse. This guide describes the day-to-day flow for
adding features, fixing bugs, and keeping the build green.

## Repository layout

```
synapse-learning/
├── src/                Vite client (React + TS)
│   ├── components/         UI surface (Shell, Workspace, Library, Analytics, …)
│   ├── lib/                Pure logic (content engine, RAG, pedagogy, formula solver, …)
│   ├── store/              Zustand-style hooks + persistence orchestration
│   ├── data/               Real defaults (no demo content)
│   ├── demo/               Demo-only mock data (gated behind Settings)
│   └── types/              Shared TypeScript types
├── server/             Node/Express proxy (auth, sync, billing)
│   ├── src/                Routes, middleware, stores
│   └── migrations/         node-pg-migrate scripts
├── e2e/                Playwright specs
└── *.md                Top-level documentation (see below)
```

Key MD references:

- `ARCHITECTURE.md`, `CONTENT_PIPELINE.md`, `STUDY_WORKSPACE.md` — what each
  layer does and how it composes.
- `ALGORITHMS.md` — every learning/retrieval algorithm with file pointers.
- `API.md`, `server/README.md` — server contract.
- `PERSISTENCE.md`, `DEPLOYMENT.md`, `TESTING.md`, `SECURITY.md` — ops.
- `ROADMAP.md`, `CHANGELOG.md` — direction + history.

## Local setup

```bash
git clone …
cd synapse-learning
npm ci
npm run dev                  # http://localhost:5173

# In another terminal, optional server:
cd server
cp .env.example .env
npm ci
npm run migrate              # if DATABASE_URL is set
npm run dev                  # http://localhost:8787
```

Node 22+ is required (CI uses Node 22). Use `npm` (not `pnpm`/`yarn`) so
`package-lock.json` stays consistent.

## Branching & commits

- Branch off `master` (or `main` if your fork uses that). Use a topical
  prefix: `option-feature-x`, `fix/quiz-distractors`, `docs/api`.
- Commits should be small and self-describing. Conventional Commits
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`) is encouraged but not
  enforced.
- Squash trivial fixups before pushing to keep `git log` readable.

## Pre-PR checklist

Run these before opening a PR (CI will repeat them):

```bash
npm run typecheck:all   # client + server tsc --noEmit
npm test                # vitest unit tests
npm run build:fast      # vite build (no extra typecheck pass)
```

When relevant:

```bash
npm run test:e2e        # Playwright (auto-spawns dev server)
cd server && npm run typecheck
```

`tsc` is a build gate — keep it green. New code must not regress the
zero-error baseline.

## Adding a feature

1. **Code** — colocate types and helpers; prefer pure functions in `src/lib/`
   so they can be unit-tested without React.
2. **Tests** — add a `*.test.ts` next to the module. Cover at least the
   happy path and one edge case.
3. **Docs** — if the feature is user-visible or changes a public surface
   (settings, endpoints, persistence keys, algorithms), update the relevant
   MD file. Documentation is part of "done".
4. **Demo isolation** — never put demo data on the production code path.
   Mock content lives in `src/demo/` and is gated by `shouldShowDemo()`
   (see `src/lib/demoMode.ts`).
5. **i18n** — strings shown to users go through `src/lib/i18n.ts` (English +
   Greek). Avoid hardcoded English unless the surface is dev-only.

## Code style

- TypeScript strict mode is on. Don't widen types to `any` — use `unknown`
  with narrowing.
- Prefer small, named helpers over deeply nested expressions.
- Don't add comments that just narrate what the code does. Comments should
  explain non-obvious intent or constraints.
- Tailwind utility classes for styling; avoid CSS modules unless a component
  truly needs them.
- React functional components only. State lives in Zustand-shaped stores
  (`src/store/`) or `useState`.

## Algorithms & content engine

Anything that reads notes, generates quizzes, scores Feynman explanations, or
updates mastery should:

- Be deterministic given its inputs (no `Math.random` without a seed).
- Not depend on a specific subject (no hardcoded economics/Cournot/Bertrand
  vocabulary on the production path — see `feynmanRubric.ts` for the pattern).
- Cite its sources (RAG hits return citations like `p.X` / `¶X`; concept
  edges record the sentences they were inferred from).
- Have a unit test covering the math (see `formulaSolver.test.ts`,
  `contentAnalysis.test.ts`).

## Server contributions

- New routes: register in `server/src/index.ts` and document in `API.md` +
  `server/README.md`.
- DB schema changes: scaffold a migration with `npm run migrate:create
  <name>` and never edit applied migrations.
- Secrets must come from env (`config.ts`); never hardcode keys.

## Reviewing

When reviewing a PR, check:

- `tsc` clean? Tests covering the change?
- Any demo content leaking into production?
- Any new persistence key documented in `PERSISTENCE.md`?
- Any new endpoint documented in `API.md`?
- Any non-obvious algorithm/regex without a comment explaining why?
- i18n coverage for new user-facing strings?

## Releasing

There is no formal release cadence yet — `master` is the trunk. Notable
changes should land in `CHANGELOG.md` under an `Unreleased` heading; cut a
date-stamped section when you tag a release.

## Code of conduct

Be excellent to each other. Substantive disagreements are welcome; personal
attacks are not. The maintainers reserve the right to lock or remove
threads that violate this norm.
