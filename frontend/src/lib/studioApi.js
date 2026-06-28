// src/lib/studioApi.js
// ─────────────────────────────────────────────────────────────────────────────
// FRONT 5 — Sovereign Studio data layer. Calls the admin-only bbf-sovereign-studio
// webhook (ElevenLabs proxy) with the CEO's verbatim script + a Vibe, and hands
// back a playable/downloadable MP3 blob. Auth is the admin's vault session token
// (validated server-side via a god-mode role check) — no client secret. Mirrors
// the house fetch convention (anon key to route the gateway; vault token to gate).

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Generate a voiceover. Returns { url, blob, billedChars, vibe }. The caller owns
// the object URL and must revoke it. Throws a display-ready Error on any failure.
export async function generateStudioVoice({ script, vibe }) {
  const token = getStoredVaultToken();
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-sovereign-studio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(token ? { 'x-bbf-vault-token': token } : {}),
    },
    body: JSON.stringify({ script, vibe, vault_token: token }),
  });

  if (!res.ok) {
    let detail = `studio_failed_${res.status}`;
    try { const j = await res.json(); detail = j.detail || j.error || detail; } catch { /* non-JSON */ }
    throw new Error(detail);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('audio')) throw new Error('studio_no_audio');

  const blob = await res.blob();
  return {
    url: URL.createObjectURL(blob),
    blob,
    billedChars: Number(res.headers.get('X-BBF-Billed-Chars')) || null,
    vibe: res.headers.get('X-BBF-Vibe') || vibe,
  };
}

// Optional: fetch the Vibe Matrix from the server (the UI ships its own copy, so
// this is only a diagnostic / future-proofing hook).
export async function fetchStudioVibes() {
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-sovereign-studio?vibes=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`vibes_failed_${res.status}`);
  return res.json();
}
