# Synapse Server — HTTP API reference

Authoritative reference for every endpoint exposed by `server/`. The default
base URL in development is `http://localhost:8787`.

- **OpenAI-compatible** routes live under `/v1` (`/v1/chat/completions`,
  `/v1/embeddings`).
- **Account routes** live under `/auth` (register, login, refresh, logout,
  forgot/reset password, me).
- **Synapse-specific routes** live under `/v1` (library, session, billing,
  YouTube, admin, NLP entities, RAG query, OCR, teacher dashboard).

## Authentication

```
Authorization: Bearer <jwt-from-/auth/login>
```

JWTs are signed with `JWT_SECRET`. Access tokens are **short-lived**
(`ACCESS_TOKEN_TTL`, default `15m`); a longer-lived **refresh token**
(`REFRESH_TOKEN_TTL_DAYS`, default `30`) is returned alongside and exchanged at
`POST /auth/refresh`. Endpoints marked **Bearer/anon** accept an anonymous
fallback when `ALLOW_ANONYMOUS=true`; routes marked **Bearer** require a real
account. A per-account/IP **rate limit** applies (`RATE_LIMIT_RPM`, default
`120`) and returns `429` when exceeded.

## Errors

All errors are JSON:

```json
{ "error": "human-readable message", "detail": "optional upstream excerpt" }
```

Common codes: `400` (validation), `401` (auth), `403` (admin), `409`
(duplicate email), `429` (quota exceeded), `500`/`502` (server/upstream).

---

## Health

### `GET /health`

```json
{ "ok": true, "upstream": "https://api.openai.com/v1", "anonymous": true, "database": false }
```

---

## Auth

### `POST /auth/register`

Body:

```json
{ "email": "alex@example.com", "password": "min-8-chars" }
```

Response `201`:

```json
{
  "token": "<access-jwt>",
  "accessToken": "<access-jwt>",
  "refreshToken": "<refresh-jwt>",
  "account": { "id": "acc_…", "email": "alex@example.com", "plan": "free" }
}
```

Errors: `400` invalid email/password, `409` email already registered.

### `POST /auth/login`

Body: same shape as register.

Response `200`: same shape as register.

Errors: `400` malformed, `401` invalid credentials.

### `POST /auth/refresh`

Body: `{ "refreshToken": "<refresh-jwt>" }`. Response `200`:

```json
{ "token": "<access-jwt>", "accessToken": "<access-jwt>", "refreshToken": "<rotated-refresh-jwt>" }
```

Errors: `401` invalid or expired refresh token.

### `POST /auth/logout`  (Bearer)

Response: `{ "ok": true }`. Access tokens are short-lived; refresh rotation
handles revocation.

### `POST /auth/forgot-password`

Body: `{ "email": "alex@example.com" }`. Always responds `{ "ok": true }` (no
account enumeration). In non-production the response also includes a
`resetToken` to ease local testing.

### `POST /auth/reset-password`

Body: `{ "resetToken": "<token>", "password": "min-8-chars" }`. Response
`{ "ok": true }`. Errors: `400` missing/short password, `401` invalid or
expired reset token.

### `GET /auth/me`  (Bearer)

```json
{
  "account": { "id": "acc_…", "email": "alex@example.com", "plan": "pro" },
  "usage": { "month": "2026-06", "promptTokens": 1234, "completionTokens": 5678, "totalTokens": 6912, "quota": 5000000, "remaining": 4993088 }
}
```

---

## OpenAI-compatible proxy

Both endpoints below are wire-compatible with OpenAI; the existing client
`llmClient` works unchanged.

### `POST /v1/chat/completions`  (Bearer/anon)

Request: standard OpenAI chat shape. Set `stream: true` for SSE. The proxy
adds `stream_options.include_usage = true` upstream so the final chunk
contains exact token counts; a char-based estimate is used as fallback.

Streaming response: `text/event-stream`. Final non-`[DONE]` event includes:

```json
{ "usage": { "prompt_tokens": 412, "completion_tokens": 217, "total_tokens": 629 } }
```

JSON response (when `stream` is false): the upstream JSON, unchanged.

Errors: `429 quota_exceeded` (with the proxy's plan caps), `502 Upstream error`.

### `POST /v1/embeddings`  (Bearer/anon)

Standard OpenAI embeddings request/response, metered (prompt tokens only).

---

## Usage

### `GET /v1/usage`  (Bearer/anon)

```json
{ "month": "2026-06", "promptTokens": 412, "completionTokens": 217, "totalTokens": 629, "quota": 100000, "remaining": 99371 }
```

---

## Library sync

### `GET /v1/library`  (Bearer/anon)

```json
{
  "uploadedFiles": [ /* UploadedFile[] */ ],
  "glossaryEntries": [ /* GlossaryEntry[] */ ],
  "generatedCourses": [ /* Course[] */ ]
}
```

### `PUT /v1/library`  (Bearer/anon)

Body: same shape (each field defaults to `[]` when omitted). Returns the
stored payload. Last-write-wins; the client merges by `id` and normalized
title before pushing — see `src/lib/librarySync.ts`.

---

## Session sync

### `GET /v1/session`  (Bearer)

```json
{
  "learnerModel": null,
  "dashboardStats": null,
  "tasks": [],
  "xp": 0,
  "betaMastery": [],
  "firstAttemptKeys": [],
  "openMistakes": [],
  "activities": [],
  "userSettings": null
}
```

### `PUT /v1/session`  (Bearer)

Body: any subset of the GET shape; missing fields default to empty.
Returns the stored payload.

---

## YouTube transcripts

### `GET /v1/youtube/transcript?url=https://youtu.be/...`  (Bearer/anon)

Server fetches the public timed-text track, normalizes it to plain text and
returns:

```json
{ "videoId": "abc123", "transcript": "..." }
```

Errors: `400` bad/missing URL, `404` no captions, `500` upstream parse error.
The client `uploadPipeline.ts` calls this via the configured proxy URL.

---

## NLP — entity extraction

### `POST /v1/nlp/entities`  (Bearer)

Hybrid NER: rule-based extraction merged with LLM entities when `OPENAI_API_KEY`
is configured. Body:

```json
{ "text": "…note content (min 20 chars)…", "max": 30 }
```

Response:

```json
{ "entities": [ { "term": "Photosynthesis", "kind": "definition", "score": 0.92, "span": "the process by which plants convert light energy" } ] }
```

`kind` is one of `definition | acronym | proper | keyphrase`. Errors: `400`
text too short (< 20 chars), `502` extraction failed.

---

## OCR

### `POST /v1/ocr/pages`  (Bearer)

Tesseract OCR over client-rendered page images (base64 JPEG). Body:

```json
{ "pages": ["<base64-jpeg>", "…"], "pageCount": 3, "languages": "eng+ell" }
```

Response:

```json
{ "text": "…recognized text…", "pageCount": 3, "ocrUsed": true, "pagesProcessed": 3 }
```

Pages are capped at `OCR_MAX_PAGES` (default 15). Errors: `400` no pages,
`502` OCR processing failed.

---

## RAG — server retrieval (optional)

### `POST /v1/rag/query`  (Bearer, metered)

Embeds the query plus client-supplied chunks and returns cosine-ranked hits.
Body:

```json
{ "query": "what is elasticity?", "chunks": [ { "id": "c1", "text": "…" } ], "topK": 5 }
```

Response:

```json
{ "results": [ { "id": "c1", "text": "…", "score": 0.87 } ] }
```

Chunks are capped at 64 and `topK` at 20; the embedding cost is estimated and
metered against the account quota. Errors: `400` query/chunks required, `502`
retrieval failed.

---

## Billing

### `GET /v1/billing/status`

```json
{ "enabled": true, "webhookConfigured": true, "plans": ["free","pro","team"], "prices": { "pro": true, "team": true } }
```

### `POST /v1/billing/checkout`  (Bearer)

Body:

```json
{ "plan": "pro", "successUrl": "https://app.example.com/?billing=success", "cancelUrl": "https://app.example.com/?billing=cancel" }
```

Both URL fields are optional; defaults derive from `CLIENT_APP_URL`. Response:

```json
{ "url": "https://checkout.stripe.com/...", "sessionId": "cs_…" }
```

Errors: `400` invalid plan, `503` Stripe price not configured, `500` Stripe failure.

### `POST /v1/billing/webhook`  (Stripe-signed)

- Body: raw Stripe payload (the route uses `express.raw`).
- Signature is verified when `STRIPE_WEBHOOK_SECRET` is set; in dev (unset) the
  server logs a warning and parses the body as-is for local testing.
- Handled events:
  - `checkout.session.completed` → `setPlanAsync(accountId, plan, customerId)`
  - `customer.subscription.deleted` → downgrade to `free`

Response: `{ "received": true }` (or `400` on signature/payload errors).

---

## Admin

### `GET /v1/admin/stats`  (Bearer + `x-admin-secret`)

Header:

```
x-admin-secret: <ADMIN_SECRET>
```

Response:

```json
{ "accounts": { "total": 12, "byPlan": { "free": 9, "pro": 3, "team": 0 } }, "uptimeSeconds": 12345, "nodeEnv": "production" }
```

When `ADMIN_SECRET` is unset, any authenticated non-anonymous account is
treated as admin (dev only — see [`SECURITY.md`](SECURITY.md)).

---

## Teacher dashboard

### `GET /v1/teacher/dashboard`  (Bearer)

Course + usage aggregates for an instructor view:

```json
{
  "account": { "id": "acc_…", "email": "teacher@example.com", "plan": "team" },
  "usage": { "month": "2026-06", "promptTokens": 1234, "completionTokens": 5678, "totalTokens": 6912, "quota": 25000000, "remainingTokens": 24993088 },
  "library": { "courseCount": 4, "fileCount": 12, "topicCount": 31 },
  "features": { "embeddings": true, "rag": true, "ner": true, "stripe": true }
}
```

> The client UI for this endpoint is not built yet — see
> `PRODUCT_SCALE_PLAN.md` §7.4 (multi-tenant teacher/class dashboard).

---

## Plans & quotas

| Plan | Default monthly token cap | Env override |
| ---- | ------------------------ | ------------ |
| `free` | 100 000 | `FREE_MONTHLY_TOKEN_QUOTA` |
| `pro`  | 5 000 000 | `PRO_MONTHLY_TOKEN_QUOTA` |
| `team` | 25 000 000 | `TEAM_MONTHLY_TOKEN_QUOTA` |

`enforceQuota` returns `429` once the cap is hit; the response includes the
remaining count and the reset month.

---

## Versioning & stability

`/v1/*` endpoints are stable for the current client. New fields may be added
to JSON bodies; existing fields will not change shape without a `/v2` bump.
The proxy follows the OpenAI API contract for `chat/completions` and
`embeddings`; refer to upstream docs for request/response details beyond the
fields documented here.
