// src/lib/studioApi.js
// ─────────────────────────────────────────────────────────────────────────────
// FRONT 5 — Sovereign Studio data layer. Calls the admin-only bbf-sovereign-studio
// webhook (ElevenLabs proxy) with the CEO's verbatim script + a Vibe, and hands
// back a playable/downloadable MP3 blob. Auth is the admin's vault session token
// (validated server-side via a god-mode role check) — no client secret. Mirrors
// the house fetch convention (anon key to route the gateway; vault token to gate).

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';
import audioVaultManifest from '../data/audioVaultManifest.json';

// Zero-latency cache: { exercise_name → permanent Supabase Storage URL }, seeded
// offline by scripts/seed-audio-vault.js. An exact topic match short-circuits the
// Edge Function entirely (no network, $0 spend). Canonical source is the repo-root
// audio-vault-manifest.json — keep this copy in sync when the vault is re-seeded.
function lookupVaultUrl(topic) {
  const key = (topic || '').trim();
  if (!key || !Object.prototype.hasOwnProperty.call(audioVaultManifest, key)) return null;
  const url = audioVaultManifest[key];
  return typeof url === 'string' && url ? url : null;
}

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

// FRONT 5 · Lazy-caching voiceover. Calls bbf-studio-voiceover with the reel's
// (topic, target_duration, series, vibe, lang). The Edge Function either returns
// a cached vault URL (zero spend) or generates + caches a new MP3 — either way we
// get back a permanent Supabase Storage public URL. Returns the parsed JSON
// ({ ok, cached, slug, url, vibe, duration, model?, usage? }); throws a
// display-ready Error on failure.
export async function generateStudioVoiceover({ topic, targetDuration, series, vibe, lang }) {
  // Zero-latency manifest cache: exact topic match returns the pre-seeded vault URL
  // instantly, skipping the Edge Function. But `audioVaultManifest` is ENGLISH-ONLY
  // (keyed by exercise name with NO locale dimension), so short-circuiting to it for
  // es/pt returned the ENGLISH clip and skipped the lang-aware Edge Function — picking
  // Spanish/Portuguese + Generate played English. Only take the fast path for EN; es/pt
  // fall through to bbf-studio-voiceover, which writes the script in-language and caches
  // the result server-side (slug includes lang, so the next es/pt hit is a $0 cache hit).
  const cachedUrl = (lang || 'en') === 'en' ? lookupVaultUrl(topic) : null;
  if (cachedUrl) {
    return { ok: true, cached: true, fromManifest: true, url: cachedUrl, vibe };
  }

  const token = getStoredVaultToken();
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-studio-voiceover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(token ? { 'x-bbf-vault-token': token } : {}),
    },
    body: JSON.stringify({
      topic,
      target_duration: targetDuration,
      series: series || '',
      vibe,
      lang: lang || 'en',
      vault_token: token,
    }),
  });

  if (!res.ok) {
    let detail = `voiceover_failed_${res.status}`;
    try { const j = await res.json(); detail = j.detail || j.error || detail; } catch { /* non-JSON */ }
    throw new Error(detail);
  }
  const j = await res.json().catch(() => null);
  if (!j || !j.url) throw new Error('voiceover_no_url');
  return j;
}

// FRONT 5 · Hook auto-gen. Haiku writes a reel hook + sub-line for the selected
// exercise/topic (no audio, no cache). Returns { hook, sub }. Throws on failure.
export async function generateHook({ topic, spectrum, lang }) {
  const token = getStoredVaultToken();
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-studio-voiceover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(token ? { 'x-bbf-vault-token': token } : {}),
    },
    body: JSON.stringify({ action: 'hook', topic, spectrum: spectrum || '', lang: lang || 'en', vault_token: token }),
  });
  if (!res.ok) {
    let detail = `hook_failed_${res.status}`;
    try { const j = await res.json(); detail = j.detail || j.error || detail; } catch { /* non-JSON */ }
    throw new Error(detail);
  }
  const j = await res.json().catch(() => null);
  if (!j || !j.hook) throw new Error('hook_no_data');
  return j;
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
