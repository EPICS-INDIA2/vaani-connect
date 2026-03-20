# Vaani Connect Publishability Checklist

This checklist tracks the work needed to move Vaani Connect from a working demo to a store-ready mobile app.

## 1. Native app experience

- [x] Replace web-only speech capture with native Expo recording on iOS and Android.
- [x] Replace external-link audio playback with in-app playback.
- [ ] Test speech record and playback on at least one physical Android device.
- [ ] Test speech record and playback on at least one physical iPhone.
- [ ] Add interrupted-audio handling for phone calls, Bluetooth changes, and app backgrounding.
- [ ] Add user-facing error states for offline, timeout, and backend overload conditions.

## 2. App configuration and branding

- [x] Set stable app name, slug, scheme, bundle identifier, Android package, and build/version counters.
- [x] Add native microphone permission text.
- [ ] Replace placeholder icons, splash treatment, screenshots, and store artwork with final brand assets.
- [ ] Confirm the reverse-DNS identifiers are the final ones you want before first store submission.
- [ ] Add support email, privacy policy URL, and marketing site URL to release materials.

## 3. Build and release pipeline

- [x] Add `eas.json` with development, preview, and production profiles.
- [x] Add package scripts for preview/production builds and store submission commands.
- [ ] Create the Expo project in EAS and connect it to the final account owner/project ID.
- [ ] Set EAS secrets or environment variables for `EXPO_PUBLIC_API_BASE_URL` and any protected preview credentials.
- [ ] Produce one preview Android APK and one preview iOS build.
- [ ] Verify installs, permissions, networking, and app startup on physical devices.

## 4. Backend production hardening

- [x] Support optional `X-API-Key` from the Expo client for protected internal environments.
- [ ] Replace shared app credentials with a safer public-client auth model.
- [x] Move generated audio off temp disk to durable storage or signed short-lived URLs.
- [x] Add a real readiness endpoint that reflects model initialization and warmup failures.
- [ ] Review production CORS, rate limits, request logging, and redaction policy.
- [ ] Add deployment automation for a public HTTPS backend with monitoring and alerting.

## 5. Quality and CI

- [x] Expo lint passes.
- [x] Expo TypeScript typecheck passes.
- [x] Fix backend CI path drift so tests run against `backend/`.
- [x] Add backend tests for any new production auth/storage behavior.
- [ ] Add frontend test coverage for translation flow and error states.
- [x] Add at least one CI job for Expo lint/typecheck.

## Suggested next release order

1. Stand up a public HTTPS backend and wire `EXPO_PUBLIC_API_BASE_URL` through EAS.
2. Replace shared app credentials with a safer public-client auth model.
3. Run preview builds on real devices and close any platform-specific bugs.
4. Add frontend test coverage for the translation flow and failure states.
5. Prepare store assets, privacy policy, and submission metadata.
