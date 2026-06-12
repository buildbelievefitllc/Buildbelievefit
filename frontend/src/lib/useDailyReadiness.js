// src/lib/useDailyReadiness.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared CNS telemetry channel — ONE read path from the Sovereign biometric
// ledger (bbf_get_biometric_ledger) consumed by the Check-In hub, Smart Cardio,
// the Nutrition Locker, the Program grid AND the Vault shell (Agentic Handshake),
// so every surface regulates off the SAME morning check-in. Deterministic; no
// LLM (CLAUDE.md §4 untouched).
//
// MATERIAL UPGRADE (store, not per-hook fetch): the ledger envelope lives in a
// module-level store behind useSyncExternalStore. All consumers share one cached
// payload + one in-flight RPC — a tab swap that used to re-fire the ledger read
// now paints instantly from the warm cache and revalidates only when the soft
// TTL lapses or the calendar day rolls. The derived view-model is computed ONCE
// per commit and shared by reference, so downstream useMemo/React.memo guards
// hold across consumers.
//
// FRESHNESS GATE: a protocol older than 48 h must not keep locking HIIT tracks or
// slicing volume — stale telemetry reads as "no telemetry" (hasData=false), which
// every consumer treats as FULL access / zero modification. Missing data never
// punishes the athlete (same stance as the readiness engine itself).
//
// LIVE RELAY: the Client Hub dispatches PROTOCOL_UPDATED_EVENT after a successful
// sync→engine→log pipeline; the store force-refetches once and every mounted
// consumer re-renders from the same fresh commit — no reload, no fan-out.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { fetchBiometricLedger } from './biometricsApi.js';
import { HRV_BREACH_MS } from './wearableApi.js';

// Fired by SovereignClientHub after bbf_log_daily_protocol succeeds.
export const PROTOCOL_UPDATED_EVENT = 'bbf:protocol-updated';

// Honor a stored protocol for this many days back (0 = today, 1 = yesterday).
const MAX_PROTOCOL_AGE_DAYS = 1;

// Warm-cache window: serve the stored envelope and skip the RPC inside this
// window (the live relay event always busts it). A daily verdict does not move
// minute-to-minute; tab churn must not re-buy the same payload.
const SOFT_TTL_MS = 5 * 60 * 1000;

function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }

// Local calendar date as 'YYYY-MM-DD' (en-CA renders ISO order in local time).
function localToday() {
  return new Date().toLocaleDateString('en-CA');
}

// Whole-day age of a 'YYYY-MM-DD' string vs local today. null when unparseable.
export function protocolAgeDays(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(String(dateStr))) return null;
  const [y1, m1, d1] = String(dateStr).slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = localToday().split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

// Reduce the ledger envelope to the consumer-facing readiness view-model.
export function deriveDailyReadiness(res) {
  const empty = {
    hasData: false, score: null, mode: null, date: null,
    carb: null, fat: null, protein: null, cardio: null,
    baselineHrv: null, vitals: null, isBreach: false, isSuppressed: false,
    stale: false,
  };
  if (!res || !res.ok) return empty;

  const lp = res.latest_protocol || null;
  const vitals = Array.isArray(res.series) && res.series.length ? res.series[0] : null;
  if (!lp) return { ...empty, vitals };

  const age = protocolAgeDays(lp.date);
  if (age === null || age < 0 || age > MAX_PROTOCOL_AGE_DAYS) {
    // Stale verdict — surface the vitals for display but assert NO regulation.
    return { ...empty, vitals, stale: true };
  }

  const log = lp.directive_log || {};
  const score = num(lp.readiness_score);
  const mode = typeof log.mode === 'string' ? log.mode : null;
  const hrv = vitals ? num(vitals.hrv_ms) : null;
  const isSuppressed = hrv !== null && hrv < HRV_BREACH_MS;
  const carb = num(lp.carb_target_pct);
  const fat = num(lp.fat_target_pct);
  const protein = num(log.protein_target_pct) ??
    (carb !== null && fat !== null ? 100 - carb - fat : null);

  return {
    hasData: true,
    score,
    mode,
    date: lp.date || null,
    carb,
    fat,
    protein,
    cardio: typeof log.cardio === 'string' ? log.cardio : null,
    baselineHrv: num(log.baseline_hrv_ms),
    vitals,
    isBreach: mode === 'SYSTEM_BREACH' || isSuppressed,
    isSuppressed,
    stale: false,
  };
}

// Agentic Handshake channel — maps the day's verdict onto the UI morph state the
// shell + hub paint through the [data-bbf-mode] CSS channel. 'none' (no usable
// telemetry) always reads as the neutral, unrestricted interface.
export function handshakeChannel(vm) {
  if (!vm || !vm.hasData) return 'none';
  if (vm.isBreach) return 'breach';
  switch (vm.mode) {
    case 'PRIME_EXECUTION': return 'prime';
    case 'STANDARD_OPERATIONS': return 'standard';
    case 'SYSTEM_STRAIN': return 'strain';
    case 'SYSTEM_BREACH': return 'breach';
    default: return 'none';
  }
}

// ── Module store ─────────────────────────────────────────────────────────────
let ledgerRes;          // undefined until first commit; then envelope | null
let readinessVM = null; // derived once per commit — shared by reference
let fetchedAt = 0;
let fetchedDay = '';
let inflight = null;
let wired = false;
const subscribers = new Set();

function emit() { subscribers.forEach((fn) => fn()); }
function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
function getReadinessSnapshot() { return readinessVM; }
function getLedgerSnapshot() { return ledgerRes; }

function commit(res) {
  ledgerRes = res;
  readinessVM = deriveDailyReadiness(res);
  fetchedAt = Date.now();
  fetchedDay = localToday();
  emit();
  return res;
}

function isWarm() {
  return ledgerRes !== undefined &&
    fetchedDay === localToday() &&
    Date.now() - fetchedAt < SOFT_TTL_MS;
}

// Single-flight loader: concurrent mounts share one RPC; warm cache short-circuits.
function load(force = false) {
  if (!force && isWarm()) return Promise.resolve(ledgerRes);
  if (inflight) return inflight;
  inflight = fetchBiometricLedger()
    .then((res) => commit(res || null))
    .catch(() => commit(null))
    .finally(() => { inflight = null; });
  return inflight;
}

// One set of listeners for the whole store (not one per consumer):
//  • live relay — busts the cache exactly once however many surfaces are mounted
//  • foreground return — the BBF Lab WebView survives backgrounding for hours;
//    when the app surfaces again, a lapsed TTL / rolled day re-pulls the ledger
//    so the athlete never reads this morning's numbers tonight (desync guard).
function ensureWired() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener(PROTOCOL_UPDATED_EVENT, () => { load(true); });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) load(); // warm-cache check inside — refetches only when stale
    });
  }
}

// Hook: the day's readiness verdict. Warm-cache read; revalidates on TTL lapse,
// day roll, or PROTOCOL_UPDATED_EVENT. Same { data, loading, refetch } contract
// the consumers have always held.
export function useDailyReadiness() {
  const data = useSyncExternalStore(subscribe, getReadinessSnapshot);
  useEffect(() => { ensureWired(); load(); }, []);
  const refetch = useCallback(() => { load(true); }, []);
  return { data, loading: data === null, refetch };
}

// Hook: the RAW ledger envelope (series + latest_protocol) off the same store —
// the Check-In hub's mount read shares the exact payload the regulated surfaces
// consume instead of issuing its own duplicate RPC.
export function useBiometricLedger() {
  const res = useSyncExternalStore(subscribe, getLedgerSnapshot);
  useEffect(() => { ensureWired(); load(); }, []);
  const refetch = useCallback(() => load(true), []);
  return { ledger: res === undefined ? null : res, loading: res === undefined, refetch };
}
