# Benchmark Harness

This directory contains the benchmark tooling for Vaani Connect backend performance runs.

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

For length-vs-latency and language-level latency charts, prefer the fuller
dataset that covers every canonical translation language with short, medium,
and long samples:

```bash
python benchmark/run_api_benchmark.py \
  --base-url http://localhost:8000 \
  --dataset benchmark/datasets/language_length_text_cases.csv \
  --runs-per-case 3 \
  --concurrency 2 \
  --tag language-length
```

If API key mode is enabled:

```bash
python benchmark/run_api_benchmark.py --api-key your_key_here
```

## Output Location

Results are written to:

`benchmark/results/<timestamp>-<tag>/`

Useful outputs include:

- `summary.md` for report-ready narrative
- CSV files for spreadsheet or chart workflows
- `summary.json` for machine-readable summary data

## Generate Presentation Graphs

You can render charts by passing either a run folder name or a full path:

```bash
python benchmark/render_presentation_graphs.py 20260310T021747Z-professional-demo
```

or

```bash
python benchmark/render_presentation_graphs.py /mnt/c/vaaniconnect9/vaani-connect/backend/benchmark/results/20260310T021747Z-professional-demo
```

Charts are written to:

`benchmark/results/<run-folder>/plots/`

Common plot outputs:

- `01_kpi_overview.png`
- `02_latency_percentiles.png`
- `03_pair_p95_latency.png`
- `04_pair_success_rate.png`
- `05_pair_latency_heatmap.png`
- `06_pair_success_heatmap.png`
- `07_route_distribution.png`
- `08_error_distribution.png`
- `09_client_vs_server_scatter.png`
- `10_stage_latency_breakdown.png`
- `presentation_graphs.md`

## Dataset Format

Text benchmark CSV header:

`case_id,source_language,target_language,text,include_speech`

- `case_id` is optional
- `include_speech` is optional and defaults to `false`
- `language_length_text_cases.csv` is the recommended dataset for charting
  text length against latency across all supported source languages
- the current version includes 10 text-length samples per supported source
  language for 230 total benchmark cases

## Speech Benchmark

Use `benchmark/run_speech_benchmark.py` to measure `POST /translate/speech` with local audio fixtures.

Example:

```bash
python benchmark/run_speech_benchmark.py \
  --base-url http://localhost:8000 \
  --dataset benchmark/datasets/speech_cases_template.csv \
  --runs-per-case 5 \
  --concurrency 1 \
  --tag speech-demo
```

Speech dataset header:

`case_id,source_language,target_language,audio_path,include_speech`

Notes:

- `audio_path` is required
- relative `audio_path` values resolve from the dataset file location
- the script emits request-level CSV, summary JSON and Markdown, translation route summary, and ASR route summary

## Important Note for Larger Runs

The backend keeps only recent metrics in memory through `VAANI_RECENT_METRICS_LIMIT` with a default of `100`.
If your benchmark exceeds that limit, some internal metrics may not join back to request rows.

Increase the env var before large runs if you need complete joins.

If `matplotlib` is missing:

```bash
pip install matplotlib
```
