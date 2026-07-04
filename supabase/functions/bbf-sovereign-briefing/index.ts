// supabase/functions/bbf-sovereign-briefing/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// bbf-sovereign-briefing — SOVEREIGN AUDIO · the Day-30 graduation voice briefing.
// FRONT 3.5: auto-daily pre-computed premium podcast. TWO entry modes:
//
//   1. TRIPWIRE MODE (X-BBF-Sovereign-Secret) — fired by the bbf_daily_protocols
//      morning check-in trigger with { athlete_id, locale }. Re-checks graduation +
//      voice_coach + an IDEMPOTENCY skip (1/athlete/day/locale) + metering, then
//      composes + synthesizes + CACHES the briefing in bbf_sovereign_audio. Returns
//      a small JSON status (no blob). This is the background pre-compute.
//
//   2. ON-DEMAND MODE (vault token) — the Vault Hub tile. CACHE-READ FIRST: if the
//      tripwire already generated today's briefing, return the cached blob instantly
//      (no Claude/ElevenLabs, no metering). On a cache miss (e.g. no check-in yet),
//      compose live, cache it, meter, and return the blob (graceful fallback).
//
// THREE GATES throughout (fail-closed, server-authoritative): voice_coach entitlement,
// Day-30 graduation (re-derived server-side), voice metering (150k/750k/unmetered).
// COMPOSE: calibration day + readiness trend → Claude (SONNET) + VOICE_DNA + ARCHITECT
// state + COLLOQUIAL trilingual directive → ElevenLabs (Akeem's clone, multilingual_v2).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';
import { requireEntitlement, TIER_TO_GROUP, FEATURE_ACCESS } from '../_shared/entitlement-gate.ts';
import { localeCode } from '../_shared/locale.ts';
import { VOICE_DNA, BBF_VOICE_SETTINGS, BBF_VOICE_MODEL, vocalStateDirective, formatForState } from '../_shared/bbf-voice-engine.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-bbf-sovereign-secret, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Akeem's Professional Voice Clone — used for ALL locales (CEO directive), spoken
// natively per-language by eleven_multilingual_v2. ONE voice, three languages.
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const GRANDFATHER_EPOCH_MS = Date.parse('2026-06-25T00:00:00Z');
const LOCALE_NAME: Record<string, string> = { en: 'English', es: 'Spanish (neutral Latin-American)', pt: 'Brazilian Portuguese' };
const NATIVE_SPEAKER: Record<string, string> = { es: 'Latin American', pt: 'Brazilian' };

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
function utcToday(): string { return new Date().toISOString().slice(0, 10); }
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── SCORE LOCK (the 77-vs-80 fix, layer 2) ─────────────────────────────────────
// Deterministic backstop over the generated script: every standalone digit-form
// integer on the 0-100 scale is rewritten to today's ACTUAL readiness score, so a
// hallucinated second figure ("primed at an 80") can never reach the athlete's ears.
// Day/date counters are exempt ("Day 34", "día 34", "dia 34", "30 days/días/dias") —
// those are calendar numbers, not scores. Mirrored client-side in lib/scoreLock.js.
function lockScoreDigits(script: string, score: number): string {
  const s = Math.round(score);
  return String(script || '').replace(
    /(\b(?:day|d[ií]a)\s+)?(\b(?:out\s+of|de|sobre|em)\s+)?\b(\d{1,3})\b(\s*(?:days?|d[ií]as?))?(\s*(?:%|percent|por\s+ciento|por\s+cento))?/gi,
    (full, dayBefore, denomBefore, digits, dayAfter, pctAfter) => {
      if (dayBefore || dayAfter) return full;              // calendar context — leave it
      if (pctAfter) return full;                           // effort %, not a score
      const n = Number(digits);
      if (denomBefore && n === 100) return full;           // the scale itself ("out of 100"/"de 100")
      if (!Number.isFinite(n) || n < 0 || n > 100) return full; // not a 0-100 scale figure
      if (n === s) return full;                            // already the true score
      return full.replace(digits, String(s));              // any other 0-100 figure → today's score
    },
  );
}

function bytesToB64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  return btoa(bin);
}
function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i += 1) view[i] = bin.charCodeAt(i);
  return buf;
}

async function callRpc(url: string, key: string, fn: string, args: Record<string, unknown>): Promise<any> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify(args) });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}
async function readConfigSecret(url: string, key: string, name: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_app_config?key=eq.${encodeURIComponent(name)}&select=value&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? String(rows[0].value || '') : null;
  } catch { return null; }
}

// ── Identity + gates by athlete_id (the tripwire path has no vault token) ─────────
async function resolveByAthleteId(url: string, key: string, athleteId: string): Promise<Record<string, any> | null> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_users?id=eq.${encodeURIComponent(athleteId)}&deleted_at=is.null&select=uid,email,subscription_tier,role,access_status,trial_expires_at&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}
async function deriveGraduation(url: string, key: string, email: string | null): Promise<{ graduated: boolean; day: number | null }> {
  if (!email) return { graduated: true, day: null };  // undatable → graduated (fail-open)
  try {
    const r = await fetch(`${url}/rest/v1/bbf_active_clients?vault_email=eq.${encodeURIComponent(email)}&select=created_at&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return { graduated: true, day: null };
    const rows = await r.json().catch(() => null);
    const created = (Array.isArray(rows) && rows.length) ? Date.parse(rows[0].created_at) : NaN;
    if (!Number.isFinite(created)) return { graduated: true, day: null };
    if (created < GRANDFATHER_EPOCH_MS) return { graduated: true, day: null };  // grandfathered
    const day = Math.max(1, Math.floor((Date.now() - created) / 86400000) + 1);
    return { graduated: day >= 30, day };
  } catch { return { graduated: true, day: null }; }
}
function tierEntitled(tier: unknown, role: unknown, uid: unknown, trial: unknown, feature: string): boolean {
  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'trainer' || r === 'coach') return true;
  if (String(uid || '').toLowerCase() === 'akeem') return true;
  if (typeof trial === 'string' && Date.parse(trial) > Date.now()) return true;
  const group = TIER_TO_GROUP[String(tier || '').trim().toLowerCase()];
  if (!group) return false;
  return (FEATURE_ACCESS[feature] || []).includes(group);
}

// Today's CURRENT readiness_score (single row — bbf_daily_protocols is one row
// per athlete/day). Distinct from gatherContext's 14-day trend average: this is
// the exact number the cache must agree with before serving a "hit".
async function fetchTodayScore(url: string, key: string, userId: string, date: string): Promise<number | null> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_daily_protocols?athlete_id=eq.${encodeURIComponent(userId)}&date=eq.${date}&select=readiness_score&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows: any[] = await r.json().catch(() => []);
    return rows[0] ? num(rows[0].readiness_score) : null;
  } catch { return null; }
}

// ── Cache (bbf_sovereign_audio · one row per athlete/day/locale) ─────────────────
// STALE CACHE GUARD: a cached row is only served when its stored readiness_score
// agrees with `currentScore` — mirrors bbf_get_sovereign_briefing's SQL check
// (20260702120000) so the tripwire's idempotency skip and this on-demand read
// never disagree with what the frontend will independently decide. A row from
// before this column existed (readiness_score null) is trusted as-is rather than
// force-missed; a null currentScore (couldn't resolve today's score) does the same.
async function readCache(url: string, key: string, userId: string, date: string, locale: string, currentScore: number | null): Promise<{ audio_b64: string; mime: string } | null> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_sovereign_audio?user_id=eq.${encodeURIComponent(userId)}&briefing_date=eq.${date}&locale=eq.${locale}&status=eq.ready&select=audio_b64,mime,readiness_score&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    const row = (Array.isArray(rows) && rows.length) ? rows[0] : null;
    if (!row || !row.audio_b64) return null;
    const cachedScore = num(row.readiness_score);
    if (currentScore !== null && cachedScore !== null && currentScore !== cachedScore) return null;
    return row;
  } catch { return null; }
}
async function writeCache(url: string, key: string, row: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${url}/rest/v1/bbf_sovereign_audio?on_conflict=user_id,briefing_date,locale`, {
      method: 'POST',
      headers: { ...pgHeaders(key), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    // Bound growth — drop this athlete's briefings older than 7 days (best-effort).
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    await fetch(`${url}/rest/v1/bbf_sovereign_audio?user_id=eq.${encodeURIComponent(String(row.user_id))}&briefing_date=lt.${cutoff}`, {
      method: 'DELETE', headers: { ...pgHeaders(key), Prefer: 'return=minimal' },
    });
  } catch (e) { console.warn('[bbf-sovereign-briefing] cache write failed:', (e as Error).message); }
}

// ── Gather the athlete's calibration + recovery telemetry for the briefing ───────
async function gatherContext(url: string, key: string, userId: string, calDay: number | null) {
  const ctx: Record<string, unknown> = {
    calibration_day: calDay,
    milestone: 'Graduated — 30-Day Biometric Calibration complete, full Sovereign access unlocked.',
  };
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
    `If the telemetry includes today_score, that is the athlete's EXACT readiness score for TODAY and the ` +
    `ONLY number on a 0-100 scale you are permitted to voice — if you cite a specific score, cite this one ` +
    `precisely (spoken as words, e.g. "eighty-eight out of one hundred"). NEVER voice any other 0-100 ` +
    `figure (no averages, no CNS or recovery ratings as numbers) — describe every other metric ` +
    `qualitatively ("trending up", "primed", "well-rested") so the briefing can never contradict the ` +
    `dashboard. ` +
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
  const timeout = setTimeout(() => controller.abort(), 25000);
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
    return { ok: false, status: 0, detail: err.name === 'AbortError' ? 'timeout_25000ms' : err.message };
  } finally { clearTimeout(timeout); }
}

// Generate → synthesize → cache → meter. Shared by the tripwire (background) and the
// on-demand cache-miss fallback. Returns the audio buffer so the caller can also stream it.
async function generateAndCache(opts: {
  url: string; key: string; anthropic?: string; eleven?: string;
  userId: string; uid: string | null; locale: string; calDay: number | null; todayScore: number | null;
}): Promise<{ ok: boolean; buf?: ArrayBuffer; chars?: number; skipped?: string }> {
  const { url, key, anthropic, eleven, userId, uid, locale, calDay, todayScore } = opts;
  // Metering — respect the monthly ceiling BEFORE any paid API work.
  const pre = await callRpc(url, key, 'bbf_voice_session_precheck', { p_user_id: userId });
  if (!pre || pre.ok !== true) return { ok: false, skipped: String(pre?.reason || 'not_entitled') };

  const ctx = await gatherContext(url, key, userId, calDay);
  // ── SINGLE SOURCE OF TRUTH (the 77-vs-80 fix, layer 1) ──
  // today_score is the ONLY 0-100 number the model may see. The 14-day avg_score
  // used to ride in the same context block and the model would voice BOTH
  // ("seventy-seven out of one hundred… primed at an eighty") — a live
  // contradiction with the dashboard. With today's score known, every other 0-100
  // numeric is stripped from the context (the trend stays qualitative), and the
  // generated script passes through the deterministic lockScoreDigits backstop.
  if (todayScore !== null) {
    ctx.today_score = todayScore;
    const trend = ctx.readiness as Record<string, unknown> | undefined;
    if (trend) ctx.readiness = { trend: trend.trend ?? 'steady', readings: trend.readings ?? null };
  }
  let text = anthropic ? (await composeBriefing(anthropic, locale, ctx)) : null;
  if (!text) text = fallbackBriefing(locale, calDay);
  if (todayScore !== null) text = lockScoreDigits(text, todayScore);
  const spoken = formatForState(text, 'architect');

  if (!eleven) return { ok: false, skipped: 'tts_unconfigured' };
  const tts = await synthesize(eleven, AKEEM_VOICE_ID, spoken);
  if (!tts.ok) return { ok: false, skipped: `tts_failed_${tts.status}` };

  await writeCache(url, key, {
    user_id: userId, briefing_date: utcToday(), locale, audio_b64: bytesToB64(new Uint8Array(tts.buf)),
    mime: 'audio/mpeg', chars: spoken.length, voice_id: AKEEM_VOICE_ID, status: 'ready',
    readiness_score: todayScore,
  });
  if (uid) await callRpc(url, key, 'bbf_voice_session_commit', { p_uid: uid, p_tokens: spoken.length });
  return { ok: true, buf: tts.buf, chars: spoken.length };
}

function audioResponse(buf: ArrayBuffer, locale: string, cache: string): Response {
  return new Response(buf, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=0, no-store',
      'X-BBF-Voice': 'BBF Coach Akeem (clone)',
      'X-BBF-Voice-Id': AKEEM_VOICE_ID,
      'X-BBF-Context': 'sovereign_briefing',
      'X-BBF-Locale': locale,
      'X-BBF-Cache': cache,
    },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  const locale = localeCode(payload?.locale ?? payload?.lang);
  const today = utcToday();
  const sentSecret = req.headers.get('x-bbf-sovereign-secret');

  // ═══ MODE 1 · TRIPWIRE (background pre-compute) ═══════════════════════════════
  if (sentSecret) {
    const cfgSecret = await readConfigSecret(SUPABASE_URL, SERVICE_KEY, 'sovereign_briefing_secret');
    if (!cfgSecret || sentSecret !== cfgSecret) return jsonResponse({ error: 'unauthorized' }, 401);

    const athleteId = String(payload?.athlete_id || '').trim();
    if (!athleteId) return jsonResponse({ error: 'missing_athlete_id' }, 400);

    const row = await resolveByAthleteId(SUPABASE_URL, SERVICE_KEY, athleteId);
    if (!row || String(row.access_status || '') === 'locked') return jsonResponse({ ok: true, skipped: 'ineligible' });
    const grad = await deriveGraduation(SUPABASE_URL, SERVICE_KEY, row.email ?? null);
    if (!grad.graduated) return jsonResponse({ ok: true, skipped: 'not_graduated' });
    if (!tierEntitled(row.subscription_tier, row.role, row.uid, row.trial_expires_at, 'voice_coach')) {
      return jsonResponse({ ok: true, skipped: 'not_entitled' });
    }
    // IDEMPOTENCY — at most one generation per athlete/day/locale/SCORE (unit
    // economics + accuracy): a cache hit for a score that no longer matches
    // today's current readiness is treated as a miss, so a later check-in that
    // moves the score re-triggers a fresh narrative instead of skipping forever.
    const todayScore = await fetchTodayScore(SUPABASE_URL, SERVICE_KEY, athleteId, today);
    if (await readCache(SUPABASE_URL, SERVICE_KEY, athleteId, today, locale, todayScore)) {
      return jsonResponse({ ok: true, skipped: 'already_cached', locale });
    }
    const res = await generateAndCache({
      url: SUPABASE_URL, key: SERVICE_KEY, anthropic: ANTHROPIC_API_KEY, eleven: ELEVENLABS_API_KEY,
      userId: athleteId, uid: row.uid ?? null, locale, calDay: grad.day, todayScore,
    });
    console.log(`[bbf-sovereign-briefing] tripwire athlete=${athleteId} locale=${locale} ${res.ok ? `cached chars=${res.chars}` : `skipped=${res.skipped}`}`);
    return jsonResponse({ ok: res.ok, mode: 'tripwire', locale, ...(res.ok ? { cached: true, chars: res.chars } : { skipped: res.skipped }) });
  }

  // ═══ MODE 2 · ON-DEMAND (vault token · the Vault Hub tile) ════════════════════
  const vaultToken = payload?.vault_token ?? req.headers.get('x-bbf-vault-token');
  const gate = await requireEntitlement({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, vaultToken, feature: 'voice_coach' });
  if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);
  const uid = gate.ctx.uid;
  const userId = gate.ctx.user_id;

  const cal = await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_calibration_status', { p_session_token: vaultToken });
  if (!cal || cal.ok !== true) return jsonResponse({ error: 'calibration_check_failed', detail: 'Could not verify graduation status.' }, 503);
  if (cal.graduated !== true) {
    return jsonResponse({ error: 'not_graduated', detail: 'The Sovereign Briefing unlocks at Day 30 — finish your calibration first.', day: cal.day ?? null }, 403);
  }

  // CACHE-READ FIRST — the pre-computed blob from the morning check-in → instant,
  // free. Score-aware: a cached row generated from a since-superseded score is
  // treated as a miss below, same as the tripwire's idempotency check.
  const todayScore = await fetchTodayScore(SUPABASE_URL, SERVICE_KEY, userId, today);
  const cached = await readCache(SUPABASE_URL, SERVICE_KEY, userId, today, locale, todayScore);
  if (cached) {
    console.log(`[bbf-sovereign-briefing] on-demand HIT uid=${uid} locale=${locale}`);
    return audioResponse(b64ToArrayBuffer(cached.audio_b64), locale, 'hit');
  }

  // Cache miss (no check-in yet today, a locale the tripwire didn't pre-generate,
  // or a stale score superseded by a later check-in) → compose live, cache it,
  // meter it, and stream it back (graceful fallback).
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);
  const res = await generateAndCache({
    url: SUPABASE_URL, key: SERVICE_KEY, anthropic: ANTHROPIC_API_KEY, eleven: ELEVENLABS_API_KEY,
    userId, uid, locale, calDay: num(cal.day), todayScore,
  });
  if (!res.ok || !res.buf) {
    const reason = res.skipped || 'tts_failed';
    const status = reason === 'quota_exhausted' ? 429 : (reason === 'not_entitled' ? 403 : 502);
    return jsonResponse({ error: reason, detail: reason === 'quota_exhausted' ? 'Monthly voice quota reached.' : 'Briefing could not be generated.' }, status);
  }
  console.log(`[bbf-sovereign-briefing] on-demand MISS→gen uid=${uid} locale=${locale} chars=${res.chars}`);
  return audioResponse(res.buf, locale, 'miss');
});
