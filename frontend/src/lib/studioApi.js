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
    // `error` is the CODED slug VibeSelector's humanizeVoErr() keys on
    // (not_admin, tts_failed, …); `detail` is a human-readable sentence the
    // Edge Function also sends for its own logs. Prefer `error` — `detail` was
    // being read first, so it ALWAYS won (every branch sets both) and
    // humanizeVoErr() never matched anything, silently masking the real cause
    // behind the generic "Voiceover generation failed" fallback.
    let detail = `voiceover_failed_${res.status}`;
    try { const j = await res.json(); detail = j.error || j.detail || detail; } catch { /* non-JSON */ }
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
    // Same fix as generateStudioVoiceover — prefer the coded `error` slug over
    // the human-readable `detail` sentence (see comment above).
    let detail = `hook_failed_${res.status}`;
    try { const j = await res.json(); detail = j.error || j.detail || detail; } catch { /* non-JSON */ }
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

// CROSS-DEVICE VOICEOVER UPLOAD. Pushes a user-provided voice file (an ElevenLabs
// / Sovereign Studio render) into the PUBLIC studio-audio-vault bucket and returns
// its durable public URL — so an uploaded voice rides the reel's voUrl on ANY
// device, exactly like a generated voice, instead of a device-local blob. Two
// steps: (1) the admin-gated bbf-studio-asset-upload fn mints a one-shot signed
// upload URL, (2) the browser PUTs the bytes straight to Storage. Returns
// { publicUrl, path }; throws a display-ready Error on failure so the caller can
// fall back to a session-local blob.
export async function uploadVoiceover(file) {
  if (!file) throw new Error('no_file');
  const token = getStoredVaultToken();
  const contentType = file.type || 'audio/mpeg';

  // 1) sign — server generates the path + a one-shot signed upload URL
  const signRes = await fetch(`${FUNCTIONS_BASE}/bbf-studio-asset-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(token ? { 'x-bbf-vault-token': token } : {}),
    },
    body: JSON.stringify({ action: 'upload_voiceover', content_type: contentType, vault_token: token }),
  });
  const sj = await signRes.json().catch(() => null);
  if (!signRes.ok || !sj?.ok || !sj?.uploadUrl || !sj?.publicUrl) {
    throw new Error((sj && (sj.error || sj.detail)) || `sign_failed_${signRes.status}`);
  }

  // 2) PUT the bytes to the signed URL (direct to Storage, no base64 inflation)
  const putRes = await fetch(sj.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-upsert': 'true',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: file,
  });
  if (!putRes.ok) throw new Error(`upload_${putRes.status}`);

  return { publicUrl: sj.publicUrl, path: sj.path || null };
}

// CAPTION TRANSCRIPTION. Turns the reel's voice track — generated OR uploaded —
// into word-by-word timing for karaoke captions. Works for ANY voUrl (a remote
// Supabase URL or a local blob:), because the browser fetches the audio bytes
// itself and POSTs them as multipart to the admin-gated bbf-studio-transcribe fn
// (ElevenLabs Scribe). Returns { text, words: [{ text, start, end }] }; throws a
// display-ready Error on failure.
export async function transcribeCaptions(audioUrl, { lang } = {}) {
  if (!audioUrl) throw new Error('no_audio');
  const token = getStoredVaultToken();

  // Fetch the audio locally (uniform for blob: and remote URLs), then forward the
  // bytes — never a URL the server may not be able to reach (e.g. a local blob).
  let blob;
  try {
    const a = await fetch(audioUrl);
    if (!a.ok) throw new Error(`audio_fetch_${a.status}`);
    blob = await a.blob();
  } catch {
    throw new Error('audio_unreadable');
  }
  if (!blob || !blob.size) throw new Error('empty_audio');

  const form = new FormData();
  form.append('file', blob, 'voiceover');
  if (token) form.append('vault_token', token);
  if (lang) form.append('lang', lang);

  const res = await fetch(`${FUNCTIONS_BASE}/bbf-studio-transcribe`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(token ? { 'x-bbf-vault-token': token } : {}),
    },
    body: form, // multipart — do NOT set Content-Type; the browser sets the boundary
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok || !Array.isArray(j.words)) {
    throw new Error((j && (j.error || j.detail)) || `transcribe_failed_${res.status}`);
  }
  return { text: String(j.text || ''), words: j.words };
}
