// src/lib/vitalsPipeline.js
// ─────────────────────────────────────────────────────────────────────────────
// The Sovereign vitals pipeline, ONE definition (Material Upgrade — telemetry
// desync kill order):
//
//   native Health Connect read (+ legacy bbf-wearable-ingest dual-write inside
//   syncHealthConnect) → bbf_upsert_daily_biometrics (trailing series back) →
//   runSovereignEngine (deterministic, client-side) → bbf_log_daily_protocol →
//   PROTOCOL_UPDATED_EVENT broadcast (the shared readiness store force-refetches
//   once; every mounted surface re-regulates live).
//
// Consumed by BOTH paths:
//   • SovereignClientHub "Synchronize Vitals" button (manual, visible errors)
//   • useAutoVitalsSync — the LAUNCH force-pull. Inside the BBF Lab app the watch
//     is the source of truth: on Vault mount, when the native bridge is up, we
//     pull LIVE Health Connect data and land it on the ledger BEFORE any cached
//     RPC view is trusted. This kills the "ledger says 34 steps, watch says 674"
//     desync at the source — the stale row is overwritten on open.
//
// AGGRESSIVE ERROR SURFACING (CEO order): the launch pull no longer swallows
// failures. Every run reports its outcome to a module status store; a wedged
// bridge, a permission lock, a null payload, or a timeout writes its RAW error
// string there, and useVitalsSyncStatus() lets the Check-In hub render it so the
// failure is VISIBLE — never a silent fallback to the stale ledger row.
//
// Read-only contracts untouched: the Kotlin bridge and bbf-wearable-ingest are
// called exactly as before — this file only consolidates the orchestration and
// the (JS-side) error reporting.

import { useEffect, useSyncExternalStore } from 'react';
import { useHealthConnectSync } from './healthConnectSync.js';
import { runSovereignEngine } from './bbf-readiness-engine';
import { PROTOCOL_UPDATED_EVENT } from './useDailyReadiness.js';
import {
  mapRecoveryToBiometricDay,
  toProtocolRow,
  syncBiometricDay,
  logDailyProtocol,
} from './biometricsApi.js';

// ── Vitals-sync status store (diagnostic surfacing) ──────────────────────────
// state: 'idle' | 'syncing' | 'ok' | 'error' · error: raw string | null ·
// source: 'launch' | 'manual' | null. One store, both paths report through it,
// so a manual success after a launch failure clears the banner automatically.
let syncStatus = { state: 'idle', error: null, source: null, at: 0 };
const statusSubs = new Set();
function emitStatus() { statusSubs.forEach((fn) => fn()); }
function setStatus(next) { syncStatus = { ...syncStatus, ...next, at: Date.now() }; emitStatus(); }
function subStatus(fn) { statusSubs.add(fn); return () => statusSubs.delete(fn); }
function getStatus() { return syncStatus; }

export function useVitalsSyncStatus() {
  return useSyncExternalStore(subStatus, getStatus, getStatus);
}

// Full pipeline off an already-bound native sync function (the hook's `sync`).
// Returns { day, protocol }. Reports state to the status store AND re-throws, so
// the manual caller still gets the rejection for its own inline handling while
// the store drives the shared diagnostic banner.
export async function runVitalsPipeline(syncFn, source = 'manual') {
  setStatus({ state: 'syncing', error: null, source });
  try {
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
    setStatus({ state: 'ok', error: null, source });
    return { day, protocol };
  } catch (e) {
    const raw = (e && e.message) || String(e) || 'Vitals sync failed.';
    setStatus({ state: 'error', error: raw, source });
    throw e;
  }
}

// One launch pull per app session — module flag survives tab swaps and React
// StrictMode double-mounts, so the watch is read exactly once per open.
let autoPulled = false;

// Mount this once at the Vault shell. No-op on web (bridge unavailable). It runs
// ONLY when the native bridge is present, so any failure it hits is a REAL native
// failure worth surfacing — the catch reports to the store (already done inside
// runVitalsPipeline) and logs to the console; it does not re-throw (a background
// pull must not crash the shell), but it is no longer silent.
export function useAutoVitalsSync() {
  const { available, sync } = useHealthConnectSync();
  useEffect(() => {
    if (!available || autoPulled) return;
    autoPulled = true;
    runVitalsPipeline(sync, 'launch').catch((e) => {
      if (typeof console !== 'undefined') {
        console.error('[vitals] launch auto-pull failed — falling back to stored ledger:', e);
      }
    });
  }, [available, sync]);
}
