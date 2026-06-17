// src/native/healthConnectBridge.js
// ─────────────────────────────────────────────────────────────────────────────
// Web → native bridge for the Android Health Connect plugin (HealthConnectBridge).
//
// Deliberately has NO static `@capacitor/core` import. The web / PWA bundle ships
// WITHOUT Capacitor, so this module reads the runtime global the native Android
// shell injects (`window.Capacitor`) and degrades to a no-op in a plain browser.
// That keeps `npm run build` dependency-free and green (CLAUDE.md §6/§10) while the
// same code lights up inside the Capacitor WebView, where the native plugin is
// auto-exposed on `window.Capacitor.Plugins.HealthConnectBridge`.
//
// Native side (single compiled source of truth):
//   frontend/android/app/src/main/java/fitness/buildbelievefit/twa/
//   — HealthConnectManager.kt + HealthConnectBridgePlugin.kt (Health Connect client).

function capacitor() {
  return (typeof window !== 'undefined' && window.Capacitor) || null;
}

// True only inside the native Android (Capacitor) shell — not in the browser/PWA.
export function isNativePlatform() {
  const c = capacitor();
  return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
}

function plugin() {
  const c = capacitor();
  return (c && c.Plugins && c.Plugins.HealthConnectBridge) || null;
}

// The native Health Connect bridge is present and callable on this device.
export function hasHealthBridge() {
  return isNativePlatform() && !!plugin();
}

// { available: boolean, status: 'available'|'unavailable'|'update_required'|... }
export async function healthConnectAvailable() {
  const p = plugin();
  if (!p) return { available: false, status: 'no_bridge' };
  try {
    return await p.isAvailable();
  } catch (e) {
    return { available: false, status: 'error', detail: String((e && e.message) || e) };
  }
}

// Launches the Health Connect permission sheet (READ HRV / Sleep / Active calories).
// Resolves { granted: boolean }. No-op-safe: throws a clean error off-platform.
export async function requestHealthPermissions() {
  const p = plugin();
  if (!p) throw new Error('Health Connect is only available in the Android app.');
  return p.requestPermissions();
}

// Reads the latest HRV + last sleep session + 24h active-calorie load from Health
// Connect and returns the canonical recovery JSON (see the Kotlin readRecovery()).
export async function readHealthRecovery() {
  const p = plugin();
  if (!p) throw new Error('Health Connect is only available in the Android app.');
  return p.readRecovery();
}
