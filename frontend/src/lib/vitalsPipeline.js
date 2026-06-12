// src/lib/vitalsPipeline.js
// ─────────────────────────────────────────────────────────────────────────────
// The Sovereign vitals pipeline, extracted to ONE definition (Material Upgrade —
// telemetry desync kill order):
//
//   native Health Connect read (+ legacy bbf-wearable-ingest dual-write inside
//   syncHealthConnect) → bbf_upsert_daily_biometrics (trailing series back) →
//   runSovereignEngine (deterministic, client-side) → bbf_log_daily_protocol →
//   PROTOCOL_UPDATED_EVENT broadcast (the shared readiness store force-refetches
//   once; every mounted surface re-regulates live).
//
// Consumed by BOTH paths:
//   • SovereignClientHub "Synchronize Vitals" button (manual, visible errors)
//   • useAutoVitalsSync — the LAUNCH force-pull. Inside the BBF Lab app the
//     watch is the source of truth: on Vault mount, when the native bridge is
//     up, we pull LIVE Health Connect data and land it on the ledger BEFORE any
//     cached RPC view is trusted. This kills the "ledger says 34 steps, watch
//     says 674" desync at the source — the stale row is overwritten on open,
//     and the [data-bbf-mode] Agentic Handshake reacts to the live verdict.
//
// Read-only contracts untouched: the Kotlin bridge and bbf-wearable-ingest are
// called exactly as before — this file only consolidates the orchestration.

import { useEffect } from 'react';
import { useHealthConnectSync } from './healthConnectSync.js';
import { runSovereignEngine } from './bbf-readiness-engine';
import { PROTOCOL_UPDATED_EVENT } from './useDailyReadiness.js';
import {
  mapRecoveryToBiometricDay,
  toProtocolRow,
  syncBiometricDay,
  logDailyProtocol,
} from './biometricsApi.js';

// Full pipeline off an already-bound native sync function (the hook's `sync`).
// Returns { day, protocol }. Throws display Errors — the manual path surfaces
// them; the auto path swallows them (a failed background pull must never block
// the athlete; the manual button remains the loud path).
export async function runVitalsPipeline(syncFn) {
  // 1 · Native read (+ legacy ACWR ingest dual-write inside the hook).
  const envelope = await syncFn();
  // 2 · Land the day on the biometric ledger → trailing 28-day series back.
  const day = mapRecoveryToBiometricDay(envelope.recovery);
  const up = await syncBiometricDay(day);
  if (!up || !up.ok) throw new Error(up && up.error ? `Ledger write failed — ${up.error}.` : 'Ledger write failed.');
  // 3 · Deterministic readiness verdict from REAL history.
  const protocol = runSovereignEngine(day, up.series || []);
  // 4 · Persist the protocol.
  const logged = await logDailyProtocol(toProtocolRow(protocol));
  if (!logged || !logged.ok) throw new Error(logged && logged.error ? `Protocol log failed — ${logged.error}.` : 'Protocol log failed.');
  // 5 · Broadcast — the shared store busts its cache once; Check-In, Cardio,
  // Nutrition, Program and the shell handshake all re-regulate, no reload.
  try {
    window.dispatchEvent(new CustomEvent(PROTOCOL_UPDATED_EVENT, { detail: { date: protocol.date } }));
  } catch { /* non-fatal */ }
  return { day, protocol };
}

// One launch pull per app session — module flag survives tab swaps and React
// StrictMode double-mounts, so the watch is read exactly once per open.
let autoPulled = false;

// Mount this once at the Vault shell. No-op on web (bridge unavailable) and on
// every mount after the first successful trigger. Silent on failure by design.
export function useAutoVitalsSync() {
  const { available, sync } = useHealthConnectSync();
  useEffect(() => {
    if (!available || autoPulled) return;
    autoPulled = true;
    runVitalsPipeline(sync).catch(() => {
      // Background pull failed (no permission grant yet, no data in window,
      // network) — stay quiet; the ledger view stands and the athlete still
      // has the manual Synchronize Vitals path with visible errors.
    });
  }, [available, sync]);
}
