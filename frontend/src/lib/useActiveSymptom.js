// src/lib/useActiveSymptom.js
// ─────────────────────────────────────────────────────────────────────────────
// THE ACTIVE SYMPTOM — the single client-side source of truth for what the
// athlete last reported in the Post-Workout Check-In (target_area + pain_score).
//
// READ PATH: the active prescription playlist (bbf-prescription-today) carries the
// ledger's target_area/pain_score — the same server-resolved row the Dynamic
// Prescription engine generated from the latest session_feedback write. No client
// ever guesses; the ledger speaks.
//
// LIVE RELAY: submitSessionFeedback broadcasts PROTOCOL_UPDATED_EVENT with the
// saved payload the instant the check-in 200s. This hook applies that payload to
// state in the same tick (Prehab/Recovery re-route immediately, no reload), then
// hard-refetches to reconcile with the engine's generated playlist.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTodaysPrescription } from './prescriptionApi.js';
import { PROTOCOL_UPDATED_EVENT } from './useDailyReadiness.js';
import { SESSION_COMPLETE_EVENT } from './sessionFeedbackApi.js';

// Reported check-in target_area → Prehab friction-region id (prehabProtocol REGIONS).
// Every reportable area routes to its closest clinical bucket — there is NO silent
// lumbar fallback: only full_body (a whole-body session, no joint complaint) maps
// to null, which lets the surface keep its own neutral default.
export const AREA_TO_PREHAB_REGION = {
  shoulder: 'shoulder',
  knee: 'knee',
  neck: 'shoulder',       // no cervical deck yet — scapular/rotator work is the clinical neighbor
  upper_body: 'shoulder',
  lower_body: 'lower_back',
  full_body: null,
};

// Reported target_area → the 25-node diagnostic matrix's joint_complex key, so the
// Joint Symptom Diagnostic pre-isolates the reported joint (Step 1 auto-answered).
export const AREA_TO_MATRIX_JOINT = {
  shoulder: 'Glenohumeral / Scapulothoracic',
  upper_body: 'Glenohumeral / Scapulothoracic',
  knee: 'Patellofemoral / Tibiofemoral',
  lower_body: 'Lumbar Spine / LPHC',
  neck: 'Cervical / Thoracic Spine',
  full_body: null,
};

/**
 * @returns {{ loading:boolean, targetArea:string|null, painScore:number|null }}
 */
export function useActiveSymptom() {
  const [state, setState] = useState({ loading: true, targetArea: null, painScore: null });
  const alive = useRef(true);
  // The last check-in payload dispatched THIS session. The prescription tripwire is
  // asynchronous — for a beat after a save, bbf-prescription-today can still return
  // no playlist. The dispatched payload must survive that window: a ledger read WITH
  // a symptom wins (reconciliation); a read WITHOUT one keeps the live payload.
  const liveRef = useRef(null);

  // Pure fetch → state applied ONLY in the deferred continuations (the house
  // useHubHydration pattern — no synchronous setState in any effect body).
  const load = useCallback(() => fetchTodaysPrescription()
    .then((pl) => {
      if (!alive.current) return;
      const serverArea = pl?.target_area || null;
      setState({
        loading: false,
        targetArea: serverArea || liveRef.current?.targetArea || null,
        painScore: serverArea
          ? (Number.isFinite(Number(pl?.pain_score)) ? Number(pl.pain_score) : null)
          : (liveRef.current?.painScore ?? null),
      });
    })
    .catch(() => {
      // No session / engine unreachable → no symptom override; surfaces keep defaults.
      if (alive.current) setState((s) => ({ ...s, loading: false }));
    }), []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  useEffect(() => {
    const onUpdate = (e) => {
      const area = e?.detail?.target_area;
      if (area) {
        // Payload dispatch → instant re-route (and held in liveRef so the
        // reconciling refetch can never clobber it back to null), then reconcile.
        const painScore = Number.isFinite(Number(e.detail.pain_score)) ? Number(e.detail.pain_score) : null;
        liveRef.current = { targetArea: area, painScore };
        setState((s) => ({ ...s, loading: false, targetArea: area, painScore: painScore ?? s.painScore }));
      }
      load();
    };
    window.addEventListener(PROTOCOL_UPDATED_EVENT, onUpdate);
    window.addEventListener(SESSION_COMPLETE_EVENT, onUpdate);
    return () => {
      window.removeEventListener(PROTOCOL_UPDATED_EVENT, onUpdate);
      window.removeEventListener(SESSION_COMPLETE_EVENT, onUpdate);
    };
  }, [load]);

  return state;
}
