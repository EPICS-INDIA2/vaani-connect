# Backend Guide

The backend provides:

- speech recognition
- translation
- text-to-speech
- FastAPI endpoints consumed by the Expo frontend
- debug metrics and benchmark support

## Backend Layout

- `app/config.py` - environment and configuration loading
- `app/translation.py` - IndicTrans2 translation flow
- `app/asr.py` - Whisper, IndicWav2Vec, and IndicConformer routing
- `app/tts.py` - TTS provider integration
- `app/setup.py` - one-time setup tasks
- `app/server.py` - FastAPI application
- `app/main.py` - local demo entry point
- `benchmark/` - benchmark scripts, datasets, and generated reports
- `tts_sidecar/` - optional isolated Parler TTS service

## Recommended Setup

Windows users should prefer WSL for backend work. Linux and macOS can follow the same flow in a normal shell.

### 1. Create a Python 3.11 environment

WSL or Linux/macOS:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python --version
```

Windows PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python --version
```

### 2. Install dependencies

```bash
python -m pip install --upgrade pip==24.0
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install git+https://github.com/VarunGumma/IndicTransToolkit.git
pip install -r requirements.txt
python -m app.setup
```

### 3. Set the Hugging Face token

Create a read token at <https://huggingface.co/settings/tokens> and export one of:

```bash
export HF_TOKEN="your_huggingface_read_token"
```

or

```bash
export HUGGINGFACE_HUB_TOKEN="your_huggingface_read_token"
```

Windows PowerShell:

```powershell
$env:HF_TOKEN="your_huggingface_read_token"
```

### 4. Start the API

```bash
uvicorn app.server:app --host 0.0.0.0 --port 8000
```

## API Endpoints

- `GET /health`
- `GET /ready`
- `GET /languages`
- `GET /metrics/recent`
- `POST /translate/text`
- `POST /translate/speech`
- `GET /audio/{filename}`

## Runtime Environment Variables

- `VAANI_API_KEY` - require `X-API-Key` on translation routes when set
- `VAANI_ALLOWED_ORIGINS` - comma-separated CORS allowlist
- `VAANI_RATE_LIMIT_REQUESTS` - requests allowed per client in the time window
- `VAANI_RATE_LIMIT_WINDOW_SECONDS` - rate-limit window size
- `VAANI_MAX_UPLOAD_BYTES` - max speech upload size
- `VAANI_AUDIO_TTL_SECONDS` - generated audio cleanup TTL
- `VAANI_AUDIO_URL_SECRET` - HMAC secret for signed audio URLs
- `VAANI_AUDIO_URL_TTL_SECONDS` - signed audio URL lifetime
- `VAANI_RECENT_METRICS_LIMIT` - number of in-memory metric events kept
- `VAANI_TTS_PROVIDER` - `gtts` or `parler_sidecar`
- `VAANI_TTS_SIDECAR_URL` - sidecar base URL
- `VAANI_TTS_SIDECAR_TIMEOUT_SECONDS` - sidecar request timeout
- `ASR_PROVIDER` - `legacy` or `indic_conformer_multi`
- `ASR_INDIC_CONFORMER_MODEL_ID` - model id for IndicConformer mode
- `ASR_INDIC_CONFORMER_DECODER` - `ctc` or `rnnt`

## ASR Behavior

- English uses Whisper directly.
- Hindi, Telugu, Tamil, Bengali, and Marathi prefer IndicWav2Vec in the legacy path.
- If the preferred path fails or returns empty output, the backend falls back to Whisper.
- If `ASR_PROVIDER=indic_conformer_multi`, non-English requests try IndicConformer first and fall back to the legacy stack on failure.

## Metrics and Debugging

The backend emits structured log lines beginning with `VAANI_METRICS` and exposes recent in-memory events at:

```bash
curl "http://localhost:8000/metrics/recent?limit=20"
```

If API key mode is enabled:

```bash
curl -H "X-API-Key: your_key_here" "http://localhost:8000/metrics/recent?limit=20"
```

## Benchmarks

Benchmark documentation lives in [../docs/benchmark.md](../docs/benchmark.md).

Common text benchmark command:

```bash
python benchmark/run_api_benchmark.py \
  --base-url http://localhost:8000 \
  --dataset benchmark/datasets/presentation_text_cases.csv \
  --runs-per-case 5 \
  --concurrency 2 \
  --tag professional-demo
```

For broader language coverage and text-length benchmarking, use:

```bash
python benchmark/run_api_benchmark.py \
  --base-url http://localhost:8000 \
  --dataset benchmark/datasets/language_length_text_cases.csv \
  --runs-per-case 3 \
  --concurrency 2 \
  --tag language-length
```

That dataset now includes 5 length tiers for each supported source language.

## Optional TTS Sidecar

The isolated Parler TTS setup is documented in [tts_sidecar/README.md](tts_sidecar/README.md).

## Validation

Basic health check:

```bash
curl http://localhost:8000/health
```

Run tests:

```bash
pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
```

