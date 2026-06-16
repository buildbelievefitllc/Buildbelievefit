// src/lib/forecastApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Biokinetic Forecast data layer (audio-first).
//
//   fetchForecast(uid, lift)      → JSON diagnostics (1RM projection + OT signal)
//                                   from the live bbf-agentic-forecasting edge fn.
//   fetchBriefingAudio(payload)   → an mp3 BLOB (audio/mpeg) — the "Sovereign Audio
//                                   Briefing" — from the dedicated TTS edge fn
//                                   bbf-biokinetic-briefing. Returns an object URL
//                                   the <audio> player streams. NOT a JSON string.
//
// House convention: raw fetch to FUNCTIONS_BASE with the anon key (the gateway
// requires it to route) — mirrors prehabApi / conciergeApi (NOT functions.invoke).

import { useCallback, useEffect, useState } from 'react';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

function fnHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

// JSON diagnostic forecast (projected_1rm · confidence_score · agent_insight ·
// ot_signal{...}) for a single lift. Throws a slug-bearing Error on failure.
export async function fetchForecast(uid, liftName, locale) {
  if (!uid) throw new Error('no_athlete');
  if (!liftName) throw new Error('missing_lift_name');
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-forecasting`, {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify({ uid, lift_name: liftName, locale }),
  });
  if (!res.ok) {
    let slug = `forecast_failed_${res.status}`;
    try { slug = (await res.json())?.error || slug; } catch { /* non-JSON body */ }
    throw new Error(slug);
  }
  return res.json();
}

// AUDIO-FIRST: the Sovereign Audio Briefing. The backend writes a ~100-word
// summary and runs it through OpenAI TTS (tts-1 · onyx), returning audio/mpeg.
// We hand the caller a playable object URL. Throws a display-ready Error otherwise.
export async function fetchBriefingAudio({ uid, liftName, forecast, locale }) {
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-biokinetic-briefing`, {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify({ uid, lift_name: liftName, forecast, locale, vault_token: getStoredVaultToken() }),
  });
  if (!res.ok) {
    let detail = `briefing_failed_${res.status}`;
    try { detail = (await res.json())?.error || detail; } catch { /* non-JSON */ }
    throw new Error(detail);
  }
  // Defensive: a misconfigured backend that returns JSON/text instead of an audio
  // stream must not be fed to <audio> as if it were sound.
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('audio')) throw new Error('briefing_no_audio');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Hook: run the forecast for { uid, lift }. Standard { data, loading, error, refetch }.
// State is mutated ONLY inside promise callbacks (never synchronously in the effect
// body) — same discipline as useCardio, which keeps it clear of the
// react-hooks/set-state-in-effect rule + StrictMode double-invoke. `loading` seeds
// true via the initializer when a fetch is possible; callers that want a fresh
// loading state per input should key-remount this hook's host component.
export function useForecast(uid, liftName, locale) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(uid && liftName));
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!uid || !liftName) return undefined;
    let cancelled = false;
    fetchForecast(uid, liftName, locale)
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(e?.message || 'forecast_failed'); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, liftName, locale, reloadKey]);

  return { data, loading, error, refetch };
}
