// src/lib/weeklyBriefApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Weekly Brief data layer — the coach's Monday voice memo.
//
//   getWeeklyBrief(uid)  → JSON verdict from bbf-weekly-brief-scenario-engine:
//                          { scenario, substatus, audio_url, locked_in,
//                            timestamp, rendered_script }.
//   useWeeklyBrief(uid)  → { data, loading, error } hook for the Hub card.
//
// House convention (mirrors forecastApi / prehabApi): a raw fetch to
// FUNCTIONS_BASE with the anon key (the gateway requires it to route) PLUS the
// athlete's server-revocable vault token on BOTH the header and the query — so
// the edge function can resolve identity server-side and enforce the entitlement
// gate (NEVER trust a client-supplied user_id alone). NOT functions.invoke.

import { useEffect, useState } from 'react';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Fetch the current week's brief for the signed-in athlete. The brief is audio-
// first: `audio_url` streams in an <audio> element, `rendered_script` backs the
// transcript modal. Throws a slug-bearing Error on failure (card degrades to its
// "not ready" state — no invented brief is ever shown).
export async function getWeeklyBrief(uid, locale) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('missing_session');
  // vault_token (query + header) binds the call to the athlete's revocable session
  // so the edge fn resolves identity server-side and gates the voice-coach feature.
  const params = new URLSearchParams({ vault_token: token });
  if (uid) params.set('uid', uid);
  // locale drives BOTH the rendered transcript and the spoken (ElevenLabs) audio —
  // the edge fn renders + voices the brief in this language and caches per-locale.
  if (locale) params.set('locale', locale);
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-weekly-brief-scenario-engine?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-bbf-vault-token': token,
    },
  });
  if (!res.ok) {
    let slug = `weekly_brief_failed_${res.status}`;
    try { slug = (await res.json())?.error || slug; } catch { /* non-JSON body */ }
    throw new Error(slug);
  }
  return res.json();
}

// Hook: load the brief once on land. State is mutated ONLY inside promise
// callbacks (never synchronously in the effect body) — same discipline as
// useForecast, which keeps it clear of react-hooks/set-state-in-effect +
// StrictMode double-invoke. `loading` seeds true when a fetch is possible.
export function useWeeklyBrief(uid, locale) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getStoredVaultToken()));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!getStoredVaultToken()) return undefined;
    let cancelled = false;
    getWeeklyBrief(uid, locale)
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(e?.message || 'weekly_brief_failed'); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, locale]);

  return { data, loading, error };
}
