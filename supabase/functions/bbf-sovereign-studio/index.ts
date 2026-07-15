// supabase/functions/bbf-sovereign-studio/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// FRONT 5 — SOVEREIGN STUDIO · Creator voiceover webhook (ElevenLabs proxy).
// ───────────────────────────────────────────────────────────────────────────
// The CEO's private content studio: mass-produce social VO, local pitches, and
// Mindset tracks in the BBF Coach Akeem clone. Takes the EXACT script (spoken
// verbatim — no Claude rewrite) + a Vibe, applies the BBF Lab Voice Engine physics
// for that vibe, wraps the script in SSML <break> tags at the head and tail for
// natural pacing, synthesizes via ElevenLabs, and returns audio/mpeg the studio UI
// previews and downloads.
//
// VIBE MATRIX (5) → BBF Lab vocal states (CLAUDE.md §4 / _shared/bbf-voice-engine):
//   the_mechanic  → Floor Coach   (energized, sharp, technical)
//   real_talk     → Lounge Talk   (relaxed, conversational real-talk)
//   the_sanctuary → Sanctuary     (deep, slow, therapeutic — SSML breaks)
//   the_reframe   → Reframe       (empathetic perspective-shift, building)
//   the_architect → Architect     (resonant storytelling, passionate)
//
// ADMIN-ONLY: gated on the caller's vault session token + a server-side god-mode
// role check (role admin/coach/trainer, or uid 'akeem') — the SAME perimeter the
// rest of the Command Center uses. No client secret. verify_jwt:false (the body
// carries the vault token; we validate it ourselves).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── BBF Coach Akeem PVC + voice physics (CLAUDE.md §4) ──────────────────────
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const AKEEM_VOICE_NAME = 'BBF Coach Akeem';
// For produced studio content the richest-prosody model wins on every vibe —
// latency is irrelevant for a batch render, so we never drop to turbo here.
const VOICE_MODEL = 'eleven_multilingual_v2';
const BASE_SETTINGS = { stability: 0.35, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true };
const MAX_SCRIPT_CHARS = 2400; // leave headroom under ElevenLabs' ~2500 cap for the break tags

type Vibe = 'the_mechanic' | 'real_talk' | 'the_sanctuary' | 'the_reframe' | 'the_architect';
type VibeSpec = {
  label: string;
  state: 'floor_coach' | 'lounge_talk' | 'sanctuary' | 'reframe' | 'architect';
  stability: number;
  style: number;
  lead: number; // SSML lead-in break (seconds)
  tail: number; // SSML lead-out break (seconds)
};
const VIBES: Record<Vibe, VibeSpec> = {
  the_mechanic:  { label: 'The Mechanic',  state: 'floor_coach', stability: 0.42, style: 0.12, lead: 0.3, tail: 0.5 },
  real_talk:     { label: 'Real Talk',     state: 'lounge_talk', stability: 0.38, style: 0.16, lead: 0.4, tail: 0.6 },
  the_sanctuary: { label: 'The Sanctuary', state: 'sanctuary',   stability: 0.30, style: 0.08, lead: 0.8, tail: 1.0 },
  the_reframe:   { label: 'The Reframe',   state: 'reframe',     stability: 0.35, style: 0.28, lead: 0.5, tail: 0.7 },
  the_architect: { label: 'The Architect', state: 'architect',   stability: 0.34, style: 0.22, lead: 0.5, tail: 0.8 },
};
function resolveVibe(input: unknown): Vibe {
  const v = String(input || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (v in VIBES) ? (v as Vibe) : 'the_architect';
}

// Format the verbatim script for its vibe (mirrors the voice engine's formatForState):
//   • Sanctuary → guarantee <break> pauses exist (inject 2.0s at sentence ends if the
//     CEO didn't author any), clamp any oversized break to 3.0s, never strip breaks.
//   • Every other vibe → strip exclamation marks (they spike synthesis volume); the
//     emphasis comes from punctuation / ellipses, not volume.
// Then wrap the whole thing in a lead-in + lead-out <break> for natural pacing.
function buildSsml(raw: string, spec: VibeSpec): string {
  let out = String(raw ?? '').trim();
  if (!out) return out;
  if (spec.state === 'sanctuary') {
    out = out.replace(/<break\s+time="(\d+(?:\.\d+)?)s"\s*\/>/gi, (_m, s) => {
      const t = Math.min(3.0, Math.max(0.3, Number(s) || 2.0));
      return `<break time="${t}s"/>`;
    });
    if (!/<break\s/i.test(out)) {
      out = out.replace(/([.?])\s+(?=[A-Z0-9"'¿¡])/g, '$1 <break time="2.0s"/> ');
    }
  } else {
    out = out.replace(/!+/g, '.');
  }
  out = out.replace(/[ \t]{2,}/g, ' ').trim();
  // Item 4 — head + tail SSML pacing breaks, vibe-tuned.
  return `<break time="${spec.lead}s"/> ${out} <break time="${spec.tail}s"/>`;
}

// ── Admin perimeter (vault token → god-mode role check) ─────────────────────
function pgHeaders(serviceKey: string): HeadersInit {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
}
async function uidFromVaultToken(url: string, key: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/_bbf_uid_from_vault_token`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify({ p_session_token: token }) });
    if (!r.ok) return null;
    const v = await r.json().catch(() => null);
    // The RPC may answer as a bare string OR a single-element array depending on
    // the PostgREST return shape — handle both (parity with every sibling studio
    // function; the string-only form could reject valid admin sessions).
    if (typeof v === 'string' && v) return v;
    if (Array.isArray(v) && v.length && v[0]) return String(v[0]);
    return null;
  } catch { return null; }
}
async function readUserRow(url: string, key: string, userId: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_users?id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&select=uid,access_status,role&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}
function isGodMode(role: string | null, uid: string | null): boolean {
  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'trainer' || r === 'coach') return true;
  return String(uid || '').toLowerCase() === 'akeem';
}
type Gate = { ok: true } | { ok: false; status: number; error: string; detail: string };
async function requireAdmin(url: string | undefined, key: string | undefined, token: string | null | undefined): Promise<Gate> {
  const tok = String(token || '').trim();
  if (!url || !key) return { ok: false, status: 503, error: 'admin_check_unavailable', detail: 'Identity store unreachable.' };
  if (!tok) return { ok: false, status: 401, error: 'missing_session', detail: 'A vault session token is required.' };
  const userId = await uidFromVaultToken(url, key, tok);
  if (!userId) return { ok: false, status: 401, error: 'invalid_session', detail: 'Vault session is invalid or expired.' };
  const row = await readUserRow(url, key, userId);
  if (!row) return { ok: false, status: 401, error: 'invalid_session', detail: 'No active account for this session.' };
  if (String(row.access_status || '') === 'locked') return { ok: false, status: 403, error: 'account_locked', detail: 'This account is locked.' };
  if (!isGodMode((row.role ?? null) as string | null, (row.uid ?? null) as string | null)) {
    return { ok: false, status: 403, error: 'not_admin', detail: 'The Sovereign Studio is restricted to the administrative tier.' };
  }
  return { ok: true };
}

async function synthesize(apiKey: string, text: string, settings: Record<string, unknown>): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(AKEEM_VOICE_ID)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: VOICE_MODEL, voice_settings: settings }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 200) };
    return { ok: true, buf: await res.arrayBuffer() };
  } catch (e) {
    const err = e as Error;
    return { ok: false, status: 0, detail: err.name === 'AbortError' ? 'timeout_30000ms' : err.message };
  } finally { clearTimeout(timeout); }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // GET ?vibes=1 → the Vibe Matrix the studio UI renders (no auth — just the menu).
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('vibes') === '1') {
      return jsonResponse({ ok: true, vibes: Object.entries(VIBES).map(([id, v]) => ({ id, label: v.label, state: v.state })) });
    }
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  // Admin gate (vault token → god-mode role).
  const gate = await requireAdmin(SUPABASE_URL, SERVICE_KEY, payload?.vault_token ?? req.headers.get('x-bbf-vault-token'));
  if (!gate.ok) return jsonResponse({ error: gate.error, detail: gate.detail }, gate.status);

  const rawScript = String(payload?.script ?? '').trim();
  if (!rawScript) return jsonResponse({ error: 'missing_script', detail: 'Provide a script to voice.' }, 400);
  if (rawScript.length > MAX_SCRIPT_CHARS) {
    return jsonResponse({ error: 'script_too_long', detail: `Max ${MAX_SCRIPT_CHARS} characters; received ${rawScript.length}.` }, 400);
  }
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);

  const vibe = resolveVibe(payload?.vibe);
  const spec = VIBES[vibe];
  const ssml = buildSsml(rawScript, spec);
  const settings = { ...BASE_SETTINGS, stability: spec.stability, style: spec.style };

  // Advanced Voice Tuning overrides (0.0–1.0). The studio console sends these ONLY
  // when the admin manually deviates from the vibe baseline; absent → the vibe
  // defaults stand (identical to the pre-tuning behavior, so the clean cached
  // baseline routes are untouched). Clamp to ElevenLabs' valid [0,1] range so a bad
  // client value can never 4xx/502 the synthesis.
  const clamp01 = (n: unknown): number | null => {
    const x = Number(n);
    return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : null;
  };
  const ovStability = clamp01(payload?.stability);
  const ovSimilarity = clamp01(payload?.similarity_boost);
  const ovStyle = clamp01(payload?.style);
  if (ovStability != null) settings.stability = ovStability;
  if (ovSimilarity != null) settings.similarity_boost = ovSimilarity;
  if (ovStyle != null) settings.style = ovStyle;
  const tuned = ovStability != null || ovSimilarity != null || ovStyle != null;

  const tts = await synthesize(ELEVENLABS_API_KEY, ssml, settings);
  if (!tts.ok) {
    console.error(`[bbf-sovereign-studio] tts ${tts.status}: ${tts.detail}`);
    return jsonResponse({ error: 'tts_failed', detail: `ElevenLabs returned ${tts.status}.`, eleven_status: tts.status }, 502);
  }

  console.log(`[bbf-sovereign-studio] vibe=${vibe} tuned=${tuned} stability=${settings.stability} similarity=${settings.similarity_boost} style=${settings.style} raw_chars=${rawScript.length} billed_chars=${ssml.length} bytes=${tts.buf.byteLength}`);
  return new Response(tts.buf, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=0, no-store',
      'X-BBF-Voice': AKEEM_VOICE_NAME,
      'X-BBF-Vibe': vibe,
      'X-BBF-State': spec.state,
      'X-BBF-Tuned': String(tuned),
      'X-BBF-Raw-Chars': String(rawScript.length),
      'X-BBF-Billed-Chars': String(ssml.length),
    },
  });
});
