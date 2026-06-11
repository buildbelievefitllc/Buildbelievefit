# Android Native Bridge — Health Connect → BBF Wearable Sync

The final leg of the Wearable Sync pipeline: pull **HRV** and **Sleep** (plus an
active-calorie load signal) from Android **Health Connect** in native Kotlin, hand it
to the React app over a Capacitor bridge, and fire it at the live ingest webhook.

---

## 0 · Wrapper assessment (do this first — it changes everything)

This repo currently has **no Android wrapper**: no `capacitor.config.*`, no Cordova
`config.xml`, no Android Studio project, no `AndroidManifest.xml`. `scripts/playstore/`
is only a Play Store **asset generator** (Sharp screenshots), not a shell. The product
is a Vite/React PWA (`frontend/`) + a legacy root PWA.

**Decision: Capacitor.** A TWA/Bubblewrap (the usual "PWA → Play Store" path the asset
generator hints at) runs the site in **Chrome Custom Tabs** — there is no WebView you
control, so `@JavascriptInterface` / custom native code is impossible, which rules out
Health Connect. Capacitor wraps the same `dist/` build in a **controllable WebView**,
supports custom native plugins (its bridge is `@JavascriptInterface` under the hood),
and ships to the Play Store. Cordova is its legacy predecessor; Capacitor is the modern
choice and integrates cleanly with the existing Vite build.

So the order's **"If using Capacitor: write the custom Capacitor Plugin"** branch is the
one implemented here.

---

## 1 · What's in this folder (the native payload + bridge)

| File | Drops into (after `npx cap add android`) | Role |
|---|---|---|
| `HealthConnectManager.kt` | `android/app/src/main/java/fitness/buildbelievefit/app/` | Pure Health Connect logic — reads HRV / sleep / active calories, builds the recovery JSON. **Real API, no mocks.** |
| `HealthConnectBridgePlugin.kt` | same package dir | The `@CapacitorPlugin` — exposes `isAvailable` / `requestPermissions` / `readRecovery` to JS. |
| `MainActivity.kt` | same package dir (replaces the generated stub) | Registers the plugin. |
| `AndroidManifest.additions.xml` | merge into `android/app/src/main/AndroidManifest.xml` | HRV/Sleep/Calories read permissions, package visibility, rationale entry points. |
| `build.gradle.additions` | merge into `android/app/build.gradle` | `connect-client`, coroutines, `minSdk 26`. |

The web/React half is already wired in the app and ships today:
`frontend/src/native/healthConnectBridge.js` (JS side of the bridge) and
`frontend/src/lib/healthConnectSync.js` (`syncHealthConnect()` + `useHealthConnectSync()`).

---

## 2 · One-time wrapper setup

```bash
cd frontend

# Capacitor core + Android platform + CLI
npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/android

# Build the web app, then generate the native Android project
npm run build            # → frontend/dist
npx cap add android      # generates frontend/android/ (needs the Android SDK)
```

`capacitor.config.ts` already exists at `frontend/` (appId `fitness.buildbelievefit.app`,
`webDir: dist`).

> The web bundle stays dependency-free: `healthConnectBridge.js` talks to the runtime
> `window.Capacitor` global the shell injects, so `npm run build` / `lint` stay green
> with or without Capacitor installed.

## 3 · Install the native bridge

1. Copy the three `*.kt` files into
   `android/app/src/main/java/fitness/buildbelievefit/app/` (overwrite the generated
   `MainActivity.kt`).
2. Merge `AndroidManifest.additions.xml` (3 blocks) into `AndroidManifest.xml`.
3. Merge `build.gradle.additions` into `android/app/build.gradle`.
4. Sync + run:

```bash
npx cap sync android
npx cap open android     # build / run from Android Studio
```

## 4 · Data flow

```
Health Connect ──(Kotlin: HealthConnectManager.readRecovery)──► JSON
  { reading_date, hrv_ms, sleep_minutes, active_kcal, recorded_at, ... }
        │  Capacitor bridge (window.Capacitor.Plugins.HealthConnectBridge)
        ▼
React  healthConnectSync.js  ─ maps → `manual` canonical reading
        │   strain = ULU(active_kcal)   // mirrors _shared/wearable-core.mjs
        ▼
supabase.functions.invoke('bbf-wearable-ingest',
   { source:'manual', session_token, payload })   // athlete-sync path
        ▼
bbf_ingest_wearable_reading() → bbf_wearable_readings (+ ACWR)
        ▼
window 'bbf:wearable-updated' → open athlete dossier refetches live
```

## 5 · Naming / contract notes (read before wiring a button)

- The order referenced `bbf-health-sync`; the **real, live endpoint is
  `bbf-wearable-ingest`**. There is no `bbf-health-sync` function.
- Android Health Connect maps to **`source: 'manual'`** — the table CHECK constraint and
  the ingest RPC only accept `whoop | apple | oura | manual`, and the
  `bbf_admin_simulate_wearable` migration already documents a Health Connect sync as
  exactly a `manual` reading (HRV<35 / sleep<240 = a CNS breach).
- `bbf_wearable_readings.strain` is **NOT NULL**. HRV + Sleep alone are rejected with
  `invalid_strain`, which is why the native read also pulls `READ_ACTIVE_CALORIES_BURNED`
  and derives strain via the documented `min(1, kcal/1000)·100` ULU formula. With no
  active-calorie data, strain is a valid `0` (sedentary), so the ordered HRV + Sleep
  scopes remain the functional core.
- The client uses the **athlete-sync (vault session token)** path only. The webhook's
  admin/Vault-secret path is server-side and must never ship in the browser bundle
  (CLAUDE.md §7).

## 6 · Usage in a component

```jsx
import { useHealthConnectSync } from '../lib/healthConnectSync.js';

function SyncButton() {
  const { available, syncing, error, sync } = useHealthConnectSync();
  if (!available) return null; // hidden in the browser/PWA; shown in the Android app
  return (
    <button onClick={sync} disabled={syncing}>
      {syncing ? 'Syncing…' : 'Sync Health Connect'}
      {error ? ` — ${error}` : ''}
    </button>
  );
}
```

> **Environment note:** the Kotlin here is production source but was not compiled in the
> automation environment (no Android SDK / Gradle). The web half (`src/native`,
> `src/lib`) is verified green via `npm run lint` + `npm run build`.
