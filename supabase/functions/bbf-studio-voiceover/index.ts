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

// ── AI-VOICE CAPTIONS (free, at generation time) ────────────────────────────
// ElevenLabs' /with-timestamps endpoint returns per-character start/end times
// ALONGSIDE the audio, at zero extra cost. We fold those characters into spoken
// words so the Studio can bake karaoke captions with NO separate transcription
// pass. The word timings are cached next to the MP3 as `{slug}.words.json`.
type Word = { text: string; start: number; end: number };

// Decode ElevenLabs' base64 MP3 payload (the /with-timestamps endpoint returns
// JSON with the audio inlined, not a raw audio body).
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Fold the character-level alignment into spoken words. Any SSML tag (`<break …/>`
// and the head/tail PADs) is skipped so captions show clean words only — and the
// pause it creates is naturally reflected in the NEXT word's start time. Robust
// whether ElevenLabs keeps or strips the tag characters from the alignment.
function wordsFromAlignment(alignment: any): Word[] {
  const chars: unknown = alignment?.characters;
  const starts: unknown = alignment?.character_start_times_seconds;
  const ends: unknown = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends) || !chars.length) return [];
  const words: Word[] = [];
  let cur = '', curStart = -1, curEnd = -1, inTag = false;
  const flush = () => {
    if (cur && curStart >= 0 && Number.isFinite(curStart) && Number.isFinite(curEnd)) {
      words.push({ text: cur, start: +curStart.toFixed(3), end: +Math.max(curEnd, curStart).toFixed(3) });
    }
    cur = ''; curStart = -1; curEnd = -1;
  };
  for (let i = 0; i < chars.length; i++) {
    const c = String(chars[i] ?? '');
    if (inTag) { if (c === '>') inTag = false; continue; }
    if (c === '<') { flush(); inTag = true; continue; }
    if (/\s/.test(c) || c === '') { flush(); continue; }
    if (cur === '') curStart = Number(starts[i]);
    cur += c;
    curEnd = Number(ends[i]);
  }
  flush();
  return words;
}

// Native fine-tuning overrides — the Advanced Voice Tuning sliders send 0–100%
// UI values (or, defensively, already-normalized 0.0–1.0). Normalize to the
// ElevenLabs 0.0–1.0 scale and clamp; null ⇒ "no override sent, use the vibe
// baseline". A value >1 is treated as a percentage (÷100); ≤1 is taken verbatim.
function normSetting(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const norm = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, norm));
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
// `tuning` is a stable fingerprint of any custom voice_settings override. It is
// folded into the cache key ONLY when overrides are present, so a fine-tuned
// render caches independently of the vibe-baseline render (same topic, different
// physics → different audio → different object). Baseline renders keep their
// historical slug untouched (backward-compatible cache hits).
async function buildSlug(parts: { vibe: string; series: string; topic: string; duration: number; lang: string; tuning?: string }): Promise<string> {
  const readable = [slugify(parts.vibe), slugify(parts.series), slugify(parts.topic)]
    .filter(Boolean).join('-') || 'vo';
  const canonical = JSON.stringify({
    v: parts.vibe, s: parts.series.trim().toLowerCase(), t: parts.topic.trim().toLowerCase(),
    d: parts.duration, l: parts.lang, voice: AKEEM_VOICE_ID, m: VOICE_MODEL,
    ...(parts.tuning ? { tune: parts.tuning } : {}),
  });
  const hash = (await sha256Hex(canonical)).slice(0, 10);
  const marker = parts.tuning ? 'x-' : ''; // human-visible flag that this is a tuned render
  return `${readable}-${marker}${parts.duration}s-${hash}`;
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

// The word-timing packet lives right next to the audio: `{slug}.words.json`.
function wordsPublicUrl(url: string, slug: string): string {
  return `${url}/storage/v1/object/public/${BUCKET}/${slug}.words.json`;
}
// On a cache HIT, fetch the caption packet if this asset has one (legacy audio
// generated before captions won't — that's fine, the client falls back to Scribe).
async function vaultGetWords(url: string, slug: string): Promise<Word[] | null> {
  try {
    const r = await fetch(wordsPublicUrl(url, slug));
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (j && Array.isArray(j.words)) return j.words as Word[];
    return Array.isArray(j) ? (j as Word[]) : null;
  } catch { return null; }
}
// VAULT DEPOSIT — store the caption packet as JSON alongside the MP3 (upsert).
async function vaultPutWords(url: string, key: string, slug: string, words: Word[]): Promise<boolean> {
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${slug}.words.json`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: JSON.stringify({ words }),
  });
  if (!r.ok) { console.warn(`[${FN}] vaultPutWords ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`); return false; }
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

// FRONT 5 · Hook auto-gen — Haiku writes a punchy reel HOOK + sub-line for an
// exercise/topic. Returns { hook, sub } (1-line each). Low-stakes copy → HAIKU.
async function writeHook(apiKey: string, model: string, opts: { topic: string; spectrum: string; lang: string }): Promise<{ ok: true; hook: string; sub: string; usage: any } | { ok: false; status: number; detail: string }> {
  const langName = ({ en: 'English', es: 'Spanish', pt: 'Portuguese' } as Record<string, string>)[opts.lang] || 'English';
  const spec = opts.spectrum ? ` Spectrum/theme: ${opts.spectrum}.` : '';
  const sys = `You are BBF Coach Akeem writing scroll-stopping hooks for a Build Believe Fit training reel. Output STRICT JSON only: {"hook":"...","sub":"..."}. Rules: write in ${langName}; "hook" is a punchy 2-4 word ALL-CAPS headline (may use a newline); "sub" is one short supporting sentence (≤90 chars). No markdown, no extra keys, no commentary.`;
  const user = `Exercise / topic: ${opts.topic}.${spec} Write the hook + sub now as JSON.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 300, system: sys, messages: [{ role: 'user', content: user }] }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    return { ok: false, status: res.status, detail: String(detail).slice(0, 200) };
  }
  const block = Array.isArray(body?.content) ? body.content.find((b: any) => b?.type === 'text' && typeof b.text === 'string') : null;
  const text = (block?.text || '').trim();
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    const hook = String(parsed.hook || '').trim();
    const sub = String(parsed.sub || '').trim();
    if (!hook) return { ok: false, status: 502, detail: 'empty_hook' };
    return { ok: true, hook, sub, usage: body?.usage ?? null };
  } catch {
    return { ok: false, status: 502, detail: 'hook_parse_failed' };
  }
}

// 🏆 CLIENT SPOTLIGHT auto-gen — Haiku writes the gold shoutout + the two quote
// lines (proof + coach) for a client win, trilingual. Low-stakes copy -> HAIKU.
async function writeSpotlight(apiKey: string, model: string, opts: { clientName: string; achievement: string; lang: string }): Promise<{ ok: true; shoutout: string; quote1: string; quote2: string; usage: any } | { ok: false; status: number; detail: string }> {
  const langName = ({ en: 'English', es: 'Spanish', pt: 'Portuguese' } as Record<string, string>)[opts.lang] || 'English';
  const ach = opts.achievement ? ` Achievement / context: ${opts.achievement}.` : ' Context: consistent training and a real transformation.';
  const sys = `You are BBF Coach Akeem writing a CLIENT SPOTLIGHT for a Build Believe Fit social post celebrating ${opts.clientName}. Output STRICT JSON only: {"shoutout":"...","quote1":"...","quote2":"..."}. Rules: write in ${langName}; "shoutout" is a punchy ALL-CAPS gold headline celebrating the client (<= 42 chars, may end with a period); "quote1" is a proof / identity line about their consistency or transformation (<= 90 chars); "quote2" is a warm first-person coach shoutout (<= 80 chars). No markdown, no extra keys, no hashtags, no emojis, no quotes around the whole line.`;
  const user = `Client: ${opts.clientName}.${ach} Write the spotlight now as JSON.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 400, system: sys, messages: [{ role: 'user', content: user }] }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    return { ok: false, status: res.status, detail: String(detail).slice(0, 200) };
  }
  const block = Array.isArray(body?.content) ? body.content.find((b: any) => b?.type === 'text' && typeof b.text === 'string') : null;
  const text = (block?.text || '').trim();
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    const shoutout = String(parsed.shoutout || '').trim();
    const quote1 = String(parsed.quote1 || '').trim();
    const quote2 = String(parsed.quote2 || '').trim();
    if (!shoutout) return { ok: false, status: 502, detail: 'empty_spotlight' };
    return { ok: true, shoutout, quote1, quote2, usage: body?.usage ?? null };
  } catch {
    return { ok: false, status: 502, detail: 'spotlight_parse_failed' };
  }
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

// 120s synthesis budget: a 180s Masterclass script (~450 words) routinely takes
// ElevenLabs >30s to synthesize, so the old 30s abort made long durations fail
// spuriously (`timeout_30000ms` → tts_failed 502 on a perfectly valid request).
// Edge functions allow up to ~150s wall clock — 120s leaves headroom for the
// storage upload after synthesis.
const SYNTH_TIMEOUT_MS = 120_000;

async function synthesize(apiKey: string, text: string, settings: Record<string, unknown>): Promise<{ ok: true; buf: ArrayBuffer; words: Word[] } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS);
  try {
    // MAX-QUALITY AUDIO VALVE: mp3_44100_192 — 44.1 kHz / 192 kbps, ElevenLabs'
    // top MP3 rung (Creator tier+, which the Akeem PVC already requires). NOT
    // pcm_16000: that is a 16 kHz sample rate (below this 44.1 kHz — thinner, not
    // richer) and would break the .mp3 / audio/mpeg container the vault + the video
    // export (SovereignFoundry) decode from. 192 kbps MP3 is the lossless-practical
    // ceiling that keeps the pipeline intact.
    //
    // /with-timestamps: same audio, same cost, but the response also carries the
    // character-level alignment we fold into free kinetic captions (Option 3). It
    // returns JSON { audio_base64, alignment } instead of a raw audio body.
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(AKEEM_VOICE_ID)}/with-timestamps?output_format=mp3_44100_192`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ text, model_id: VOICE_MODEL, voice_settings: settings }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 200) };
    const data = await res.json().catch(() => null);
    const b64 = data?.audio_base64;
    if (!b64 || typeof b64 !== 'string') return { ok: false, status: 502, detail: 'no_audio_base64' };
    const words = wordsFromAlignment(data?.alignment);
    return { ok: true, buf: b64ToBytes(b64).buffer, words };
  } catch (e) {
    const err = e as Error;
    return { ok: false, status: 0, detail: err.name === 'AbortError' ? `timeout_${SYNTH_TIMEOUT_MS}ms` : err.message };
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

  const lang = (['en', 'es', 'pt'].includes(String(payload?.lang || 'en'))) ? String(payload?.lang || 'en') : 'en';

  // ── 🏆 CLIENT SPOTLIGHT AUTO-GEN (text only, no audio/cache) ──
  if (payload?.action === 'spotlight') {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'llm_unconfigured', detail: 'ANTHROPIC_API_KEY is not set.' }, 503);
    const clientName = String(payload?.client_name ?? payload?.clientName ?? '').trim();
    if (!clientName) return jsonResponse({ error: 'missing_client', detail: 'Provide a client name.' }, 400);
    const achievement = String(payload?.achievement ?? '').trim();
    const spotModel = routeAndLog(FN, 'studio_voiceover_script');
    const s = await writeSpotlight(ANTHROPIC_API_KEY, spotModel, { clientName, achievement, lang });
    if (!s.ok) {
      console.error(`[${FN}] spotlight gen failed ${s.status}: ${s.detail}`);
      return jsonResponse({ error: 'spotlight_failed', detail: `Spotlight engine failed (${s.status}).` }, 502);
    }
    return jsonResponse({ ok: true, shoutout: s.shoutout, quote1: s.quote1, quote2: s.quote2, model: spotModel, usage: s.usage });
  }

  // ── inputs ──
  const topic = String(payload?.topic ?? payload?.exercise ?? '').trim();
  if (!topic) return jsonResponse({ error: 'missing_topic', detail: 'Provide an Exercise/Topic.' }, 400);
  const series = String(payload?.series ?? '').trim();
  const vibe = resolveVibe(payload?.vibe);

  // ── HOOK AUTO-GEN (text only, no audio/cache) ──
  if (payload?.action === 'hook' || payload?.mode === 'hook') {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'llm_unconfigured', detail: 'ANTHROPIC_API_KEY is not set.' }, 503);
    const hookModel = routeAndLog(FN, 'studio_voiceover_script');
    const spectrum = String(payload?.spectrum ?? '').trim();
    const h = await writeHook(ANTHROPIC_API_KEY, hookModel, { topic, spectrum, lang });
    if (!h.ok) {
      console.error(`[${FN}] hook gen failed ${h.status}: ${h.detail}`);
      return jsonResponse({ error: 'hook_failed', detail: `Hook engine failed (${h.status}).` }, 502);
    }
    return jsonResponse({ ok: true, hook: h.hook, sub: h.sub, model: hookModel, usage: h.usage });
  }
  // Accept a number (30) or a suffixed string ("60s") for the duration.
  const rawDur = parseFloat(String(payload?.target_duration ?? payload?.targetDuration ?? payload?.duration ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(rawDur) || rawDur <= 0) return jsonResponse({ error: 'missing_duration', detail: 'Provide TargetDuration in seconds (e.g. 60 or "60s").' }, 400);
  const duration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(rawDur)));
  const force = payload?.force === true; // bypass the cache (re-render)
  // Optional pre-written script — when present we skip the LLM entirely and voice
  // this EXACT text (batch vault seeding). Empty/absent → fall back to LLM gen.
  const providedScript = typeof payload?.provided_script === 'string' ? payload.provided_script.trim() : '';

  // ── CUSTOM VOICE PHYSICS (Advanced Voice Tuning sliders) ──
  // Parse the optional per-render overrides. When present they replace the vibe's
  // baseline for that ElevenLabs axis; when absent (null) the baseline stands.
  const spec = VIBES[vibe];
  const customStability = normSetting(payload?.stability);
  const customSimilarity = normSetting(payload?.similarity_boost ?? payload?.similarity ?? payload?.clarity);
  const customStyle = normSetting(payload?.style ?? payload?.style_exaggeration);
  const hasCustom = customStability !== null || customSimilarity !== null || customStyle !== null;
  const settings = {
    ...BASE_SETTINGS,
    stability: customStability ?? spec.stability,
    similarity_boost: customSimilarity ?? BASE_SETTINGS.similarity_boost,
    style: customStyle ?? spec.style,
  };
  // Fingerprint only the effective settings when an override is live — keeps
  // baseline renders on their historical (untuned) cache key.
  const tuning = hasCustom
    ? `st${Math.round(settings.stability * 100)}-si${Math.round(settings.similarity_boost * 100)}-sy${Math.round(settings.style * 100)}`
    : undefined;

  // ── 1 · CACHE LOOKUP ──
  const slug = await buildSlug({ vibe, series, topic, duration, lang, tuning });
  if (!force && (await vaultHas(SUPABASE_URL, slug))) {
    const words = await vaultGetWords(SUPABASE_URL, slug);
    console.log(`[${FN}] cache HIT slug=${slug} words=${words ? words.length : 'none'} tuned=${hasCustom}`);
    return jsonResponse({ ok: true, cached: true, slug, url: publicUrl(SUPABASE_URL, slug), vibe, duration, words, tuned: hasCustom });
  }
  console.log(`[${FN}] cache MISS slug=${slug} — generating`);

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);

  // ── 2 · SCRIPT (provided verbatim, or LLM-generated on miss) ──
  const words = Math.max(8, Math.round(duration * WORDS_PER_SEC));
  let script: string;
  let model: string | null = null;   // null when we voice a provided script (no LLM)
  let llmUsage: unknown = null;
  let source: 'provided_script' | 'llm';

  if (providedScript) {
    // Pre-written script → skip the Anthropic/Haiku call entirely.
    script = providedScript;
    source = 'provided_script';
    console.log(`[${FN}] using provided_script (${script.length} chars) — LLM skipped`);
  } else {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'llm_unconfigured', detail: 'ANTHROPIC_API_KEY is not set.' }, 503);
    model = routeAndLog(FN, 'studio_voiceover_script');
    const scripted = await writeScript(ANTHROPIC_API_KEY, model, { topic, series, words, tone: spec.tone, lang });
    if (!scripted.ok) {
      console.error(`[${FN}] script gen failed ${scripted.status}: ${scripted.detail}`);
      return jsonResponse({ error: 'script_failed', detail: `Claude could not write the script (${scripted.status}).` }, 502);
    }
    script = scripted.text;
    llmUsage = scripted.usage;
    source = 'llm';
  }
  if (script.length > MAX_SCRIPT_CHARS) script = script.slice(0, MAX_SCRIPT_CHARS);

  const ssml = buildSsml(script, vibe);
  const tts = await synthesize(ELEVENLABS_API_KEY, ssml, settings);
  if (!tts.ok) {
    console.error(`[${FN}] tts failed ${tts.status}: ${tts.detail}`);
    return jsonResponse({ error: 'tts_failed', detail: `ElevenLabs returned ${tts.status}.`, eleven_status: tts.status }, 502);
  }

  // ── 3 · VAULT DEPOSIT (audio + free caption packet) ──
  await ensureBucket(SUPABASE_URL, SERVICE_KEY);
  const stored = await vaultPut(SUPABASE_URL, SERVICE_KEY, slug, tts.buf);
  if (!stored) {
    return jsonResponse({ error: 'vault_write_failed', detail: 'Synthesis succeeded but the audio could not be cached.' }, 502);
  }
  // Persist the kinetic-caption timings next to the audio (best-effort — the audio
  // is the load-bearing asset; a missed words.json just falls back to Scribe).
  const captionWords = tts.words || [];
  if (captionWords.length) await vaultPutWords(SUPABASE_URL, SERVICE_KEY, slug, captionWords);

  console.log(`[${FN}] STORED slug=${slug} source=${source} model=${model ?? 'none'} words=${words} caption_words=${captionWords.length} script_chars=${script.length} billed_chars=${ssml.length} bytes=${tts.buf.byteLength} tuned=${hasCustom} settings=st${settings.stability},si${settings.similarity_boost},sy${settings.style}`);
  return jsonResponse({
    ok: true,
    cached: false,
    slug,
    url: publicUrl(SUPABASE_URL, slug),
    vibe,
    duration,
    source,
    model,
    words: captionWords.length ? captionWords : null,
    tuned: hasCustom,
    voice_settings: { stability: settings.stability, similarity_boost: settings.similarity_boost, style: settings.style },
    usage: {
      words_target: words,
      script_chars: script.length,
      billed_chars: ssml.length,
      audio_bytes: tts.buf.byteLength,
      caption_words: captionWords.length,
      llm: llmUsage,
    },
  });
});
