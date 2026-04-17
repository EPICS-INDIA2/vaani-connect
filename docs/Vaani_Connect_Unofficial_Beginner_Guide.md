# Vaani Connect
## Unofficial Beginner-Friendly Documentation

Created for the next team  
Last updated: April 16, 2026

---

## How to use this document

This is the "please do not make me reverse-engineer the whole repo from scratch" guide.

This document is written for the next team, especially people who:

- are new to this codebase
- are still getting comfortable with coding
- need to understand the project without reading 3,000 lines of code on day one

The tone here is intentionally plain-English and a little casual. The goal is not to sound like a corporate manual. The goal is to help the next team actually understand what is going on.

Best way to read this:

1. Read Sections 1 through 4 first.
2. Skim the file guide in Section 5.
3. Use Section 6 when you want the "wait, what does this code actually do?" version.
4. Use Section 7 when you need to change something.
5. Use Section 8 when the project starts acting weird.

If you only have energy to understand a few files at first, start here:

- `backend/app/server.py`
- `backend/app/translation.py`
- `backend/app/asr.py`
- `Expo/services/api.ts`
- `Expo/app/(tabs)/index.tsx`

Those files are the main brain and the main user flow.

---

## 1. Read This First

### What this project is

Vaani Connect is a translation app focused on Indian languages.

Short version:

- The frontend is an Expo / React Native app.
- The backend is a FastAPI service.
- The backend handles translation, speech-to-text, and optional text-to-speech.
- The app lets a user either type text or record speech, then get translated output and optionally play audio.

### What this project is supposed to do

The project is trying to make cross-language communication easier, especially across English and several Indian languages.

The current app supports:

- text translation
- speech translation
- optional generated voice playback
- recent history on the device
- conversation mode that swaps speaker direction after each successful turn
- backend health checking
- benchmark tooling for measuring backend performance

### Who this project is for

There are really two audiences:

1. End users who want to translate text or speech.
2. Student developers who need to keep the project alive, improve it, and not accidentally break it.

This doc is for audience number 2.

### What coding/tools are used here

Main stack:

- Frontend: Expo, React Native, TypeScript, expo-router
- Backend: Python 3.11, FastAPI
- Translation models: IndicTrans2
- Speech recognition: Whisper plus Indic ASR models
- Speech output: gTTS by default, optional Parler TTS sidecar
- Storage on frontend: AsyncStorage
- Testing: Python `unittest` for backend, ESLint and TypeScript checks for Expo
- CI: GitHub Actions

### What beginners should focus on first

Do this in order:

1. Understand the project at the big-picture level.
2. Understand how the frontend talks to the backend.
3. Understand the two main backend routes:
   - `POST /translate/text`
   - `POST /translate/speech`
4. Understand where the language lists are defined.
5. Understand how the app stores user preferences and history.

### What parts you can ignore at the beginning

You do not need to deeply understand these on day one:

- benchmark graph rendering
- the optional TTS sidecar
- Expo starter leftovers like `modal.tsx`, `hello-wave.tsx`, and `parallax-scroll-view.tsx`
- release helper scripts
- changelog helper scripts in `tools/`

They are not useless. They are just not where you should start.

### Quick mental model

The easiest mental model is this:

- `Expo/app/(tabs)/index.tsx` is the main screen and user flow.
- `Expo/services/api.ts` is the frontend bridge to the backend.
- `backend/app/server.py` is the API door.
- `backend/app/translation.py` is the translation engine wrapper.
- `backend/app/asr.py` is the speech-to-text engine wrapper.
- `backend/app/tts.py` is the voice-output helper.

Everything else mostly supports those pieces.

---

## 2. Setup and Run

### Recommended environment

This project is easiest to work on with:

- Windows for the Expo frontend
- WSL for the Python backend

That split is not mandatory, but it is the path this repo is already leaning toward.

### Software you need

- Git
- Python 3.11
- Node.js LTS
- npm
- WSL if you are on Windows and want the recommended backend workflow
- A Hugging Face read token for the model downloads

### Repo structure during development

You will usually run two services:

1. Backend API on `http://localhost:8000`
2. Expo frontend dev server from `Expo/`

Optional third service:

3. TTS sidecar on `http://localhost:8010`

### Backend setup

From `backend/`:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip==24.0
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install git+https://github.com/VarunGumma/IndicTransToolkit.git
pip install -r requirements.txt
python -m app.setup
```

Set your Hugging Face token:

```bash
export HF_TOKEN="your_token_here"
```

Or:

```bash
export HUGGINGFACE_HUB_TOKEN="your_token_here"
```

Then start the backend:

```bash
uvicorn app.server:app --host 0.0.0.0 --port 8000
```

### Frontend setup

From `Expo/`:

```bash
npm install
npm run start
```

Useful alternatives:

```bash
npm run web
npm run android
npm run ios
```

### Optional TTS sidecar setup

This is only needed if you want the Parler TTS sidecar.

From `backend/tts_sidecar/`:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip==24.0
pip install -r requirements.txt
export HF_TOKEN="your_token_here"
uvicorn app:app --host 0.0.0.0 --port 8010
```

Then in the main backend environment:

```bash
export VAANI_TTS_PROVIDER=parler_sidecar
export VAANI_TTS_SIDECAR_URL=http://127.0.0.1:8010
```

### One-command local helper

This working copy also has local helper scripts in `tools/`:

- `tools/start-dev-stack.ps1`
- `tools/stop-dev-stack.ps1`

What they do:

- start the backend in WSL
- start the optional TTS sidecar in WSL if its virtualenv exists
- start the Expo frontend in Windows
- save PIDs and logs under `.git/dev-stack/`

Important note:

- these helper scripts are gitignored at the repo root
- that means they may exist in this working copy, but they are not guaranteed to exist after a fresh clone

So: nice bonus if you have them, but do not build the whole handoff plan around them existing forever.

### How to test that the setup works

Backend checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:8000/languages
```

Frontend checks:

- Open the app in web or on a simulator/device.
- Confirm the translate screen loads.
- Confirm the backend status message does not say offline.
- Try one text translation.
- Try one speech translation if microphone access is available.

Project validation commands:

Backend:

```bash
python -m unittest discover -s tests -v
```

Frontend:

```bash
npm run typecheck
cmd /c npx eslint . --no-cache
```

### Validation snapshot from this documentation pass

Verified on April 16, 2026:

- backend unit tests passed: 32 tests
- Expo TypeScript typecheck passed
- Expo ESLint passed with `--no-cache`

One environment-specific gotcha:

- `npm run lint` failed in this environment because ESLint tried to write a cache file under `Expo/.expo/cache/eslint/` and hit an `EPERM` write error
- rerunning ESLint without cache worked fine

So if lint fails locally, do not instantly assume the code is broken. It may just be the cache.

### Common setup issues

#### 1. Backend dies on startup

Most likely reasons:

- missing `HF_TOKEN`
- first-time model download is still happening
- backend virtualenv is missing packages

Check:

- environment variables
- terminal logs
- `GET /health`
- `GET /ready`

#### 2. Frontend loads but translation does not work

Most likely reasons:

- backend is not running
- frontend is pointing at the wrong API base URL
- API key is required but not provided

Check:

- `Expo/services/api.ts`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_API_KEY`
- backend status tab in the app

#### 3. Speech recording works badly or not at all

Most likely reasons:

- microphone permission not granted
- running a build/environment where recording is limited
- backend speech endpoint unavailable

Check:

- Expo microphone permission dialog
- `Expo/app.json` plugin config for `expo-audio`
- `/translate/speech` endpoint

#### 4. Backend feels frozen for a long time

That is usually model warmup, not a crash.

Important difference:

- `/health` means "server process is alive"
- `/ready` means "model services are initialized and ready"

### If it breaks immediately, check this first

This is the panic-check list:

1. Is the backend actually running on port `8000`?
2. Does `http://localhost:8000/health` return `{"status":"ok"}`?
3. Did you set `HF_TOKEN` or `HUGGINGFACE_HUB_TOKEN`?
4. Is Expo using the right backend URL?
5. Are you trying to use the optional sidecar without running it?
6. Did you accidentally assume a gitignored helper file exists in every clone?

---

## 3. Project Map

### High-level folder structure

```text
vaani-connect/
  .github/workflows/        CI checks for backend and Expo
  backend/                  FastAPI app, model wrappers, tests, benchmarks
    app/                    Main backend source code
    benchmark/              Performance scripts and datasets
    tests/                  Backend unit tests
    tts_sidecar/            Optional isolated TTS service
  Expo/                     Mobile/web frontend
    app/                    Routes and screens
    services/               Backend API calls and local persistence
    hooks/                  Reusable frontend logic
    constants/              Shared UI text, colors, language list
    components/             Reusable UI building blocks
  docs/                     Shared repository docs
```

### Shared repo docs vs local-only helper files

Tracked/shared docs:

- `README.md`
- `backend/README.md`
- `Expo/README.md`
- `docs/README.md`
- `docs/benchmark.md`
- `backend/benchmark/README.md`
- `backend/tts_sidecar/README.md`

Local-only or ignored helper files in this working copy:

- `tools/`
- `release.ps1`
- `release.sh`
- `PUBLISHABILITY_CHECKLIST.md`
- `RELEASE_SH_GUIDE.md`
- `TODO.txt`
- `.vscode/tasks.json`

That split matters.

If the next team receives a zip of this exact folder, they may get those ignored helper files.
If they clone from remote, they probably will not.

### Which files are the most important

If you want the actual core of the project, these are the most important files:

- `backend/app/server.py`
- `backend/app/translation.py`
- `backend/app/asr.py`
- `backend/app/transliteration.py`
- `backend/app/tts.py`
- `backend/app/languages.py`
- `Expo/app/(tabs)/index.tsx`
- `Expo/services/api.ts`
- `Expo/services/preferences.ts`
- `Expo/constants/languages.ts`
- `Expo/constants/ui-copy.ts`
- `Expo/hooks/use-backend-status.ts`

### Which files are mostly support/helper files

- `Expo/components/themed-text.tsx`
- `Expo/components/themed-view.tsx`
- `Expo/hooks/use-theme-color.ts`
- `Expo/hooks/use-color-scheme.ts`
- `Expo/hooks/use-color-scheme.web.ts`
- `Expo/components/ui/icon-symbol.tsx`
- `Expo/components/ui/icon-symbol.ios.tsx`
- `Expo/components/haptic-tab.tsx`
- `Expo/components/ui/collapsible.tsx`

### Which files should be edited carefully

These are the "change with intention" files:

- `backend/app/server.py`
  - changing request/response shapes here can break the frontend
- `backend/app/languages.py`
  - changing language names or codes here affects translation routing
- `backend/app/asr.py`
  - heavy model logic and fallback behavior live here
- `backend/app/tts.py`
  - language voice routing and sidecar behavior live here
- `Expo/services/api.ts`
  - this is the frontend/backend contract
- `Expo/app/(tabs)/index.tsx`
  - huge file, main screen, lots of state, easy to break UX
- `Expo/constants/ui-copy.ts`
  - giant UI copy file; easy to make inconsistent wording if edited carelessly

### What can be ignored on day one

You can safely skim or ignore at first:

- `Expo/app/modal.tsx`
- `Expo/components/hello-wave.tsx`
- `Expo/components/parallax-scroll-view.tsx`
- `Expo/scripts/reset-project.js`
- benchmark graph code unless you are doing performance reporting

Those are not the core translation path.

---

## 4. How the Program Works

### Big-picture architecture in plain English

The project has two halves:

1. The Expo app handles user interaction.
2. The FastAPI backend does the expensive language work.

The frontend does not translate anything by itself.
It mostly:

- collects text or audio from the user
- sends it to the backend
- shows the returned result
- optionally plays returned/generated audio
- stores a little local history and preference data

The backend does the serious work:

- validate request
- normalize language names
- optionally normalize romanized input into native script
- run ASR if speech was uploaded
- run translation
- optionally generate speech
- return text plus optional audio URL

### Where the program starts

Frontend startup order:

1. `Expo/app/_layout.tsx`
   - sets app-wide navigation theme
2. `Expo/app/(tabs)/_layout.tsx`
   - builds the tab layout
3. `Expo/app/(tabs)/index.tsx`
   - main translation screen
4. `Expo/app/(tabs)/explore.tsx`
   - backend status / setup helper screen

Backend startup order:

1. `backend/app/server.py`
   - creates the FastAPI app
2. startup event calls `_warmup_services()`
3. `backend/app/main.py`
   - `build_services()` logs into Hugging Face and creates:
     - `TranslationService`
     - `ASRService`

### Text translation flow

This is the typed-text path:

1. User types text in the frontend.
2. `Expo/app/(tabs)/index.tsx` calls `translateText()` from `Expo/services/api.ts`.
3. Frontend sends JSON to `POST /translate/text`.
4. Backend `server.py` validates the request.
5. Backend normalizes language names.
6. Backend runs `normalize_text_for_translation(...)`.
   - if the input looks romanized and the source language supports transliteration, it converts it to native script first
7. Backend calls `TranslationService.translate_text_with_stats(...)`.
8. Backend may also run TTS if `include_speech=true`.
9. Backend returns:
   - original source text
   - normalized source text
   - translated text
   - optional audio URL
10. Frontend stores result, updates history, and shows the translation.

### Speech translation flow

This is the recorded-audio path:

1. User taps Speak in the frontend.
2. Expo records audio using `expo-audio`.
3. Frontend sends multipart form data to `POST /translate/speech`.
4. Backend validates the uploaded file.
5. Backend saves a temporary upload file.
6. Backend runs ASR through `ASRService.transcribe_with_stats(...)`.
7. ASR returns transcribed source text.
8. Backend translates that text.
9. Backend may optionally generate output speech.
10. Backend returns:
    - transcribed text
    - translated text
    - optional audio URL
11. Frontend shows transcript + translation, and may add it to history.

### Audio playback flow

Important UX detail:

- the frontend usually requests translations with `include_speech=false`
- this is intentional
- it makes the first response faster because the user gets text first instead of waiting for audio generation

Then, if the user taps Listen:

1. frontend checks whether it already has an `audio_url`
2. if yes, it plays it
3. if no, it re-requests the translation with `include_speech=true`
4. once audio is returned, it plays it

So if you ever wonder:

"Why did I get translated text but no audio?"

That is not automatically a bug. That is the intended fast-path behavior.

### Conversation mode flow

Conversation mode is a little different from standard translate mode.

After a successful turn:

- the frontend saves that turn into a conversation list
- then it swaps source and target languages

That means the next person can speak back the other direction without manually switching the pair.

This is smart UX, but it can confuse people reading the code the first time because the language pair changes after success.

### How data moves between files

Frontend side:

- `index.tsx` handles screen state and user actions
- `api.ts` sends requests
- `preferences.ts` stores local history and settings
- `ui-copy.ts` provides language-specific UI labels
- `use-backend-status.ts` keeps track of backend readiness

Backend side:

- `server.py` exposes the API
- `languages.py` provides canonical language names and codes
- `transliteration.py` optionally normalizes romanized input
- `translation.py` picks translation route
- `asr.py` picks speech-recognition route
- `tts.py` picks text-to-speech route

### Metrics and benchmarking flow

The backend logs structured metrics and also keeps recent metrics in memory.

That is used by:

- `GET /metrics/recent`
- `backend/benchmark/run_api_benchmark.py`
- `backend/benchmark/run_speech_benchmark.py`

Those benchmark scripts:

- fire lots of requests
- join backend metrics back to request rows
- generate CSV, JSON, and markdown summaries
- optionally render charts with `render_presentation_graphs.py`

So benchmarking is not random extra code. It is wired into the backend observability story.

---

## 5. File-by-File Guide

This section focuses on the files that matter most. Tiny wrappers and obvious starter leftovers are grouped later so this does not turn into unreadable soup.

### Root and shared docs

#### `README.md`

- Purpose: top-level project overview
- Why it exists: gives the first clean explanation of what this repo contains
- Connected to: links out to backend, Expo, benchmark, sidecar, and docs guides
- Beginner note: read this first before opening source files
- Watch out: it is an overview, not the whole truth of the implementation

#### `docs/README.md`

- Purpose: documentation index
- Why it exists: shows where the rest of the docs live
- Connected to: root README, backend README, Expo README, benchmark docs
- Beginner note: helpful when you do not remember where a guide lives

#### `docs/benchmark.md`

- Purpose: shorter benchmark cheat sheet
- Why it exists: quick instructions for performance runs
- Connected to: backend benchmark scripts
- Beginner note: useful only when you are measuring performance

#### `CHANGELOG.md`

- Purpose: project-level history log
- Why it exists: shows what changed over time
- Connected to: both backend and Expo
- Beginner note: very useful for understanding recent architecture decisions
- Watch out: the repo also contains some local-only docs that are gitignored, so not everything mentioned here is guaranteed to exist in every clone

#### `VERSION`

- Purpose: simple version number file
- Why it exists: used by local release scripts
- Connected to: `release.ps1` and `release.sh`
- Beginner note: you can ignore it until you are actually cutting releases

#### `.github/workflows/backend-tests.yml`

- Purpose: backend CI job
- Why it exists: keeps backend tests running automatically on pushes and pull requests
- Main job:
  - install Python 3.11
  - install PyTorch CPU wheels
  - install backend requirements
  - run `python -m unittest discover -s tests -v`
- Beginner note: if backend CI breaks, start here

#### `.github/workflows/expo-verify.yml`

- Purpose: frontend CI job
- Why it exists: runs frontend checks automatically
- Main job:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
- Beginner note: if frontend CI breaks, this file tells you what command CI actually runs

### Local-only helper files in this working copy

These are worth knowing about even though they are gitignored:

#### `tools/start-dev-stack.ps1`

- Purpose: start backend, optional sidecar, and Expo together
- Why it exists: one-command local dev startup
- Connected to: backend `.venv`, sidecar `.venv`, Expo dev server
- Watch out: depends on WSL and expected virtualenv paths

#### `tools/stop-dev-stack.ps1`

- Purpose: stop the services launched by the start script
- Why it exists: cleans up tracked PIDs cleanly
- Connected to: `.git/dev-stack/`

#### `release.ps1` and `release.sh`

- Purpose: local release helpers
- Why they exist: bump `VERSION`, commit, tag, and push
- Watch out:
  - they run `git add .`
  - that means they can commit more than you intended if your working tree is messy

#### `PUBLISHABILITY_CHECKLIST.md`

- Purpose: store-readiness checklist
- Why it exists: tracks what is still missing before this becomes a polished app release
- Beginner note: read it if your team is doing deployment or store submission work

### Backend core files

#### `backend/README.md`

- Purpose: main backend setup and API guide
- Why it exists: explains how to install, configure, and run backend services
- Connected to: backend app files, benchmark docs, sidecar docs
- Beginner note: this is the backend version of "read me before touching stuff"

#### `backend/requirements.txt`

- Purpose: production-ish backend dependencies
- Why it exists: installs translation, ASR, TTS, and FastAPI packages
- Important detail:
  - this project pulls in big ML dependencies
  - first install is not small and not fast

#### `backend/requirements-dev.txt`

- Purpose: extra dev/test dependencies
- Why it exists: adds testing and charting tools on top of base requirements
- Connected to: backend tests, benchmark graph rendering

#### `backend/app/main.py`

- Purpose: service builder and tiny demo entry point
- Why it exists: central place that creates translation and ASR services
- Main things inside:
  - `build_services()`
- Connected to:
  - `config.py` for Hugging Face login
  - `translation.py`
  - `asr.py`
  - `tts.py`
- Beginner note: when the backend wants model services, this is where they get created

#### `backend/app/config.py`

- Purpose: Hugging Face token loading and login helper
- Why it exists: backend models are pulled from Hugging Face
- Main things inside:
  - `load_hf_token()`
  - `login_huggingface()`
- Watch out:
  - missing token here means backend startup will fail

#### `backend/app/setup.py`

- Purpose: one-time NLTK asset download helper
- Why it exists: some dependencies want `punkt`
- Beginner note: tiny file, low drama

#### `backend/app/languages.py`

- Purpose: canonical language map
- Why it exists: translation routes need stable language names and model codes
- Main things inside:
  - `LANGUAGE_TO_CODE`
  - `LANGUAGE_ALIASES`
- Connected to:
  - `server.py`
  - `tts.py`
  - `transliteration.py`
  - frontend language list, conceptually
- Watch out:
  - frontend also has a separate language list in `Expo/constants/languages.ts`
  - if you add/remove/rename a language, update both sides

#### `backend/app/transliteration.py`

- Purpose: detect romanized Indic text and optionally convert it into native script
- Why it exists: users may type things like `mera naam rahul hai` instead of using Devanagari
- Main things inside:
  - `is_probably_romanized(...)`
  - `transliteration_supported(...)`
  - `transliterate_to_native(...)`
  - `normalize_text_for_translation(...)`
- Connected to:
  - called by `server.py` before translation
- Watch out:
  - not every language has supported transliteration
  - romanized input is helpful for some languages and a no-op for others

#### `backend/app/translation.py`

- Purpose: translation service wrapper around IndicTrans2
- Why it exists: hides the model-loading and route-selection details behind one service
- Main things inside:
  - `TranslationService`
  - `_run_translation_with_stats(...)`
  - `translate_text_with_stats(...)`
  - `warmup()`
- What it actually does:
  - loads three model families:
    - English -> Indic
    - Indic -> English
    - Indic -> Indic
  - chooses the right route
  - falls back through English if direct Indic -> Indic fails
  - returns detailed stats used by metrics/benchmarks
- Connected to:
  - built by `main.py`
  - called by `server.py`
- Watch out:
  - this file is core behavior
  - changing route logic here affects quality, latency, and metrics

#### `backend/app/asr.py`

- Purpose: speech-to-text service wrapper
- Why it exists: speech recognition is messy and uses multiple model paths
- Main things inside:
  - `ASRService`
  - Whisper path
  - IndicWav2Vec path
  - optional IndicConformer path
  - fallback logic
- What it actually does:
  - always uses Whisper for English
  - uses IndicWav2Vec for selected Indian languages in legacy mode
  - can try IndicConformer first if configured
  - falls back when a preferred ASR path fails or returns empty output
- Connected to:
  - built by `main.py`
  - called by `server.py`
- Watch out:
  - this is another high-risk file
  - fallback behavior is the difference between "the request still works" and "the app looks broken"

#### `backend/app/tts.py`

- Purpose: text-to-speech routing
- Why it exists: output voice is optional and can come from two different providers
- Main things inside:
  - `resolve_tts_route(...)`
  - `_gtts_generate(...)`
  - `_sidecar_generate(...)`
  - `tts_generate_with_metadata(...)`
- What it actually does:
  - default provider is gTTS
  - unsupported languages are mapped to a nearest available voice instead of silently giving up
  - optional sidecar provider downloads WAV from the isolated TTS service
- Connected to:
  - `server.py`
  - `tts_sidecar/app.py`
- Watch out:
  - voice availability is not identical to translation availability
  - adding a new language means updating both language support and voice-routing support

#### `backend/app/server.py`

- Purpose: the backend API and runtime orchestration
- Why it exists: this file is the actual API surface the app calls
- Main things inside:
  - environment parsing helpers
  - API key check
  - in-memory rate limiting
  - audio upload validation
  - generated audio persistence and signed URL handling
  - metrics logging
  - FastAPI endpoints
- Endpoints:
  - `GET /health`
  - `GET /ready`
  - `GET /languages`
  - `GET /metrics/recent`
  - `POST /translate/text`
  - `POST /translate/speech`
  - `GET /audio/{filename}`
- Connected to basically everything backend-side
- Beginner note:
  - if the frontend stops matching the backend, this is usually the first backend file to inspect
- Watch out:
  - request/response shapes here must stay in sync with `Expo/services/api.ts`

### Backend benchmark files

#### `backend/benchmark/README.md`

- Purpose: benchmark instructions
- Why it exists: explains what the scripts output and how to run them
- Beginner note: useful for demos and performance analysis, not required for basic feature work

#### `backend/benchmark/run_api_benchmark.py`

- Purpose: text-endpoint benchmark harness
- Why it exists: repeatedly hits `/translate/text`, stores raw rows, joins metrics, and builds summaries
- Main things inside:
  - dataset loading
  - threaded request execution
  - summary builders
  - markdown report generation
- Connected to:
  - `/translate/text`
  - `/metrics/recent`
  - CSV datasets

#### `backend/benchmark/run_speech_benchmark.py`

- Purpose: speech-endpoint benchmark harness
- Why it exists: same idea as the text benchmark, but for local audio fixtures
- Connected to:
  - `/translate/speech`
  - `/metrics/recent`
  - speech dataset CSV
- Watch out:
  - dataset audio paths must be real local files

#### `backend/benchmark/render_presentation_graphs.py`

- Purpose: generate nice charts from benchmark output
- Why it exists: turn CSV/JSON into presentation-friendly images
- Connected to:
  - benchmark results folders
  - `matplotlib`
- Beginner note: useful when someone asks for graphs, otherwise optional

#### `backend/benchmark/datasets/*.csv`

- Purpose: sample input sets for benchmarks
- Why they exist: benchmark scripts need repeatable test cases
- Files:
  - `language_length_text_cases.csv`
  - `presentation_text_cases.csv`
  - `speech_cases_template.csv`

### Backend tests

#### `backend/tests/test_server_hardening.py`

- Purpose: protect backend request safety and API behavior
- Covers:
  - path traversal blocking
  - signed audio URLs
  - upload size limits
  - API key enforcement
  - TTS failure survival
  - transliteration-normalized response fields
  - rate limiting
  - readiness behavior

#### `backend/tests/test_asr_language_fallback.py`

- Purpose: protect ASR route and fallback logic
- Covers:
  - Whisper language hints
  - long-tail auto-detect behavior
  - IndicConformer rollback
  - prepared-audio reuse

#### `backend/tests/test_model_inference_setup.py`

- Purpose: protect model loading behavior
- Covers:
  - models entering eval mode
  - lazy Indic ASR loading once only

#### `backend/tests/test_transliteration.py`

- Purpose: protect romanized-input normalization logic
- Covers:
  - native-script detection
  - romanized detection
  - supported and unsupported transliteration behavior

#### `backend/tests/test_tts_language_coverage.py`

- Purpose: protect TTS language routing coverage
- Covers:
  - all translation languages having a TTS route
  - explicit fallback voices for unsupported native gTTS cases

#### `backend/tests/test_tts_sidecar_client.py`

- Purpose: protect the sidecar client path
- Covers:
  - downloading WAV audio from the sidecar endpoint

### Optional sidecar files

#### `backend/tts_sidecar/README.md`

- Purpose: sidecar setup instructions
- Why it exists: this service has its own environment and dependencies

#### `backend/tts_sidecar/app.py`

- Purpose: isolated Parler TTS FastAPI app
- Why it exists: keeps heavy/alternative TTS dependencies separate from the main backend
- Main things inside:
  - model bundle lazy load
  - `/health`
  - `/tts`
- Watch out:
  - separate dependency set
  - separate port
  - separate runtime concerns

#### `backend/tts_sidecar/requirements.txt`

- Purpose: sidecar-specific dependency file
- Why it exists: the sidecar does not share exactly the same dependency stack as the main backend

### Frontend core files

#### `Expo/README.md`

- Purpose: main frontend setup guide
- Why it exists: explains how to run the app and what the main frontend folders do

#### `Expo/package.json`

- Purpose: frontend dependency + scripts file
- Why it exists: defines Expo scripts and frontend dependencies
- Important scripts:
  - `start`
  - `android`
  - `ios`
  - `web`
  - `lint`
  - `typecheck`
  - EAS build/submit scripts

#### `Expo/app.json`

- Purpose: Expo app configuration
- Why it exists: app name, slug, bundle/package IDs, microphone permission text, splash config, etc.
- Connected to:
  - native app behavior
  - store build identity
- Watch out:
  - change identifiers here carefully if release work is already in progress

#### `Expo/eas.json`

- Purpose: EAS build profile configuration
- Why it exists: defines development, preview, and production build profiles
- Beginner note: only matters once you are doing packaged builds

#### `Expo/app/_layout.tsx`

- Purpose: root app layout
- Why it exists: sets navigation theme and top-level stack routing
- Connected to:
  - `theme.ts`
  - tabs layout

#### `Expo/app/(tabs)/_layout.tsx`

- Purpose: tab bar layout
- Why it exists: gives the app its two main tabs
- Tabs:
  - `Translate`
  - `Backend`
- Connected to:
  - `HapticTab`
  - `IconSymbol`
  - theme colors/fonts

#### `Expo/app/(tabs)/index.tsx`

- Purpose: main translation screen
- Why it exists: this is the actual app experience users spend most of their time in
- Main things inside:
  - text translation flow
  - speech recording flow
  - output audio playback flow
  - conversation mode
  - retry handling
  - history
  - backend status banner
  - language picker modal
- Connected to:
  - `api.ts`
  - `preferences.ts`
  - `ui-copy.ts`
  - `languages.ts`
  - `use-backend-status.ts`
  - `expo-audio`
- Watch out:
  - huge file
  - central UX file
  - easy place to accidentally introduce state bugs

#### `Expo/app/(tabs)/explore.tsx`

- Purpose: backend help / status dashboard screen
- Why it exists: gives the frontend a simple place to show backend status and required route contract
- Main things inside:
  - `/health` check
  - current base URL display
  - route dependency list
- Beginner note: great file for understanding what the frontend expects from the backend

#### `Expo/services/api.ts`

- Purpose: frontend/backend contract layer
- Why it exists: keeps raw fetch logic out of screen components
- Main things inside:
  - base URL selection
  - API key header injection
  - backend readiness probing
  - JSON request helpers
  - text translation request
  - speech translation request
  - absolute audio URL helper
- Watch out:
  - if endpoint shape changes, this file must change too

#### `Expo/services/preferences.ts`

- Purpose: local app persistence
- Why it exists: stores language pair, mode, microphone onboarding flag, and recent history
- Main things inside:
  - `loadStoredPreferences()`
  - `saveStoredPreferences()`
- Connected to:
  - AsyncStorage
  - `index.tsx`
- Beginner note: if a user says "my app forgot everything" this is a place to inspect

#### `Expo/hooks/use-backend-status.ts`

- Purpose: reusable backend readiness hook
- Why it exists: the app needs to know whether the backend is ready, warming, offline, unauthorized, or error
- Main things inside:
  - `refresh()`
  - AppState listener that re-checks when the app becomes active
- Connected to:
  - `api.ts`
  - `index.tsx`

#### `Expo/constants/languages.ts`

- Purpose: frontend language list and native labels
- Why it exists: language pickers need a list even before the backend responds
- Main things inside:
  - `SUPPORTED_LANGUAGES`
  - `LANGUAGE_LABELS`
  - `getLanguageLabel(...)`
- Watch out:
  - this duplicates backend language knowledge
  - if you add/remove a language, update backend and frontend together

#### `Expo/constants/theme.ts`

- Purpose: shared colors and font choices
- Why it exists: central theme config for light and dark mode plus font families
- Beginner note: if you want to change the overall feel of the app, start here and then adjust screen styles

#### `Expo/constants/ui-copy.ts`

- Purpose: the giant UI wording dictionary
- Why it exists: lets the app change labels and messages based on source language
- Main things inside:
  - `UiCopy` type
  - `ENGLISH_UI`
  - large `UI_COPY` overrides object
  - `UI_SUBTITLES`
  - `getUiCopy(...)`
- Connected to:
  - `index.tsx`
- Watch out:
  - very large file
  - easy to make inconsistent wording if you edit one part and forget matching copy elsewhere

### Frontend support/helper files

#### `Expo/components/themed-text.tsx`

- Purpose: text wrapper that respects theme colors and text variants
- Why it exists: avoids repeating text styling logic everywhere

#### `Expo/components/themed-view.tsx`

- Purpose: view wrapper that respects theme colors
- Why it exists: same idea as themed text, but for containers

#### `Expo/components/haptic-tab.tsx`

- Purpose: tab button with iOS haptic feedback
- Why it exists: nicer tab press feel on iOS

#### `Expo/components/ui/icon-symbol.tsx` and `icon-symbol.ios.tsx`

- Purpose: shared icon wrapper
- Why they exist:
  - iOS can use SF Symbols directly
  - Android/web fall back to Material Icons

#### `Expo/components/ui/collapsible.tsx`

- Purpose: expandable/collapsible content helper
- Why it exists: generic reusable UI helper
- Beginner note: not central to the translation flow

#### `Expo/hooks/use-theme-color.ts`

- Purpose: pick the right themed color
- Why it exists: shared color selection helper

#### `Expo/hooks/use-color-scheme.ts` and `use-color-scheme.web.ts`

- Purpose: color-scheme helpers
- Why they exist: consistent light/dark behavior across native and web

### Frontend starter leftovers and low-priority files

These are real files, but they are not central to the app logic:

#### `Expo/app/modal.tsx`

- starter modal screen
- not part of the main translation experience

#### `Expo/components/hello-wave.tsx`

- starter/demo animated component
- safe to ignore

#### `Expo/components/parallax-scroll-view.tsx`

- starter/demo layout helper
- safe to ignore unless you reuse it later

#### `Expo/components/external-link.tsx`

- generic helper to open links
- not important to the translation flow right now

#### `Expo/scripts/reset-project.js`

- Expo starter reset script
- safe to ignore
- if anything, it is a reminder that some starter-template files were kept around

---

## 6. Important Code Walkthroughs

This section is the "okay cool, but what is the code actually doing?" part.

### Walkthrough 1: frontend startup and initial load

Main file:

- `Expo/app/(tabs)/index.tsx`

What it does in simple words:

- restores local preferences
- fetches supported languages from the backend
- configures audio mode
- decides what the screen should look like at first

Step-by-step:

1. The screen mounts.
2. It restores any saved preferences from AsyncStorage.
3. It tries to fetch languages from `GET /languages`.
4. If the backend is reachable, it uses that backend list.
5. If the backend is not reachable, it falls back to the baked-in frontend language list.
6. It sets up audio mode so the app can record and play.
7. It starts tracking backend status separately through `useBackendStatus()`.

Why this matters:

- this is where "first impression" bugs show up
- if the app loads in a weird state, this setup logic is a prime suspect

What would likely break if changed carelessly:

- language pickers
- saved preferences restore
- onboarding state
- backend availability banners

### Walkthrough 2: typed translation from the frontend

Main files:

- `Expo/app/(tabs)/index.tsx`
- `Expo/services/api.ts`
- `backend/app/server.py`
- `backend/app/translation.py`

Step-by-step:

1. User types into the input box.
2. `translateFromText()` runs.
3. Frontend sends JSON to `/translate/text`.
4. Backend validates text and language names.
5. Backend normalizes romanized text if relevant.
6. Backend chooses a translation route in `TranslationService`.
7. Backend returns translated text and maybe an audio URL.
8. Frontend calls `applyTranslation(...)`.
9. UI updates the result card and history.

Why this matters:

- this is the cleanest end-to-end route in the project
- if you understand this flow, the speech flow is easier to follow

### Walkthrough 3: speech translation from the frontend

Main files:

- `Expo/app/(tabs)/index.tsx`
- `Expo/services/api.ts`
- `backend/app/server.py`
- `backend/app/asr.py`

Step-by-step:

1. User taps Speak.
2. `toggleRecording()` requests microphone permission if needed.
3. Expo starts recording audio.
4. User taps Stop.
5. Frontend gets the recording URI.
6. Frontend uploads the file with multipart form data to `/translate/speech`.
7. Backend validates the file and writes a temp upload.
8. Backend runs ASR.
9. Backend translates the ASR text.
10. Backend returns transcript + translation + optional audio.
11. Frontend stores transcript and displays the result.

Why this matters:

- this is the most "multi-step" feature
- if speech translation fails, the bug could be frontend recording, backend upload validation, ASR routing, or translation

### Walkthrough 4: why Listen is a second step

Main files:

- `Expo/app/(tabs)/index.tsx`
- `backend/app/server.py`
- `backend/app/tts.py`

What it does in simple words:

- the app tries to be fast first and fancy second

Step-by-step:

1. Frontend usually requests text translation with `include_speech=false`.
2. That skips the TTS wait.
3. User sees translated text faster.
4. If the user later taps Listen, the app checks whether an audio URL already exists.
5. If it does not, the app re-requests the translation with `include_speech=true`.
6. The backend runs TTS and returns an audio URL.
7. Frontend plays the audio.

Why this matters:

- people reading the code for the first time often think the missing `audio_url` is a backend bug
- it is usually intentional

### Walkthrough 5: backend text endpoint

Main file:

- `backend/app/server.py`, function `translate_text(...)`

Step-by-step:

1. enforce rate limit
2. cleanup expired generated audio files
3. reject empty text
4. normalize source and target language names
5. convert human language names into backend language codes
6. normalize romanized text if possible
7. get services with lazy initialization
8. translate text
9. optionally run TTS
10. log metrics
11. return response JSON

Why this matters:

- this is the main backend API contract
- this is where request validation and response shape live

What would likely break if changed carelessly:

- frontend requests
- benchmarks
- tests
- audio playback

### Walkthrough 6: backend speech endpoint

Main file:

- `backend/app/server.py`, function `translate_speech(...)`

Step-by-step:

1. enforce rate limit
2. cleanup expired audio files
3. normalize language names
4. validate uploaded audio extension/content type
5. stream upload into a temp file
6. reject empty or oversized uploads
7. run ASR
8. run translation
9. optionally run TTS
10. log metrics
11. clean up the temp upload file in `finally`

Why this matters:

- it combines file handling, ASR, translation, and TTS
- it is the most backend-heavy route

### Walkthrough 7: translation route decision

Main file:

- `backend/app/translation.py`, method `translate_text_with_stats(...)`

What it does in normal human language:

- decide which translation model path makes the most sense for the current source/target pair

Route logic:

1. English -> Indic uses the English-to-Indic model directly.
2. Indic -> English uses the Indic-to-English model directly.
3. Indic -> Indic tries the direct Indic-to-Indic model first.
4. If direct Indic -> Indic fails, it falls back to:
   - Indic -> English
   - English -> Indic

Why this matters:

- this file is not just "run model"
- it is also "choose the least bad route if the preferred route fails"

### Walkthrough 8: ASR route decision

Main file:

- `backend/app/asr.py`, method `transcribe_with_stats(...)`

Route logic:

1. If source language is English:
   - use Whisper directly
2. If `ASR_PROVIDER=indic_conformer_multi` and the language is supported:
   - try IndicConformer first
   - if it fails, roll back to legacy stack
3. Legacy non-English path:
   - for selected languages, try IndicWav2Vec
   - if IndicWav2Vec fails or returns empty output, fall back to Whisper
4. For long-tail languages without IndicWav2Vec:
   - use Whisper
   - apply language hint when possible
   - auto-detect when not possible

Why this matters:

- this is one of the smartest parts of the backend
- it is basically saying "best effort, do not leave the user with nothing if one model path fails"

### Walkthrough 9: romanized input normalization

Main file:

- `backend/app/transliteration.py`

What it does:

- tries to detect when a user typed an Indic language using Latin letters

Example idea:

- user types `mera naam rahul hai`
- backend may convert that into native Hindi script before translation

Why this matters:

- user input is messy in real life
- this improves translation quality for supported languages

Important limitation:

- not every language gets this feature
- unsupported languages simply pass through unchanged

---

## 7. Common Changes People May Need

### 1. Change app text, labels, or error messages

Edit:

- `Expo/constants/ui-copy.ts`

Also check:

- `Expo/app/(tabs)/index.tsx`
- `Expo/app/(tabs)/explore.tsx`

Test after:

- type translation
- speech translation
- backend offline state
- retry flow

### 2. Change colors, fonts, or general UI feel

Edit:

- `Expo/constants/theme.ts`
- `Expo/app/(tabs)/index.tsx`
- `Expo/app/(tabs)/explore.tsx`

Test after:

- light mode
- dark mode
- small phone width
- backend status banners

### 3. Change the backend URL or API key behavior for the frontend

Check:

- `Expo/services/api.ts`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_API_KEY`

Test after:

- `/health` reachability through the app
- text translation
- unauthorized state if API key mode is enabled

### 4. Add or remove a supported language

This is a multi-file change. Do not do it in only one place.

Update:

- `backend/app/languages.py`
- `Expo/constants/languages.ts`
- `backend/app/asr.py`
  - if speech recognition should support it
- `backend/app/tts.py`
  - if voice output should support it
- `Expo/constants/ui-copy.ts`
  - if you want localized UI wording for that language

Test after:

- `/languages`
- text translation
- speech translation if supported
- voice playback if supported

### 5. Change translation behavior or model routing

Edit:

- `backend/app/translation.py`

Test after:

- backend unit tests
- at least one English -> Indic request
- at least one Indic -> English request
- at least one Indic -> Indic request

### 6. Change speech recognition behavior

Edit:

- `backend/app/asr.py`

Test after:

- backend unit tests
- speech translation on at least one supported language
- fallback behavior

### 7. Change text-to-speech behavior

Edit:

- `backend/app/tts.py`
- maybe `backend/tts_sidecar/app.py`

Test after:

- text translation with `include_speech=true`
- speech translation with `include_speech=true`
- direct audio playback from the app

### 8. Change request limits, CORS, or backend hardening settings

Edit or configure:

- `backend/app/server.py`
- environment variables such as:
  - `VAANI_API_KEY`
  - `VAANI_ALLOWED_ORIGINS`
  - `VAANI_RATE_LIMIT_REQUESTS`
  - `VAANI_MAX_UPLOAD_BYTES`
  - `VAANI_AUDIO_URL_SECRET`

Test after:

- CORS from the frontend
- large upload rejection
- API key enforcement
- signed audio URLs if enabled

### 9. Add a new backend endpoint

Update:

- `backend/app/server.py`
- `Expo/services/api.ts`
- whichever screen uses the new endpoint
- tests

Rule of thumb:

- if the frontend is supposed to call it, never add the backend route alone and stop there

### 10. Add a new frontend screen

Update:

- `Expo/app/`
- maybe `Expo/app/(tabs)/_layout.tsx`
- maybe `Expo/app/_layout.tsx`

Test after:

- navigation
- theme
- backend state if relevant

### 11. Change conversation mode behavior

Edit:

- `Expo/app/(tabs)/index.tsx`

Watch out:

- this mode auto-swaps source and target after each successful turn
- if you change that, test the whole user flow, not just one translation call

### 12. Change benchmark datasets or reporting

Edit:

- files in `backend/benchmark/`

Test after:

- run one short benchmark
- confirm results folder is created
- confirm summary files and graphs still generate

---

## 8. Known Problems / Weird Stuff

This section is the "this looks odd, but there is a reason" section.

### 1. `npm run lint` may fail locally because of cache writes

Observed during this documentation pass:

- the default Expo lint command hit an `EPERM` cache write error under `.expo/cache/eslint`
- `cmd /c npx eslint . --no-cache` passed

Translation:

- the code can be fine even if the cached lint command is being dramatic

### 2. The project has some local-only helper files that are gitignored

Examples:

- `tools/`
- `release.ps1`
- `release.sh`
- `PUBLISHABILITY_CHECKLIST.md`

Translation:

- if someone clones from remote and those files are missing, that is normal
- do not assume every developer will have the exact same extra helpers

### 3. Language support is defined in more than one place

Backend:

- `backend/app/languages.py`

Frontend:

- `Expo/constants/languages.ts`

Also related:

- `backend/app/asr.py`
- `backend/app/tts.py`
- `Expo/constants/ui-copy.ts`

Translation:

- adding a language is not a one-file job

### 4. Frontend `SupportedLanguage` is typed as `string`

This makes the frontend flexible, but it also means TypeScript is not protecting language values as strongly as it could.

Translation:

- it is easy to pass a bad language string around if you are careless

### 5. The main translation screen is huge

`Expo/app/(tabs)/index.tsx` is doing a lot:

- translation mode
- conversation mode
- recording
- playback
- history
- retry handling
- language picker
- banners
- animations

Translation:

- this file probably wants future refactoring
- right now it is functional, but it is a lot

### 6. The app intentionally asks for text first and audio later

Frontend usually sends `include_speech=false` first.

Translation:

- "no audio URL yet" is often a speed optimization, not a bug

### 7. Romanized input support is partial, not universal

Some languages can be transliterated from Latin input to native script before translation.
Some cannot.

Translation:

- if romanized input works for one language and not another, that may be by design, not a random failure

### 8. First backend startup can be slow

Reason:

- big model login/load/warmup

Translation:

- use `/ready`, not just vibes

### 9. Physical mobile QA is still a release risk

The local publishability checklist still calls out unfinished items like:

- real Android device verification
- real iPhone verification
- final branding assets
- store metadata

Translation:

- do not assume "works on Expo web" means "ready for store release"

### 10. Release scripts are powerful and not very picky

`release.ps1` and `release.sh` both run `git add .`

Translation:

- if your working tree is messy, they will happily package the mess

### 11. There are some Expo starter leftovers

Examples:

- `modal.tsx`
- `hello-wave.tsx`
- `parallax-scroll-view.tsx`
- `reset-project.js`

Translation:

- not everything in this repo is equally meaningful
- some files are just leftover scaffolding

---

## 9. Vocabulary / Beginner Notes

### API

The set of backend routes the frontend calls.

Normal human translation:

- "the menu of URLs the app is allowed to talk to"

### Endpoint

One specific API route, like `POST /translate/text`.

### FastAPI

The Python web framework used by the backend.

Normal human translation:

- "the thing that turns Python functions into web routes"

### Expo

The frontend app/tooling setup used here for React Native.

Normal human translation:

- "the frontend project system for mobile/web app development"

### React Native

Frontend framework for building mobile UI with React ideas.

### Route

This word is overloaded in this repo.

It can mean:

- a frontend screen route
- a backend API route
- a model route decision

So always check the context.

### ASR

Automatic Speech Recognition.

Normal human translation:

- "speech-to-text"

### TTS

Text-to-Speech.

Normal human translation:

- "make the computer talk"

### TTS sidecar

A separate FastAPI service used for optional Parler TTS.

Normal human translation:

- "the extra voice server that lives next to the main backend instead of inside it"

### Whisper

OpenAI speech-recognition model used here for English and fallback cases.

### IndicWav2Vec

Language-specific speech-recognition models used for selected Indian languages in the legacy ASR path.

### IndicConformer

Optional multilingual ASR model that can be tried before falling back to the legacy stack.

### IndicTrans2

The translation model family used by the backend.

### Transliteration

Converting the writing system, not the meaning.

Example idea:

- Latin-typed Hindi -> Devanagari Hindi

### Romanized input

An Indic language typed in English letters.

Example:

- `mera naam rahul hai`

### Warmup

Startup work done before the service is really ready.

Normal human translation:

- "load the heavy stuff now so the first real user request is less painful"

### Rate limiting

Temporary limit on how many requests one client can make in a time window.

### CORS

Browser permission rules for which frontend origins may call the backend.

Normal human translation:

- "which websites/apps the backend says are allowed to talk to it from a browser"

### AsyncStorage

Frontend local storage used by the app for preferences and history.

### Conversation mode

A mode where the app records one turn, translates it, then swaps the language pair so the other person can answer back.

### `include_speech`

A request flag that tells the backend whether it should also generate audio output.

Normal human translation:

- "do you want only the translated text, or also the voice file?"

### Metrics

Structured details about requests, timing, routes, and generated output.

Normal human translation:

- "debug breadcrumbs with numbers attached"

### Benchmark harness

Scripts that repeatedly hit the backend and summarize performance.

Normal human translation:

- "automated stress-test and report generator"

---

## Suggested reading order for a brand-new teammate

If I were handing this project to someone tomorrow, I would tell them to read in this order:

1. `README.md`
2. `backend/README.md`
3. `Expo/README.md`
4. this document
5. `Expo/services/api.ts`
6. `backend/app/server.py`
7. `backend/app/translation.py`
8. `backend/app/asr.py`
9. `Expo/app/(tabs)/index.tsx`
10. backend tests

That order gives you:

- setup
- architecture
- contract between frontend and backend
- core translation logic
- core speech logic
- examples of expected behavior

---

## Final advice for the next team

This project is not tiny, but it is also not magic.

If you get lost, come back to this question:

"Am I looking at frontend UI state, the frontend/backend contract, or backend model logic?"

Most confusion in this repo comes from mixing those layers together.

Also: do not try to understand all of `Expo/app/(tabs)/index.tsx` in one sitting unless you enjoy suffering.
Understand the flow in chunks:

1. startup
2. text translation
3. speech translation
4. audio playback
5. conversation mode
6. history + retry behavior

That path is much saner.

And finally:

- use the tests
- trust the route flow more than assumptions
- update language-related files together
- and if something looks weird, check whether it is one of the "weird but intentional" items from Section 8 before declaring war on the codebase

