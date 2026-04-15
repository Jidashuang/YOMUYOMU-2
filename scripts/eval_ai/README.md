# eval_ai

Minimal AI explanation quality evaluation set and batch runner.

## Files

- `samples.jsonl`: 20 Japanese sentences across novel/dialogue/formal/grammar styles.
- `run_eval.py`: batch-call `/ai-explanations`, collect metrics, and save results JSON.

## Output summary fields

The summary section includes:
- `provider_counts`
- `prompt_version_counts`
- `succeeded` / `failed`
- `error_type_counts`
- `schema_valid_count`
- `avg_latency_ms`

Each row includes manual review helpers:
- `sentence`
- `translation_zh`
- `literal_translation`
- `grammar_points_count`
- `examples_count`
- `error_type`

## Usage

### 1) Real provider (OpenAI) evaluation

Prerequisites:
- API service running with `LLM_PROVIDER=openai`
- Valid `OPENAI_API_KEY`

```bash
python scripts/eval_ai/run_eval.py \
  --mode api \
  --api-base-url http://localhost:8000 \
  --email eval@example.com \
  --password strong-password-123 \
  --expect-provider openai \
  --input scripts/eval_ai/samples.jsonl \
  --output scripts/eval_ai/results/eval_results_openai.json
```

### 2) Offline mock smoke evaluation

```bash
python scripts/eval_ai/run_eval.py \
  --mode offline-mock \
  --prompt-version v2 \
  --input scripts/eval_ai/samples.jsonl \
  --output scripts/eval_ai/results/eval_results_offline.json
```

Optional:
- `--article-id <id>`: reuse existing article.
- `--wait-seconds 0.2`: add delay between requests.

The script prints summary metrics and writes full per-sample results to output JSON.
