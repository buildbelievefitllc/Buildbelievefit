// src/lib/liveHeartRate.js
// ─────────────────────────────────────────────────────────────────────────────
// LIVE HEART-RATE TELEMETRY BRIDGE — the real-time event hook feeding the
// premium session's inflection governor (blueprint c509f26 §2.5.3).
//
// Sources, in order:
//   1. Native Health Connect bridge (Android shell) — polls the plugin's
//      heart-rate read every POLL_MS. The plugin method is feature-detected
//      (readHeartRate → { bpm }), so this module lights up the moment the
//      Kotlin side ships it and stays a silent no-op until then — the exact
//      degrade posture of healthConnectBridge.js itself.
//   2. Nothing — createHrSource() returns null and the caller mounts the
//      player WITHOUT an hrSource: narration + music play; the biometric
//      layer silently disables (house wearable-dormancy posture).
//
// Contract: an hrSource is `(cb) => unsubscribe`, pushing plain bpm numbers.

import { isNativePlatform } from '../native/platform.js';

const POLL_MS = 5000;

function plugin() {
  const c = (typeof window !== 'undefined' && window.Capacitor) || null;
  return (c && c.Plugins && c.Plugins.HealthConnectBridge) || null;
}

// True when a live heart-rate read is actually available on this device.
export function hasLiveHeartRate() {
  const p = plugin();
  return isNativePlatform() && !!p && typeof p.readHeartRate === 'function';
}

// Build the subscription (or null when no live source exists — callers pass
// the null straight through so the inflection layer self-disables).
export function createHrSource() {
  if (!hasLiveHeartRate()) return null;
  return (cb) => {
    let stopped = false;
    const timer = setInterval(async () => {
      if (stopped) return;
      try {
        const r = await plugin()?.readHeartRate();
        const bpm = Number(r?.bpm);
        if (Number.isFinite(bpm) && bpm > 0) cb(bpm);
      } catch { /* a failed read is a skipped tick, never an error surface */ }
    }, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  };
}
