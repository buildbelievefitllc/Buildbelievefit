// supabase/functions/bbf-weekly-brief-scenario-engine/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY BRIEF — the coach's Monday voice memo. A deterministic scenario engine
// (hierarchy: SAFETY → COMPLIANCE → PROGRESSION → NEUTRAL) renders a spoken
// script from the athlete's week telemetry, voices it through the SAME locale-
// mapped ElevenLabs voice the rest of the platform uses (en → "BBF Coach"), and
// returns it audio-first to the top-of-fold Hub card.
//
// REWORK (CEO backend-fix order) — closes the draft's blockers against the REAL
// platform architecture:
//   • Audio is uploaded to the PRIVATE `bbf-coach-audio` storage bucket; the
//     response carries a freshly SIGNED url (re-signed on every read, so the
//     weekly cache never serves an expired link). No more stub URL.
//   • FAIL-CLOSED entitlement gate: identity is resolved server-side from the
//     vault token (x-bbf-vault-token header OR ?vault_token query) — the raw
//     ?user_id is NEVER trusted. Gates on the paid `voice_coach` feature (§7).
//   • Persists to `bbf_weekly_briefs` (one row per user · ISO year+week) — no
//     collision with the section-coach `bbf_coach_audio` cache.
//   • Returns `rendered_script` so the UI transcript drawer renders.
//
// §4 NOTE: this engine makes NO Claude call (the scripts are deterministic
// templates), so there is no model string to route through model-router.ts. The
// voice synth calls ElevenLabs directly — identical to bbf-biokinetic-briefing,
// the platform's reference TTS function. (The prompt's `routeModel({model:'tts'})`
// abstraction does not exist in this codebase; model-router routes Claude only.)
//
// Returns JSON (not a blob): { user_id, scenario, substatus, audio_url,
// rendered_script, locked_in, timestamp }. GET only (+ OPTIONS preflight).

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY') || '';
const AUDIO_BUCKET = 'bbf-coach-audio';
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

// ═══════════════════════════════════════════════════════════════════════════
// ENTITLEMENT GATE (inlined from _shared/entitlement-gate.ts · FAIL-CLOSED)
// ═══════════════════════════════════════════════════════════════════════════
const GROUP = { BASELINE: 'baseline', AUTONOMOUS: 'autonomous', APEX: 'apex', YOUTH: 'youth', ALL: 'allaccess' } as const;
type Group = typeof GROUP[keyof typeof GROUP];
const TIER_TO_GROUP: Record<string, Group> = {
  catalyst: GROUP.BASELINE, momentum: GROUP.BASELINE, fuel_foundation: GROUP.BASELINE,
  autonomous: GROUP.AUTONOMOUS, fuel_performance: GROUP.AUTONOMOUS,
  fuel_sovereign: GROUP.APEX, kickstart_6wk_3x: GROUP.APEX, kickstart_6wk_4x: GROUP.APEX,
  transformation_8wk_3x: GROUP.APEX, transformation_8wk_4x: GROUP.APEX,
  sovereign_12wk_3x: GROUP.APEX, sovereign_12wk_4x: GROUP.APEX,
  rising_athlete: GROUP.YOUTH,
  lite: GROUP.BASELINE, gateway: GROUP.AUTONOMOUS, architect: GROUP.AUTONOMOUS, sovereign: GROUP.APEX,
  youth_athlete: GROUP.YOUTH, nutrition_essentials: GROUP.BASELINE, nutrition_platinum: GROUP.APEX,
};
const AUTO_BAND: Group[] = [GROUP.AUTONOMOUS, GROUP.APEX, GROUP.ALL];
const FEATURE_ACCESS: Record<string, Group[]> = { voice_coach: AUTO_BAND };

type Gate = { ok: true; user_id: string } | { ok: false; status: number; error: string; detail: string };
async function requireVoiceCoach(supa: ReturnType<typeof createClient>, token: string): Promise<Gate> {
  const tok = String(token || '').trim();
  if (!tok) return { ok: false, status: 401, error: 'missing_session', detail: 'A vault session token is required.' };
  const { data: uid } = await supa.rpc('_bbf_uid_from_vault_token', { p_session_token: tok });
  const userId = typeof uid === 'string' && uid ? uid : null;
  if (!userId) return { ok: false, status: 401, error: 'invalid_session', detail: 'Vault session is invalid or expired.' };
  const { data: rows } = await supa
    .from('bbf_users')
    .select('uid, subscription_tier, trial_expires_at, access_status, role')
    .eq('id', userId).is('deleted_at', null).limit(1);
  const row = Array.isArray(rows) && rows.length ? rows[0] as Record<string, unknown> : null;
  if (!row) return { ok: false, status: 401, error: 'invalid_session', detail: 'No active account for this session.' };
  if (String(row.access_status || '') === 'locked') return { ok: false, status: 403, error: 'account_locked', detail: 'This account is locked.' };
  const role = String(row.role || '').toLowerCase();
  const uidSlug = String(row.uid || '').toLowerCase();
  const godMode = role === 'admin' || role === 'trainer' || role === 'coach' || uidSlug === 'akeem';
  const trialMs = Date.parse(String(row.trial_expires_at || ''));
  const trialActive = Number.isFinite(trialMs) && trialMs > Date.now();
  if (godMode || trialActive) return { ok: true, user_id: userId };
  const slug = String(row.subscription_tier || '').trim().toLowerCase();
  const group = slug ? TIER_TO_GROUP[slug] : undefined;
  if (group && FEATURE_ACCESS.voice_coach.includes(group)) return { ok: true, user_id: userId };
  return { ok: false, status: 403, error: 'tier_not_entitled', detail: `Tier "${row.subscription_tier || '(none)'}" does not unlock the Weekly Brief.` };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO ENGINE — scripts + strict hierarchy (SAFETY → COMPLIANCE → PROGRESSION)
// ═══════════════════════════════════════════════════════════════════════════
interface UserWeekData {
  user_id: string; sessions_logged: number; unique_days: number; avg_rpe: number;
  readiness_logs: number; app_open_days: number; max_weight_this_week: number; max_weight_last_week: number;
  plateau_lift?: string; plateau_weight?: number; plateau_weeks?: number;
  progression_lift?: string; progression_weight?: number; pr_amount?: number; rep_delta?: number;
}
interface ScenarioResult { scenario: string; substatus: string; locked_in: boolean; rendered_script: string; }

const scripts: Record<string, { main: string }> = {
  PLATEAU_WITH_HIGH_RPE: { main: `Hey, so your {plateau_lift} has been stuck at {plateau_weight} for three weeks. And I'm seeing your RPE — you're grinding hard every rep. That tells me you're fatigued deep down, not just tired. Here's what we're doing: we're backing off to {deload_weight} this week. Lower weight, higher reps, but the goal isn't ego, it's recovery. Let the nervous system reset. I need you fresh so we can come back stronger. This is the smart move, not the easy move. Trust me on this.` },
  COMPLIANCE_NO_LOGS: { main: `Look, I see you hit the program this week. That's the work. But I'm not seeing the data — weight, reps, RPE. And here's the thing: I can't coach what I can't see. Every number you log is a data point. It tells me if you're getting stronger, if you're recovering, where you're breaking down. Without it, I'm flying blind. So let's make a deal: this week, every set, three pieces. Weight, reps, how hard it felt. That's it. Thirty seconds per set. Can you do that? Because I'm ready to coach you, but I need you to meet me halfway.` },
  COMPLIANCE_NO_READINESS: { main: `You're logging sets, I see that. Solid. But I'm not seeing sleep or soreness data. That's the second half of the picture. Sleep, soreness, how you feel — that's how I know if you're ready to go hard or if you need a deload. This week, after every session, thirty seconds: open the app, tell me how many hours you slept, how sore you are one to ten. That's it. I can't build the right plan without knowing how you're recovering. Let's go.` },
  COMPLIANCE_LOW_ENGAGEMENT: { main: `I see the sets you logged. But the app sees you only a couple times this week. And here's what I'm telling you: the app is where I live. Between the sets, the readiness checks, the briefs I'm dropping, that's the coaching. This week, open the app every day. Even if you're not training, check your brief, see your program, get your head right. Make it a daily habit. Because I'm in there, and I'm waiting to coach you.` },
  PROGRESSION_NEW_MAX: { main: `{progression_lift} went up {pr_amount} pounds. That's a win. Clean. But here's what I'm watching: your speed on the way up is slowing. You're muscling it instead of staying tight. This week, same weight as last week's max, but we're dialing in quality. Explosive lockout, controlled descent, pause at the bottom. We're not chasing a new number this week, we're refining the engine. Quality weight beats sloppy heavy every time.` },
  PROGRESSION_REP_MAX: { main: `{progression_lift} at {progression_weight} for {rep_delta} more reps. That's real progression. But I'm seeing the same thing: speed's dropping. This week, we dial the reps back by a couple, lock in explosive reps, controlled negatives. We're not grinding, we're moving with intent. You're strong. Now let's make sure the bar knows it.` },
  PROGRESSION_FORM_FLAG: { main: `You got a new max on {progression_lift}, {pr_amount} pounds up. That's a win. But your RPE is climbing and I'm seeing some form breakdown on the heavy sets. So here's the deal: we keep this weight for one more week, lock in the movement, then we reassess. You're strong enough to move the weight. Now I need you to move it right. Form first, then load. This week: same top weight, perfect reps only.` },
  NEUTRAL: { main: `You logged solid this week — sessions in, readiness data coming in. This week, same plan. Stay consistent. You're building the habit, and the numbers follow. Keep showing up.` },
};

function renderScript(substatus: string, data: UserWeekData): string {
  const template = scripts[substatus] || scripts.NEUTRAL;
  const deloadWeight = Math.round((data.plateau_weight || 0) * 0.9);
  return template.main
    .replace(/{plateau_lift}/g, data.plateau_lift || 'your main lift')
    .replace(/{plateau_weight}/g, String(data.plateau_weight || ''))
    .replace(/{deload_weight}/g, String(deloadWeight))
    .replace(/{progression_lift}/g, data.progression_lift || 'your main lift')
    .replace(/{progression_weight}/g, String(data.progression_weight || ''))
    .replace(/{pr_amount}/g, String(data.pr_amount || ''))
    .replace(/{rep_delta}/g, String(data.rep_delta || ''));
}

function detectScenario(data: UserWeekData): ScenarioResult {
  // A · SAFETY/FATIGUE — highest priority.
  if (data.avg_rpe > 8 && data.plateau_weeks && data.plateau_weeks >= 3) {
    return { scenario: 'PLATEAU_WITH_HIGH_RPE', substatus: 'PLATEAU_WITH_HIGH_RPE', locked_in: false, rendered_script: renderScript('PLATEAU_WITH_HIGH_RPE', data) };
  }
  // B · COMPLIANCE — second priority.
  if (data.sessions_logged < 3 || data.readiness_logs === 0) {
    let substatus = 'COMPLIANCE_NO_LOGS';
    if (data.sessions_logged >= 2 && data.readiness_logs === 0) substatus = 'COMPLIANCE_NO_READINESS';
    if (data.app_open_days < 3 && data.sessions_logged > 0) substatus = 'COMPLIANCE_LOW_ENGAGEMENT';
    return { scenario: 'COMPLIANCE', substatus, locked_in: false, rendered_script: renderScript(substatus, data) };
  }
  // C · PROGRESSION — third priority (requires "locked in" consistency).
  const locked_in = data.app_open_days >= 5 && data.readiness_logs >= 4 && data.sessions_logged >= 3;
  if (locked_in && data.max_weight_this_week > data.max_weight_last_week) {
    const substatus = data.avg_rpe > 7.5 ? 'PROGRESSION_FORM_FLAG' : 'PROGRESSION_NEW_MAX';
    return { scenario: 'PROGRESSION', substatus, locked_in: true, rendered_script: renderScript(substatus, data) };
  }
  if (locked_in && data.rep_delta && data.rep_delta > 0) {
    return { scenario: 'PROGRESSION', substatus: 'PROGRESSION_REP_MAX', locked_in: true, rendered_script: renderScript('PROGRESSION_REP_MAX', data) };
  }
  // D · NEUTRAL — fallback.
  return { scenario: 'NEUTRAL', substatus: 'NEUTRAL', locked_in: true, rendered_script: renderScript('NEUTRAL', data) };
}

// ═══════════════════════════════════════════════════════════════════════════
// ELEVENLABS VOICE — resolve "BBF Coach" live from the CEO account (self-heals on
// rename), then synthesize. Mirrors bbf-biokinetic-briefing exactly.
// ═══════════════════════════════════════════════════════════════════════════
const FORBIDDEN_VOICE = 'jamal';
const BRIEF_VOICE_NAME = 'BBF Coach';
const VOICE_SETTINGS = { stability: 0.45, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true };
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
function deburr(s: unknown): string { return String(s ?? '').normalize('NFD').replace(COMBINING_MARKS, '').trim().toLowerCase(); }

let _voice: { voice_id: string; name: string } | null = null;
async function resolveBriefVoice(apiKey: string): Promise<{ voice_id: string; name: string } | null> {
  if (_voice) return _voice;
  let voices: any[] = [];
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': apiKey } });
    if (!res.ok) { console.error(`[weekly-brief] /v1/voices ${res.status}`); return null; }
    const j = await res.json().catch(() => null);
    voices = Array.isArray(j?.voices) ? j.voices : [];
  } catch (e) { console.error('[weekly-brief] voices fetch failed:', (e as Error).message); return null; }
  const candidates = voices.filter((v) => !deburr(v?.name).includes(FORBIDDEN_VOICE));
  const wn = deburr(BRIEF_VOICE_NAME);
  const v = candidates.find((x) => deburr(x?.name) === wn)
    || candidates.find((x) => deburr(x?.name).startsWith(wn))
    || candidates.find((x) => deburr(x?.name).includes(wn))
    || candidates[0] || null;
  if (!v?.voice_id) return null;
  _voice = { voice_id: String(v.voice_id), name: String(v.name) };
  return _voice;
}

async function synthesize(apiKey: string, voiceId: string, text: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: text.slice(0, 2500), model_id: 'eleven_multilingual_v2', voice_settings: VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) { console.error(`[weekly-brief] tts ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`); return null; }
    return await res.arrayBuffer();
  } catch (e) { console.error('[weekly-brief] synth failed:', (e as Error).message); return null; }
  finally { clearTimeout(timeout); }
}

// ISO year + week (Mon-based) — the cache key dimension.
function isoYearWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_unavailable', detail: 'Server identity store is unreachable.' }, 503);

  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const url = new URL(req.url);

  // Vault token from the dedicated header or the query (NEVER the raw ?user_id).
  const token = req.headers.get('x-bbf-vault-token') || url.searchParams.get('vault_token') || '';

  // ── FAIL-CLOSED GATE — before any paid compute ─────────────────────────────
  const gate = await requireVoiceCoach(supa, token);
  if (!gate.ok) return jsonResponse({ error: gate.error, detail: gate.detail }, gate.status);
  const userId = gate.user_id;

  const { year, week } = isoYearWeek(new Date());

  // ── CACHE HIT — one brief per (user · year · week). Re-sign a fresh url. ────
  try {
    const { data: rows } = await supa
      .from('bbf_weekly_briefs')
      .select('scenario, substatus, locked_in, audio_path, rendered_script, created_at')
      .eq('user_id', userId).eq('year', year).eq('week_of_year', week).limit(1);
    const hit = Array.isArray(rows) && rows.length ? rows[0] as Record<string, unknown> : null;
    if (hit) {
      let audioUrl: string | null = null;
      if (hit.audio_path) {
        const { data: signed } = await supa.storage.from(AUDIO_BUCKET).createSignedUrl(String(hit.audio_path), SIGNED_URL_TTL);
        audioUrl = signed?.signedUrl || null;
      }
      console.log(`[weekly-brief] cache HIT user=${userId} ${year}w${week}`);
      return jsonResponse({
        user_id: userId, scenario: hit.scenario, substatus: hit.substatus,
        audio_url: audioUrl, rendered_script: hit.rendered_script || '',
        locked_in: hit.locked_in === true, timestamp: hit.created_at,
      }, 200, { 'X-BBF-Cache': 'hit' });
    }
  } catch (e) { console.warn('[weekly-brief] cache read failed:', (e as Error).message); }

  // ── COMPUTE — week telemetry → scenario ────────────────────────────────────
  const { data: weekRows, error: weekErr } = await supa.rpc('get_user_week_data', { p_user_id: userId });
  if (weekErr) { console.error('[weekly-brief] week-data rpc error:', weekErr.message); return jsonResponse({ error: 'week_data_failed', detail: 'Could not read your training week.' }, 502); }
  const weekData: UserWeekData = (Array.isArray(weekRows) ? weekRows[0] : weekRows) || {
    user_id: userId, sessions_logged: 0, unique_days: 0, avg_rpe: 0, readiness_logs: 0,
    app_open_days: 0, max_weight_this_week: 0, max_weight_last_week: 0,
  };
  const scenario = detectScenario(weekData);

  // ── SYNTHESIZE → UPLOAD → SIGN (best-effort; the brief still returns its
  //    transcript if the voice path fails, so the UI degrades gracefully) ──────
  let audioPath: string | null = null;
  let audioUrl: string | null = null;
  let voiceMeta: { voice_id: string; name: string } | null = null;
  if (ELEVENLABS_API_KEY) {
    voiceMeta = await resolveBriefVoice(ELEVENLABS_API_KEY);
    if (voiceMeta) {
      const buf = await synthesize(ELEVENLABS_API_KEY, voiceMeta.voice_id, scenario.rendered_script);
      if (buf) {
        const path = `${userId}/${year}-w${week}-${scenario.substatus}.mp3`;
        const { error: upErr } = await supa.storage.from(AUDIO_BUCKET)
          .upload(path, new Uint8Array(buf), { contentType: 'audio/mpeg', upsert: true });
        if (upErr) { console.error('[weekly-brief] upload failed:', upErr.message); }
        else {
          audioPath = path;
          const { data: signed } = await supa.storage.from(AUDIO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
          audioUrl = signed?.signedUrl || null;
        }
      }
    }
  }

  // ── PERSIST (one brief per week; ignore a race that already inserted it) ────
  const { error: insErr } = await supa.from('bbf_weekly_briefs').insert({
    user_id: userId, year, week_of_year: week,
    scenario: scenario.scenario, substatus: scenario.substatus, locked_in: scenario.locked_in,
    audio_path: audioPath, rendered_script: scenario.rendered_script,
    voice_id: voiceMeta?.voice_id || null, voice_name: voiceMeta?.name || null,
  });
  if (insErr && !String(insErr.message || '').toLowerCase().includes('duplicate')) {
    console.warn('[weekly-brief] persist failed:', insErr.message);
  }

  return jsonResponse({
    user_id: userId, scenario: scenario.scenario, substatus: scenario.substatus,
    audio_url: audioUrl, rendered_script: scenario.rendered_script,
    locked_in: scenario.locked_in, timestamp: new Date().toISOString(),
  }, 200, { 'X-BBF-Cache': 'miss', 'X-BBF-Voice': voiceMeta?.name || '' });
});
