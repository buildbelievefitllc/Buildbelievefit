// supabase/functions/bbf-studio-voiceover/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// FRONT 5 — SOVEREIGN STUDIO · LAZY-CACHING VOICEOVER PIPELINE
// ───────────────────────────────────────────────────────────────────────────
// CEO directive (API-margin protection): we NEVER pay to generate audio we
// already own. Every request is keyed by its (Exercise/Topic, TargetDuration,
// Series, vibe, lang) combo into a deterministic slug. The pipeline:
//
//   1. CACHE LOOKUP   — HEAD the slug's MP3 in the `studio-audio-vault` bucket.
//                       HIT  → return the public URL immediately (zero spend).
//   2. DYNAMIC GEN    — MISS → Claude writes a ~(2.5 words/sec × duration) script
//                       (routed via _shared/model-router · HAIKU tier), then
//                       ElevenLabs (Akeem clone) synthesizes it with <break> pads.
//   3. VAULT DEPOSIT  — upload the MP3 to the bucket under the slug and return the
//                       permanent public Storage URL for the V4 Studio frontend.
//
// ADMIN-ONLY: same perimeter as the rest of the Command Center — a valid admin
// vault/session token, or the server-to-server shared secret. No client secret.
// verify_jwt:false (the body/header carries the session token; we validate it).
//
// Secrets (Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY,
// ANTHROPIC_API_KEY, BBF_COACH_AGENT_TOKEN (optional server-to-server gate).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';

const FN = 'bbf-studio-voiceover';
const BUCKET = 'studio-audio-vault';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-bbf-session-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── BBF Coach Akeem clone (CEO-pinned voice) ────────────────────────────────
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const VOICE_MODEL = 'eleven_multilingual_v2'; // richest prosody — latency irrelevant for a batch render
const BASE_SETTINGS = { stability: 0.35, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true };

// Pacing economics: spoken delivery lands ≈2.5 words/sec, so the script length is
// derived from the target duration rather than guessed.
const WORDS_PER_SEC = 2.5;
const MIN_DURATION = 8;     // seconds — a usable hook floor
const MAX_DURATION = 180;   // seconds — keep one render under the ElevenLabs char cap
const MAX_SCRIPT_CHARS = 2400; // headroom under ElevenLabs' ~2500 cap incl. break tags
const PAD = '<break time="0.5s"/>'; // CEO-specified head/tail padding

// Vibe → voice physics (mirrors bbf-sovereign-studio's Vibe Matrix). Tunes the
// ElevenLabs settings AND the script's tone; the slug includes the vibe so two
// tones of the same exercise are cached independently.
type Vibe = 'the_mechanic' | 'real_talk' | 'the_sanctuary' | 'the_reframe' | 'the_architect';
const VIBES: Record<Vibe, { label: string; stability: number; style: number; tone: string }> = {
  the_mechanic:  { label: 'The Mechanic',  stability: 0.42, style: 0.12, tone: 'energized, sharp, technical floor-coach cues — drive the rep' },
  real_talk:     { label: 'Real Talk',     stability: 0.38, style: 0.16, tone: 'relaxed, conversational, across-the-table real talk' },
  the_sanctuary: { label: 'The Sanctuary', stability: 0.30, style: 0.08, tone: 'deep, slow, therapeutic — lower the cortisol' },
  the_reframe:   { label: 'The Reframe',   stability: 0.35, style: 0.28, tone: 'empathetic perspective-shift that builds' },
  the_architect: { label: 'The Architect', stability: 0.34, style: 0.22, tone: 'resonant storytelling — build the philosophy' },
};
function resolveVibe(input: unknown): Vibe {
  const v = String(input || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (v in VIBES) ? (v as Vibe) : 'the_architect';
}

// ── slug / hash ─────────────────────────────────────────────────────────────
function slugify(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Deterministic, human-readable cache key: readable prefix (vibe-series-topic-Ns)
// + a short hash of the FULL normalized input set (collision-safe). Same inputs →
// same slug → same vault object → cache hit.
async function buildSlug(parts: { vibe: string; series: string; topic: string; duration: number; lang: string }): Promise<string> {
  const readable = [slugify(parts.vibe), slugify(parts.series), slugify(parts.topic)]
    .filter(Boolean).join('-') || 'vo';
  const canonical = JSON.stringify({
    v: parts.vibe, s: parts.series.trim().toLowerCase(), t: parts.topic.trim().toLowerCase(),
    d: parts.duration, l: parts.lang, voice: AKEEM_VOICE_ID, m: VOICE_MODEL,
  });
  const hash = (await sha256Hex(canonical)).slice(0, 10);
  return `${readable}-${parts.duration}s-${hash}`;
}

// ── admin perimeter (vault/session token → god-mode role, or shared secret) ──
function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function uidFromToken(url: string, key: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/_bbf_uid_from_vault_token`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify({ p_session_token: token }) });
    if (!r.ok) return null;
    const v = await r.json().catch(() => null);
    return (typeof v === 'string' && v) ? v : (Array.isArray(v) && v.length ? String(v[0]) : null);
  } catch { return null; }
}
async function isGodModeUser(url: string, key: string, userId: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_users?id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&select=uid,role,access_status&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return false;
    const rows = await r.json().catch(() => null);
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u || String(u.access_status || '') === 'locked') return false;
    const role = String(u.role || '').toLowerCase();
    return role === 'admin' || role === 'trainer' || role === 'coach' || String(u.uid || '').toLowerCase() === 'akeem';
  } catch { return false; }
}
async function isAuthorized(req: Request, payload: any, url: string, key: string): Promise<boolean> {
  const shared = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  const adminHdr = req.headers.get('x-bbf-admin-token') || '';
  if (shared && adminHdr && adminHdr === shared) return true; // server-to-server
  const token = String(payload?.vault_token || req.headers.get('x-bbf-vault-token') || req.headers.get('x-bbf-session-token') || '').trim();
  if (!token) return false;
  const uid = await uidFromToken(url, key, token);
  if (!uid) return false;
  return isGodModeUser(url, key, uid);
}

// ── storage (service role) ──────────────────────────────────────────────────
function publicUrl(url: string, slug: string): string {
  return `${url}/storage/v1/object/public/${BUCKET}/${slug}.mp3`;
}
// CACHE LOOKUP — HEAD the public object. true ⇒ we already own this asset.
async function vaultHas(url: string, slug: string): Promise<boolean> {
  try {
    const r = await fetch(publicUrl(url, slug), { method: 'HEAD' });
    return r.ok;
  } catch { return false; }
}
// Idempotent: create the public bucket if it doesn't exist (ignore "already exists").
async function ensureBucket(url: string, key: string): Promise<void> {
  try {
    const r = await fetch(`${url}/storage/v1/bucket`, {
      method: 'POST', headers: pgHeaders(key),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
    if (!r.ok && r.status !== 409) {
      const t = (await r.text().catch(() => '')).toLowerCase();
      if (!t.includes('already exists') && !t.includes('duplicate')) {
        console.warn(`[${FN}] ensureBucket status=${r.status}: ${t.slice(0, 160)}`);
      }
    }
  } catch (e) { console.warn(`[${FN}] ensureBucket error:`, String((e as Error)?.message ?? e)); }
}
// VAULT DEPOSIT — upload the MP3 under the slug (upsert so a re-render overwrites).
async function vaultPut(url: string, key: string, slug: string, buf: ArrayBuffer): Promise<boolean> {
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${slug}.mp3`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: buf,
  });
  if (!r.ok) { console.error(`[${FN}] vaultPut ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`); return false; }
  return true;
}

// ── dynamic generation ──────────────────────────────────────────────────────
// Claude writes the spoken VO script, length-targeted to the duration.
async function writeScript(apiKey: string, model: string, opts: { topic: string; series: string; words: number; tone: string; lang: string }): Promise<{ ok: true; text: string; usage: any } | { ok: false; status: number; detail: string }> {
  const langName = ({ en: 'English', es: 'Spanish', pt: 'Portuguese' } as Record<string, string>)[opts.lang] || 'English';
  const seriesLine = opts.series ? ` It is part of the "${opts.series}" series.` : '';
  const sys = `You are BBF Coach Akeem, the voice of Build Believe Fit — a universal human-optimization fitness platform. Write a single, spoken-word voiceover script for a short vertical reel. Brand voice: ${opts.tone}. Strict rules: (1) Write ONLY the words to be spoken — no stage directions, no labels, no markdown, no quotes. (2) Write in ${langName}. (3) Target approximately ${opts.words} words (±10%) so it lands near the intended runtime when spoken. (4) Be specific and motivating about the topic; cue real coaching, not fluff. (5) No emojis, no hashtags, no SSML tags.`;
  const user = `Topic / exercise: ${opts.topic}.${seriesLine} Write the ~${opts.words}-word voiceover now.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(1500, Math.ceil(opts.words * 3) + 200),
      system: sys,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    return { ok: false, status: res.status, detail: String(detail).slice(0, 200) };
  }
  const block = Array.isArray(body?.content) ? body.content.find((b: any) => b?.type === 'text' && typeof b.text === 'string') : null;
  const text = (block?.text || '').trim();
  if (!text) return { ok: false, status: 502, detail: 'empty_script' };
  return { ok: true, text, usage: body?.usage ?? null };
}

// Wrap the spoken script in the CEO-specified <break time="0.5s"/> head/tail
// padding (and light sentence-level pauses for the slow Sanctuary tone).
function buildSsml(raw: string, vibe: Vibe): string {
  let out = String(raw ?? '').trim();
  if (!out) return out;
  if (vibe === 'the_sanctuary' && !/<break\s/i.test(out)) {
    out = out.replace(/([.?])\s+(?=[A-Z0-9"'¿¡])/g, '$1 <break time="0.8s"/> ');
  } else {
    out = out.replace(/!+/g, '.'); // exclamation marks spike synth volume
  }
  out = out.replace(/[ \t]{2,}/g, ' ').trim();
  return `${PAD} ${out} ${PAD}`;
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

// ── handler ─────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'backend_unconfigured', detail: 'Storage/identity not configured.' }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  if (!(await isAuthorized(req, payload, SUPABASE_URL, SERVICE_KEY))) {
    return jsonResponse({ error: 'not_admin', detail: 'The Sovereign Studio voiceover vault is restricted to the administrative tier.' }, 401);
  }

  // ── inputs ──
  const topic = String(payload?.topic ?? payload?.exercise ?? '').trim();
  if (!topic) return jsonResponse({ error: 'missing_topic', detail: 'Provide an Exercise/Topic.' }, 400);
  const series = String(payload?.series ?? '').trim();
  const vibe = resolveVibe(payload?.vibe);
  const lang = (['en', 'es', 'pt'].includes(String(payload?.lang || 'en'))) ? String(payload?.lang || 'en') : 'en';
  const rawDur = Number(payload?.target_duration ?? payload?.targetDuration ?? payload?.duration);
  if (!Number.isFinite(rawDur)) return jsonResponse({ error: 'missing_duration', detail: 'Provide TargetDuration in seconds.' }, 400);
  const duration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(rawDur)));
  const force = payload?.force === true; // bypass the cache (re-render)

  // ── 1 · CACHE LOOKUP ──
  const slug = await buildSlug({ vibe, series, topic, duration, lang });
  if (!force && (await vaultHas(SUPABASE_URL, slug))) {
    console.log(`[${FN}] cache HIT slug=${slug}`);
    return jsonResponse({ ok: true, cached: true, slug, url: publicUrl(SUPABASE_URL, slug), vibe, duration });
  }
  console.log(`[${FN}] cache MISS slug=${slug} — generating`);

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'llm_unconfigured', detail: 'ANTHROPIC_API_KEY is not set.' }, 503);

  // ── 2 · DYNAMIC GENERATION (cache miss) ──
  const words = Math.max(8, Math.round(duration * WORDS_PER_SEC));
  const model = routeAndLog(FN, 'studio_voiceover_script');
  const spec = VIBES[vibe];

  const scripted = await writeScript(ANTHROPIC_API_KEY, model, { topic, series, words, tone: spec.tone, lang });
  if (!scripted.ok) {
    console.error(`[${FN}] script gen failed ${scripted.status}: ${scripted.detail}`);
    return jsonResponse({ error: 'script_failed', detail: `Claude could not write the script (${scripted.status}).` }, 502);
  }
  let script = scripted.text;
  if (script.length > MAX_SCRIPT_CHARS) script = script.slice(0, MAX_SCRIPT_CHARS);

  const ssml = buildSsml(script, vibe);
  const settings = { ...BASE_SETTINGS, stability: spec.stability, style: spec.style };
  const tts = await synthesize(ELEVENLABS_API_KEY, ssml, settings);
  if (!tts.ok) {
    console.error(`[${FN}] tts failed ${tts.status}: ${tts.detail}`);
    return jsonResponse({ error: 'tts_failed', detail: `ElevenLabs returned ${tts.status}.`, eleven_status: tts.status }, 502);
  }

  // ── 3 · VAULT DEPOSIT ──
  await ensureBucket(SUPABASE_URL, SERVICE_KEY);
  const stored = await vaultPut(SUPABASE_URL, SERVICE_KEY, slug, tts.buf);
  if (!stored) {
    return jsonResponse({ error: 'vault_write_failed', detail: 'Synthesis succeeded but the audio could not be cached.' }, 502);
  }

  console.log(`[${FN}] STORED slug=${slug} model=${model} words=${words} script_chars=${script.length} billed_chars=${ssml.length} bytes=${tts.buf.byteLength}`);
  return jsonResponse({
    ok: true,
    cached: false,
    slug,
    url: publicUrl(SUPABASE_URL, slug),
    vibe,
    duration,
    model,
    usage: {
      words_target: words,
      script_chars: script.length,
      billed_chars: ssml.length,
      audio_bytes: tts.buf.byteLength,
      llm: scripted.usage,
    },
  });
});
