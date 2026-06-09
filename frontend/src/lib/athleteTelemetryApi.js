// src/lib/athleteTelemetryApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Athlete telemetry logbook — client API for the per-set log (weight / RPE /
// completed_at) the Sports Hub TelemetryLog writes.
//
//   • bbf_get_athlete_set_log(uid, token) → { ok, logs:{ <log_key>: {weight,
//     bodyweight, rpe, completed_at} } } — token-gated mount-time rehydration, so
//     logged sets stay collapsed/checked across refresh.
//   • bbf_log_athlete_set(uid, token, …)  → upsert one set; the server resolves the
//     user FROM the vault bearer token (the uid is not trusted for auth) and rolls
//     rpe_avg_last_3 into bbf_athlete_progression for the Referee.
//
// Token replay mirrors youthIntakeApi (the readiness / youth-progress writers).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

const lc = (v) => String(v || '').trim().toLowerCase();

// Fetch the athlete's full set log as a { log_key: entry } map. Never throws —
// an absent/expired token or any error resolves to an empty map (fresh grid).
export async function fetchAthleteSetLog(uid) {
  const token = getStoredVaultToken();
  if (!token) return {};
  const { data, error } = await supabase.rpc('bbf_get_athlete_set_log', {
    p_uid: lc(uid),
    p_session_token: token,
  });
  if (error || !data || data.ok !== true) return {};
  return data.logs || {};
}

// Upsert one logged set. `entry` = { weight:Number|null, rpe:Number, at:isoString };
// `meta` = { exerciseName, source:'ex'|'dr'|'sp', day }. Fire-and-forget — the server
// is the source of truth on the next load. Returns the server envelope { ok, … }.
export async function logAthleteSet(uid, logKey, entry, meta = {}) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'invalid_session' };
  const bodyweight = entry.weight == null;
  const { data, error } = await supabase.rpc('bbf_log_athlete_set', {
    p_uid: lc(uid),
    p_session_token: token,
    p_log_key: logKey,
    p_exercise_name: meta.exerciseName || logKey,
    p_weight: bodyweight ? null : Number(entry.weight),
    p_bodyweight: bodyweight,
    p_rpe: Number(entry.rpe),
    p_source: meta.source || 'ex',
    p_day: meta.day || null,
  });
  if (error) return { ok: false, error: 'network' };
  return data || { ok: false, error: 'unknown' };
}

// Lifted telemetry state for the Sports Hub: fetch the log map once on mount, expose
// an optimistic `logSet`. Keyed per movement (log_key), so it survives the per-day
// panel remounts (SportsHub keys the panel by activeDay) and refresh.
export function useAthleteTelemetry(uid) {
  const key = lc(uid);
  const [logs, setLogs] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    fetchAthleteSetLog(key)
      .then((map) => { if (!cancelled) { setLogs(map); setReady(true); } })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [key]);

  const logSet = useCallback((logKey, entry, meta) => {
    // Optimistic local merge (mirrors the persisted shape), then persist.
    setLogs((m) => ({
      ...m,
      [logKey]: { weight: entry.weight, bodyweight: entry.weight == null, rpe: entry.rpe, completed_at: entry.at },
    }));
    logAthleteSet(key, logKey, entry, meta);
  }, [key]);

  return { logs, logSet, ready };
}
