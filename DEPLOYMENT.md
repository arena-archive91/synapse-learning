# Deployment

Deploy Synapse as a **static client** plus a **Node server** (proxy + auth +
sync + billing). The client keeps learner state in the browser and a copy on
the server; the server holds secrets, meters LLM usage, persists accounts +
libraries + sessions in Postgres, and integrates with Stripe.

## Architecture

```
Browser (Vite build → static files)
   │  localStorage + IndexedDB  (library + session, scoped per workspace task)
   │  Bearer JWT when signed in
   ▼
Synapse server (server/) — Express on :8787
   │  OPENAI_API_KEY            (server-only LLM secret)
   │  JWT auth + plan-aware quotas
   │  Stripe checkout + webhook
   │  YouTube transcript proxy
   ▼
PostgreSQL  (DATABASE_URL)  — accounts, account_libraries, account_sessions
   ▼
Upstream LLM (OpenAI-compatible)
```

## Client (frontend)

### Build

```bash
cd synapse-learning
npm ci
npm run typecheck:all
npm test
npm run test:e2e          # optional — Playwright spec
npm run build             # outputs dist/ with code-split chunks (~281 KB main entry)
```

Serve `dist/` from any static host (Netlify, Vercel, S3+CloudFront, nginx).
Configure SPA fallback to `index.html`.

### Environment / settings (runtime)

No build-time env vars are required. Users configure in **Settings**:

- **Proxy base URL** — e.g. `https://api.example.com` (client appends `/v1` for LLM)
- **Auth** — register/login; auto-pull library + session on sign-in; manual push/pull buttons; **Upgrade to Pro/Team** triggers a Stripe Checkout session
- **Plan refresh** — re-reads `/auth/me` after billing redirect

### CORS

The server must list your frontend origin in `ALLOWED_ORIGINS`.

## Server (proxy + auth + sync + billing)

### Build & run

```bash
cd server
cp .env.example .env
npm ci
npm run typecheck
npm run migrate           # apply Postgres schema (or set RUN_MIGRATIONS_ON_START)
npm start                 # or npm run dev for watch mode
```

### Required env

| Variable | Purpose |
| -------- | ------- |
| `OPENAI_API_KEY` | Upstream provider key (never exposed to browser) |
| `JWT_SECRET` | Signs account JWTs — use a long random value in production |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (no `*` in production) |

### Optional env

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Postgres connection string (enables durable account/library/session storage) |
| `RUN_MIGRATIONS_ON_START` | When `true`, apply pending migrations on boot |
| `ALLOW_ANONYMOUS` | Set `false` to require sign-in for all `/v1/*` routes |
| `PORT` | Listen port (default `8787`) |
| `UPSTREAM_BASE_URL` | OpenAI-compatible API base |
| `FREE_MONTHLY_TOKEN_QUOTA`, `PRO_…`, `TEAM_…` | Per-plan token limits |
| `CLIENT_APP_URL` | Where Stripe redirects after checkout (`?billing=success`) |
| `STRIPE_SECRET_KEY` | Stripe API key (server-only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret — **required in production** to verify webhook events |
| `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM` | Stripe price IDs for the upgrade buttons |
| `ADMIN_SECRET` | Bearer secret required to call `/v1/admin/stats` — **required in production**, see `SECURITY.md` |

### Postgres schema (managed by `node-pg-migrate`)

Tables created by `server/migrations/1740000000000_initial-schema.cjs`:

```sql
accounts            (id, email, password_hash, plan, stripe_customer_id, created_at, used_tokens, …)
account_libraries   (account_id PK FK, payload JSONB, updated_at)
account_sessions    (account_id PK FK, payload JSONB, updated_at)
```

Apply migrations:

```bash
cd server
npm run migrate                     # up to latest
npm run migrate:down                # rollback one
npm run migrate:create -- new-feature
```

Or set `RUN_MIGRATIONS_ON_START=true` so the server runs `runMigrations()`
before listening.

Without `DATABASE_URL`, the server falls back to in-memory repos (dev only —
data is lost on restart).

Example Docker Postgres:

```bash
docker run -d --name synapse-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=synapse -p 5432:5432 postgres:16
# DATABASE_URL=postgres://postgres:dev@localhost:5432/synapse
```

### Stripe billing

1. Create products/prices in Stripe (one for Pro, one for Team) and copy
   their price IDs into `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM`.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
3. Point a webhook at `POST /v1/billing/webhook` for events
   `checkout.session.completed` and `customer.subscription.deleted`.
4. The client's **Upgrade to Pro/Team** button calls `POST /v1/billing/checkout`,
   redirects the user to Stripe-hosted checkout, and on return refreshes the
   plan via `/auth/me`.

In dev (`STRIPE_WEBHOOK_SECRET` unset) the webhook accepts unsigned bodies for
local testing — see `SECURITY.md` for the production checklist.

### TLS & production checklist

- Terminate TLS at a reverse proxy (nginx, Caddy, cloud load balancer).
- Set `ALLOW_ANONYMOUS=false` for paid/managed tiers.
- Set `ADMIN_SECRET` to a long random secret — without it, every authenticated
  account can call `/v1/admin/stats`.
- Rotate `JWT_SECRET`; plan for refresh tokens before scale.
- Set `STRIPE_WEBHOOK_SECRET` so webhooks are signature-verified.
- Add rate limiting and structured logging at the edge.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR:

1. `npm ci`
2. `npm run typecheck:all`  (client + server)
3. `npm test`
4. `npm run build:fast`

Playwright (`npm run test:e2e`) is available locally; CI integration is on
the roadmap.

## Sync model

| Direction | Trigger | Endpoint |
| --------- | ------- | -------- |
| Pull library | Sign-in / Register / Settings → Pull library | `GET /v1/library` |
| Push library | Settings → Push library / on upload-finalize | `PUT /v1/library` |
| Pull session | Sign-in / Register / app mount | `GET /v1/session` |
| Push session | Settings → Push session / debounced on activity | `PUT /v1/session` |
| Plan refresh | After billing redirect / Settings → Refresh plan | `GET /auth/me` |

Merge strategy on library pull: union by id; remote wins on conflicts; course
topics merged by normalized title. Session pull/push uses last-write-wins on
the `account_sessions.updated_at` timestamp. See `src/lib/librarySync.ts` and
`src/lib/sessionSync.ts`.
