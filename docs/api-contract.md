# Yomuyomu API Contract (Phase 7A)

Contract source of truth for current MVP APIs.

Mirrored types:
- TypeScript: `packages/shared-types/src/contracts.ts`
- API Pydantic: `apps/api/app/schemas/*.py`
- NLP Pydantic: `services/nlp/app/schemas.py`

## Common

Auth:

- Browser sessions use a secure `HttpOnly` cookie with `SameSite=None` in the default deployment configuration.
- Legacy/internal clients may still send `Authorization: Bearer <jwt>`.

```http
Authorization: Bearer <jwt>
```

Common error shape:

```json
{
  "detail": "Email already registered",
  "code": "email_already_registered"
}
```

`code` is optional. Existing clients can continue using `detail`.
This envelope is used for explicit application errors such as auth failures, conflicts, and rate limits.

Validation error shape (`422 Unprocessable Entity`):

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Value error, Password is too weak"
    }
  ]
}
```

## Auth

### POST `/auth/register`

Current MVP behavior:
- creates the user
- immediately establishes a cookie-backed session
- returns the authenticated user envelope

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password-123"
}
```

Validation rules:
- `email`: trimmed and lowercased before duplicate check and persistence
- `password`: `8-128` chars
- `password` must not be all whitespace
- `password` must not equal normalized email
- a small set of obvious weak passwords is rejected

Success response `201 Created`:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

Error responses:
- `409` with `code=email_already_registered`
- `422` for schema / validation failures
- `429` with `code=rate_limited`

Concurrency rule:
- duplicate-email race conditions are resolved at the DB unique-constraint boundary and mapped to `409`

### POST `/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password-123"
}
```

Behavior:
- `email` is trimmed and lowercased before lookup
- request validation still uses the same `EmailStr` and `password 8-128` rules as register
- success returns the same session envelope as register
- invalid credentials return `401` with `code=invalid_credentials`
- malformed payloads return standard FastAPI `422` validation responses
- repeated failures return `429` with `code=rate_limited`

### GET `/auth/me`

Returns the active user profile when the session cookie or bearer token is valid.

### POST `/auth/logout`

Clears the session cookie and returns `204 No Content`.

## Billing

### GET `/billing/me`

Returns the current commercialization summary for the authenticated user.

Response:

```json
{
  "plan": "free",
  "billing_status": null,
  "ai_explanations": {
    "used_this_month": 3,
    "monthly_limit": 20,
    "remaining": 17
  }
}
```

Notes:
- `plan` currently only has `free | pro`
- `billing_status` mirrors the latest synced Stripe subscription status when available, otherwise `null`

### POST `/billing/checkout-session`

Creates a Stripe Checkout session for the authenticated user.

Response:

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_123"
}
```

Behavior:
- always creates the `pro` subscription checkout flow
- binds Stripe metadata to the authenticated `user_id`
- returns `503` if Stripe credentials are not configured

### POST `/billing/portal-session`

Creates a Stripe billing portal session for the authenticated user.

Response:

```json
{
  "portal_url": "https://billing.stripe.com/p/session/test_123"
}
```

Behavior:
- requires the current user to already have a `stripe_customer_id`
- returns `409` when there is no linked Stripe customer yet
- current implementation delegates subscription management to Stripe Billing Portal rather than a first-party settings workflow

### POST `/billing/webhook`

Receives Stripe subscription webhooks and updates the user billing state.

Current handled events:
- `customer.subscription.updated`
- `customer.subscription.deleted`

Side effects:
- writes `plan`, `stripe_customer_id`, `stripe_subscription_id`, and `billing_status` onto `users`
- downgrade events reset `plan` to `free` and clear `stripe_subscription_id`

Out of current billing API scope:
- first-party refund management
- first-party invoice history APIs

## Articles

### POST `/articles`
- Creates article with `status=processing`.
- Enqueues async processing.
- Emits event: `article_created`.
- Supports `source_type=text|epub`.
- Rejects oversized raw payloads with `413`.
- For `source_type=epub`, `raw_content` accepts base64 payload:
  - `base64:<payload>`
  - `data:application/epub+zip;base64,<payload>`

### Processing lifecycle
- Background worker parses source content (text normalization or epub extraction), then persists blocks/tokens.
- EPUB parsing enforces archive byte, per-entry byte, and file-count limits.
- Emits event: `article_processed` with payload status `ready|failed`.

### GET `/articles`
### GET `/articles/{id}`
### DELETE `/articles/{id}`

## Reader data

### POST `/reader-data/lookup`

Reader-authenticated lookup proxy. This endpoint is used to bind lookup behavior to user/article analytics.

Request:

```json
{
  "article_id": "uuid",
  "surface": "来る",
  "lemma": "来る",
  "reading": "くる",
  "context": "彼は来るはずだったのに"
}
```

Response:

```json
{
  "entries": [
    {
      "lemma": "来る",
      "reading": "くる",
      "pos": ["verb"],
      "meanings": ["to come", "to arrive"],
      "primary_meaning": "to come",
      "example_sentence": "彼は来るはずだったのに。",
      "usage_note": "Common verb usage.",
      "jlpt_level": "N5",
      "frequency_band": "top-1k"
    }
  ]
}
```

Side effect:
- Emits event `token_lookup` (with article_id).

### POST `/reader-data/highlights`
- Emits event: `highlight_created`.

### GET `/reader-data/highlights?article_id={id}`
### PATCH `/reader-data/highlights/{id}/note`
### POST `/reader-data/progress`
### GET `/reader-data/progress/{article_id}`
### POST `/reader-data/vocab`
- Alias quick-save vocab.
- Emits event: `vocab_added`.
- Supports optional `status` (`new|learning|known`), default `new`.

## Vocab

### POST `/vocab`
- Emits event: `vocab_added`.
- Response fields include scheduling metadata:
  - `next_review_at` (datetime or null)
  - `review_count` (integer)

### GET `/vocab`
Optional query:
- `bucket=today_new` -> status=`new` and created today (UTC)
- `bucket=unmastered` -> status in `new|learning`
- `bucket=review_due` -> status in `new|learning` and `next_review_at <= now` (or null)

### PATCH `/vocab/{id}/status`
Request:

```json
{
  "status": "learning"
}
```

### PATCH `/vocab/{id}/review`
Request:

```json
{
  "result": "pass"
}
```

Result:
- `fail`: keep in learning and schedule near-term retry
- `pass`: increase `review_count`, widen next interval, auto-mark `known` after enough passes

### DELETE `/vocab/{id}`
### GET `/vocab/export.csv`
### GET `/vocab/export.json`

## AI explanations

### POST `/ai-explanations`

Pipeline:
1. Emit `ai_explanation_requested`
2. tokenize + lookup hints
3. provider call (`mock|openai`)
4. JSON parse repair + schema validation
5. Redis cache read/write
6. persist `ai_explanations` history row
7. emit `ai_explanation_succeeded` or `ai_explanation_failed`

Response includes:
- `provider`
- `prompt_version`
- `from_cache`
- `error_type` (optional)
- `provider_latency_ms` (optional)
- `prompt_tokens` (optional)
- `completion_tokens` (optional)
- `total_tokens` (optional)
- structured `response_json`
- `suggested_vocab` (content words for one-click vocab add)

`response_json` is strictly structured and now also includes:
- `why_this_expression`
- `alternative_expressions` (list of `{jp, zh, note}`)

Commercialization rule:
- if the user's current monthly AI explanation quota is exhausted, the endpoint returns `402` with `code=plan_limit_reached`

### GET `/ai-explanations?article_id={id}`

## Analytics

### GET `/analytics/today`

Returns day-level learning counters (UTC day):

```json
{
  "date": "2026-03-17",
  "lookup_count": 12,
  "vocab_added_count": 4,
  "ai_explanation_count": 7
}
```

### GET `/analytics/stats`

Optional query:
- `article_id=<uuid>`

Response:

```json
{
  "user_id": "uuid",
  "article_id": "uuid-or-null",
  "totals": {
    "lookup_count": 12,
    "vocab_added_count": 4,
    "highlight_count": 5,
    "ai_explanation_count": 7
  },
  "metrics": {
    "lookup_to_vocab_rate": 0.3333,
    "highlight_to_ai_rate": 1.4,
    "ai_requests_per_article": 3.5,
    "ai_requests_per_user": 7
  },
  "raw_event_counts": {
    "token_lookup": 12,
    "vocab_added": 4,
    "highlight_created": 5,
    "ai_explanation_requested": 7
  },
  "by_article": [
    {
      "article_id": "uuid",
      "counts": {
        "lookup_count": 9,
        "vocab_added_count": 3,
        "highlight_count": 4,
        "ai_explanation_count": 5
      },
      "metrics": {
        "lookup_to_vocab_rate": 0.3333,
        "highlight_to_ai_rate": 1.25,
        "ai_requests_per_article": 5,
        "ai_requests_per_user": 5
      },
      "raw_event_counts": {
        "token_lookup": 9,
        "vocab_added": 3
      }
    }
  ]
}
```

Business metric formulas:
- `lookup_to_vocab_rate = vocab_added_count / lookup_count`
- `highlight_to_ai_rate = ai_explanation_count / highlight_count`
- `ai_requests_per_article = ai_explanation_count / distinct_article_count_with_ai_requests`
- `ai_requests_per_user = ai_explanation_count`

## NLP service

### POST `/lookup`
Lookup ranking behavior:
- Query priority: `lemma > surface > reading`
- Inflection robustness: Sudachi normalization + heuristic base forms
- Multi-sense sorting: match quality + commonness + sense priority
- Lookup entries include `example_sentence`, `usage_note`, `primary_meaning`

Production path vs fallback:
- Production default: sqlite JMDict index (`JMDICT_DB_PATH`)
- Dev fallback only: seed JSON when `ALLOW_SEED_FALLBACK=true`

## Analytics snapshot script

Manual run:

```bash
python scripts/analytics_snapshots/generate_snapshot.py --date 2026-03-17
```

Output:
- `scripts/analytics_snapshots/output/snapshot_YYYY-MM-DD.json`

Snapshot payload includes:
- totals: event counts, usage counts, metrics
- users[]: per-user event counts, usage counts, metrics

## Evaluation script contract (`scripts/eval_ai/run_eval.py`)

Summary includes:
- `provider_counts`
- `prompt_version_counts`
- `succeeded` / `failed`
- `error_type_counts`
- `schema_valid_count`
- `avg_latency_ms`

Per-row manual review fields:
- `sentence`
- `translation_zh`
- `literal_translation`
- `grammar_points_count`
- `examples_count`
- `error_type`

Strict provider baseline mode:
- pass `--expect-provider openai`
- if expected provider is not observed, script fails explicitly (no silent fallback)
