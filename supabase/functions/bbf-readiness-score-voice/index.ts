// supabase/functions/bbf-readiness-score-voice/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// bbf-readiness-score-voice — the EXACT readiness number, spoken by Coach Akeem.
// ───────────────────────────────────────────────────────────────────────────
// The Sovereign Briefing's biometric-matrix clip (bbf-biometric-audio-matrix)
// speaks a fixed CNS BUCKET (40/60/80/100) baked into a pre-recorded script —
// never the athlete's literal readiness_score. This fn closes that gap without
// reintroducing a live-synthesis cost: the sentence "Your readiness this
// morning is N out of 100" is IDENTICAL for every athlete who ever scores N,
// so it's cached GLOBALLY by (locale, score) — not per athlete, not per day.
// At most 101 values × 3 locales can ever exist; in practice only the handful
// of scores real athletes actually land on ever get synthesized, once, ever.
//
// LAZY CACHE (mirrors bbf-studio-voiceover): 1) HEAD the slug → hit ⇒ $0.
// 2) miss ⇒ ElevenLabs (Akeem clone, the SAME locked voice physics as every
// other BBF voice surface) ⇒ upload ⇒ return the permanent public URL.
//
// Gated by the SAME voice_coach entitlement as the Sovereign Briefing itself
// (this clip only ever plays alongside it) — fail-closed, server-authoritative.
// Self-contained (no relative imports) so it deploys as a single-file bundle —
// mirrors bbf-biokinetic-briefing's inlined entitlement-gate + voice-engine
// pattern (canonical sources: _shared/entitlement-gate.ts, _shared/bbf-voice-engine.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ══ ENTITLEMENT GATE (inlined — canonical: _shared/entitlement-gate.ts) ══════════
const GROUP = { BASELINE: 'baseline', AUTONOMOUS: 'autonomous', APEX: 'apex', YOUTH: 'youth', ALL: 'allaccess' } as const;
type Group = typeof GROUP[keyof typeof GROUP];
const TIER_TO_GROUP: Record<string, Group> = {
  catalyst: GROUP.BASELINE, momentum: GROUP.BASELINE, fuel_foundation: GROUP.BASELINE,
  autonomous: GROUP.AUTONOMOUS, fuel_performance: GROUP.AUTONOMOUS,
  fuel_sovereign: GROUP.APEX, kickstart_6wk_3x: GROUP.APEX, kickstart_6wk_4x: GROUP.APEX, transformation_8wk_3x: GROUP.APEX,
  transformation_8wk_4x: GROUP.APEX, sovereign_12wk_3x: GROUP.APEX, sovereign_12wk_4x: GROUP.APEX,
  rising_athlete: GROUP.YOUTH,
  lite: GROUP.BASELINE, gateway: GROUP.AUTONOMOUS, architect: GROUP.AUTONOMOUS, sovereign: GROUP.APEX,
  youth_athlete: GROUP.YOUTH, nutrition_essentials: GROUP.BASELINE, nutrition_platinum: GROUP.APEX,
};
const AUTO_BAND: Group[] = [GROUP.AUTONOMOUS, GROUP.APEX, GROUP.ALL];
const FEATURE_ACCESS: Record<string, Group[]> = { voice_coach: AUTO_BAND };

function pgHeaders(serviceKey: string): HeadersInit {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
}
async function uidFromVaultToken(url: string, key: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/_bbf_uid_from_vault_token`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify({ p_session_token: token }) });
    if (!r.ok) return null;
    const v = await r.json().catch(() => null);
    return (typeof v === 'string' && v) ? v : null;
  } catch { return null; }
}
async function readUserRow(url: string, key: string, userId: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_users?id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&select=uid,subscription_tier,trial_expires_at,access_status,role&limit=1`, { headers: pgHeaders(key) });
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
function trialActive(t: unknown): boolean {
  if (typeof t !== 'string' || !t) return false;
  const ms = Date.parse(t);
  return Number.isFinite(ms) && ms > Date.now();
}
type GateResult = { ok: true } | { ok: false; status: number; error: string; detail: string };
async function requireEntitlement(url: string | undefined, key: string | undefined, token: string | null | undefined, feature: string): Promise<GateResult> {
  const tok = String(token || '').trim();
  if (!url || !key) return { ok: false, status: 503, error: 'entitlement_check_unavailable', detail: 'Gate cannot reach the identity store.' };
  if (!tok) return { ok: false, status: 401, error: 'missing_session', detail: 'A vault session token is required.' };
  const userId = await uidFromVaultToken(url, key, tok);
  if (!userId) return { ok: false, status: 401, error: 'invalid_session', detail: 'Vault session is invalid or expired.' };
  const row = await readUserRow(url, key, userId);
  if (!row) return { ok: false, status: 401, error: 'invalid_session', detail: 'No active account for this session.' };
  if (String(row.access_status || '') === 'locked') return { ok: false, status: 403, error: 'account_locked', detail: 'This account is locked.' };
  const uid = (row.uid ?? null) as string | null;
  const role = (row.role ?? null) as string | null;
  const tier = (row.subscription_tier ?? null) as string | null;
  if (isGodMode(role, uid) || trialActive(row.trial_expires_at)) return { ok: true };
  const slug = String(tier || '').trim().toLowerCase();
  const group = slug ? TIER_TO_GROUP[slug] : undefined;
  if (!group) return { ok: false, status: 403, error: 'tier_not_entitled', detail: `No entitlement mapping for tier "${slug || '(none)'}".` };
  if ((FEATURE_ACCESS[feature] || []).includes(group)) return { ok: true };
  return { ok: false, status: 403, error: 'tier_not_entitled', detail: `Tier "${tier || '(none)'}" does not unlock "${feature}".` };
}

// ══ BBF LAB VOICE ENGINE (inlined — canonical: _shared/bbf-voice-engine.ts) ══════
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const BBF_VOICE_SETTINGS = { stability: 0.35, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true };
const BBF_VOICE_MODEL = 'eleven_multilingual_v2';

// ══ readiness-score voice ═════════════════════════════════════════════════════
const BUCKET = 'studio-audio-vault';
const PREFIX = 'readiness-score';

const LOCALES = new Set(['en', 'es', 'pt']);
function resolveLocale(input: unknown): 'en' | 'es' | 'pt' {
  const l = String(input || 'en').toLowerCase();
  return (LOCALES.has(l) ? l : 'en') as 'en' | 'es' | 'pt';
}

// Deterministic, fully-templated — NO LLM call, ever. The score is the only variable.
const SCORE_SENTENCE: Record<string, (n: number) => string> = {
  en: (n) => `Your readiness this morning is ${n} out of 100.`,
  es: (n) => `Tu preparación esta mañana es ${n} de 100.`,
  pt: (n) => `Sua prontidão esta manhã é ${n} de 100.`,
};

function publicUrl(url: string, path: string): string {
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}
async function vaultHas(url: string, path: string): Promise<boolean> {
  try { return (await fetch(publicUrl(url, path), { method: 'HEAD' })).ok; }
  catch { return false; }
}
async function vaultPut(url: string, key: string, path: string, buf: ArrayBuffer): Promise<boolean> {
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: buf,
  });
  if (!r.ok) { console.error(`[bbf-readiness-score-voice] vaultPut ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`); return false; }
  return true;
}
async function synthesize(apiKey: string, text: string): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(AKEEM_VOICE_ID)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: BBF_VOICE_MODEL, voice_settings: BBF_VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 200) };
    return { ok: true, buf: await res.arrayBuffer() };
  } catch (e) {
    const err = e as Error;
    return { ok: false, status: 0, detail: err.name === 'AbortError' ? 'timeout_20000ms' : err.message };
  } finally { clearTimeout(timeout); }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const vaultToken = payload?.vault_token ?? req.headers.get('x-bbf-vault-token');
  const gate = await requireEntitlement(SUPABASE_URL, SERVICE_KEY, vaultToken, 'voice_coach');
  if (!gate.ok) return jsonResponse({ error: gate.error, detail: gate.detail }, gate.status);

  const rawScore = Number(payload?.score);
  if (!Number.isFinite(rawScore)) return jsonResponse({ error: 'missing_score', detail: 'Provide the numeric readiness score.' }, 400);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const locale = resolveLocale(payload?.locale ?? payload?.lang);

  const path = `${PREFIX}/${locale}-${score}.mp3`;

  // 1 · CACHE LOOKUP — the whole point: at most 101 renders per locale, ever.
  if (await vaultHas(SUPABASE_URL, path)) {
    return jsonResponse({ ok: true, cached: true, url: publicUrl(SUPABASE_URL, path), score, locale });
  }

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);

  // 2 · SYNTHESIZE — deterministic template, no LLM.
  const text = (SCORE_SENTENCE[locale] || SCORE_SENTENCE.en)(score);
  const tts = await synthesize(ELEVENLABS_API_KEY, text);
  if (!tts.ok) {
    console.error(`[bbf-readiness-score-voice] tts failed ${tts.status}: ${tts.detail}`);
    return jsonResponse({ error: 'tts_failed', detail: `ElevenLabs returned ${tts.status}.` }, 502);
  }

  // 3 · VAULT DEPOSIT — permanent, shared, public.
  const stored = await vaultPut(SUPABASE_URL, SERVICE_KEY, path, tts.buf);
  if (!stored) return jsonResponse({ error: 'vault_write_failed', detail: 'Synthesis succeeded but the audio could not be cached.' }, 502);

  console.log(`[bbf-readiness-score-voice] STORED score=${score} locale=${locale} bytes=${tts.buf.byteLength}`);
  return jsonResponse({ ok: true, cached: false, url: publicUrl(SUPABASE_URL, path), score, locale });
});
