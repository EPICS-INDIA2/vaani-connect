# Vaani Connect TTS Sidecar

This service isolates Indic Parler TTS from the main backend so the core translation and ASR stack can keep a separate dependency set.

## What It Does

- runs `ai4bharat/indic-parler-tts` in a separate FastAPI service
- exposes `POST /tts` and returns `audio/wav`
- can be used by the main backend when `VAANI_TTS_PROVIDER=parler_sidecar`

## Recommended Setup

Use a separate virtual environment or container for this sidecar.

### Linux, macOS, or WSL

```bash
cd /workspace/vaani-connect/backend/tts_sidecar
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip==24.0
pip install -r requirements.txt
export HF_TOKEN="your_huggingface_read_token"
uvicorn app:app --host 0.0.0.0 --port 8010
```

## Main Backend Environment

Set these in the main backend environment:

```bash
export VAANI_TTS_PROVIDER=parler_sidecar
export VAANI_TTS_SIDECAR_URL=http://127.0.0.1:8010
```

Optional:

```bash
export VAANI_TTS_SIDECAR_TIMEOUT_SECONDS=120
```

## Sidecar Environment Variables

- `HF_TOKEN` or `HUGGINGFACE_HUB_TOKEN`
- `PARLER_TTS_MODEL_ID` with default `ai4bharat/indic-parler-tts`
- `PARLER_TTS_DEVICE` with values such as `auto`, `cpu`, or `cuda`
- `PARLER_TTS_VOICE_DESCRIPTION` for the default speaking style prompt

## Health Check

```bash
curl http://localhost:8010/health
```

## Example Request

```bash
curl -X POST http://localhost:8010/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Namaste, aap kaise hain?","target_language":"Hindi"}' \
  --output sample.wav
```

## Related Docs

- [../../README.md](../../README.md)
- [../benchmark/README.md](../benchmark/README.md)
