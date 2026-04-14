# Vaani Connect

Vaani Connect is a mobile-first translation project focused on helping people communicate across Indian languages through text and speech workflows.

## Overview

The repository has two main parts:

- `backend/` - FastAPI service for translation, speech recognition, text-to-speech, metrics, and benchmarking
- `Expo/` - Expo React Native frontend for mobile and web

## Documentation

- [backend/README.md](backend/README.md) - backend setup, API, runtime variables, and validation
- [Expo/README.md](Expo/README.md) - frontend setup and local development
- [backend/benchmark/README.md](backend/benchmark/README.md) - benchmark workflow and generated reports
- [backend/tts_sidecar/README.md](backend/tts_sidecar/README.md) - optional isolated Parler TTS sidecar
- [docs/README.md](docs/README.md) - documentation index
- [CHANGELOG.md](CHANGELOG.md) - project-level change history

## Quick Start

You will usually run two services:

1. Backend API on `http://localhost:8000`
2. Expo frontend on the default Expo dev server port

If you use the optional TTS sidecar, run a third service on `http://localhost:8010`.

### Start the backend

From `backend/`:

```bash
uvicorn app.server:app --host 0.0.0.0 --port 8000
```

See [backend/README.md](backend/README.md) for the full setup flow.

### Start the frontend

From `Expo/`:

```bash
npm install
npm run start
```

See [Expo/README.md](Expo/README.md) for frontend details.

## Main API Endpoints

- `GET /health`
- `GET /ready`
- `GET /languages`
- `POST /translate/text`
- `POST /translate/speech`
- `GET /audio/{filename}`
- `GET /metrics/recent` for debug metrics during development

## Recommended Environment

- Backend: Python 3.11
- Frontend: Node.js LTS and npm
- Windows users: WSL is recommended for backend development

## Current Scope

The project currently includes:

- text translation between supported languages
- speech translation with ASR fallback behavior
- optional text-to-speech output
- frontend flows for translation and playback
- benchmark tooling for demo and performance evaluation

## Notes

- The backend supports either `HF_TOKEN` or `HUGGINGFACE_HUB_TOKEN` for model access.
- Benchmark and observability details live under `backend/`.
- Local-only workflow files may exist in the working copy but are intentionally excluded from the shared repository view.
