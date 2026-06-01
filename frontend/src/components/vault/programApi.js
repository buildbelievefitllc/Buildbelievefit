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
//   3. CLOUD set-logging (Phase 18.2) — the atomic write transaction that pushes
//      the buffered session to Supabase, mirroring the legacy bbf-sync.syncSession:
//        a. resolve the internal UUID from the login slug via bbf_get_uid_map()
//           (the slug→uuid resolver; bbf_sets.user_id / bbf_logs.user_id are uuid,
//           never the slug).
//        b. POST one parent row to bbf_logs → capture log_id (NOT NULL FK).
//        c. inject log_id into every set row and bulk-POST the append-only data
//           to bbf_sets in a single request (uniform key set → no PGRST102).
//        d. on any failure / partial write, DELETE the parent log so no orphan
//           rows survive (the FK is ON DELETE CASCADE), then surface the error.
//      RLS is intentionally UNCHANGED — the live anon INSERT/SELECT (+ anon DELETE
//      on bbf_logs for rollback) policies already permit this exact path. Identity
//      hardening waits for the future GoTrue auth migration.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

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

// ── Cloud write (Phase 18.2) ─────────────────────────────────────────────────

// Slug → internal UUID, resolved via the anon-GRANTed bbf_get_uid_map() →
// TABLE(uid text, id uuid). Memoized for the tab so a session sync resolves once.
const _uuidCache = Object.create(null);

export async function resolveUserId(uid) {
  const slug = String(uid || '').trim().toLowerCase();
  if (!slug) throw new Error('Missing user id — cannot sync.');
  if (_uuidCache[slug]) return _uuidCache[slug];

  const { data, error } = await supabase.rpc('bbf_get_uid_map');
  if (error) throw new Error(`Identity resolve failed — ${error.message || 'uid_map RPC error'}.`);

  const row = (data || []).find((r) => String(r.uid || '').toLowerCase() === slug);
  if (!row || !row.id) {
    throw new Error('No backend profile is linked to this account yet — sets can’t sync.');
  }
  _uuidCache[slug] = row.id;
  return row.id;
}

// Build the append-only bbf_sets rows from the local buffer. Uniform key set
// across every row (reps + weight_lbs always present, null when blank) so the
// bulk POST never trips PostgREST's PGRST102 "all object keys must match".
// Skips fully-empty sets (neither reps nor weight entered).
function buildSetRows(userId, dayIdx, entries) {
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
        user_id: userId,
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

// Atomic session sync: pushes the buffered local sets for one day to the cloud.
// Returns { ok, count, logId } on success, { ok:false, reason:'empty' } when
// there is nothing to log. Throws (with a human message) on a real failure —
// the local buffer is left intact so the athlete can retry.
export async function syncSessionToCloud(uid, dayIdx) {
  const entries = readDayEntries(uid, dayIdx);
  const userId = await resolveUserId(uid);
  const rows = buildSetRows(userId, dayIdx, entries);
  if (!rows.length) return { ok: false, reason: 'empty', count: 0 };

  // (b) Parent log — date defaults to CURRENT_DATE server-side; we set it
  // explicitly for determinism. return=representation via .select() gives the id.
  const today = new Date().toISOString().slice(0, 10);
  const { data: logData, error: logErr } = await supabase
    .from('bbf_logs')
    .insert({ user_id: userId, date: today })
    .select('id')
    .single();
  if (logErr || !logData?.id) {
    throw new Error(`Session log failed — ${logErr?.message || 'no log id returned'}.`);
  }
  const logId = logData.id;

  // (c) Children — inject the FK and bulk-insert in one request.
  const withLog = rows.map((r) => ({ ...r, log_id: logId }));
  const { data: setData, error: setErr } = await supabase
    .from('bbf_sets')
    .insert(withLog)
    .select('id');

  // (d) Validate the whole batch landed; otherwise roll back the parent log
  // (ON DELETE CASCADE sweeps any partial children) and surface the error.
  if (setErr || !Array.isArray(setData) || setData.length !== withLog.length) {
    await supabase.from('bbf_logs').delete().eq('id', logId);
    const detail = setErr?.message || `partial write ${setData?.length || 0}/${withLog.length}`;
    throw new Error(`Set sync failed — ${detail}. Rolled back; nothing saved to the cloud.`);
  }

  return { ok: true, count: setData.length, logId };
}
