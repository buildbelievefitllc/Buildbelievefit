// src/lib/healthConnectSync.js
// ─────────────────────────────────────────────────────────────────────────────
// React trigger for the Android Health Connect → BBF wearable pipeline.
//
// Reads the native recovery payload (HRV / sleep / active-calorie load) from the
// HealthConnectBridge plugin, maps it onto the canonical `manual` wearable reading,
// and fires it at the EXISTING ingest webhook `bbf-wearable-ingest` over the
// athlete-sync (vault session token) path — the same RPC the Command Center's
// "Simulate Health Connect sync" Dev Tool exercises (bbf_ingest_wearable_reading).
//
// NOTE ON NAMING: the order referenced a `bbf-health-sync` webhook; the real, live
// endpoint is `bbf-wearable-ingest` and the canonical source for an Android Health
// Connect device is `manual` (bbf_wearable_readings.source CHECK = whoop|apple|oura|
// manual; the simulate migration documents a Health Connect sync as exactly this).
//
// On success it dispatches the SAME `bbf:wearable-updated` event wearableApi.js
// listens on, so an open athlete dossier refetches readiness live — no reload.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';
import { WEARABLE_UPDATED_EVENT } from './wearableApi.js';
import {
  hasHealthBridge,
  healthConnectAvailable,
  requestHealthPermissions,
  readHealthRecovery,
} from '../native/healthConnectBridge.js';

// active kcal → strain (0–100 ULU). Mirrors _shared/wearable-core.mjs
// (APPLE_ACTIVE_KCAL_FULL = 1000): 1000 kcal of active burn ≙ a maximal day.
const ACTIVE_KCAL_FULL = 1000;

function num(x) {
  // Guard null/undefined/'' FIRST — Number(null) is 0, not NaN, so without this a
  // "not measured" vital (e.g. Health Connect has no resting HR → null) would be
  // sent as 0 and rejected by the column CHECK (resting_hr must be NULL or 20–220).
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function kcalToStrain(kcal) {
  const n = num(kcal);
  if (n === null || n <= 0) return 0; // no/zero active load → 0 ULU (a valid, honest reading)
  return Math.max(0, Math.min(100, Math.round(Math.min(1, n / ACTIVE_KCAL_FULL) * 100)));
}

// Native recovery JSON → the `manual` canonical payload bbf-wearable-ingest expects.
// Strain is REQUIRED + NOT NULL downstream, so it is always present (0 when no load).
export function mapRecoveryToManualPayload(recovery) {
  const r = recovery || {};
  return {
    reading_date: r.reading_date || null,
    readiness_score: null, // Health Connect exposes no readiness score (like HealthKit)
    strain: kcalToStrain(r.active_kcal),
    resting_hr: num(r.resting_hr),
    hrv_ms: num(r.hrv_ms),
    sleep_minutes: num(r.sleep_minutes),
    recorded_at: r.recorded_at || null,
  };
}

// Read Health Connect and POST to the live ingest webhook. Returns the ingest
// envelope { ok, reading_id, source, normalized, acwr } — plus `recovery`, the RAW
// native payload (hrv_ms / sleep_minutes / active_kcal / daily_steps), so the
// Sovereign Client Hub can feed the readiness engine + biometric ledger from the
// same single native read. Throws a display Error on any failure.
export async function syncHealthConnect() {
  const token = getStoredVaultToken();
  if (!token) throw new Error('Sign in to sync your wearable.');

  const recovery = await readHealthRecovery();
  if (!recovery || recovery.ok === false) {
    throw new Error((recovery && recovery.detail) || 'Health Connect returned no recovery data.');
  }

  const payload = mapRecoveryToManualPayload(recovery);
  if (!payload.reading_date) throw new Error('Health Connect reading is missing a date.');
  if (payload.hrv_ms === null && payload.sleep_minutes === null) {
    throw new Error('No HRV or sleep data found in the last 48 hours.');
  }

  const { data, error } = await supabase.functions.invoke('bbf-wearable-ingest', {
    // Athlete-sync path: the vault session token binds the reading to the signed-in
    // athlete server-side. The webhook's admin/Vault-secret path is NEVER used from
    // the client (CLAUDE.md §7).
    body: { source: 'manual', session_token: token, payload },
  });

  if (error) {
    const status = error && error.context && error.context.status;
    throw new Error(`Wearable sync failed${status ? ` (${status})` : ''} — ${(error && error.message) || 'request failed'}.`);
  }
  if (!data || !data.ok) {
    throw new Error(`Wearable sync rejected — ${(data && data.error) || 'unknown'}.`);
  }

  // Live-refresh any open dossier listening on the shared wearable-updated channel.
  try {
    window.dispatchEvent(new CustomEvent(WEARABLE_UPDATED_EVENT, { detail: { source: 'health_connect' } }));
  } catch {
    /* no window (SSR) — non-fatal */
  }
  // Attach the raw native payload so downstream consumers (Sovereign Client Hub →
  // readiness engine + biometric ledger) reuse this read instead of re-querying HC.
  return { ...data, recovery };
}

// Hook: drives a "Sync Health Connect" button. `available` reflects whether the
// native bridge + Health Connect SDK are present on this device.
export function useHealthConnectSync() {
  const [available, setAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // `available` already defaults to false — don't setState synchronously in the
    // effect body (react-hooks/set-state-in-effect); only the async result updates it.
    if (!hasHealthBridge()) return undefined;
    healthConnectAvailable()
      .then((s) => { if (!cancelled) setAvailable(!!(s && s.available)); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      if (hasHealthBridge()) {
        // Ensure HRV / Sleep / Active-calorie scopes are granted (no-op if already).
        await requestHealthPermissions().catch(() => { /* surfaced by the read below */ });
      }
      const data = await syncHealthConnect();
      setResult(data);
      return data;
    } catch (e) {
      setError((e && e.message) || 'Sync failed.');
      throw e;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { available, syncing, result, error, sync };
}
