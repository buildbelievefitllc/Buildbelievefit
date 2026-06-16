// bbf-biokinetic-briefing — "Sovereign Audio Briefing" (audio-first forecast).
// ─────────────────────────────────────────────────────────────────────────────
// Accepts the Biokinetic Forecast telemetry, writes a SHORT (~100-word) spoken
// summary, runs it through OpenAI TTS (tts-1 · onyx), and returns the rendered
// audio as `audio/mpeg` — NOT JSON. The frontend (forecastApi.fetchBriefingAudio)
// plays the blob directly. This replaces the rejected markdown "wall of text".
//
// PIPELINE
//   1. Compose the briefing text. If ANTHROPIC_API_KEY is present we route through
//      the model-router (Haiku tier — narration/snapshot, low-stakes per CLAUDE.md
//      §4) to write a punchy ~100-word coach briefing in the athlete's locale.
//      With no key we fall back to a deterministic, telemetry-grounded summary so
//      the audio pipeline still works.
//   2. OpenAI TTS: POST /v1/audio/speech { model:'tts-1', voice:'onyx', input,
//      response_format:'mp3' } → audio bytes.
//   3. Return audio/mpeg (cache-private).
//
// SECRETS (env / Vault): OPENAI_API_KEY (required for TTS) · ANTHROPIC_API_KEY
// (optional — better prose). Auto-injected: SUPABASE_URL, SERVICE_ROLE (unused for
// now; reserved for a future entitlement gate on vault_token).
//
// NOTE: deploy is gated on OPENAI_API_KEY being injected into the project secrets.
// Without it the function returns a clean 503 { error:'tts_unconfigured' }.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // x-client-info is attached by supabase-js functions.invoke; allow it so a
  // browser preflight never blocks the POST (lesson from bbf-agentic-cardio).
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ─── Central model router (inlined — single-file edge bundle; CLAUDE.md §4) ──────
const MODELS = { HAIKU: 'claude-haiku-4-5', SONNET: 'claude-sonnet-4-6', OPUS: 'claude-opus-4-8' } as const;
function routeAndLog(fn: string, useCase: string): string {
  // Briefing narration is low-stakes snapshot synthesis → Haiku tier.
  const model = MODELS.HAIKU;
  console.log(`[model-router] fn=${fn} use_case=${useCase} model=${model}`);
  return model;
}

// ─── Locale ──────────────────────────────────────────────────────────────────
function localeCode(input?: string | null): 'en' | 'es' | 'pt' {
  const t = String(input ?? '').trim().toLowerCase();
  if (t.startsWith('es')) return 'es';
  if (t.startsWith('pt') || t.includes('braz') || t.includes('bras')) return 'pt';
  return 'en';
}
const LOCALE_NAME: Record<string, string> = { en: 'English', es: 'Spanish (neutral Latin-American)', pt: 'Brazilian Portuguese' };

// ─── Deterministic fallback briefing (telemetry-grounded, ~100 words) ───────────
function fallbackBriefing(lift: string, f: any, locale: string): string {
  const proj = f?.projected_1rm ?? 'N/A';
  const conf = f?.confidence_score ?? 'Moderate';
  const ot = f?.ot_signal || {};
  const detected = ot?.detected === true;
  if (locale === 'es') {
    return `Informe biocinético para ${lift}. Tu proyección a 30 días es ${proj}, con confianza ${conf}. ` +
      (detected
        ? `El radar marca señales de sobreentrenamiento: la carga aguda supera a la crónica. Baja el volumen, prioriza el sueño y vuelve más fuerte.`
        : `La ventana anabólica está abierta y tu carga está equilibrada. Mantén la progresión y ataca tus series principales con intención.`);
  }
  if (locale === 'pt') {
    return `Briefing biocinético para ${lift}. Sua projeção de 30 dias é ${proj}, com confiança ${conf}. ` +
      (detected
        ? `O radar aponta sinais de overtraining: a carga aguda passou da crônica. Reduza o volume, priorize o sono e volte mais forte.`
        : `A janela anabólica está aberta e sua carga está equilibrada. Mantenha a progressão e ataque as séries principais com intenção.`);
  }
  return `Biokinetic briefing for the ${lift}. Your 30-day projection is ${proj}, at ${conf} confidence. ` +
    (detected
      ? `The radar flags an overtraining signal — acute load has outrun your chronic base. Pull volume back, prioritize sleep, and come back sharper.`
      : `Your anabolic window is open and load is balanced. Hold the progression and attack your top sets with intent — you're trending up.`);
}

// ─── Anthropic: write the ~100-word spoken briefing (best-effort) ────────────────
async function writeBriefing(apiKey: string, model: string, lift: string, f: any, locale: string): Promise<string | null> {
  const sys = [
    `You are the BBF Smart Coach recording a SPOKEN audio briefing (~100 words, max 120) in ${LOCALE_NAME[locale]}.`,
    'Direct, motivational, second person. NO markdown, NO lists, NO headings — flowing speech only, 3-5 short sentences.',
    'Ground every claim in the telemetry provided. End with one concrete directive.',
  ].join(' ');
  const user = `Lift: ${lift}\nTelemetry JSON:\n${JSON.stringify(f ?? {}).slice(0, 1500)}\n\nWrite the spoken briefing now.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 400, system: sys, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) { console.error(`[bbf-biokinetic-briefing] anthropic ${res.status}`); return null; }
    const j = await res.json().catch(() => null);
    const block = Array.isArray(j?.content) ? j.content.find((b: any) => b?.type === 'text') : null;
    const text = block?.text?.trim();
    return text || null;
  } catch (e) {
    console.error('[bbf-biokinetic-briefing] anthropic call failed:', (e as Error).message);
    return null;
  }
}

// ─── OpenAI TTS (tts-1 · onyx) → mp3 bytes ──────────────────────────────────────
async function synthesize(openaiKey: string, input: string): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; status: number; detail: string }> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', voice: 'onyx', input: input.slice(0, 4000), response_format: 'mp3' }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    return { ok: false, status: res.status, detail };
  }
  return { ok: true, buf: await res.arrayBuffer() };
}

// ─── handler ─────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const lift = String(payload?.lift_name || 'your main lift').slice(0, 60);
  const locale = localeCode(payload?.locale ?? payload?.lang);
  const forecast = payload?.forecast ?? null;

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: 'tts_unconfigured', detail: 'OPENAI_API_KEY is not set — inject it to enable the audio briefing.' }, 503);
  }

  // 1 — briefing text (Claude Haiku if available, else deterministic fallback).
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const model = routeAndLog('bbf-biokinetic-briefing', 'snapshot_synthesis');
  let text: string | null = null;
  if (ANTHROPIC_API_KEY) text = await writeBriefing(ANTHROPIC_API_KEY, model, lift, forecast, locale);
  if (!text) text = fallbackBriefing(lift, forecast, locale);

  // 2 — OpenAI TTS → mp3.
  const tts = await synthesize(OPENAI_API_KEY, text);
  if (!tts.ok) {
    console.error(`[bbf-biokinetic-briefing] tts failed ${tts.status}: ${tts.detail}`);
    return jsonResponse({ error: 'tts_failed', detail: `OpenAI TTS returned ${tts.status}.` }, 502);
  }

  // 3 — return the audio stream.
  return new Response(tts.buf, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=0, no-store',
      'X-BBF-Briefing-Source': ANTHROPIC_API_KEY && text ? 'claude+tts' : 'deterministic+tts',
    },
  });
});
