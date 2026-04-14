# Expo Frontend Guide

This app provides the Vaani Connect user interface for mobile and web.

## Prerequisites

- Node.js LTS
- npm
- A running backend API, typically at `http://localhost:8000`

Check your local versions:

```bash
node -v
npm -v
```

## Install and Run

From `Expo/`:

```bash
npm install
npm run start
```

Expo will let you open the app in:

- Android
- iOS
- Web

## Backend Dependency

The frontend expects the backend API to be available. Start the backend separately:

```bash
uvicorn app.server:app --host 0.0.0.0 --port 8000
```

If the backend is not running, translation and speech features will fail.

## Useful Scripts

- `npm run start` - start the Expo dev server
- `npm run android` - open Android target when configured
- `npm run ios` - open iOS target when configured
- `npm run web` - run the web target directly
- `npm run reset-project` - reset the Expo starter structure if needed

## Main Frontend Areas

- `app/` - screens and routes
- `components/` - reusable UI pieces
- `constants/` - shared UI text, theme values, and languages
- `services/` - backend API and local preference helpers
- `hooks/` - reusable React hooks

## Related Docs

- [../README.md](../README.md)
- [../backend/README.md](../backend/README.md)
