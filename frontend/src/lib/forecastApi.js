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
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY, supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

function fnHeaders(vaultToken) {
  const h = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  // The server entitlement gate reads the vault token from the x-bbf-vault-token
  // HEADER (or the body). Sending it on BOTH guarantees the gate authenticates the
  // request — a missing token here is what was 401-ing and tripping the fallback.
  if (vaultToken) h['x-bbf-vault-token'] = vaultToken;
  return h;
}

// JSON diagnostic forecast (projected_1rm · confidence_score · agent_insight ·
// ot_signal{...}) for a single lift. Throws a slug-bearing Error on failure.
export async function fetchForecast(uid, liftName, locale) {
  if (!uid) throw new Error('no_athlete');
  if (!liftName) throw new Error('missing_lift_name');
  const token = getStoredVaultToken();
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-forecasting`, {
    method: 'POST',
    headers: fnHeaders(token),
    // vault_token (header + body) binds the call to the athlete's server-revocable
    // session so the edge fn enforces the biokinetic_forecast entitlement gate.
    body: JSON.stringify({ uid, lift_name: liftName, locale, vault_token: token }),
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
  return postForAudio({ context: 'forecast', uid, lift_name: liftName, forecast, locale }, 'briefing');
}

// SOVEREIGN AUDIO — the Day-30 graduation briefing. Akeem's cloned voice delivers a
// personalized, trilingual spoken address from the dedicated bbf-sovereign-briefing
// edge fn (gated server-side: voice_coach + Day-30 graduation + metering). Returns a
// playable mp3 object URL; throws a slug-bearing Error on any gate/synth failure.
export async function fetchSovereignBriefing({ locale }) {
  const token = getStoredVaultToken();
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-sovereign-briefing`, {
    method: 'POST',
    headers: fnHeaders(token),
    body: JSON.stringify({ locale, vault_token: token }),
  });
  if (!res.ok) {
    let slug = `sovereign_briefing_failed_${res.status}`;
    try { slug = (await res.json())?.error || slug; } catch { /* non-JSON body */ }
    throw new Error(slug);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('audio')) throw new Error('sovereign_briefing_no_audio');
  return URL.createObjectURL(await res.blob());
}

// AUTO-DAILY (FRONT 3.5): read TODAY'S PRE-CACHED Sovereign Briefing — the one the
// morning check-in tripwire generated in the background — via the token-gated
// bbf_get_sovereign_briefing RPC. Returns a playable object URL for instant play, or
// NULL when it hasn't been pre-generated yet (e.g. no check-in today) so the caller
// can fall back to on-demand fetchSovereignBriefing. No Claude/ElevenLabs round-trip.
export async function fetchCachedSovereignBriefing({ locale }) {
  const token = getStoredVaultToken();
  if (!token) return null;
  const { data, error } = await supabase.rpc('bbf_get_sovereign_briefing', { p_session_token: token, p_locale: locale });
  if (error) throw new Error(error.message || 'sovereign_cache_failed');
  if (!data?.ok) throw new Error(data?.error || 'sovereign_cache_failed');
  if (!data.found || !data.audio_b64) return null; // not pre-generated yet → caller falls back
  const bin = atob(data.audio_b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: data.mime || 'audio/mpeg' }));
}

// LIVE COACH (context='program'): a short, intense in-ear cue for the active
// movement, voiced by the SAME locale-mapped ElevenLabs voice. Returns an mp3
// object URL. `{ exerciseName, targetReps, targetSets, formCues, equipment }`.
export async function fetchCoachAudio({ exerciseName, targetReps, targetSets, formCues, equipment, locale }) {
  return postForAudio({
    context: 'program',
    locale,
    exercise: { exercise_name: exerciseName, target_reps: targetReps, target_sets: targetSets, form_cues: formCues, equipment },
  }, 'coach');
}

// SECTION COACH (context='recovery'|'prehab'|'cardio'): voices a pre-authored cue
// (breathing/form/intensity, drill or zone guidance) via the SAME locale-mapped
// ElevenLabs voice, CACHED server-side by `cueRef`. `cueText` is the spoken source;
// the server renders it naturally in-locale. Returns an mp3 object URL.
export async function fetchSectionCoachAudio({ context, cueRef, cueText, locale }) {
  return postForAudio({ context, locale, cue_ref: cueRef, cue_text: cueText }, context || 'coach');
}

// Shared audio POST → Blob. Both briefing + coach hit bbf-biokinetic-briefing
// (ElevenLabs) and expect an audio/mpeg blob, NOT a JSON string.
async function postForBlob(body, slug) {
  const token = getStoredVaultToken();
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-biokinetic-briefing`, {
    method: 'POST',
    headers: fnHeaders(token),
    body: JSON.stringify({ ...body, vault_token: token }),
  });
  if (!res.ok) {
    let detail = `${slug}_failed_${res.status}`;
    try { detail = (await res.json())?.error || detail; } catch { /* non-JSON */ }
    throw new Error(detail);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('audio')) throw new Error(`${slug}_no_audio`);
  return res.blob();
}

// Shared audio POST → object URL (one-shot; the caller owns + revokes the URL).
async function postForAudio(body, slug) {
  return URL.createObjectURL(await postForBlob(body, slug));
}

// ── Session audio cache (API-BLEED GUARD) ────────────────────────────────────
// Pre-authored section cues (e.g. the youth Champion Mindset Architect welcome) are
// IDENTICAL on every play, yet a naive component re-fetches them on every mount and
// language toggle — each one an edge-function round-trip (and an ElevenLabs synth on
// a cold server cache). The server already caches the SYNTHESIS (bbf_coach_audio);
// THIS stops the CLIENT from re-hitting the API at all. We hold the decoded BLOB once
// per key (context|locale|cueRef) for the session and hand each caller a FRESH object
// URL — so a component can revoke its own URL on unmount without evicting the shared
// blob. Net effect: the edge fn is hit at most ONCE per key per session; a language
// toggle-back or a tab unmount/remount plays straight from memory. Concurrent callers
// share a single in-flight request. (Session-scoped by design — a full page reload
// re-primes from the cheap server cache; the bleed we're killing is mount/toggle churn.)
const _sectionBlobCache = new Map(); // key -> Blob
const _sectionInflight = new Map();  // key -> Promise<Blob>
function sectionAudioKey({ context, locale, cueRef }) {
  return `${context || 'coach'}|${locale || 'en'}|${cueRef || ''}`;
}

// Cached twin of fetchSectionCoachAudio — same contract (resolves to an object URL),
// but only touches the network on the FIRST request for a given key. Use for FIXED,
// repeat-played cues (the Architect welcome); use fetchSectionCoachAudio for one-off
// dynamic cues that should never be memoized.
export async function fetchCachedSectionCoachAudio({ context, cueRef, cueText, locale }) {
  const key = sectionAudioKey({ context, locale, cueRef });
  let blob = _sectionBlobCache.get(key);
  if (!blob) {
    let pending = _sectionInflight.get(key);
    if (!pending) {
      pending = postForBlob({ context, locale, cue_ref: cueRef, cue_text: cueText }, context || 'coach')
        .then((b) => { _sectionBlobCache.set(key, b); _sectionInflight.delete(key); return b; })
        .catch((e) => { _sectionInflight.delete(key); throw e; });
      _sectionInflight.set(key, pending);
    }
    blob = await pending;
  }
  // A fresh URL per call: the caller revokes its own on unmount; the blob lives on.
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
