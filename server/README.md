# Synapse Learning — Phase 6 Server (proxy + auth + sync + billing)

A small but production-shaped Node service that backs the Synapse client. It
keeps the LLM provider key server-side, meters usage per account, persists
library + session data in Postgres, brokers Stripe billing, and exposes a
minimal admin endpoint.

The browser (Vite client) is OpenAI-API-compatible, so all of `llmClient` works
unchanged — only the base URL changes.

## Capabilities

| Area | Status |
| ---- | ------ |
| OpenAI-compatible chat + embeddings proxy | ✅ Streaming + JSON, exact token usage |
| JWT accounts (`/auth/register`, `/auth/login`, `/auth/me`) | ✅ |
| Per-account metering + plan quotas (`free`/`pro`/`team`) | ✅ |
| Postgres persistence (accounts, libraries, sessions) | ✅ via `node-pg-migrate` |
| Stripe checkout + webhook (`/v1/billing/*`) | ✅ Plan upgrades/downgrades |
| Library sync (`/v1/library`) | ✅ JSONB blob |
| Session sync (`/v1/session`) | ✅ Tasks, XP, mastery, settings |
| YouTube transcript proxy (`/v1/youtube/transcript`) | ✅ Used by client upload pipeline |
| Admin stats (`/v1/admin/stats`) | ✅ Behind `ADMIN_SECRET` |
| Refresh tokens, password reset, email verify | ⏳ Roadmap |
| Rate limiting + audit log | ⏳ Roadmap |

For a full request/response contract, see [`../API.md`](../API.md).

## Quick start

```bash
cd server
cp .env.example .env          # OPENAI_API_KEY + JWT_SECRET (required)
npm install
npm run dev                   # http://localhost:8787  (watch mode)
# or:
npm run typecheck
npm start
```

In the client **Settings → Managed proxy URL**, set:

```
http://localhost:8787/v1
```

The browser then sends **no provider key**; the proxy injects it. With
`ALLOW_ANONYMOUS=true` (default) the key-less client works immediately against
a shared anonymous account. To meter per real user, register/login from the
client; the client persists `Authorization: Bearer <jwt>`.

## Environment

Required:

| Variable | Purpose |
| -------- | ------- |
| `OPENAI_API_KEY` | Upstream provider key (server-only) |
| `JWT_SECRET` | Signs account JWTs — long random in production |

Common:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PORT` | `8787` | HTTP port |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `UPSTREAM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible base |
| `ALLOW_ANONYMOUS` | `true` | When `false`, every `/v1/*` requires a JWT |
| `DATABASE_URL` | – | Postgres connection (enables durable storage) |
| `RUN_MIGRATIONS_ON_START` | `true` | Apply pending migrations on boot |
| `FREE_MONTHLY_TOKEN_QUOTA` | `100000` | Free plan monthly token cap |
| `PRO_MONTHLY_TOKEN_QUOTA` | `1000000` | Pro plan monthly token cap |
| `TEAM_MONTHLY_TOKEN_QUOTA` | `5000000` | Team plan monthly token cap |
| `STRIPE_SECRET_KEY` | – | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | – | Stripe webhook signing secret (production) |
| `STRIPE_PRICE_PRO` | – | Stripe Price ID for Pro |
| `STRIPE_PRICE_TEAM` | – | Stripe Price ID for Team |
| `CLIENT_APP_URL` | `http://localhost:5173` | Stripe success/cancel redirect base |
| `ADMIN_SECRET` | – | Bearer secret for `/v1/admin/stats` |

## Database & migrations

Schema is managed with **[node-pg-migrate](https://salsita.github.io/node-pg-migrate/)** in `server/migrations/`.
Applied migrations are tracked in the `pgmigrations` table.

```bash
cd server
cp .env.example .env             # set DATABASE_URL
npm run migrate                  # apply pending migrations
npm run migrate:create add_x     # scaffold a new .cjs migration
npm run migrate:down             # roll back one migration
```

On boot, pending migrations run automatically when `DATABASE_URL` is set
(`RUN_MIGRATIONS_ON_START`, default `true`). For multi-replica production, run
`npm run migrate` once in CI/deploy and set `RUN_MIGRATIONS_ON_START=false`.

| Migration | Tables |
| --------- | ------ |
| `1740000000000_initial-schema` | `accounts`, `account_libraries`, `account_sessions` |

Without `DATABASE_URL`, all stores fall back to in-memory (lost on restart;
fine for dev).

## Endpoints (summary)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET`  | `/health` | – | Liveness + config echo (`upstream`, `anonymous`, `database`) |
| `POST` | `/auth/register` | – | Create account → `{ token, account }` |
| `POST` | `/auth/login` | – | Sign in → `{ token, account }` |
| `GET`  | `/auth/me` | Bearer | Account profile + usage |
| `POST` | `/v1/chat/completions` | Bearer/anon | Streaming + JSON chat proxy, metered |
| `POST` | `/v1/embeddings` | Bearer/anon | Embeddings proxy, metered |
| `GET`  | `/v1/usage` | Bearer/anon | Current month usage + quota remaining |
| `GET`  | `/v1/library` | Bearer/anon | Synced course library JSON |
| `PUT`  | `/v1/library` | Bearer/anon | Save library JSON |
| `GET`  | `/v1/session` | Bearer | Synced session blob (tasks/XP/mastery/settings) |
| `PUT`  | `/v1/session` | Bearer | Save session blob |
| `GET`  | `/v1/youtube/transcript?url=` | Bearer/anon | Fetch YouTube captions as text |
| `GET`  | `/v1/billing/status` | – | Reports whether Stripe is configured |
| `POST` | `/v1/billing/checkout` | Bearer | Create Stripe Checkout session for `pro`/`team` |
| `POST` | `/v1/billing/webhook` | Stripe sig | Webhook for `checkout.session.completed`, `customer.subscription.deleted` |
| `GET`  | `/v1/admin/stats` | Bearer + `x-admin-secret` | Account counts + uptime |

For full request/response shapes, see [`../API.md`](../API.md).

## Metering & quotas

- Token usage (prompt + completion) tracked per account per calendar month.
- Streaming requests set `stream_options.include_usage` so the upstream
  returns exact token counts in the final chunk; a char-based estimate is the
  fallback for non-conforming providers.
- `enforceQuota` rejects with `429` once the plan's monthly token cap is
  reached (`Retry-After` header included).
- Plan caps are configured via env (see table above).

## Stripe billing

1. Create products/prices in Stripe (Pro, Team) and set `STRIPE_PRICE_PRO` /
   `STRIPE_PRICE_TEAM`.
2. Set `STRIPE_SECRET_KEY` (and `STRIPE_WEBHOOK_SECRET` in production).
3. Point a webhook at `POST /v1/billing/webhook` for events
   `checkout.session.completed` and `customer.subscription.deleted`.
4. Client **Upgrade to Pro/Team** calls `POST /v1/billing/checkout` →
   redirects to Stripe → on return, the client calls `/auth/me` to refresh
   the plan badge.

In dev (`STRIPE_WEBHOOK_SECRET` unset) the webhook accepts unsigned bodies for
local testing — see [`../SECURITY.md`](../SECURITY.md) for the production
checklist.

## Production checklist

- ✅ Replace `store/accounts.ts` with Postgres — set `DATABASE_URL`.
- ✅ Stripe checkout + webhook → `account.plan` persists when DB is on.
- ⏳ Refresh tokens, password reset, email verification.
- ⏳ Per-account rate limiting (token bucket) and structured request logs.
- ⏳ Teacher/admin dashboard reading `/v1/usage` aggregates.
- 🔒 Deploy behind TLS; pin `ALLOWED_ORIGINS`; rotate `JWT_SECRET`; set
  `ADMIN_SECRET`; verify webhook signatures (`STRIPE_WEBHOOK_SECRET`).
