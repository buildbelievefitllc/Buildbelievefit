// src/version.js
// ─────────────────────────────────────────────────────────────────────────────
// Build-time app version stamp. `__APP_VERSION__` is replaced at build time by
// Vite's `define` (see vite.config.js) with the CI's BBF_VERSION_NAME — the very
// same `1.0.<run#>` string gradle stamps into the Android versionName — so the
// in-app badge always matches the exact build running on the device.
//
// Falls back to 'dev' for local dev servers and web-only deploys (GitHub Pages /
// Render) where BBF_VERSION_NAME isn't in the environment. Never hardcode a
// version here — that is exactly the staleness this stamp exists to kill.
/* global __APP_VERSION__ */
export const APP_VERSION =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : 'dev';
