// src/lib/useDailyReadiness.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared CNS telemetry hook — ONE read path from the Sovereign biometric ledger
// (bbf_get_biometric_ledger) consumed by Smart Cardio, the Nutrition Locker, and
// the Program grid, so all three surfaces regulate off the SAME morning check-in
// the Client Hub logged. Deterministic; no LLM (CLAUDE.md §4 untouched).
//
// Exposes the day's stored verdict: readiness_score + execution mode (from
// bbf_daily_protocols.directive_log), the macro targets, the raw vitals row, and
// severity flags (isBreach / isSuppressed — HRV < 35 ms mirrors wearableApi's
// clinical floor).
//
// FRESHNESS GATE: a protocol older than 48 h must not keep locking HIIT tracks or
// slicing volume — stale telemetry reads as "no telemetry" (hasData=false), which
// every consumer treats as FULL access / zero modification. Missing data never
// punishes the athlete (same stance as the readiness engine itself).
//
// LIVE RELAY: the Client Hub dispatches PROTOCOL_UPDATED_EVENT after a successful
// sync→engine→log pipeline; any mounted consumer refetches, so a fresh morning
// check-in re-regulates an open tab without a reload (the wearableApi pattern).

import { useCallback, useEffect, useState } from 'react';
import { fetchBiometricLedger } from './biometricsApi.js';
import { HRV_BREACH_MS } from './wearableApi.js';

// Fired by SovereignClientHub after bbf_log_daily_protocol succeeds.
export const PROTOCOL_UPDATED_EVENT = 'bbf:protocol-updated';

// Honor a stored protocol for this many days back (0 = today, 1 = yesterday).
const MAX_PROTOCOL_AGE_DAYS = 1;

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

// Hook: the day's readiness verdict. Fetches on mount + on PROTOCOL_UPDATED_EVENT.
export function useDailyReadiness() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    fetchBiometricLedger()
      .then((res) => { setData(deriveDailyReadiness(res)); setLoading(false); })
      .catch(() => { setData(deriveDailyReadiness(null)); setLoading(false); });
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Defer the initial fetch to a microtask (async-only setState in effects).
    queueMicrotask(() => { if (!cancelled) refetch(); });
    const onUpdated = () => refetch();
    window.addEventListener(PROTOCOL_UPDATED_EVENT, onUpdated);
    return () => { cancelled = true; window.removeEventListener(PROTOCOL_UPDATED_EVENT, onUpdated); };
  }, [refetch]);

  return { data, loading, refetch };
}
