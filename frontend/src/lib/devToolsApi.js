// src/lib/devToolsApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin Dev Tools — client API for the Command Center DevToolsPanel.
//
// "Simulate CNS Breach" pushes a compromised Health-Connect-style wearable reading
// (HRV < 35 ms, sleep < 240 m) for a target athlete and returns the recomputed ACWR.
//
// SECURITY — the shared webhook secret (`wearable_ingest_token`) is deliberately
// NOT in the client. We authorize with the ADMIN'S OWN vault session token (the
// server validates it via _bbf_is_admin_session, the same self-validating gate the
// Command Center override RPCs use) and the privileged ingest runs server-side. A
// bundled Vault secret would be extractable from the public JS — that's the line we
// don't cross (CLAUDE.md §7); this delivers the identical test path without it.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// A compromised wearable reading: critically low recovery, near-maximal acute load,
// HRV below the 35 ms breach floor and sleep below the 240 m floor.
export function buildCnsBreachReading() {
  const now = new Date();
  return {
    reading_date: now.toISOString().slice(0, 10),
    readiness_score: 14,   // 0–100 recovery — critically low
    strain: 92,            // 0–100 ULU — near-maximal acute load
    resting_hr: 78,        // elevated
    hrv_ms: 28,            // < 35 → CNS breach
    sleep_minutes: 210,    // < 240 → sleep-debt breach
    recorded_at: now.toISOString(),
    raw: { simulated: true, scenario: 'cns_breach', origin: 'health_connect', via: 'DevToolsPanel' },
  };
}

// Fire the simulated breach at `uid`. Returns the server envelope
// { ok, reading_id, acwr, source, uid } | { ok:false, error }.
export async function simulateCnsBreach(uid, { source = 'manual', reading } = {}) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  const target = String(uid || '').trim().toLowerCase();
  if (!target) return { ok: false, error: 'no_target' };

  const { data, error } = await supabase.rpc('bbf_admin_simulate_wearable', {
    p_session_token: token,
    p_uid: target,
    p_source: source,
    p_reading: reading || buildCnsBreachReading(),
  });
  if (error) return { ok: false, error: error.message || 'network' };
  return data || { ok: false, error: 'unknown' };
}
