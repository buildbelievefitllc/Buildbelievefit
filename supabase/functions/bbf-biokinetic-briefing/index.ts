// bbf-biokinetic-briefing — Universal Voice Coach (ElevenLabs, trilingual).
// ─────────────────────────────────────────────────────────────────────────────
// CEO V8.16 upgrade: OpenAI TTS is REMOVED. This is now the premium, culturally
// resonant ElevenLabs voice engine, serving TWO contexts off one mapped voice set:
//
//   context='forecast' → a ~100-word clinical diagnostic from forecast telemetry
//                         (Biokinetic Forecast / Hub behavior).
//   context='program'  → a short, intense in-ear coaching cue from the active
//                         movement (Exercise · Target · Form cues) for live training.
//
// VOICE MAP (resolved at runtime from the CEO's ElevenLabs account — exact voice_id
// hashes are queried from /v1/voices and cached per isolate, so a rename/swap in
// the account self-heals):
//   en → BBF Coach (CEO custom voice · BBF account)
//   es → Ana María (Mexican)
//   pt → Ana Alice (Brazilian)
//   ⛔ "Young Jamal" is NEVER selected (hard exclusion).
//
// Returns audio/mpeg (NOT JSON) so the client streams the blob directly.
// SECRETS: ELEVENLABS_API_KEY (required) · ANTHROPIC_API_KEY (optional — better
// prose; deterministic fallback otherwise).
//   GET ?voices=1 → diagnostic: the resolved locale→{name,voice_id} map.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ─── Central model router (inlined — single-file edge bundle; CLAUDE.md §4) ──────
const MODELS = { HAIKU: 'claude-haiku-4-5', SONNET: 'claude-sonnet-4-6', OPUS: 'claude-opus-4-8' } as const;
function routeAndLog(fn: string, useCase: string): string {
  const model = MODELS.HAIKU; // narration / snapshot / coaching cue → low-stakes Haiku tier
  console.log(`[model-router] fn=${fn} use_case=${useCase} model=${model}`);
  return model;
}

function localeCode(input?: string | null): 'en' | 'es' | 'pt' {
  const t = String(input ?? '').trim().toLowerCase();
  if (t.startsWith('es')) return 'es';
  if (t.startsWith('pt') || t.includes('braz') || t.includes('bras')) return 'pt';
  return 'en';
}
const LOCALE_NAME: Record<string, string> = { en: 'English', es: 'Spanish (neutral Latin-American)', pt: 'Brazilian Portuguese' };

// ─── HARD ENTITLEMENT GATE (inlined from _shared/entitlement-gate.ts · FAIL-CLOSED) ─
// Identity is resolved SERVER-SIDE from the 24h vault bearer token; the body uid is
// never trusted. program → voice_coach, forecast → biokinetic_forecast (Autonomous+).
// God Mode (admin/trainer/coach/akeem/active-trial) always passes. Any failure to
// POSITIVELY establish identity + a mapped, unlocked entitlement → DENY (no compute).
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
const FEATURE_ACCESS: Record<string, Group[]> = { voice_coach: AUTO_BAND, biokinetic_forecast: AUTO_BAND };

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

// ─── ElevenLabs voice resolution (locale → CEO account voice_id) ─────────────────
const LOCALE_VOICE_NAME: Record<string, string> = { en: 'BBF Coach', es: 'Ana María', pt: 'Ana Alice' };
const FORBIDDEN_VOICE = 'jamal'; // ⛔ never select "Young Jamal" under any circumstances
// Tuned for a WARM, human, unhurried delivery (CEO note: the BBF Coach voice was
// coming out too sharp / robotic). Lower similarity_boost backs off clone-artifact
// "sharpness"; a touch of style adds expressive warmth (kills the flat-robot tone);
// speed 0.92 slows it ~8% so cues land smooth instead of clipped.
const DEFAULT_VOICE_SETTINGS = { stability: 0.50, similarity_boost: 0.80, style: 0.25, use_speaker_boost: true, speed: 0.92 };

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
function deburr(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(COMBINING_MARKS, '').trim().toLowerCase();
}

let _voiceCache: Record<string, { voice_id: string; name: string }> | null = null;
async function resolveVoices(apiKey: string): Promise<Record<string, { voice_id: string; name: string }> | null> {
  if (_voiceCache) return _voiceCache;
  let voices: any[] = [];
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': apiKey } });
    if (!res.ok) { console.error(`[bbf-biokinetic-briefing] /v1/voices ${res.status}`); return null; }
    const j = await res.json().catch(() => null);
    voices = Array.isArray(j?.voices) ? j.voices : [];
  } catch (e) {
    console.error('[bbf-biokinetic-briefing] voices fetch failed:', (e as Error).message);
    return null;
  }
  // Candidates exclude the forbidden voice entirely.
  const candidates = voices.filter((v) => !deburr(v?.name).includes(FORBIDDEN_VOICE));
  const pick = (want: string) => {
    const wn = deburr(want);
    return candidates.find((v) => deburr(v?.name) === wn)
        || candidates.find((v) => deburr(v?.name).startsWith(wn))
        || candidates.find((v) => deburr(v?.name).includes(wn))
        || null;
  };
  const map: Record<string, { voice_id: string; name: string }> = {};
  for (const [loc, name] of Object.entries(LOCALE_VOICE_NAME)) {
    const v = pick(name);
    if (v?.voice_id) map[loc] = { voice_id: String(v.voice_id), name: String(v.name) };
  }
  _voiceCache = map;
  return map;
}

// ─── ElevenLabs synthesis → mp3 bytes ───────────────────────────────────────────
async function synthesize(apiKey: string, voiceId: string, text: string, modelId: string): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: text.slice(0, 2500), model_id: modelId, voice_settings: DEFAULT_VOICE_SETTINGS }),
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

// ─── Briefing / cue copy (Claude Haiku, deterministic fallback) ──────────────────
async function writeWithClaude(apiKey: string, model: string, system: string, user: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 400, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) { console.error(`[bbf-biokinetic-briefing] anthropic ${res.status}`); return null; }
    const j = await res.json().catch(() => null);
    const block = Array.isArray(j?.content) ? j.content.find((b: any) => b?.type === 'text') : null;
    return block?.text?.trim() || null;
  } catch (e) {
    console.error('[bbf-biokinetic-briefing] anthropic failed:', (e as Error).message);
    return null;
  }
}

function forecastFallback(lift: string, f: any, locale: string): string {
  const proj = f?.projected_1rm ?? 'N/A';
  const conf = f?.confidence_score ?? 'Moderate';
  const detected = f?.ot_signal?.detected === true;
  if (locale === 'es') {
    return `Informe biocinético para ${lift}. Tu proyección a 30 días es ${proj}, con confianza ${conf}. ` +
      (detected ? `El radar marca sobreentrenamiento: baja el volumen, prioriza el sueño y vuelve más fuerte.`
                : `La ventana anabólica está abierta y tu carga está equilibrada. Mantén la progresión y ataca tus series con intención.`);
  }
  if (locale === 'pt') {
    return `Briefing biocinético para ${lift}. Sua projeção de 30 dias é ${proj}, com confiança ${conf}. ` +
      (detected ? `O radar aponta overtraining: reduza o volume, priorize o sono e volte mais forte.`
                : `A janela anabólica está aberta e sua carga está equilibrada. Mantenha a progressão e ataque as séries com intenção.`);
  }
  return `Biokinetic briefing for the ${lift}. Your 30-day projection is ${proj}, at ${conf} confidence. ` +
    (detected ? `The radar flags overtraining — pull volume back, prioritize sleep, and come back sharper.`
              : `Your anabolic window is open and load is balanced. Hold the progression and attack your top sets with intent.`);
}

function programFallback(ex: any, locale: string): string {
  const name = ex?.exercise_name || ex?.name || 'this movement';
  const reps = ex?.target_reps ?? '';
  const cue = (Array.isArray(ex?.form_cues) && ex.form_cues[0]) ? ex.form_cues[0] : '';
  if (locale === 'es') return `${name}. ${reps ? `Apunta a ${reps} repeticiones limpias. ` : ''}Aprieta el core, controla la bajada y explota en cada repetición. ${cue}`.trim();
  if (locale === 'pt') return `${name}. ${reps ? `Mire ${reps} repetições limpas. ` : ''}Trave o core, controle a descida e exploda em cada repetição. ${cue}`.trim();
  return `${name}. ${reps ? `Hit ${reps} clean reps. ` : ''}Brace the core, control the eccentric, and drive through every rep. ${cue}`.trim();
}

// Section coaches (recovery/prehab/cardio): the client sends pre-authored cue
// notes (breathing/form/intensity, or drill/zone guidance) in `cue_text`. Claude
// renders them as a natural spoken cue IN THE LOCALE (translating EN-only library
// cues to ES/PT as needed) and verbalizes ratings like "6/10" → "six out of ten".
const SECTION_LABEL: Record<string, Record<string, string>> = {
  recovery: { en: 'mobility and recovery', es: 'movilidad y recuperación', pt: 'mobilidade e recuperação' },
  prehab:   { en: 'prehab and injury-prevention', es: 'prehabilitación y prevención de lesiones', pt: 'prehabilitação e prevenção de lesões' },
  cardio:   { en: 'conditioning and cardio', es: 'acondicionamiento y cardio', pt: 'condicionamento e cardio' },
};

async function composeText(context: string, payload: any, locale: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const model = routeAndLog('bbf-biokinetic-briefing', context === 'forecast' ? 'snapshot_synthesis' : 'coach_cue');

  if (context === 'recovery' || context === 'prehab' || context === 'cardio') {
    const cueText = String(payload?.cue_text ?? '').replace(/\s+/g, ' ').trim().slice(0, 1400);
    if (!cueText) return '';
    const label = (SECTION_LABEL[context] || SECTION_LABEL.recovery)[locale] || SECTION_LABEL[context].en;
    if (ANTHROPIC_API_KEY) {
      const sys = `You are an elite ${label} coach speaking directly into the athlete's ear — warm, calm, and unhurried, like a real person standing right beside them. Record a spoken cue (3-5 flowing sentences, ~80 words) in ${LOCALE_NAME[locale]}. Second person, encouraging, conversational. Use natural commas and gentle pauses so it breathes and never sounds rushed or clipped, and add a little human connective tissue ("nice and easy", "stay with me here", "good") so it feels alive, not read aloud. Preserve the breathing, form, and intensity guidance from the notes. Convert numeric ratings like "6/10" into spoken words ("six out of ten"). Natural human speech only — NO markdown, NO lists, NO preamble, NO quotes, NO emojis.`;
      const user = `Coaching notes (may be in English — speak them in ${LOCALE_NAME[locale]}):\n${cueText}\n\nSpeak the cue now.`;
      const t = await writeWithClaude(ANTHROPIC_API_KEY, model, sys, user);
      if (t) return t;
    }
    return cueText; // deterministic fallback (source language)
  }

  if (context === 'program') {
    const ex = payload?.exercise || payload || {};
    const name = String(ex?.exercise_name || ex?.name || 'this movement').slice(0, 80);
    const reps = String(ex?.target_reps ?? '').slice(0, 24);
    const sets = String(ex?.target_sets ?? '').slice(0, 8);
    const cues = Array.isArray(ex?.form_cues) ? ex.form_cues.filter(Boolean).slice(0, 4) : [];
    const equip = String(ex?.equipment ?? '').slice(0, 48);
    if (ANTHROPIC_API_KEY) {
      const sys = `You are an elite strength coach giving a short in-ear cue (2-3 sentences, ~45 words) in ${LOCALE_NAME[locale]}. Second person, confident and motivating but HUMAN — a real coach talking, not a robot barking orders. Reference the movement and ONE form cue, and let it land with natural commas and rhythm so it sounds smooth, not clipped. No markdown, no preamble, no quotes.`;
      const user = `Exercise: ${name}\nTarget: ${sets ? sets + ' x ' : ''}${reps}\nForm cues: ${cues.join('; ') || '(standard execution)'}\nEquipment: ${equip || '(n/a)'}\nGive the cue now.`;
      const t = await writeWithClaude(ANTHROPIC_API_KEY, model, sys, user);
      if (t) return t;
    }
    return programFallback({ exercise_name: name, target_reps: reps, form_cues: cues }, locale);
  }

  // forecast
  const lift = String(payload?.lift_name || 'your main lift').slice(0, 60);
  const forecast = payload?.forecast ?? null;
  if (ANTHROPIC_API_KEY) {
    const sys = `You are the BBF Smart Coach recording a SPOKEN audio briefing (~100 words, max 120) in ${LOCALE_NAME[locale]}. Direct, motivational, second person. NO markdown, NO lists — flowing speech, 3-5 short sentences. Ground every claim in the telemetry. End with one concrete directive.`;
    const user = `Lift: ${lift}\nTelemetry JSON:\n${JSON.stringify(forecast ?? {}).slice(0, 1500)}\n\nWrite the spoken briefing now.`;
    const t = await writeWithClaude(ANTHROPIC_API_KEY, model, sys, user);
    if (t) return t;
  }
  return forecastFallback(lift, forecast, locale);
}

// ─── TTS cache (bbf_coach_audio) — recovery/prehab/cardio cues keyed by a stable
// hash of (context|locale|cue_ref), so an identical cue never re-bills ElevenLabs
// + Claude. Best-effort: any cache failure degrades to a live synth. ───────────────
function bytesToB64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function readCoachCache(url: string, key: string, hash: string): Promise<any | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_coach_audio?cue_hash=eq.${encodeURIComponent(hash)}&select=audio_b64,mime,voice_id,voice_name&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}
async function writeCoachCache(url: string, key: string, row: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${url}/rest/v1/bbf_coach_audio`, {
      method: 'POST',
      headers: { ...pgHeaders(key), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (e) { console.warn('[bbf-biokinetic-briefing] cache write failed:', (e as Error).message); }
}

// ─── handler ─────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

  // GET ?voices=1 → resolved locale→voice diagnostic (no audio, no secrets).
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('voices') === '1') {
      if (!ELEVENLABS_API_KEY) return jsonResponse({ ok: false, reason: 'config_missing_elevenlabs_key' });
      const map = await resolveVoices(ELEVENLABS_API_KEY);
      return jsonResponse({ ok: Boolean(map), resolved: map, forbidden_excluded: FORBIDDEN_VOICE, targets: LOCALE_VOICE_NAME });
    }
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const VALID_CONTEXTS = ['program', 'forecast', 'recovery', 'prehab', 'cardio'];
  const context = VALID_CONTEXTS.includes(payload?.context) ? payload.context : 'forecast';
  const locale = localeCode(payload?.locale ?? payload?.lang);
  // A stable per-cue identity (e.g. "recovery:stat_calf_001") enables caching that
  // survives Claude's non-deterministic phrasing — we hash the INPUT, not the prose.
  const cueRef = typeof payload?.cue_ref === 'string' ? payload.cue_ref.slice(0, 160) : '';

  // ─── HARD ENTITLEMENT GATE (FAIL-CLOSED) — BEFORE any paid compute ──────────────
  // Identity resolved server-side from the vault token. program → voice_coach,
  // forecast → biokinetic_forecast (both Autonomous+). A Baseline/Youth/anon caller
  // is rejected here, so NO Claude Haiku synthesis and NO ElevenLabs call is burned.
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // program + the section coaches (recovery/prehab/cardio) all gate on the paid
  // Voice Coach feature (Autonomous+); only the forecast briefing uses its own key.
  const feature = context === 'forecast' ? 'biokinetic_forecast' : 'voice_coach';
  const gate = await requireEntitlement(SUPABASE_URL, SERVICE_KEY, payload?.vault_token ?? req.headers.get('x-bbf-vault-token'), feature);
  if (!gate.ok) return jsonResponse({ error: gate.error, detail: gate.detail }, gate.status);

  // ─── CACHE HIT — serve a stored cue before burning any Claude/ElevenLabs spend ──
  let cueHash = '';
  const cacheable = Boolean(cueRef) && Boolean(SUPABASE_URL) && Boolean(SERVICE_KEY);
  if (cacheable) {
    cueHash = await sha256hex(`${context}|${locale}|${cueRef}`);
    const hit = await readCoachCache(SUPABASE_URL as string, SERVICE_KEY as string, cueHash);
    if (hit?.audio_b64) {
      console.log(`[bbf-biokinetic-briefing] cache HIT ctx=${context} locale=${locale} ref=${cueRef}`);
      return new Response(b64ToBytes(hit.audio_b64), {
        status: 200,
        headers: {
          ...CORS,
          'Content-Type': hit.mime || 'audio/mpeg',
          'Cache-Control': 'private, max-age=0, no-store',
          'X-BBF-Voice': hit.voice_name || '',
          'X-BBF-Voice-Id': hit.voice_id || '',
          'X-BBF-Context': context,
          'X-BBF-Cache': 'hit',
        },
      });
    }
  }

  if (!ELEVENLABS_API_KEY) {
    return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);
  }

  // 1 — resolve the locale voice (fall back en → any non-forbidden voice).
  const voices = await resolveVoices(ELEVENLABS_API_KEY);
  const voice = voices?.[locale] || voices?.en || (voices ? Object.values(voices)[0] : null);
  if (!voice?.voice_id) {
    return jsonResponse({ error: 'voice_unresolved', detail: 'No ElevenLabs voice could be resolved for this locale.' }, 502);
  }

  // 2 — compose the text (Claude Haiku, deterministic fallback).
  const text = await composeText(context, payload, locale);

  // 3 — synthesize. Program cues use turbo (low latency but FAR more natural than
  // flash, which was the robotic/clipped culprit); everything else uses the richest
  // prosody model. Both honor the warm voice settings + 0.92 speed above.
  const modelId = context === 'program' ? 'eleven_turbo_v2_5' : 'eleven_multilingual_v2';
  const tts = await synthesize(ELEVENLABS_API_KEY, voice.voice_id, text, modelId);
  if (!tts.ok) {
    console.error(`[bbf-biokinetic-briefing] tts ${tts.status}: ${tts.detail}`);
    return jsonResponse({ error: 'tts_failed', detail: `ElevenLabs returned ${tts.status}.` }, 502);
  }

  // Persist to the cache (best-effort) so the next identical cue skips Claude + ElevenLabs.
  if (cacheable && cueHash) {
    const bytes = new Uint8Array(tts.buf);
    await writeCoachCache(SUPABASE_URL as string, SERVICE_KEY as string, {
      cue_hash: cueHash, context, locale, cue_ref: cueRef,
      voice_id: voice.voice_id, voice_name: voice.name, narrative: text,
      audio_b64: bytesToB64(bytes), mime: 'audio/mpeg', bytes: bytes.length, model_id: modelId,
    });
  }

  return new Response(tts.buf, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=0, no-store',
      'X-BBF-Voice': voice.name,
      'X-BBF-Voice-Id': voice.voice_id,
      'X-BBF-Context': context,
      'X-BBF-Cache': cacheable ? 'miss' : 'off',
    },
  });
});
