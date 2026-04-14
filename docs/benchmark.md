# Benchmark Guide

Use this guide for Vaani Connect backend performance runs.

## What It Produces

The text benchmark workflow generates:

- `raw_requests.csv`
- `pair_summary.csv`
- `route_summary.csv`
- `error_summary.csv`
- `summary.json`
- `summary.md`

## Prerequisites

- The backend is running at `http://localhost:8000`.
- `POST /translate/text` is available.
- `GET /metrics/recent` is available.
- If API key mode is enabled, pass `--api-key`.

## Run Text Benchmark

From `backend/`:

```bash
python benchmark/run_api_benchmark.py \
  --base-url http://localhost:8000 \
  --dataset benchmark/datasets/presentation_text_cases.csv \
  --runs-per-case 5 \
  --concurrency 2 \
  --tag professional-demo
```

If API key mode is enabled:

```bash
python benchmark/run_api_benchmark.py --api-key your_key_here
```

## Output Location

Results are written to:

`benchmark/results/<timestamp>-<tag>/`

## Generate Presentation Graphs

```bash
python benchmark/render_presentation_graphs.py 20260310T021747Z-professional-demo
```

You can also pass a full run-folder path.

## Dataset Format

Text benchmark CSV header:

`case_id,source_language,target_language,text,include_speech`

Speech benchmark CSV header:

`case_id,source_language,target_language,audio_path,include_speech`

## Speech Benchmark

```bash
python benchmark/run_speech_benchmark.py \
  --base-url http://localhost:8000 \
  --dataset benchmark/datasets/speech_cases_template.csv \
  --runs-per-case 5 \
  --concurrency 1 \
  --tag speech-demo
```

## Note for Larger Runs

If you need complete joins between request rows and backend metrics, increase `VAANI_RECENT_METRICS_LIMIT` before large runs.
