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
  // value: 'complete' | 'incomplete'; selection: { sportId, positionCode } | null.
  const [result, setResult] = useState({ uid: null, value: null, selection: null });

  // Flip to complete on submit without a refetch round-trip (keyed to this uid),
  // carrying the just-chosen sport/position so the Hub renders it immediately.
  const markComplete = useCallback((selection = null) => {
    setResult({ uid: key, value: 'complete', selection });
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
        // persisted sport/position (canonical ids) drive the Hub for a returning athlete.
        const selection = (!error && data?.sport)
          ? { sportId: data.sport, positionCode: data.position || null }
          : null;
        setResult({ uid: key, value: !error && data?.completed ? 'complete' : 'incomplete', selection });
      })
      .catch(() => { if (!cancelled) setResult({ uid: key, value: 'incomplete', selection: null }); });
    return () => { cancelled = true; };
  }, [key, skip]);

  let status;
  if (skip) status = 'complete';
  else if (!key) status = 'incomplete';
  else if (result.uid !== key) status = 'loading'; // current uid not yet resolved
  else status = result.value;

  const selection = result.uid === key ? result.selection : null;
  return { status, selection, markComplete };
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
