// src/lib/youthIntakeApi.js
// ─────────────────────────────────────────────────────────────────────────────
// The Sports Hub first-run intake gate — client API.
//
// The youth fork blocks a flagged athlete from the Hub until they complete a
// forced PAR-Q+ intake. This module owns the two RPC calls behind that gate:
//   • bbf_get_youth_intake_status(uid)            — anon-safe completion read.
//   • bbf_submit_youth_intake(uid, token, payload) — token-gated persist (replays
//     the stored 24h vault_token, exactly like the readiness/vault-sync writers).
//
// Intake data is persisted to the EXISTING clinical PAR-Q columns on bbf_users
// (par_q_screen / par_q_screened_at / cardiac_clearance) so it feeds the same
// pipeline the coach dossier + risk telemetry already read.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// The 7 standard PAR-Q+ items — the SAME trilingual keys the public Pathfinder
// intake uses, so the legal copy stays single-sourced (bbf-lang f-parq*).
export const PARQ_ITEMS = ['f-parq1', 'f-parq2', 'f-parq3', 'f-parq4', 'f-parq5', 'f-parq6', 'f-parq7'];

// Standard PAR-Q+ classification (mirrors the server RPC + legacy monolith
// verbatim): 0 yes → self_attested · 1 → restricted · 2+ → contraindicated.
// Client-side copy is for immediate UX only; the server re-derives authoritatively.
export function classifyParq(answers) {
  const yes = PARQ_ITEMS.filter((k) => answers?.[k] === true).length;
  if (yes === 0) return 'self_attested';
  if (yes === 1) return 'restricted';
  return 'contraindicated';
}

// First-run gate status. FAIL-CLOSED: until the DB definitively confirms a
// screening timestamp, the athlete is treated as NOT cleared ('incomplete') — a
// compliance gate must never let an un-attested minor slip into training on a
// network blip. `skip` (admins) short-circuits to 'complete' for previewing.
//
// The RPC result is stored KEYED BY uid and the gate status is DERIVED in render
// (never set synchronously inside the effect — react-hooks/set-state-in-effect):
// a result whose key doesn't match the current uid reads as 'loading'.
export function useYouthIntakeStatus(uid, { skip = false } = {}) {
  const key = String(uid || '').trim().toLowerCase();
  // value: 'complete' | 'incomplete'; selection: { sportId, positionCode } | null;
  // prefill: { birthDate, gender } | null — anything already on the athlete_profiles
  //   record, used to pre-fill the re-gated intake (legacy back-population);
  // progress: the persisted per-day check-off map (bbf_users.youth_progress) | null.
  const [result, setResult] = useState({ uid: null, value: null, selection: null, prefill: null, progress: null });

  // Flip to complete on submit without a refetch round-trip (keyed to this uid),
  // carrying the just-chosen sport/position so the Hub renders it immediately. A
  // just-onboarded athlete has no progress yet (null → a fresh, unchecked week).
  const markComplete = useCallback((selection = null) => {
    // A fresh submit guarantees a complete athlete_profiles (birth_date + gender),
    // so we can open the gate without a refetch (prefill is moot once cleared).
    setResult({ uid: key, value: 'complete', selection, prefill: null, progress: null });
  }, [key]);

  useEffect(() => {
    if (skip || !key) return undefined; // nothing to fetch; derived below
    let cancelled = false;
    supabase
      .rpc('bbf_get_youth_intake_status', { p_uid: key })
      .then(({ data, error }) => {
        if (cancelled) return;
        // RETURNS json → `data` is the object. Only a definitive `completed:true`
        // opens the gate; everything else (no row, error shape) stays closed. The
        // persisted sport/position (canonical ids) drive the Hub for a returning
        // athlete; youth_progress restores their check-offs.
        const selection = (!error && data?.sport)
          ? { sportId: data.sport, positionCode: data.position || null }
          : null;
        // Anything already on file pre-fills the re-gated intake (minimize friction).
        const prefill = (!error && (data?.birth_date || data?.gender))
          ? { birthDate: data.birth_date || '', gender: data.gender || '' }
          : null;
        // FAIL-CLOSED: the gate opens ONLY when the PAR-Q is cleared AND the
        // athlete_profiles record is complete (birth_date + gender present). A
        // legacy athlete who cleared PAR-Q but never populated the profile is
        // RE-GATED to backfill the values we can't guess.
        const cleared = !error && data?.completed && data?.profile_complete;
        setResult({
          uid: key,
          value: cleared ? 'complete' : 'incomplete',
          selection,
          prefill,
          progress: (!error && data?.youth_progress) || null,
        });
      })
      .catch(() => { if (!cancelled) setResult({ uid: key, value: 'incomplete', selection: null, prefill: null, progress: null }); });
    return () => { cancelled = true; };
  }, [key, skip]);

  let status;
  if (skip) status = 'complete';
  else if (!key) status = 'incomplete';
  else if (result.uid !== key) status = 'loading'; // current uid not yet resolved
  else status = result.value;

  const selection = result.uid === key ? result.selection : null;
  const prefill = result.uid === key ? result.prefill : null;
  const progress = result.uid === key ? result.progress : null;
  return { status, selection, prefill, progress, markComplete };
}

// Persist the intake. Authorized server-side purely by the bearer token (the
// uid is not trusted for auth), so we replay the stored vault_token. Returns the
// server envelope: { ok, screened_at, cardiac_clearance } | { ok:false, error }.
export async function submitYouthIntake(uid, payload) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'invalid_session' };
  const { data, error } = await supabase.rpc('bbf_submit_youth_intake', {
    p_uid: String(uid || '').trim().toLowerCase(),
    p_session_token: token,
    p_payload: payload,
  });
  if (error) return { ok: false, error: 'network' };
  return data || { ok: false, error: 'unknown' };
}

// Persist a single Daily Protocol check-off to the athlete's row. Token-gated
// (the bearer token authorizes; the user is resolved server-side). `kind` is
// 'ex' (workout) | 'dr' (drill) | 'fm' (film); `value` is a boolean for ex/dr or
// the film status string. Optimistic UI — fire-and-forget; the server is the
// source of truth on the next load. Never throws (errors resolve to { ok:false }).
export async function logYouthProgress(uid, day, kind, index, value) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'invalid_session' };
  const { data, error } = await supabase.rpc('bbf_log_youth_progress', {
    p_uid: String(uid || '').trim().toLowerCase(),
    p_session_token: token,
    p_day: day,
    p_kind: kind,
    p_index: String(index),
    p_value: value,
  });
  if (error) return { ok: false, error: 'network' };
  return data || { ok: false, error: 'unknown' };
}
