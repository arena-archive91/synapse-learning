# Persistence

Client-side storage keys, server sync surfaces, and backup strategy.

## localStorage (`synapse:*`)

| Key | Content |
|-----|---------|
| `synapse:session-v2` | Learner model, tasks, activities, settings, XP, mistakes |
| `synapse:library-v1` | Upload metadata, glossary, generated courses |
| `synapse:whiteboard-strokes` | Whiteboard strokes — **scoped per workspace task** (`{ [progressKey]: Stroke[] }`) |
| `synapse:scratchpad-formulas` | Scratchpad formulas/vars/steps — **scoped per workspace task** |
| `synapse:concept-map-positions` | Concept-map node positions — **scoped per workspace task** |
| `synapse:workspace-progress` | Last viewed step per workspace key |
| `synapse:workspace-notes` | Per-task session notes |

Legacy keys auto-migrated on first load:
- `synapse:session-v1` → merged into `session-v2`
- `synapse.whiteboard.v1` (single global board) → moved into the scoped `__global` slot of `whiteboard-strokes`

## IndexedDB (`synapse-learning` database)

Large `extractedText` (≥ 48KB) offloaded from localStorage:

- Store: `file-text`
- Key: uploaded file `id`
- Hydrated on app load via `hydrateLibrary()`

Module: `src/lib/indexedDbStorage.ts`, `src/lib/libraryStorage.ts`

## Session backup

Settings → **Export backup** / **Import backup** — all `synapse:*` keys via `sessionBackup.ts`.

## Server sync

When signed in (Settings → Account & Sync), the client and server keep two
independent JSON blobs in sync. Sync is automatic on login (`syncAccountOnLogin`)
and exposed manually as **Pull / Push** buttons in Settings.

| Surface | Endpoint | Server table | Client module |
| ------- | -------- | ------------ | ------------- |
| Library (uploads + glossary + courses) | `GET/PUT /v1/library` | `account_libraries` | `librarySync.ts` |
| Session (learner model + tasks + activities + XP + settings) | `GET/PUT /v1/session` | `account_sessions` | `sessionSync.ts` |
| Plan tier | `GET /auth/me` | `accounts.plan` | `authClient.authMe` + `refreshAuthPlan` |

Server tables live in Postgres when `DATABASE_URL` is set. Schema is owned by
`node-pg-migrate` (`server/migrations/`); apply with `npm run migrate` or set
`RUN_MIGRATIONS_ON_START=true`. In dev mode without `DATABASE_URL` the server
falls back to in-memory repos.

Module: `src/lib/sessionSync.ts`, `src/lib/librarySync.ts`, `server/src/routes/library.ts`, `server/src/routes/session.ts`.

## Quotas

localStorage ~5MB typical browser limit. IndexedDB reduces quota errors for
large PDFs (the extracted text is offloaded automatically when ≥ 48KB).

## Demo isolation

- Demo courses filtered by `demoMode.ts` on persist (`stripDemoFromTasks`,
  `visibleCourses`).
- `showDemoContent: false` is the production default — demo seeds in
  `src/demo/` are never injected unless the setting is on.
