// src/lib/useAthleteDossier.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED ATHLETE DOSSIER HOOK — Redundancy Fix R2 (database layer consolidation).
//
// ONE server-side aggregate replaces the coaching dashboard's per-athlete read
// fan-out: the bbf_athlete_dossier RPC (token-gated wrapper over
// get_complete_athlete_dossier) joins profile + logged metrics + historical
// timelines + protocol tables NEXT TO THE DATA and returns a single deeply
// nested JSON block. The dossier shape:
//
//   { athlete, profile, body_metrics_latest,
//     metrics:   { daily_biometrics[], readiness_protocols[], wearable_readings[] },
//     timeline:  { completion_events[], session_feedback[], recent_sets[],
//                  meal_logs[], nutrition_sync[], messages[] },
//     protocols: { nutrition_target_latest, cardio_prescription_latest,
//                  active_playlist_latest, prehab_open[] },
//     generated_at }
//
// R1 DOCTRINE APPLIED PER-ATHLETE: a module-level cache (60s TTL) + in-flight
// dedupe means EVERY panel consuming the same athlete shares ONE network call —
// exactly how RosterProvider collapsed the roster pulls. Panels migrate onto
// this hook instead of firing their own effect-per-datum reads (the migration
// list lives in ClientDossier.jsx; DossierPulse is the first consumer).
//
// Auth follows the house adminRpc convention (protocolOverrideApi.js): the
// vault session token rides as p_session_token; the SQL wrapper fails closed
// (coaches/admins any athlete, everyone else self-only).

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

const TTL_MS = 60_000;
const cache = new Map();    // athleteId → { at, dossier }
const inFlight = new Map(); // athleteId → Promise

export async function fetchAthleteDossier(athleteId, { force = false } = {}) {
  const id = String(athleteId || '').trim();
  if (!id) throw Object.assign(new Error('No athlete selected.'), { code: 'no_athlete' });

  if (!force) {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.dossier;
    const pending = inFlight.get(id);
    if (pending) return pending;
  }

  const token = getStoredVaultToken();
  if (!token) throw Object.assign(new Error('No admin session — sign in to load the dossier.'), { code: 'no_session' });

  const p = (async () => {
    const { data, error } = await supabase.rpc('bbf_athlete_dossier', {
      p_session_token: token, p_athlete_id: id,
    });
    if (error) throw Object.assign(new Error(error.message || 'Dossier fetch failed.'), { code: 'rpc_error' });
    if (!data?.ok) {
      const slug = data?.error || 'dossier_failed';
      throw Object.assign(new Error(slug === 'not_entitled' ? 'This session cannot read that athlete.' : 'Dossier fetch failed.'), { code: slug });
    }
    cache.set(id, { at: Date.now(), dossier: data.dossier });
    return data.dossier;
  })();

  inFlight.set(id, p);
  try { return await p; } finally { inFlight.delete(id); }
}

// Drop a cached dossier (e.g. after an admin write that changes what it shows).
export function invalidateAthleteDossier(athleteId) {
  cache.delete(String(athleteId || '').trim());
}

// React hook — { dossier, isLoading, error, refresh }. Multiple mounted
// consumers of the same athleteId resolve from the shared cache/in-flight map.
export function useAthleteDossier(athleteId) {
  const [dossier, setDossier] = useState(null);
  const [isLoading, setIsLoading] = useState(!!athleteId);
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const load = useCallback(async (opts = {}) => {
    if (!athleteId) { setDossier(null); setIsLoading(false); setError(null); return; }
    setIsLoading(true);
    setError(null);
    try {
      const d = await fetchAthleteDossier(athleteId, opts);
      if (aliveRef.current) setDossier(d);
    } catch (e) {
      if (aliveRef.current) { setDossier(null); setError(e.message || 'Dossier fetch failed.'); }
    } finally {
      if (aliveRef.current) setIsLoading(false);
    }
  }, [athleteId]);

  // Deferred via microtask (the RosterProvider self-load convention) so the
  // effect body never sets state synchronously; isLoading already seeds true.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [load]);

  const refresh = useCallback(() => {
    invalidateAthleteDossier(athleteId);
    return load({ force: true });
  }, [athleteId, load]);

  return { dossier, isLoading, error, refresh };
}
