// supabase/functions/bbf-intake-voice/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// VOICE INTAKE — PUBLIC, ALLOWLISTED AKEEM-VOICE PROMPT VAULT
// ───────────────────────────────────────────────────────────────────────────
// Powers the live conversational intake (/assessment): Coach Akeem's ElevenLabs
// clone speaks the fixed intake questions to a top-of-funnel visitor, one line
// at a time. Unlike bbf-studio-voiceover (admin-only, dynamic LLM scripts), this
// function is PUBLIC (verify_jwt:false) but hard-locked to a SERVER-SIDE
// ALLOWLIST of the exact intake lines. A visitor can only ever trigger synthesis
// of one of these ~5 known lines × 3 languages — never arbitrary text — so there
// is no way to weaponize it into an ElevenLabs billing sink.
//
// LAZY CACHE (same economics as the Studio vault): every (key, lang) maps to a
// deterministic slug in the PUBLIC `studio-audio-vault` bucket. First request for
// a line synthesizes it with Akeem's voice and deposits the MP3; every request
// after is a zero-spend cache hit returning the permanent public URL. A content
// hash in the slug means editing a line's copy re-bakes automatically.
//
// Response: { ok, url, text, cached }. The `text` is the authoritative spoken
// copy — the frontend renders it verbatim in the live transcript, so audio and
// on-screen text can never drift.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const FN = 'bbf-intake-voice';
const BUCKET = 'studio-audio-vault';

// ── Coach Akeem clone (CEO-pinned signature voice) ──────────────────────────
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const VOICE_MODEL = 'eleven_multilingual_v2';
// Warm, conversational baseline — an intake feels like a coach across the table,
// not a hype reel. Slightly higher stability than a reel, modest style.
const VOICE_SETTINGS = { stability: 0.42, similarity_boost: 0.85, style: 0.18, use_speaker_boost: true };
const PAD = '<break time="0.4s"/>';

type Lang = 'en' | 'es' | 'pt';
const LANGS: Lang[] = ['en', 'es', 'pt'];

// ── THE ALLOWLIST — the ONLY text this function will ever voice ──────────────
// Keys mirror the frontend conversation steps. Copy is the authoritative spoken
// line; the UI shows the same string in the transcript. Keep in sync with the
// vi-say-* keys in LangContext.jsx.
const SCRIPTS: Record<Lang, Record<string, string>> = {
  en: {
    greeting: "Hey — I'm Coach Akeem. Let's build your plan together. I'll ask you a few quick questions. You can just talk to me, or tap your answer. First up: what's your number one focus right now?",
    metrics: "Got it. Now let's get your numbers. Tell me your height, your current weight, and the weight you're aiming for.",
    availability: "How many days a week can you realistically train?",
    injuries: "Last thing — any injuries or areas I should train around? If you're all good, just say none.",
    wrap: "Perfect. I've got what I need to build your plan. Sign in and I'll take you straight to your recommended tier.",
  },
  es: {
    greeting: "Hola, soy el Coach Akeem. Vamos a crear tu plan juntos. Te haré unas preguntas rápidas. Puedes hablarme o tocar tu respuesta. Primero: ¿cuál es tu enfoque número uno ahora mismo?",
    metrics: "Perfecto. Ahora tus números. Dime tu estatura, tu peso actual y el peso que quieres alcanzar.",
    availability: "¿Cuántos días a la semana puedes entrenar de forma realista?",
    injuries: "Lo último: ¿alguna lesión o zona que deba cuidar al entrenarte? Si estás bien, solo di ninguna.",
    wrap: "Perfecto. Ya tengo lo que necesito para crear tu plan. Inicia sesión y te llevo directo a tu nivel recomendado.",
  },
  pt: {
    greeting: "Olá, sou o Coach Akeem. Vamos criar seu plano juntos. Vou fazer algumas perguntas rápidas. Você pode falar comigo ou tocar na sua resposta. Primeiro: qual é o seu foco número um agora?",
    metrics: "Perfeito. Agora os seus números. Diga sua altura, seu peso atual e o peso que você quer alcançar.",
    availability: "Quantos dias por semana você consegue treinar de forma realista?",
    injuries: "Por último: alguma lesão ou área que eu deva respeitar no treino? Se estiver tudo bem, é só dizer nenhuma.",
    wrap: "Perfeito. Já tenho o que preciso para criar seu plano. Faça login e eu te levo direto ao seu nível recomendado.",
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── slug / hash ─────────────────────────────────────────────────────────────
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Deterministic cache key: intake-<key>-<lang>-<hash8>. The hash covers the exact
// spoken text + voice + model, so an edit to a line's copy forks the slug and
// re-bakes; unchanged lines keep hitting their cached object forever.
async function buildSlug(key: string, lang: Lang, text: string): Promise<string> {
  const canonical = JSON.stringify({ k: key, l: lang, t: text, v: AKEEM_VOICE_ID, m: VOICE_MODEL });
  const hash = (await sha256Hex(canonical)).slice(0, 8);
  return `intake-${key}-${lang}-${hash}`;
}

// ── storage (service role, public bucket) ───────────────────────────────────
function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
function publicUrl(url: string, slug: string): string {
  return `${url}/storage/v1/object/public/${BUCKET}/${slug}.mp3`;
}
async function vaultHas(url: string, slug: string): Promise<boolean> {
  try {
    const r = await fetch(publicUrl(url, slug), { method: 'HEAD' });
    return r.ok;
  } catch { return false; }
}
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
async function vaultPut(url: string, key: string, slug: string, buf: ArrayBuffer): Promise<boolean> {
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${slug}.mp3`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: buf,
  });
  if (!r.ok) { console.error(`[${FN}] vaultPut ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`); return false; }
  return true;
}

// ── synthesis (Akeem clone) ─────────────────────────────────────────────────
const SYNTH_TIMEOUT_MS = 60_000;
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function synthesize(apiKey: string, text: string): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS);
  try {
    const ssml = `${PAD} ${text} ${PAD}`;
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(AKEEM_VOICE_ID)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: ssml, model_id: VOICE_MODEL, voice_settings: VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 200) };
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength < 512) return { ok: false, status: 502, detail: 'empty_audio' };
    return { ok: true, buf };
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
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const lang: Lang = LANGS.includes(payload?.lang) ? payload.lang : 'en';
  const key = String(payload?.key ?? '').trim();

  // ── ALLOWLIST GATE — the whole security model. Only a known (key, lang). ──
  const text = SCRIPTS[lang]?.[key];
  if (!text) return jsonResponse({ error: 'unknown_line', detail: 'Not an allowlisted intake prompt.' }, 400);

  const slug = await buildSlug(key, lang, text);

  // 1 · CACHE LOOKUP — already own it? Return the public URL (zero spend).
  if (await vaultHas(SUPABASE_URL, slug)) {
    return jsonResponse({ ok: true, cached: true, key, lang, url: publicUrl(SUPABASE_URL, slug), text });
  }

  // 2 · SYNTHESIZE (Akeem clone) on the first-ever request for this line.
  const XI_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!XI_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);
  const tts = await synthesize(XI_KEY, text);
  if (!tts.ok) {
    console.error(`[${FN}] tts failed ${tts.status}: ${tts.detail}`);
    return jsonResponse({ error: 'tts_failed', detail: `ElevenLabs returned ${tts.status}.` }, 502);
  }

  // 3 · VAULT DEPOSIT — cache for every future visitor.
  await ensureBucket(SUPABASE_URL, SERVICE_KEY);
  const stored = await vaultPut(SUPABASE_URL, SERVICE_KEY, slug, tts.buf);
  if (!stored) return jsonResponse({ error: 'vault_write_failed' }, 502);

  console.log(`[${FN}] BAKED key=${key} lang=${lang} slug=${slug} bytes=${tts.buf.byteLength}`);
  return jsonResponse({ ok: true, cached: false, key, lang, url: publicUrl(SUPABASE_URL, slug), text });
});
