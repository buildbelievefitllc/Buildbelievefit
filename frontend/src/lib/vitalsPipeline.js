// src/lib/vitalsPipeline.js
// ─────────────────────────────────────────────────────────────────────────────
// The Sovereign vitals pipeline, ONE definition (Material Upgrade — telemetry
// desync kill order):
//
//   recovery payload → bbf_upsert_daily_biometrics (trailing series back) →
//   runSovereignEngine (deterministic, client-side) → bbf_log_daily_protocol →
//   PROTOCOL_UPDATED_EVENT broadcast (the shared readiness store force-refetches
//   once; every mounted surface re-regulates live).
//
// TWO recovery sources, ONE pipeline core (_pipeline):
//   • NATIVE  — Health Connect read (+ legacy bbf-wearable-ingest dual-write
//     inside syncHealthConnect). runVitalsPipeline(syncFn) / useAutoVitalsSync.
//   • MANUAL  — Manual Health Input: a recovery-shaped payload typed by the
//     athlete (manualBaseline.js). runManualVitalsPipeline(recovery, manual).
//     The engine scores it with EQUAL validity (subjective recovery axis).
//
// AGGRESSIVE ERROR SURFACING (CEO order): every run reports its outcome to a
// module status store; a wedged bridge, a permission lock, a null payload, or a
// timeout writes its RAW error string there, and useVitalsSyncStatus() lets the
// Check-In hub render it so the failure is VISIBLE — never a silent fallback.
//
// HANDSHAKE DIAGNOSTIC: every NATIVE attempt also persists a compact bridge
// snapshot (status + timestamp + HRV/Calories/Sleep payload) to localStorage so
// the Health Connect Status panel can tell a broken API handshake apart from a
// day the wearable simply logged nothing. Manual input never touches it — it does
// not describe the native bridge.
//
// Read-only contracts untouched: the Kotlin bridge and bbf-wearable-ingest are
// called exactly as before — this file only consolidates the orchestration.

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

function numOrNull(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// ── Vitals-sync status store (diagnostic surfacing) ──────────────────────────
// state: 'idle' | 'syncing' | 'ok' | 'error' · error: raw string | null ·
// source: 'launch' | 'manual' | 'manual_input' | null. One store, every path
// reports through it, so a manual success after a launch failure clears the banner.
let syncStatus = { state: 'idle', error: null, source: null, at: 0 };
const statusSubs = new Set();
function emitStatus() { statusSubs.forEach((fn) => fn()); }
function setStatus(next) { syncStatus = { ...syncStatus, ...next, at: Date.now() }; emitStatus(); }
function subStatus(fn) { statusSubs.add(fn); return () => statusSubs.delete(fn); }
function getStatus() { return syncStatus; }

export function useVitalsSyncStatus() {
  return useSyncExternalStore(subStatus, getStatus, getStatus);
}

// ── Health Connect handshake snapshot (native bridge diagnostic) ─────────────
const HANDSHAKE_KEY = 'bbf-hc-handshake-v1';
const HANDSHAKE_EVENT = 'bbf:hc-handshake';

// Only a NATIVE attempt describes the BRIDGE. The launch auto-pull and the native
// "Synchronize Vitals" button are Health Connect reads; a Manual Health Input
// override is not — it must never overwrite the bridge snapshot.
function isNativeSource(source) {
  return source === 'launch' || source === 'manual';
}

let handshake; // undefined until first read; then record | null
const hsSubs = new Set();
function emitHandshake() { hsSubs.forEach((fn) => fn()); }

function readStoredHandshake() {
  try {
    const raw = localStorage.getItem(HANDSHAKE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function getHandshake() {
  if (handshake === undefined) handshake = readStoredHandshake();
  return handshake;
}
function recordHandshake({ source, ok, recovery, error }) {
  if (!isNativeSource(source)) return;
  const r = recovery || {};
  handshake = {
    at: Date.now(),
    source,
    ok: !!ok,
    hrv_ms: numOrNull(r.hrv_ms),
    sleep_minutes: numOrNull(r.sleep_minutes),
    active_kcal: numOrNull(r.active_kcal),
    error: error || null,
  };
  try { localStorage.setItem(HANDSHAKE_KEY, JSON.stringify(handshake)); } catch { /* private mode — non-fatal */ }
  emitHandshake();
  try { window.dispatchEvent(new CustomEvent(HANDSHAKE_EVENT)); } catch { /* no window (SSR) */ }
}
function subHandshake(fn) {
  hsSubs.add(fn);
  const onStorage = (e) => { if (e.key === HANDSHAKE_KEY) { handshake = readStoredHandshake(); fn(); } };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => { hsSubs.delete(fn); if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage); };
}

// Hook: the latest native Health Connect handshake snapshot (or null if never).
export function useHealthConnectHandshake() {
  return useSyncExternalStore(subHandshake, getHandshake, getHandshake);
}

// ── Pipeline core ────────────────────────────────────────────────────────────
// produceRecovery() yields the recovery payload (native read OR a manual entry);
// `manual` carries the subjective recovery-axis inputs (null for native). Returns
// { day, protocol }. Reports to the status store + handshake snapshot AND re-throws
// so the caller still gets the rejection for its own inline handling.
async function _pipeline(produceRecovery, source, manual) {
  setStatus({ state: 'syncing', error: null, source });
  let recovery = null;
  try {
    recovery = await produceRecovery();
    if (!recovery) throw new Error('No recovery payload to sync.');
    // 1 · Land the day on the biometric ledger → trailing 28-day series back.
    const day = mapRecoveryToBiometricDay(recovery);
    const up = await syncBiometricDay(day);
    if (!up || !up.ok) throw new Error(up && up.error ? `Ledger write failed — ${up.error}.` : 'Ledger write failed.');
    // 2 · Deterministic readiness verdict from REAL history (+ subjective axis).
    const protocol = runSovereignEngine(day, up.series || [], manual);
    // 3 · Persist the protocol.
    const logged = await logDailyProtocol(toProtocolRow(protocol));
    if (!logged || !logged.ok) throw new Error(logged && logged.error ? `Protocol log failed — ${logged.error}.` : 'Protocol log failed.');
    // 4 · Broadcast — the shared store busts its cache once; Check-In, Cardio,
    // Nutrition, Program and the shell handshake all re-regulate, no reload.
    try {
      window.dispatchEvent(new CustomEvent(PROTOCOL_UPDATED_EVENT, { detail: { date: protocol.date } }));
    } catch { /* non-fatal */ }
    recordHandshake({ source, ok: true, recovery, error: null });
    setStatus({ state: 'ok', error: null, source });
    return { day, protocol };
  } catch (e) {
    const raw = (e && e.message) || String(e) || 'Vitals sync failed.';
    recordHandshake({ source, ok: false, recovery, error: raw });
    setStatus({ state: 'error', error: raw, source });
    throw e;
  }
}

// NATIVE path — off an already-bound native sync function (the hook's `sync`).
// The legacy ACWR ingest dual-write happens inside syncFn(); we consume its
// `.recovery` (the raw native payload) as the pipeline's recovery source.
export function runVitalsPipeline(syncFn, source = 'manual') {
  return _pipeline(async () => {
    const envelope = await syncFn();
    return envelope ? envelope.recovery : null;
  }, source, null);
}

// MANUAL path — a recovery-shaped payload typed by the athlete (manualBaseline.js)
// + the subjective recovery-axis inputs. Same ledger + engine + broadcast as a
// wearable read, so the verdict is immediate and actionable.
export function runManualVitalsPipeline(recovery, manual, source = 'manual_input') {
  return _pipeline(async () => recovery, source, manual);
}

// One launch pull per app session — module flag survives tab swaps and React
// StrictMode double-mounts, so the watch is read exactly once per open.
let autoPulled = false;

// Mount this once at the Vault shell. No-op on web (bridge unavailable). It runs
// ONLY when the native bridge is present, so any failure it hits is a REAL native
// failure worth surfacing — the catch reports to the store (already done inside
// _pipeline) and logs to the console; it does not re-throw (a background pull must
// not crash the shell), but it is no longer silent.
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
