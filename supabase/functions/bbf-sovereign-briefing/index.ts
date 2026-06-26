// supabase/functions/bbf-sovereign-briefing/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// bbf-sovereign-briefing — SOVEREIGN AUDIO · the Day-30 graduation voice briefing.
// The CEO's cloned voice (Professional Voice Clone) delivers a personalized,
// trilingual spoken address marking the athlete's graduation from the 30-Day
// Biometric Calibration into full Sovereign access — grounded in their real
// calibration journey + recovery trend.
//
// THREE GATES (all fail-closed, server-authoritative — the body is never trusted):
//   1. Entitlement — voice_coach (Autonomous+), resolved from the vault bearer token.
//   2. Day-30 graduation — re-derived server-side via bbf_calibration_status (the
//      grandfather epoch + day>=30 rule); not graduated → 403 not_graduated.
//   3. Metering — bbf_voice_session_precheck before compose; bbf_voice_session_commit
//      after synthesis (150k Autonomous / 750k Apex / unmetered God per tier).
//
// COMPOSE: calibration day + readiness trend → Claude (SONNET · sovereign_audio_briefing)
// with VOICE_DNA + the ARCHITECT vocal state + a COLLOQUIAL trilingual directive →
// ElevenLabs (Akeem's clone, eleven_multilingual_v2 → his voice in EN/ES/PT) → audio/mpeg.
//
// Mirrors bbf-biokinetic-briefing's compose→speak stack; routes the model through the
// shared router (§4) and the voice physics through the shared voice engine.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';
import { requireEntitlement } from '../_shared/entitlement-gate.ts';
import { localeCode } from '../_shared/locale.ts';
import { VOICE_DNA, BBF_VOICE_SETTINGS, BBF_VOICE_MODEL, vocalStateDirective, formatForState } from '../_shared/bbf-voice-engine.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Akeem's Professional Voice Clone — used for ALL locales (CEO directive), spoken
// natively per-language by eleven_multilingual_v2. ONE voice, three languages.
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const LOCALE_NAME: Record<string, string> = { en: 'English', es: 'Spanish (neutral Latin-American)', pt: 'Brazilian Portuguese' };
const NATIVE_SPEAKER: Record<string, string> = { es: 'Latin American', pt: 'Brazilian' };

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function callRpc(url: string, key: string, fn: string, args: Record<string, unknown>): Promise<any> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify(args) });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Gather the athlete's calibration + recovery telemetry for the briefing (service-role reads).
async function gatherContext(url: string, key: string, userId: string, uid: string | null, calDay: number | null) {
  const ctx: Record<string, unknown> = {
    calibration_day: calDay,
    milestone: 'Graduated — 30-Day Biometric Calibration complete, full Sovereign access unlocked.',
  };
  // Readiness trend — last 14 daily protocol verdicts → avg + recent-vs-prior week delta.
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_daily_protocols?athlete_id=eq.${encodeURIComponent(userId)}&select=date,readiness_score&order=date.desc&limit=14`,
      { headers: pgHeaders(key) },
    );
    const rows: any[] = r.ok ? (await r.json().catch(() => [])) : [];
    const scores = rows.map((x) => num(x.readiness_score)).filter((n): n is number => n !== null);
    if (scores.length) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const recent = scores.slice(0, 7);
      const prior = scores.slice(7, 14);
      const rAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
      const pAvg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
      ctx.readiness = {
        avg_score: avg,
        trend: (rAvg !== null && pAvg !== null) ? (rAvg > pAvg + 2 ? 'rising' : rAvg < pAvg - 2 ? 'dipping' : 'steady') : 'steady',
        readings: scores.length,
      };
    }
  } catch { /* readiness trend is best-effort */ }
  // Sleep + HRV from the latest vitals row (for a concrete recovery touchpoint).
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_daily_biometrics?athlete_id=eq.${encodeURIComponent(userId)}&select=hrv_ms,sleep_minutes&order=date.desc&limit=1`,
      { headers: pgHeaders(key) },
    );
    const rows: any[] = r.ok ? (await r.json().catch(() => [])) : [];
    if (rows[0]) {
      const sm = num(rows[0].sleep_minutes);
      ctx.latest_vitals = { hrv_ms: num(rows[0].hrv_ms), sleep_hours: sm !== null ? Math.round((sm / 60) * 10) / 10 : null };
    }
  } catch { /* vitals are best-effort */ }
  return ctx;
}

async function writeWithClaude(apiKey: string, model: string, system: string, user: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) { console.error(`[bbf-sovereign-briefing] anthropic ${res.status}`); return null; }
    const j = await res.json().catch(() => null);
    const block = Array.isArray(j?.content) ? j.content.find((b: any) => b?.type === 'text') : null;
    return block?.text?.trim() || null;
  } catch (e) {
    console.error('[bbf-sovereign-briefing] anthropic failed:', (e as Error).message);
    return null;
  }
}

async function composeBriefing(apiKey: string, locale: string, ctx: Record<string, unknown>): Promise<string | null> {
  const model = routeAndLog('bbf-sovereign-briefing', 'sovereign_audio_briefing'); // → SONNET
  // CEO CRITICAL LOCALIZATION DIRECTIVE: native, colloquial, culturally-accurate ES/PT —
  // never rigid word-for-word translations of English idioms.
  const colloquial = locale === 'en' ? '' :
    `\n\n# CRITICAL LOCALIZATION (NON-NEGOTIABLE)\n` +
    `Compose DIRECTLY in natural, colloquial, culturally-accurate ${LOCALE_NAME[locale]} — the way a real ` +
    `${NATIVE_SPEAKER[locale] || 'native'} speaker actually talks, not a textbook. NEVER produce rigid, ` +
    `word-for-word translations of English idioms or phrasing — re-express each idea with its authentic ` +
    `local equivalent so the rhythm, warmth, and cadence land like a native. The ElevenLabs multilingual ` +
    `synthesis will speak exactly what you write, so the words must already carry the authentic ${locale === 'es' ? 'Spanish' : 'Portuguese'} vibe.`;
  const system =
    `${VOICE_DNA}\n\n` +
    `You are recording the SOVEREIGN BRIEFING — a spoken audio address marking this athlete's graduation ` +
    `from the 30-Day Biometric Calibration into full Sovereign access. Speak directly to them in ` +
    `${LOCALE_NAME[locale]}, second person, 120-150 words. This is a milestone they EARNED, not one handed ` +
    `to them. Open by naming the graduation; weave in their calibration journey and recovery trend from the ` +
    `telemetry; close on a grounded, forward-driving line. Convert any numeric rating into spoken words. ` +
    `Natural human speech only — NO markdown, NO lists, NO preamble, NO quotes, NO emojis.${colloquial}\n\n` +
    `${vocalStateDirective('architect')}`;
  const user = `Athlete telemetry (speak it naturally in ${LOCALE_NAME[locale]}):\n${JSON.stringify(ctx).slice(0, 1400)}\n\nRecord the Sovereign Briefing now.`;
  return writeWithClaude(apiKey, model, system, user);
}

function fallbackBriefing(locale: string, calDay: number | null): string {
  const day = Number.isFinite(Number(calDay)) ? Number(calDay) : 30;
  if (locale === 'es') {
    return `Lo lograste. Treinta dias de calibracion... y hoy el Vault se abre por completo. Cada manana que registraste, cada sesion honesta, te trajo hasta aqui. Ya no eres el mismo de hace un mes. Tu cuerpo aprendio, tu sistema se afino, y ahora tienes acceso soberano total. Esto no se te regalo... te lo ganaste. Ahora sigue construyendo.`;
  }
  if (locale === 'pt') {
    return `Voce conseguiu. Trinta dias de calibracao... e hoje o Vault se abre por completo. Cada manha que voce registrou, cada sessao honesta, te trouxe ate aqui. Voce nao e mais o mesmo de um mes atras. Seu corpo aprendeu, seu sistema se ajustou, e agora voce tem acesso soberano total. Isso nao foi dado... voce conquistou. Agora continue construindo.`;
  }
  return `You did it. Thirty days of calibration... and today the Vault opens all the way. Every morning you checked in, every honest session, brought you here. You are not the person you were a month ago. Your body learned, your system tuned, and now you hold full Sovereign access. This was not given to you... you earned it. Day ${day}. Now keep building.`;
}

async function synthesize(apiKey: string, voiceId: string, text: string): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: text.slice(0, 2500), model_id: BBF_VOICE_MODEL, voice_settings: BBF_VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      return { ok: false, status: res.status, detail };
    }
    return { ok: true, buf: await res.arrayBuffer() };
  } catch (e) {
    const err = e as Error;
    return { ok: false, status: 0, detail: err.name === 'AbortError' ? 'timeout_20000ms' : err.message };
  } finally { clearTimeout(timeout); }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  const locale = localeCode(payload?.locale ?? payload?.lang);
  const vaultToken = payload?.vault_token ?? req.headers.get('x-bbf-vault-token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

  // ── GATE 1 · entitlement (voice_coach, fail-closed; resolves identity server-side) ──
  const gate = await requireEntitlement({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, vaultToken, feature: 'voice_coach' });
  if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);
  const uid = gate.ctx.uid;
  const userId = gate.ctx.user_id;

  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  // ── GATE 2 · Day-30 graduation (re-derived server-side; never trusted from client) ──
  const cal = await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_calibration_status', { p_session_token: vaultToken });
  if (!cal || cal.ok !== true) return jsonResponse({ error: 'calibration_check_failed', detail: 'Could not verify graduation status.' }, 503);
  if (cal.graduated !== true) {
    return jsonResponse({ error: 'not_graduated', detail: 'The Sovereign Briefing unlocks at Day 30 — finish your calibration first.', day: cal.day ?? null }, 403);
  }
  const calDay = num(cal.day);

  // ── GATE 3 · metering precheck (tier ceiling + quota) ──
  const pre = await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_voice_session_precheck', { p_user_id: userId });
  if (!pre || pre.ok !== true) {
    const reason = String(pre?.reason || 'not_entitled');
    const status = reason === 'quota_exhausted' ? 429 : 403;
    return jsonResponse({ error: reason, detail: reason === 'quota_exhausted' ? 'Monthly voice quota reached.' : 'Voice coaching is not included in your current plan.' }, status);
  }

  // ── COMPOSE ──
  const ctx = await gatherContext(SUPABASE_URL, SERVICE_KEY, userId, uid, calDay);
  let text = ANTHROPIC_API_KEY ? (await composeBriefing(ANTHROPIC_API_KEY, locale, ctx)) : null;
  if (!text) text = fallbackBriefing(locale, calDay);
  const spoken = formatForState(text, 'architect');

  // ── SYNTHESIZE (Akeem's clone, all locales) ──
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);
  const tts = await synthesize(ELEVENLABS_API_KEY, AKEEM_VOICE_ID, spoken);
  if (!tts.ok) {
    console.error(`[bbf-sovereign-briefing] tts ${tts.status}: ${tts.detail}`);
    return jsonResponse({ error: 'tts_failed', detail: `ElevenLabs returned ${tts.status}.` }, 502);
  }

  // ── METER · commit the spoken character count to the monthly ledger ──
  if (uid) await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_voice_session_commit', { p_uid: uid, p_tokens: spoken.length });

  console.log(`[bbf-sovereign-briefing] uid=${uid} locale=${locale} day=${calDay ?? 'grad'} chars=${spoken.length} voice=akeem_clone`);

  return new Response(tts.buf, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=0, no-store',
      'X-BBF-Voice': 'BBF Coach Akeem (clone)',
      'X-BBF-Voice-Id': AKEEM_VOICE_ID,
      'X-BBF-Context': 'sovereign_briefing',
      'X-BBF-Locale': locale,
    },
  });
});
