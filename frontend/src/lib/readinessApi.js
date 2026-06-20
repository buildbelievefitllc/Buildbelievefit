// src/lib/readinessApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Readiness data layer — the morning check-in calculator.
//
//   postReadiness({ sleepHours, vibeCheck, athleteId? })
//     → POST bbf-readiness-calculator → { ok, readinessScore, volMultiplier,
//       alerts:{en,es,pt}, logged }.
//
// House convention (mirrors forecastApi): raw fetch to FUNCTIONS_BASE with the anon
// key (the gateway requires it to route) plus the athlete's vault token on the
// header for parity with the other coach endpoints. athlete_id is OPTIONAL — when
// present (an athlete_profiles row exists) the edge fn persists the morning log;
// when omitted the engine still returns the full verdict (pure calculation).

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

export async function postReadiness({ sleepHours, vibeCheck, athleteId = null }) {
  const token = getStoredVaultToken();
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (token) headers['x-bbf-vault-token'] = token;

  const body = { sleep_hours: sleepHours, vibe_check: vibeCheck };
  if (athleteId) body.athlete_id = athleteId;

  const res = await fetch(`${FUNCTIONS_BASE}/bbf-readiness-calculator`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let slug = `readiness_failed_${res.status}`;
    try { slug = (await res.json())?.error || slug; } catch { /* non-JSON body */ }
    throw new Error(slug);
  }
  return res.json();
}
