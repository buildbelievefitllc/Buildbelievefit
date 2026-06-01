// src/lib/aiHubApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 19 — Frontend wiring to the live BBF AI Hub (the chatbox brain).
//
// Replaces the Phase 17 keyword placeholder in BBFChatbox.jsx with a real POST
// to the deployed Anthropic-backed edge function.
//
// Contract (verified against supabase/functions/bbf-ai-hub/index.ts):
//   POST {FUNCTIONS_BASE}/bbf-ai-hub
//   body: {
//     messages:   [{ role:'user'|'assistant', content:string }]  // must start with user
//     lang?:      'en' | 'es' | 'pt'                              // optional
//     tierMatrix?: Tier[]                                         // pricing source of truth
//   }
//   200 → { ok:true, reply:string, cta:'pathfinder'|'tdee'|null, model, usage }
//   4xx/5xx → { error:'<slug>', detail? }   (no_messages, must_start_with_user,
//             rate_limited[429], origin_not_allowed[403],
//             config_missing_anthropic_key[503], anthropic_call_failed[502], …)
//
// PRICING SINGLE SOURCE OF TRUTH: we always send the frontend's live TIER_MATRIX
// so the AI can never quote a stale price baked into the function's fallback
// mirror (see the function's single-source-of-truth note).
//
// verify_jwt is false on this function (public marketing endpoint), so the anon
// key is not strictly required — but the function's CORS allowlists apikey/
// authorization, so we attach the anon key when present (canonical Supabase
// Functions invocation) and degrade gracefully when it is not.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { TIER_MATRIX } from './chatboxContext.js';

const ENDPOINT = `${FUNCTIONS_BASE}/bbf-ai-hub`;

// Map server error → a warm, on-brand line (never a raw slug to the prospect).
// Every fallback nudges toward the Pathfinder so a failure still converts.
function aiErrorMessage(status, slug) {
  if (status === 429 || slug === 'rate_limited') {
    return "You're moving fast — give me a few seconds and ask again.";
  }
  if (slug === 'origin_not_allowed') {
    return 'This site isn’t authorized to use the assistant yet — please reach Akeem via the application.';
  }
  if (status === 503 || slug === 'config_missing_anthropic_key') {
    return 'The coach’s assistant is briefly offline. Drop your details in the Pathfinder and Akeem will reach out within 24 hours.';
  }
  if (status === 502 || slug === 'anthropic_call_failed' || slug === 'bad_model_json') {
    return 'I had a hiccup answering that. Try rephrasing — or head to the Pathfinder and Akeem will reach out directly.';
  }
  if (status === 400) {
    return 'I couldn’t quite process that one — mind rephrasing?';
  }
  return 'I couldn’t reach the assistant just now. The Pathfinder application puts you straight in front of Akeem.';
}

// Convert the chatbox's internal history ({ role:'user'|'bot', text }) into the
// API's turns ({ role:'user'|'assistant', content }). Drops leading assistant
// turns (the seeded greeting) because Anthropic requires the first turn to be a
// user message.
function toApiTurns(history) {
  const turns = (history || [])
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
}

// Send the running conversation to the live brain. Resolves to { reply, cta }.
// Throws Error(friendlyMessage) on any failure so the caller can render it as a
// graceful bot message — the chatbox never shows an unhandled error.
export async function sendChat(history, { lang } = {}) {
  const messages = toApiTurns(history);
  if (!messages.length) throw new Error('Type a message to start the conversation.');

  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, lang, tierMatrix: TIER_MATRIX }),
    });
  } catch {
    throw new Error('Network error — I couldn’t reach the assistant. Check your connection and try again.');
  }

  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON error page */ }

  if (!res.ok || !body?.ok) {
    throw new Error(aiErrorMessage(res.status, body?.error));
  }

  return {
    reply: typeof body.reply === 'string' && body.reply.trim() ? body.reply : '…',
    // Normalize to the BBFChatbox cta contract ('pathfinder' | 'tdee' | null).
    cta: body.cta === 'pathfinder' || body.cta === 'tdee' ? body.cta : null,
  };
}
