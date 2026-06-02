// src/lib/agenticCardioApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 22.x — Agentic Cardio GPS (the PROACTIVE generator, distinct from the
// Phase-22 logger in cardioApi.js which persists completed sessions).
//
// Calls the bbf-agentic-cardio edge function: given a time budget it deterministically
// routes a modality tier (HIIT < 20min / Tempo ≤ 35 / Zone 2 > 35), reads CNS fatigue
// from the athlete's recent training, optionally STEPS THE TIER DOWN to protect the
// CNS, then has Claude write the minute-by-minute protocol + physiological ROI.
//
// VERIFIED CONTRACT (read from buildContract() in the edge fn source + fixture DB):
//   POST { uid, available_minutes }  →
//   { ok, uid, available_minutes,
//     modality: { tier, machine, label, strategy },
//     protocol_steps: [{ start_min, end_min, phase, label, target }],
//     cns_downregulation: { score, fatigue_level, base_tier, effective_tier, down_regulated, ... },
//     roi: { toast, detail, primary_metric },
//     meta: { source, model, generated_at } }
//
// Gateway: the function's CORS allows apikey/authorization, and supabase-js attaches
// the anon key automatically via supabase.functions.invoke — so no manual headers.

import { supabase } from './supabaseClient.js';

// Generate a protocol for a time budget. Returns the verified envelope or throws a
// display-ready Error.
export async function generateCardio(uid, availableMinutes) {
  const mins = Math.round(Number(availableMinutes) || 0);
  if (!uid) throw new Error('No athlete — sign in to generate a protocol.');
  if (!mins || mins <= 0) throw new Error('Enter how many minutes you have.');

  const { data, error } = await supabase.functions.invoke('bbf-agentic-cardio', {
    body: { uid, available_minutes: mins },
  });

  if (error) {
    // functions.invoke surfaces non-2xx as a FunctionsHttpError carrying the
    // Response on `.context`. Intercept 429 from the new rate-limited backend and
    // surface it as a coded error the UI maps to a clean toast (not a raw failure).
    if (error?.context?.status === 429) {
      throw rateLimited();
    }
    throw new Error(`Cardio engine unavailable — ${error.message || 'request failed'}.`);
  }
  if (!data?.ok) {
    const slug = data?.error || 'unknown';
    // Defensive: some gateways return the limit as a 200 body slug.
    if (slug === 'rate_limited' || slug === 'too_many_requests') throw rateLimited();
    const map = {
      unauthorized: 'Not authorized to generate a protocol.',
      missing_uid: 'No athlete on the request.',
      invalid_minutes: 'Enter a valid number of minutes.',
      invalid_json: 'The engine rejected the request.',
    };
    throw new Error(map[slug] || 'Could not generate a protocol. Try again.');
  }
  return data;
}

// Coded rate-limit error → the UI renders it as a toast, not a generic failure.
function rateLimited() {
  const e = new Error('Daily limit reached. Resets at midnight UTC.');
  e.code = 'rate_limited';
  return e;
}
