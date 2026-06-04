// src/lib/leadApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Public Pathfinder lead intake → the bbf-lead-capture Supabase edge function.
//
// ⚠️ This is a PUBLIC, UNAUTHENTICATED call. Mirrors the legacy storefront
// (index.html) EXACTLY: POST with ONLY `Content-Type: application/json` — NO
// apikey / Authorization header. The function's CORS allowlists only the
// `content-type` header, so adding an apikey would trip the preflight. The
// gateway/abuse protection is handled server-side via origin allowlist +
// per-IP rate limit + a mandatory Cloudflare Turnstile token.
//
// Contract (verified against supabase/functions/bbf-lead-capture/index.ts):
//   POST {FUNCTIONS_BASE}/bbf-lead-capture
//   body: { source:'pathfinder', email (required), full_name, phone, tier?,
//           ...free-form payload (primary_goal, etc.), turnstile_token (required),
//           timestamp }
//   200 → { ok:true, ... }
//   400 missing_source_or_email | invalid_email | invalid_json
//   403 origin_not_allowed | turnstile_failed
//   429 rate_limited · 503 config_missing(_turnstile) · 500 lead_insert_failed

import { FUNCTIONS_BASE } from './supabaseClient.js';

function leadErrorMessage(status, slug) {
  if (slug === 'turnstile_failed' || slug === 'config_missing_turnstile') {
    return 'Security check failed — please try again.';
  }
  if (slug === 'origin_not_allowed') return 'This site is not yet authorized to submit (CORS).';
  if (status === 429 || slug === 'rate_limited') return 'Too many attempts — wait a minute and retry.';
  if (slug === 'invalid_email') return 'That email looks invalid — please check it.';
  if (slug === 'missing_source_or_email') return 'Name and a valid email are required.';
  if (status === 503) return 'Intake is temporarily unavailable — please try again shortly.';
  return `Submission failed (${slug || `status ${status}`}). Please try again.`;
}

// Submit a lead. `fields` carries full_name, email, phone, primary_goal, etc.
// `turnstileToken` is the single-use token from useTurnstile.obtainToken().
// `lang` is the active LangContext code (en|es|pt) — persisted as the lead's
// language_preference so downstream plan generation (the /process pipeline)
// emits the athlete's first plans in the language they applied in.
export async function submitLead(fields, turnstileToken, lang) {
  const code = String(lang || '').trim().toLowerCase().slice(0, 2);
  const language_preference = (code === 'es' || code === 'pt') ? code : 'en';
  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-lead-capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // ← only this header (see note above)
      body: JSON.stringify({
        source: 'pathfinder',
        language_preference,
        lang: language_preference,
        timestamp: new Date().toISOString(),
        ...fields,
        turnstile_token: turnstileToken,
      }),
    });
  } catch {
    throw new Error('Network error — your application did not reach the server. Check your connection and retry.');
  }

  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }

  if (!res.ok || !body?.ok) {
    throw new Error(leadErrorMessage(res.status, body?.error));
  }
  return body;
}
