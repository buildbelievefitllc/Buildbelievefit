// src/components/vault/programApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18.1 — Program grid data layer (kept inside components/vault/* to honor
// the locked domain boundary for this task: pages/ClientVault.jsx + vault/* only).
//
// Two responsibilities, mirroring the legacy Autoregulation Engine in
// bbf-app.html:
//
//   1. SERVER last-working-weights (cross-device) — the anon-GRANTed
//      SECURITY DEFINER RPC bbf_get_last_weights(target_uid, target_day_idx)
//      → { ok, day_idx, weights: { ex_0: 135, ex_1: 95, … } }. exercise_key is
//      the positional slot "ex_<i>" matching PLAN[dayIdx].exercises[i]. This is
//      the cross-device "last: 135 lb" target banner.
//
//   2. LOCAL today's-entry persistence — parity with the monolith's
//      d.w[uid][dayKey][exKey] localStorage store. day_key is "YYYY-MM-DD_d<N>".
//      This is the OFFLINE BUFFER: every keystroke persists here first so a
//      network drop never loses a logged set.
//
//   3. CLOUD set-logging (Phase 21.1) — the atomic write now routes through the
//      SECURITY DEFINER RPC `bbf_sync_vault_session`. RLS on bbf_logs/bbf_sets has
//      been locked down (no anon INSERT), so the client no longer asserts identity
//      or writes rows directly. Instead it POSTs:
//        { p_uid, p_session_token, p_session, p_sets }
//      The server validates the vault_token (minted at PIN login, 24h TTL),
//      resolves the user_id ITSELF from that token (the client can no longer spoof
//      identity), then creates the parent bbf_logs row + bulk-inserts the children
//      atomically in one transaction. On a missing/expired token the RPC returns
//      { ok:false, error:'invalid_session' } → we throw a SESSION_EXPIRED error so
//      the UI can force a fresh PIN login. The PIN itself is never sent or cached.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { getStoredVaultToken } from '../../context/AuthContext.jsx';

export const exKey = (i) => `ex_${i}`;

// Local store key — namespaced + versioned, parity with the monolith's d.w map.
const LOCAL_KEY = 'bbf.vault.weights.v1';

// Today's day_key for a plan index: "YYYY-MM-DD_d<N>" (matches the server regex).
export function dayKeyFor(dayIdx, date = new Date()) {
  const iso = date.toISOString().slice(0, 10);
  return `${iso}_d${dayIdx}`;
}

// ── Server: most-recent working weight per exercise slot for a day index ──────
export async function fetchLastWeights(uid, dayIdx) {
  const slug = String(uid || '').trim().toLowerCase();
  if (!slug) return {};
  if (dayIdx == null || dayIdx < 0) return {};

  const { data, error } = await supabase.rpc('bbf_get_last_weights', {
    target_uid: slug,
    target_day_idx: dayIdx,
  });
  if (error) {
    throw new Error(`Last weights unavailable — ${error.message || 'RPC error'}.`);
  }
  // user_not_found / no history returns ok:false or an empty map — both are an
  // empty target, not a fatal error.
  return (data && data.weights) || {};
}

// Hook: load server last-weights for the active day. State seeded so the effect
// performs only async work (keeps clear of react-hooks/set-state-in-effect).
export function useLastWeights(uid, dayIdx) {
  const [weights, setWeights] = useState({});
  const [isLoading, setIsLoading] = useState(Boolean(uid) && dayIdx != null && dayIdx >= 0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid || dayIdx == null || dayIdx < 0) return undefined;
    let cancelled = false;

    fetchLastWeights(uid, dayIdx)
      .then((w) => { if (!cancelled) { setWeights(w); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load last weights.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [uid, dayIdx]);

  return { weights, isLoading, error };
}

// ── Local: today's entered weights (offline-safe, per uid) ────────────────────
function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Per-set entries for one user's day (today), faithful to the monolith shape
// d.w[uid][dk][ek] = [{ w, r }, …]. Returns { [exKey]: [{w,r}, …] }; empty when
// none yet.
export function readDayEntries(uid, dayIdx) {
  if (!uid) return {};
  const store = readLocal();
  return store?.[uid]?.[dayKeyFor(dayIdx)] || {};
}

// Persist one set's field (w|r) for today; mirrors SVS() in the monolith.
// Tolerates private-mode / quota by failing silently (state holds for the tab).
export function writeDayEntry(uid, dayIdx, key, setIdx, field, value) {
  if (!uid) return;
  const store = readLocal();
  const dk = dayKeyFor(dayIdx);
  store[uid] = store[uid] || {};
  store[uid][dk] = store[uid][dk] || {};
  const sets = Array.isArray(store[uid][dk][key]) ? store[uid][dk][key] : [];
  sets[setIdx] = sets[setIdx] || {};
  if (value === '' || value == null) {
    delete sets[setIdx][field];
  } else {
    sets[setIdx][field] = value;
  }
  store[uid][dk][key] = sets;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
  } catch {
    /* private-mode / quota — entry stays in component state for this session */
  }
}

// ── Cloud write (Phase 21.1 — token-authorized RPC) ──────────────────────────

// SESSION_EXPIRED sentinel — thrown whenever the vault_token is absent or the
// server rejects it (invalid_session). The UI catches `.code === 'SESSION_EXPIRED'`
// and routes back to the PIN screen to mint a fresh token. The local set buffer
// is never cleared on this path, so nothing the athlete logged is lost.
function sessionExpiredError() {
  const e = new Error('Your secure session has expired — please sign in again.');
  e.code = 'SESSION_EXPIRED';
  return e;
}

// Build the append-only set rows from the local buffer. The server resolves
// user_id from the token and assigns log_id, so the client sends only the
// per-set payload. Uniform key set across every row (reps + weight_lbs always
// present, null when blank) keeps the JSON array clean. Skips fully-empty sets.
function buildSetRows(dayIdx, entries) {
  const dk = dayKeyFor(dayIdx);
  const rows = [];
  Object.keys(entries || {}).forEach((ek) => {
    const sets = Array.isArray(entries[ek]) ? entries[ek] : [];
    sets.forEach((s, i) => {
      if (!s) return;
      const repsRaw = s.r;
      const wRaw = s.w;
      const reps = repsRaw === '' || repsRaw == null ? null : parseInt(repsRaw, 10);
      const weight = wRaw === '' || wRaw == null ? null : parseFloat(wRaw);
      const repsVal = Number.isNaN(reps) ? null : reps;
      const weightVal = Number.isNaN(weight) ? null : weight;
      if (repsVal == null && weightVal == null) return; // nothing logged
      rows.push({
        day_key: dk,
        exercise_key: ek,
        set_number: i + 1,
        reps: repsVal,
        weight_lbs: weightVal,
      });
    });
  });
  return rows;
}

// Atomic session sync via the SECURITY DEFINER RPC bbf_sync_vault_session.
// Returns { ok, count, logId } on success, { ok:false, reason:'empty' } when
// there is nothing to log. Throws SESSION_EXPIRED when the token is missing/
// rejected (UI forces re-login), or a human-readable error on other failures —
// the local buffer is left intact so the athlete can retry.
export async function syncSessionToCloud(uid, dayIdx) {
  const slug = String(uid || '').trim().toLowerCase();
  const entries = readDayEntries(uid, dayIdx);
  const rows = buildSetRows(dayIdx, entries);
  if (!rows.length) return { ok: false, reason: 'empty', count: 0 };

  const token = getStoredVaultToken();
  if (!token) throw sessionExpiredError();

  const { data, error } = await supabase.rpc('bbf_sync_vault_session', {
    p_uid: slug,
    p_session_token: token,
    p_session: {
      date: new Date().toISOString().slice(0, 10),
      day_key: dayKeyFor(dayIdx),
      day_idx: dayIdx,
    },
    p_sets: rows,
  });

  if (error) {
    throw new Error(`Set sync failed — ${error.message || 'RPC error'}. Nothing saved to the cloud.`);
  }
  if (!data?.ok) {
    if (data?.error === 'invalid_session') throw sessionExpiredError();
    throw new Error(`Set sync failed — ${data?.error || 'unknown error'}. Nothing saved to the cloud.`);
  }

  return { ok: true, count: data.count ?? rows.length, logId: data.log_id ?? null };
}

// Readiness sync — token-authorized mirror of the session sync, routed through
// the SECURITY DEFINER RPC bbf_sync_readiness (same vault_token contract, same
// invalid_session → re-login behavior).
//
// STAGED / NOT YET WIRED: there is no readiness check-in surface in the React app
// today, and Terminal 5 has not published the readiness payload param name. This
// follows the natural mirror (`p_readiness`) so the secure RPC has a client the
// moment a check-in UI exists. FLAG: confirm the p_readiness shape with Terminal 5
// before the first real caller is added.
export async function syncReadinessToCloud(uid, readiness) {
  const slug = String(uid || '').trim().toLowerCase();
  const token = getStoredVaultToken();
  if (!token) throw sessionExpiredError();

  const { data, error } = await supabase.rpc('bbf_sync_readiness', {
    p_uid: slug,
    p_session_token: token,
    p_readiness: readiness,
  });

  if (error) {
    throw new Error(`Readiness sync failed — ${error.message || 'RPC error'}.`);
  }
  if (!data?.ok) {
    if (data?.error === 'invalid_session') throw sessionExpiredError();
    throw new Error(`Readiness sync failed — ${data?.error || 'unknown error'}.`);
  }

  return { ok: true, ...data };
}
