// src/lib/wearableApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Live wearable readiness — admin read of an athlete's latest bbf_wearable_readings
// (HRV / sleep / strain / recovery + live ACWR) via the admin-session-gated RPC
// bbf_admin_get_wearable_readiness. Authorized by the admin's own vault session token.
//
// The dossier consumes this through useAthleteWearable(uid): it fetches on mount AND
// refetches when a `bbf:wearable-updated` event fires for that uid — so the Dev Tools
// "Simulate CNS Breach" button updates the open dossier LIVE, no page reload.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Global signal the DevToolsPanel dispatches after a successful sim → dossier refetch.
export const WEARABLE_UPDATED_EVENT = 'bbf:wearable-updated';

// CNS breach floors (mirror the simulated payload + the clinical thresholds).
export const HRV_BREACH_MS = 35;
export const SLEEP_BREACH_MIN = 240;

function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function clampInt(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(n))); }

// Fetch the latest readiness envelope for a target athlete uid.
export async function fetchWearableReadiness(uid) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  const target = String(uid || '').trim().toLowerCase();
  if (!target) return { ok: false, error: 'no_target' };
  const { data, error } = await supabase.rpc('bbf_admin_get_wearable_readiness', {
    p_session_token: token,
    p_uid: target,
  });
  if (error) return { ok: false, error: error.message || 'network' };
  return data || { ok: false, error: 'unknown' };
}

// Derive the dossier view-model + breach/risk verdict from the RPC envelope.
//   risk: 'critical' (HRV<35 or sleep<240) · 'elevated' (ACWR caution/high) ·
//         'low' (synced, nominal) · 'unknown' (no data / error)
export function deriveReadiness(res) {
  const reading = res && res.ok && res.reading ? res.reading : null;
  const acwr = res && res.ok ? (res.acwr || null) : null;

  const hrv = reading ? num(reading.hrv_ms) : null;
  const sleep = reading ? num(reading.sleep_minutes) : null;
  const recovery = reading ? num(reading.readiness_score) : null;
  const strain = reading ? num(reading.strain) : null;
  const restingHr = reading ? num(reading.resting_hr) : null;

  const breach = (hrv != null && hrv < HRV_BREACH_MS) || (sleep != null && sleep < SLEEP_BREACH_MIN);
  const acwrRisk = acwr?.flag === 'high_risk' || acwr?.flag === 'caution';

  let risk = 'unknown';
  if (reading) risk = breach ? 'critical' : acwrRisk ? 'elevated' : 'low';

  // Central fatigue drift — derived from recovery (low recovery = high drift). Real,
  // data-driven; no hardcoded constant. Null without a reading.
  const cnsDrift = recovery != null ? clampInt(100 - recovery, 0, 100) : null;

  return {
    hasData: !!reading,
    hrv, sleep, recovery, strain, restingHr, cnsDrift,
    acwrFlag: acwr?.flag || null,
    acwr: acwr?.acwr ?? null,
    readingDate: reading?.reading_date || null,
    source: reading?.source || null,
    breach, risk,
  };
}

// Hook: live readiness for `uid`. Fetches on mount + on the wearable-updated event.
export function useAthleteWearable(uid) {
  const key = String(uid || '').trim().toLowerCase();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(key));

  const refetch = useCallback(() => {
    if (!key) return;
    fetchWearableReadiness(key)
      .then((res) => { setData(deriveReadiness(res)); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [key]);

  useEffect(() => {
    if (!key) { return undefined; }
    let cancelled = false;
    // Initial fetch deferred to a microtask (keeps setState out of the sync effect body).
    queueMicrotask(() => { if (!cancelled) refetch(); });
    const onUpdated = (e) => {
      const u = e?.detail?.uid;
      if (!u || String(u).toLowerCase() === key) refetch();
    };
    window.addEventListener(WEARABLE_UPDATED_EVENT, onUpdated);
    return () => { cancelled = true; window.removeEventListener(WEARABLE_UPDATED_EVENT, onUpdated); };
  }, [key, refetch]);

  return { data, loading, refetch };
}
