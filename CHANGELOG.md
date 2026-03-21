# Change Log

Use this file to record what changed in the project over time.

## Entry Template

Copy this block for each update:

```md
## YYYY-MM-DD - Short Title

- Area: Backend | Expo | Full Stack | Docs | DevOps
- Summary: What changed and why
- Files: `path/to/file1`, `path/to/file2`
- Commands Run: `npm test`, `uvicorn ...` (if any)
- Validation: What you tested and the result
- Notes/Risks: Anything incomplete, risky, or important
- Next Step: What should happen next
```

---

## 2026-03-21 - Sprint 4 Release Hardening

- Area: Expo | Docs
- Summary: Tuned the main translation screen for smoother language searching by deferring the search query and virtualizing the language picker list, then refreshed the publishability checklist and release guide with the current device QA and release-gate expectations.
- Files: `Expo/app/(tabs)/index.tsx`, `PUBLISHABILITY_CHECKLIST.md`, `RELEASE_SH_GUIDE.md`
- Commands Run: `npm.cmd run typecheck`, `cmd /c npx eslint . --no-cache`
- Validation: Expo TypeScript typecheck passed and ESLint passed through the non-PowerShell entrypoint.
- Notes/Risks: Physical Android and iPhone QA, EAS project connection, and store assets remain release blockers.
- Next Step: Run the release candidate on real devices, then finish EAS and store-submission readiness once the remaining backend and branding items are finalized.

## 2026-03-20 - Fixed Backend CI Test Expectation

- Area: Backend
- Summary: Fixed a failing ASR unit test in GitHub Actions by correcting the mocked fallback expectation. The test was asserting that Whisper ran even though the mocked Indic fallback path already returned the final transcription.
- Files: `backend/tests/test_asr_language_fallback.py`, `CHANGELOG.md`
- Commands Run: None
- Validation: Aligned the test assertion with the mocked control flow so `test_transcribe_with_stats_preloads_audio_once_for_fallback_paths` no longer dereferences a missing Whisper mock call.
- Notes/Risks: This only fixes the test expectation; it does not change backend runtime behavior.
- Next Step: Re-run `backend-tests.yml` in GitHub to confirm the workflow is green.

## 2026-03-20 - Reduced Speech Translation Latency

- Area: Full Stack
- Summary: Reduced end-to-end translation wait time by reusing decoded audio across backend ASR fallback paths and by switching the mobile app to request fast text-first translations without blocking on TTS unless the user explicitly taps listen.
- Files: `backend/app/asr.py`, `backend/app/server.py`, `backend/tests/test_asr_language_fallback.py`, `backend/tests/test_server_hardening.py`, `Expo/services/api.ts`, `Expo/app/(tabs)/index.tsx`, `CHANGELOG.md`
- Commands Run: `npm.cmd run typecheck`
- Validation: Expo TypeScript typecheck passed. Added backend coverage for skip-TTS speech requests and prepared-audio reuse across ASR fallback paths, but backend unit tests could not be executed from this shell because no runnable Windows Python interpreter is available here and WSL launch is denied.
- Notes/Risks: The API remains backward-compatible because `include_speech` still defaults to true on the backend, but the app now prefers generating audio on demand after the fast text response.
- Next Step: Measure median latency before and after on a physical device and, if needed, tune translation decoding parameters for another speed pass.

## 2026-03-10 - Added Change Log

- Area: Docs
- Summary: Created a dedicated update log so project progress can be tracked consistently.
- Files: `CHANGELOG.md`
- Commands Run: None
- Validation: File added to repository root and ready for future updates.
- Notes/Risks: None
- Next Step: Add a new entry each time you make a meaningful project update.


## 2026-03-14

- Moved `POST /translate/speech` onto FastAPI's synchronous worker path so ASR, translation, and TTS no longer run inside the async event loop.
- Made TTS best-effort for both translation endpoints. Requests now succeed even when `gTTS` fails, and TTS errors are logged in backend metrics instead of crashing the request.
- Loaded translation and lazy Indic ASR models in eval mode and added a lock around the lazy Indic ASR cache to avoid duplicate first-request model initialization.

## 2026-03-18 - Added Indic Parler TTS Sidecar Architecture

- Area: Backend
- Summary: Added an isolated `tts_sidecar` service for Indic Parler-TTS so the main backend can keep its existing translation/ASR dependency stack while optionally calling Parler over HTTP.
- Files: `backend/app/tts.py`, `backend/app/server.py`, `backend/app/main.py`, `backend/tests/test_server_hardening.py`, `backend/tests/test_tts_sidecar_client.py`, `backend/tts_sidecar/app.py`, `backend/tts_sidecar/requirements.txt`, `backend/tts_sidecar/README.md`, `backend/README.md`, `README.md`, `CHANGELOG.md`
- Commands Run: None
- Validation: Added backend tests for the sidecar client path and for serving `.wav` generated audio alongside existing TTS behavior.
- Notes/Risks: Automated backend test execution was not completed in this shell, so the new sidecar path still needs a real environment smoke test after dependencies are installed.
- Next Step: Install the sidecar dependencies in a separate environment, start it on port `8010`, and verify end-to-end translation plus audio playback with `VAANI_TTS_PROVIDER=parler_sidecar`.

## 2026-03-18 - Added One-Command Dev Stack Launcher

- Area: DevOps
- Summary: Added PowerShell launcher scripts to start and stop the recommended dev stack in one command, with the Python services running in WSL and Expo running in Windows.
- Files: `tools/start-dev-stack.ps1`, `tools/stop-dev-stack.ps1`, `.vscode/tasks.json`, `README.md`, `CHANGELOG.md`
- Commands Run: None
- Validation: Added PID and log tracking for each service, plus matching VS Code tasks for start/stop workflows.
- Notes/Risks: The launcher expects the backend WSL virtual environment at `backend/.venv` and uses the sidecar automatically only when `backend/tts_sidecar/.venv` exists.
- Next Step: Run the new launcher, confirm the stack comes up end-to-end, and inspect `.git/dev-stack/` logs if any service fails during boot.

## 2026-03-20 - Added Speech Benchmark Harness

- Area: Backend
- Summary: Added `benchmark/run_speech_benchmark.py` to benchmark `/translate/speech` with local audio fixtures, backend metrics joins, and request-level CSV/summary outputs.
- Files: `backend/benchmark/run_speech_benchmark.py`, `backend/benchmark/datasets/speech_cases_template.csv`, `backend/benchmark/README.md`, `CHANGELOG.md`
- Commands Run: `wsl.exe bash -lc "cd '/mnt/c/vaaniconnect9/vaani-connect/backend' && source .venv/bin/activate && python -m py_compile benchmark/run_speech_benchmark.py"`
- Validation: The new script compiled successfully in the backend WSL environment.
- Notes/Risks: The template dataset references placeholder audio fixture paths; replace them with real files before running the harness.
- Next Step: Add a small set of representative speech fixtures and run the new harness against a warm backend to capture p50/p95 latency.
