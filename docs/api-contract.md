# Yomuyomu API Contract (Phase 6)

Contract source of truth for current MVP APIs.

Mirrored types:
- TypeScript: `packages/shared-types/src/contracts.ts`
- API Pydantic: `apps/api/app/schemas/*.py`
- NLP Pydantic: `services/nlp/app/schemas.py`

## Common

Auth header:

```http
Authorization: Bearer <jwt>
```

## Articles

### POST `/articles`
- Creates article with `status=processing`.
- Enqueues async processing.
- Emits event: `article_created`.

### Processing lifecycle
- Background worker persists blocks/tokens.
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

### GET `/vocab`
Optional query:
- `bucket=today_new` -> status=`new` and created today (UTC)
- `bucket=unmastered` -> status in `new|learning`

### PATCH `/vocab/{id}/status`
Request:

```json
{
  "status": "learning"
}
```

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
