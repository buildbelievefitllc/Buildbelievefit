// src/lib/useProgramDay.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Loop Breaker program-day state for the athlete dashboard.
//
// Calls the token-gated bbf_resolve_program_day(p_session_token) RPC on mount and
// exposes the squad schedule + the per-athlete Loop Breaker flag:
//   { programDay (1..84), programWeek (1..12), daysOnProgram, isLoopBreaker,
//     isOverride, briefScriptReference, title, loading, error }
//
// OMNISCIENCE PROTOCOL (CEO mandate): a console-set global lets an admin force the
// UI states locally for DOM testing — no backend round-trip required.
//   window.BBF_ADMIN_OVERRIDE = true                  // force LB + override (demo ref)
//   window.BBF_ADMIN_OVERRIDE = { loopBreaker:true, override:true,
//                                 briefScriptReference:'audio_62a878f8', programDay:85 }
//   window.dispatchEvent(new Event('bbf-admin-override'))   // re-apply without reload
// Set it to false / delete it and re-dispatch to clear.

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';
import { manifest } from './sovereignManifest.js';

const EMPTY = {
  programDay: null, programWeek: null, daysOnProgram: null,
  isLoopBreaker: false, isOverride: false, briefScriptReference: null, title: null,
};

// Read window.BBF_ADMIN_OVERRIDE and fold it over the real RPC result. Returns the
// (possibly) overridden state. A demo brief_script_reference falls back to the first
// manifest id so the override audio path is testable out of the box.
function applyOmniscience(state) {
  if (typeof window === 'undefined') return state;
  const o = window.BBF_ADMIN_OVERRIDE;
  if (!o) return state;
  const demoRef = manifest[0]?.id || null;
  if (o === true) {
    return { ...state, isLoopBreaker: true, isOverride: true,
      briefScriptReference: state.briefScriptReference || demoRef,
      programDay: state.programDay ?? 85, daysOnProgram: state.daysOnProgram ?? 85, _omniscient: true };
  }
  return {
    ...state,
    isLoopBreaker: o.loopBreaker ?? state.isLoopBreaker,
    isOverride: o.override ?? state.isOverride,
    briefScriptReference: o.briefScriptReference ?? state.briefScriptReference ?? (o.override ? demoRef : null),
    programDay: o.programDay ?? state.programDay,
    daysOnProgram: o.daysOnProgram ?? state.daysOnProgram,
    _omniscient: true,
  };
}

export function useProgramDay() {
  const [raw, setRaw] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bump to re-fold the omniscience override (console event) without re-fetching.
  const [omniTick, setOmniTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredVaultToken();
    if (!token) {
      // Defer so we never setState synchronously inside the effect body.
      queueMicrotask(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    supabase
      .rpc('bbf_resolve_program_day', { p_session_token: token })
      .then(({ data, error: rpcErr }) => {
        if (cancelled) return;
        if (rpcErr || !data?.ok) { setError(rpcErr?.message || 'program_day_failed'); setLoading(false); return; }
        setRaw({
          programDay: data.program_day ?? null,
          programWeek: data.program_week ?? null,
          daysOnProgram: data.days_on_program ?? null,
          isLoopBreaker: !!data.is_loop_breaker,
          isOverride: !!data.is_override,
          briefScriptReference: data.brief_script_reference || null,
          title: data.title || null,
        });
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(e?.message || 'program_day_failed'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // Listen for the omniscience console event so testers can toggle without reload.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOmni = () => setOmniTick((n) => n + 1);
    window.addEventListener('bbf-admin-override', onOmni);
    return () => window.removeEventListener('bbf-admin-override', onOmni);
  }, []);

  // eslint-disable-next-line no-unused-vars -- omniTick forces the override re-fold
  const _ = omniTick;
  return { ...applyOmniscience(raw), loading, error };
}
