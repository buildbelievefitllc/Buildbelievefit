// bbf-agent-brain — Agentic Command Center · the autonomous coaching brain
// ----------------------------------------------------------------------------
// The generation core of the closed-loop agent network:
//
//   sentinels ──► THIS FN ──► coach_action_inbox ──► Action Inbox UI ──► one-tap
//   (DB triggers + cron)       ↑ Gemini Flash          appliers (RPC, service role)
//
// TRIGGERS handled by `generate` (sentinel-only, Vault shared secret):
//   • ACWR_SPIKE        — load ramp (>= 1.5). Proposes a plan modification.
//   • STAGNANCY_ALERT   — > 48h silent across every logging surface.
//   • AUTONOMIC_OVERUSE — dual-path crisis. path_used = 'WEARABLE' (clinical
//     7-day HRV z-score vs 28-day baseline) or 'SUBJECTIVE' (composite
//     soreness/fatigue/sleep readiness z) steers the diagnostic language.
//     Proposes a plan modification.
//   • ONBOARDING        — new intake linked to a user. Semantic search over
//     research_vault (gte-small query embedding → query_research_embeddings;
//     degrades gracefully while the corpus is empty), then a structured 4-week
//     blueprint → coach_action_inbox type ONBOARDING_PLAN.
//
// COACH surface (admin-gated: X-BBF-Admin-Token or admin session token):
//   • list    — pending cards (now incl. proposed_plan_modification).
//   • resolve — { id, status } marks APPROVED/DISMISSED; with
//     { apply_override:true } it instead runs the one-tap applier server-side:
//     ONBOARDING_PLAN → bbf_apply_onboarding_plan (bbf_users.workout_plan);
//     spike/autonomic → bbf_apply_plan_override (upserts bbf_daily_protocols).
//   • health  — config probe.
//
// coach_action_inbox and every applier are RLS/EXECUTE-sealed (§7): everything
// here runs as service_role; the browser never touches PostgREST directly.
//
// Gemini: gemini-2.5-flash via zero-dependency fetch, key in the x-goog-api-key
// HEADER (never the URL), responseSchema-enforced JSON per trigger type.
// ----------------------------------------------------------------------------

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-bbf-admin-token, x-bbf-session-token, x-agent-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN    = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL   = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

// ── Service-role PostgREST helpers (bypass RLS) ─────────────────────────────
async function pgGet(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) throw new Error(`pg_get_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function pgRpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc_${res.status}:${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

async function pgWrite(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pg_${method.toLowerCase()}_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ── Coach authorization (parity with bbf-admin-roster / bbf-athlete-acwr) ───
async function uidFromSession(session: string): Promise<string | null> {
  try {
    const r = await pgRpc('_bbf_uid_from_vault_token', { p_session_token: session });
    const id = typeof r === 'string' ? r : (Array.isArray(r) && r.length ? r[0] : null);
    if (id) return String(id);
  } catch (_) { /* fall through */ }
  try {
    const nowISO = new Date().toISOString();
    const rows = await pgGet(
      `bbf_vault_sessions?select=user_id&token=eq.${encodeURIComponent(session)}` +
      `&expires_at=gt.${encodeURIComponent(nowISO)}&limit=1`,
    );
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return row?.user_id ? String(row.user_id) : null;
  } catch (_) { return null; }
}

async function isCoachAuthorized(req: Request): Promise<boolean> {
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return true;
  const session = req.headers.get('x-bbf-session-token') ?? '';
  if (!session) return false;
  const userId = await uidFromSession(session);
  if (!userId) return false;
  try {
    const rows = await pgGet(
      `bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`,
    );
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return false;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) { return false; }
}

// ── Sentinel authorization — the Vault shared secret, fail-closed ───────────
async function isSentinelAuthorized(req: Request): Promise<{ ok: boolean; status: number; error?: string }> {
  const provided = req.headers.get('x-agent-secret') ?? '';
  let expected: string | null = null;
  try { expected = await pgRpc('bbf_agent_webhook_secret', {}); } catch (_) { expected = null; }
  if (!expected || typeof expected !== 'string' || !expected.trim()) {
    console.error('[bbf-agent-brain] cannot resolve agent webhook secret — failing closed');
    return { ok: false, status: 500, error: 'secret_unavailable' };
  }
  if (!provided || provided !== expected) {
    console.warn('[bbf-agent-brain] rejected: bad or missing x-agent-secret');
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  return { ok: true, status: 200 };
}

// ── The Compact Dossier ──────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Dossier = {
  name: string;
  profileLine: string;
  acwr: { acute: number; chronic: number; ratio: number } | null;
  recentSessions: string[];
};

async function compileDossier(athleteId: string): Promise<Dossier | null> {
  const users = await pgGet(
    `bbf_users?select=name,uid,sport,position,metabolic_tier,subscription_tier,block_priority` +
    `&id=eq.${encodeURIComponent(athleteId)}&deleted_at=is.null&limit=1`,
  );
  const u = Array.isArray(users) && users.length ? users[0] : null;
  if (!u) return null;

  let acwr: Dossier['acwr'] = null;
  try {
    const r = await pgRpc('bbf_compute_acwr', { p_athlete_id: athleteId });
    const row = Array.isArray(r) && r.length ? r[0] : (r && typeof r === 'object' ? r : null);
    if (row) {
      acwr = {
        acute: Number(row.acute_ewma) || 0,
        chronic: Number(row.chronic_ewma) || 0,
        ratio: Number(row.acwr) || 0,
      };
    }
  } catch (_) { /* dossier survives without the ratio */ }

  let recentSessions: string[] = [];
  try {
    const logs = await pgGet(
      `bbf_athlete_load_logs?select=session_timestamp,session_type,duration_minutes,srpe_intensity,load_au` +
      `&athlete_id=eq.${encodeURIComponent(athleteId)}&order=session_timestamp.desc&limit=5`,
    );
    recentSessions = (Array.isArray(logs) ? logs : []).map((l: any) =>
      `${String(l.session_timestamp).slice(0, 10)} · ${l.session_type} · ${l.duration_minutes}min @ sRPE ${l.srpe_intensity} (load ${l.load_au} AU)`,
    );
  } catch (_) { /* dossier survives without session history */ }

  const profileBits = [u.sport, u.position, u.metabolic_tier, u.subscription_tier, u.block_priority]
    .filter(Boolean).map(String);
  return {
    name: String(u.name || u.uid || 'Athlete'),
    profileLine: profileBits.length ? profileBits.join(' · ') : 'general population client',
    acwr,
    recentSessions,
  };
}

// Dual-path readiness context for AUTONOMIC_OVERUSE — fresh z + concrete
// recent numbers so Gemini writes clinically (wearable) or subjectively (manual).
async function autonomicContext(athleteId: string, pathUsed: string): Promise<string[]> {
  const lines: string[] = [];
  try {
    const r = await pgRpc('bbf_compute_autonomic_readiness', { p_athlete_id: athleteId });
    const row = Array.isArray(r) && r.length ? r[0] : (r && typeof r === 'object' ? r : null);
    if (row) {
      lines.push(`Readiness path: ${row.path_used} · z-score ${row.z_score} · ACWR ${row.acwr_ratio}`);
    }
  } catch (_) { /* context is best-effort */ }
  try {
    if (pathUsed === 'WEARABLE') {
      const w = await pgGet(
        `bbf_wearable_readings?select=reading_date,hrv_ms,resting_hr,sleep_minutes` +
        `&user_id=eq.${encodeURIComponent(athleteId)}&hrv_ms=not.is.null&order=reading_date.desc&limit=7`,
      );
      for (const x of (Array.isArray(w) ? w : [])) {
        lines.push(`  wearable ${x.reading_date}: HRV ${x.hrv_ms}ms · RHR ${x.resting_hr ?? '—'} · sleep ${x.sleep_minutes != null ? Math.round(x.sleep_minutes / 60 * 10) / 10 + 'h' : '—'}`);
      }
    } else {
      const s = await pgGet(
        `bbf_readiness?select=reading_date,timestamp,score,sleep_quality,soreness_level` +
        `&user_id=eq.${encodeURIComponent(athleteId)}&order=timestamp.desc&limit=7`,
      );
      for (const x of (Array.isArray(s) ? s : [])) {
        const d = x.reading_date ?? String(x.timestamp ?? '').slice(0, 10);
        lines.push(`  check-in ${d}: readiness ${x.score ?? '—'} · sleep quality ${x.sleep_quality ?? '—'}/10 · soreness ${x.soreness_level ?? '—'}/10`);
      }
    }
  } catch (_) { /* context is best-effort */ }
  return lines;
}

// ── Gemini Flash · per-trigger structured schemas ────────────────────────────
const BASE_PROPS = {
  insight_summary: { type: 'STRING', description: 'Clear sports-science summary of the data.' },
  proposed_action: { type: 'STRING', description: 'Surgical physical training modification.' },
  draft_message:   { type: 'STRING', description: 'Direct, empathetic, high-accountability SMS-length message to the athlete.' },
};

const MODIFICATION_PROP = {
  proposed_plan_modification: {
    type: 'OBJECT',
    description: 'Structured deload block the coach can one-tap apply.',
    properties: {
      intensity_multiplier: { type: 'NUMBER', description: 'Scale target intensity/loads, 0.3-1.0 (e.g. 0.70 = 70%).' },
      volume_multiplier:    { type: 'NUMBER', description: 'Scale working sets/volume, 0.3-1.0 (e.g. 0.80 = 80%).' },
      target_days:          { type: 'INTEGER', description: 'Upcoming days to apply the modification, 1-14.' },
      modification_reason:  { type: 'STRING', description: 'One-line physiological rationale.' },
    },
    required: ['intensity_multiplier', 'volume_multiplier', 'target_days', 'modification_reason'],
  },
};

const BLUEPRINT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ...BASE_PROPS,
    blueprint: {
      type: 'OBJECT',
      description: 'A 4-week baseline macrocycle.',
      properties: {
        overview: { type: 'STRING', description: '2-3 sentence programming rationale.' },
        weeks: {
          type: 'ARRAY',
          description: 'Exactly 4 weeks.',
          items: {
            type: 'OBJECT',
            properties: {
              week:  { type: 'INTEGER' },
              focus: { type: 'STRING', description: 'The week emphasis + intensity band (e.g. "Anatomical adaptation · RPE 6-7").' },
              days: {
                type: 'ARRAY',
                description: 'One entry per training day.',
                items: {
                  type: 'OBJECT',
                  properties: {
                    day:     { type: 'STRING', description: 'e.g. "Day 1 — Lower".' },
                    session: { type: 'STRING', description: 'The session prescription: split, movement patterns, sets x reps band, target RPE.' },
                  },
                  required: ['day', 'session'],
                },
              },
            },
            required: ['week', 'focus', 'days'],
          },
        },
        progression_pacing: { type: 'STRING', description: 'Week-over-week progression rule.' },
      },
      required: ['overview', 'weeks', 'progression_pacing'],
    },
  },
  required: ['insight_summary', 'proposed_action', 'draft_message', 'blueprint'],
};

function schemaFor(triggerType: string) {
  if (triggerType === 'ONBOARDING') return BLUEPRINT_SCHEMA;
  if (triggerType === 'ACWR_SPIKE' || triggerType === 'AUTONOMIC_OVERUSE') {
    return {
      type: 'OBJECT',
      properties: { ...BASE_PROPS, ...MODIFICATION_PROP },
      required: ['insight_summary', 'proposed_action', 'draft_message', 'proposed_plan_modification'],
    };
  }
  return { type: 'OBJECT', properties: BASE_PROPS, required: ['insight_summary', 'proposed_action', 'draft_message'] };
}

async function callGemini(prompt: string, schema: unknown): Promise<any> {
  if (!GEMINI_API_KEY) throw new Error('gemini_key_missing');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`gemini_${res.status}:${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error(`gemini_empty:${JSON.stringify(data?.promptFeedback ?? {}).slice(0, 200)}`);
  return JSON.parse(raw);
}

const clean = (v: unknown, cap: number) => String(v ?? '').trim().slice(0, cap);

// Clamp a Gemini modification block into sane bounds (the SQL applier clamps
// again — defense in depth on both sides of the wire).
function clampModification(m: any): Record<string, unknown> | null {
  if (!m || typeof m !== 'object') return null;
  const num = (v: unknown, lo: number, hi: number, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : dflt;
  };
  return {
    intensity_multiplier: Math.round(num(m.intensity_multiplier, 0.3, 1.0, 0.7) * 100) / 100,
    volume_multiplier:    Math.round(num(m.volume_multiplier, 0.3, 1.0, 0.8) * 100) / 100,
    target_days:          Math.round(num(m.target_days, 1, 14, 3)),
    modification_reason:  clean(m.modification_reason, 500) || 'Elevated training strain detected.',
  };
}

// ── Prompts ──────────────────────────────────────────────────────────────────
const VOICE = [
  'You are the AI performance co-coach inside Build Believe Fit, a human-optimization coaching platform.',
  'Write for the COACH (insight + action) and for the ATHLETE (draft message). Never mention AI, systems, or internal tooling.',
];

function dossierBlock(d: Dossier): string[] {
  return [
    'ATHLETE DOSSIER',
    `Name: ${d.name}`,
    `Profile: ${d.profileLine}`,
    `Subjective ACWR (Foster sRPE): ${d.acwr ? `acute ${d.acwr.acute} AU · chronic ${d.acwr.chronic} AU · ratio ${d.acwr.ratio}` : 'no load data yet'}`,
    'Last 5 sessions:',
    ...(d.recentSessions.length ? d.recentSessions.map((s) => `  - ${s}`) : ['  - (none logged)']),
  ];
}

function draftMessageRule(name: string): string {
  return `- draft_message: an SMS to ${name.split(/\s+/)[0]} in the coach's voice — direct, empathetic, high-accountability, under 320 characters, signed "Build Believe Fit".`;
}

function buildTriggerPrompt(d: Dossier, triggerType: string, riskScore: number | null, pathUsed: string, autonomicLines: string[], zScore: number | null): string {
  let trigger: string;
  let styleRule = '';
  if (triggerType === 'ACWR_SPIKE') {
    trigger = `TRIGGER: ACWR SPIKE. The athlete's acute:chronic workload ratio just hit ${riskScore ?? d.acwr?.ratio ?? 'unknown'} (>= 1.5 = elevated injury-risk zone; sweet spot is 0.8-1.3).`;
  } else if (triggerType === 'AUTONOMIC_OVERUSE') {
    if (pathUsed === 'WEARABLE') {
      trigger = `TRIGGER: AUTONOMIC CRISIS (wearable-verified). ACWR ${riskScore ?? 'elevated'} >= 1.5 combined with a 7-day HRV rolling z-score of ${zScore ?? '<= -1.0'} vs the athlete's own 28-day baseline — objective parasympathetic suppression under a rising load ramp.`;
      styleRule = 'Write the insight in CLINICAL wearable terms: HRV z-score, baseline deviation, autonomic/parasympathetic suppression, resting HR drift. Cite the concrete numbers below.';
    } else {
      trigger = `TRIGGER: SUBJECTIVE FATIGUE CRISIS (manual check-ins — no wearable). ACWR ${riskScore ?? 'elevated'} >= 1.5 combined with a composite subjective readiness z-score of ${zScore ?? '<= -1.5'} vs the athlete's own 28-day baseline.`;
      styleRule = 'Write the insight in SUBJECTIVE terms the athlete actually reported: soreness levels, sleep quality, fatigue accumulation. Reference the concrete check-in values below — never invent wearable metrics they do not have.';
    }
  } else {
    trigger = `TRIGGER: STAGNANCY. No training log, check-in, or readiness entry for ${riskScore != null ? `${Math.round(Number(riskScore))} hours` : 'over 48 hours'} — adherence is slipping.`;
  }

  const wantsModification = triggerType === 'ACWR_SPIKE' || triggerType === 'AUTONOMIC_OVERUSE';
  return [
    ...VOICE, '',
    trigger,
    ...(styleRule ? ['', styleRule] : []),
    '',
    ...dossierBlock(d),
    ...(autonomicLines.length ? ['', 'READINESS TELEMETRY (most recent first):', ...autonomicLines] : []),
    '',
    'Respond with the required JSON only:',
    '- insight_summary: 2-3 sentence sports-science read of what the data shows.',
    '- proposed_action: one surgical training modification the coach can apply this week.',
    draftMessageRule(d.name),
    ...(wantsModification
      ? ['- proposed_plan_modification: the one-tap deload block. Multipliers between 0.3 and 1.0; target_days 1-14 (typically 2-5). Be surgical, not drastic, unless the data demands it.']
      : []),
  ].join('\n');
}

// ── ONBOARDING · semantic protocol search + 4-week blueprint ─────────────────
let aiSession: any = null;
async function embedQuery(text: string): Promise<number[] | null> {
  try {
    if (!aiSession) aiSession = new (globalThis as any).Supabase.ai.Session('gte-small');
    const v = await aiSession.run(text, { mean_pool: true, normalize: true });
    return Array.isArray(v) && v.length === 384 ? (v as number[]) : null;
  } catch (e) {
    console.warn('[bbf-agent-brain] query embedding unavailable:', String(e).slice(0, 120));
    return null;
  }
}

async function searchResearch(queryText: string): Promise<Array<{ title: string; abstract: string; similarity: number }>> {
  const emb = await embedQuery(queryText);
  if (!emb) return [];
  try {
    const rows = await pgRpc('query_research_embeddings', {
      query_embedding: JSON.stringify(emb),
      match_threshold: 0.35,
      match_count: 4,
    });
    return (Array.isArray(rows) ? rows : [])
      .map((r: any) => ({ title: String(r.title ?? ''), abstract: String(r.abstract ?? '').slice(0, 600), similarity: Number(r.similarity) || 0 }));
  } catch (e) {
    console.warn('[bbf-agent-brain] research search failed (non-fatal):', String(e).slice(0, 120));
    return [];
  }
}

function intakeLines(i: any): string[] {
  const kg = i.body_mass_g ? Math.round(Number(i.body_mass_g) / 100) / 10 : null;
  const cm = i.height_mm ? Math.round(Number(i.height_mm) / 10) : null;
  const age = i.birth_year ? new Date().getFullYear() - Number(i.birth_year) : null;
  return [
    `Goal: ${i.goal ?? 'general fitness'}`,
    `Sport/Position: ${[i.sport, i.position].filter(Boolean).join(' / ') || '—'}`,
    `Availability: ${i.training_days_wk ?? '?'} days/wk · ${i.session_minutes ?? '?'} min/session`,
    `Body: ${kg ? `${kg}kg` : '—'} · ${cm ? `${cm}cm` : '—'} · ${i.body_fat_pct ? `${i.body_fat_pct}% BF` : 'BF —'} · ${age ? `${age}y` : 'age —'}`,
    `Friction flags: ${Array.isArray(i.friction_flags) && i.friction_flags.length ? i.friction_flags.join(', ') : 'none'}`,
    `Dietary: ${i.dietary_profile ?? '—'}`,
  ];
}

function blueprintToPlanText(name: string, bp: any): string {
  const lines: string[] = [
    `## 4-WEEK BASELINE MACROCYCLE — ${name}`,
    '',
    clean(bp.overview, 800),
    '',
  ];
  for (const w of (Array.isArray(bp.weeks) ? bp.weeks.slice(0, 4) : [])) {
    lines.push(`### WEEK ${w.week} — ${clean(w.focus, 200)}`);
    for (const day of (Array.isArray(w.days) ? w.days.slice(0, 7) : [])) {
      lines.push(`- **${clean(day.day, 80)}**: ${clean(day.session, 500)}`);
    }
    lines.push('');
  }
  lines.push(`**Progression:** ${clean(bp.progression_pacing, 500)}`);
  return lines.join('\n').slice(0, 12000);
}

async function actOnboarding(athleteId: string, intakeId: string | null): Promise<Response> {
  // One blueprint per athlete (any status) — mirrors the DB trigger's guard.
  const existing = await pgGet(
    `coach_action_inbox?select=id&athlete_id=eq.${encodeURIComponent(athleteId)}&type=eq.ONBOARDING_PLAN&limit=1`,
  );
  if (Array.isArray(existing) && existing.length) {
    return jsonResponse({ ok: true, deduped: true, existing_id: existing[0].id });
  }

  const dossier = await compileDossier(athleteId);
  if (!dossier) return jsonResponse({ error: 'athlete_not_found' }, 404);

  // Intake row: by id when the trigger passed one, else the athlete's latest.
  let intake: any = null;
  try {
    const path = intakeId && UUID_RE.test(intakeId)
      ? `bbf_pathfinder_intakes?select=*&id=eq.${encodeURIComponent(intakeId)}&limit=1`
      : `bbf_pathfinder_intakes?select=*&consumed_by_user=eq.${encodeURIComponent(athleteId)}&order=created_at.desc&limit=1`;
    const rows = await pgGet(path);
    intake = Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (_) { /* blueprint still generatable from the dossier */ }

  // Semantic protocol search — degrades to [] while research_vault is empty.
  const searchText = [intake?.goal, intake?.sport, dossier.profileLine].filter(Boolean).join(' · ') || 'general hypertrophy strength foundation';
  const research = await searchResearch(searchText);
  const researchLines = research.length
    ? ['MATCHED SPORTS-SCIENCE PROTOCOLS (internal research vault):',
       ...research.map((r) => `  - [sim ${r.similarity.toFixed(2)}] ${r.title}: ${r.abstract}`)]
    : ['(No matched protocols in the research vault yet — program from established first principles.)'];

  const prompt = [
    ...VOICE, '',
    'TRIGGER: ONBOARDING. A new client just completed intake. Architect their 4-week baseline macrocycle.',
    '',
    ...dossierBlock(dossier),
    '',
    'INTAKE FORM:',
    ...(intake ? intakeLines(intake).map((s) => `  ${s}`) : ['  (intake details unavailable — use the dossier)']),
    '',
    ...researchLines,
    '',
    'Respond with the required JSON only:',
    '- insight_summary: 2-3 sentence programming rationale for THIS client.',
    '- proposed_action: what the coach should verify before deploying (equipment, injury screen, first-week calibration).',
    draftMessageRule(dossier.name),
    '- blueprint: EXACTLY 4 weeks. Respect their availability (days/wk + session length). Start conservative (anatomical adaptation), progress deliberately. Every day entry needs a concrete session: split, movement patterns, sets x reps band, target RPE.',
  ].join('\n');

  console.log(`[bbf-agent-brain] (bbf-agent-brain, onboarding, ${GEMINI_MODEL}) → ${athleteId}`);
  const gen = await callGemini(prompt, BLUEPRINT_SCHEMA);
  const planText = blueprintToPlanText(dossier.name, gen.blueprint ?? {});

  const inserted = await pgWrite('POST', 'coach_action_inbox', [{
    athlete_id: athleteId,
    type: 'ONBOARDING_PLAN',
    risk_score: null,
    insight_summary: clean(gen.insight_summary, 2000),
    proposed_action: clean(gen.proposed_action, 2000),
    draft_message: clean(gen.draft_message, 1000),
    proposed_plan_modification: {
      kind: 'onboarding_blueprint',
      blueprint: gen.blueprint ?? null,
      plan_text: planText,
    },
  }]);
  const row = Array.isArray(inserted) && inserted.length ? inserted[0] : null;
  return jsonResponse({ ok: true, id: row?.id ?? null, model: GEMINI_MODEL, research_matches: research.length });
}

// ── Actions ──────────────────────────────────────────────────────────────────
const TRIGGER_TYPES = new Set(['ACWR_SPIKE', 'STAGNANCY_ALERT', 'AUTONOMIC_OVERUSE', 'ONBOARDING']);

async function actGenerate(body: Record<string, unknown>): Promise<Response> {
  const athleteId = String(body?.athlete_id ?? '');
  const triggerType = String(body?.trigger_type ?? '');
  const riskRaw = Number(body?.risk_score);
  const riskScore = Number.isFinite(riskRaw) ? riskRaw : null;
  const zRaw = Number(body?.z_score);
  const zScore = Number.isFinite(zRaw) ? zRaw : null;
  const pathUsed = String(body?.path_used ?? '') === 'WEARABLE' ? 'WEARABLE' : 'SUBJECTIVE';

  if (!UUID_RE.test(athleteId)) return jsonResponse({ error: 'invalid_athlete_id' }, 400);
  if (!TRIGGER_TYPES.has(triggerType)) return jsonResponse({ error: 'invalid_trigger_type' }, 400);

  if (triggerType === 'ONBOARDING') {
    return await actOnboarding(athleteId, body?.intake_id ? String(body.intake_id) : null);
  }

  // Authoritative dedup: one live PENDING card per athlete+type.
  const dupes = await pgGet(
    `coach_action_inbox?select=id&athlete_id=eq.${encodeURIComponent(athleteId)}` +
    `&type=eq.${encodeURIComponent(triggerType)}&status=eq.PENDING&limit=1`,
  );
  if (Array.isArray(dupes) && dupes.length) {
    return jsonResponse({ ok: true, deduped: true, existing_id: dupes[0].id });
  }

  const dossier = await compileDossier(athleteId);
  if (!dossier) return jsonResponse({ error: 'athlete_not_found' }, 404);

  const autonomicLines = triggerType === 'AUTONOMIC_OVERUSE'
    ? await autonomicContext(athleteId, pathUsed)
    : [];

  console.log(`[bbf-agent-brain] (bbf-agent-brain, ${triggerType.toLowerCase()}${triggerType === 'AUTONOMIC_OVERUSE' ? `/${pathUsed.toLowerCase()}` : ''}, ${GEMINI_MODEL}) → ${athleteId}`);
  const gen = await callGemini(
    buildTriggerPrompt(dossier, triggerType, riskScore, pathUsed, autonomicLines, zScore),
    schemaFor(triggerType),
  );

  const out = {
    insight_summary: clean(gen.insight_summary, 2000),
    proposed_action: clean(gen.proposed_action, 2000),
    draft_message:   clean(gen.draft_message, 1000),
  };
  if (!out.insight_summary || !out.proposed_action || !out.draft_message) throw new Error('gemini_schema_violation');

  const modification = (triggerType === 'ACWR_SPIKE' || triggerType === 'AUTONOMIC_OVERUSE')
    ? clampModification(gen.proposed_plan_modification)
    : null;

  const inserted = await pgWrite('POST', 'coach_action_inbox', [{
    athlete_id: athleteId,
    type: triggerType,
    risk_score: riskScore,
    ...out,
    proposed_plan_modification: modification,
  }]);
  const row = Array.isArray(inserted) && inserted.length ? inserted[0] : null;
  return jsonResponse({ ok: true, id: row?.id ?? null, model: GEMINI_MODEL });
}

async function actList(): Promise<Response> {
  const rows = await pgGet(
    `coach_action_inbox?select=id,athlete_id,type,status,risk_score,insight_summary,proposed_action,draft_message,proposed_plan_modification,created_at,` +
    `athlete:bbf_users(name,uid)&status=eq.PENDING&order=created_at.desc&limit=50`,
  );
  return jsonResponse({ ok: true, count: Array.isArray(rows) ? rows.length : 0, actions: rows ?? [] });
}

async function actResolve(body: Record<string, unknown>): Promise<Response> {
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '').toUpperCase();
  const applyOverride = body?.apply_override === true;
  if (!UUID_RE.test(id)) return jsonResponse({ error: 'invalid_id' }, 400);

  if (applyOverride) {
    // One-tap applier — server-side, service role; the status transition to
    // APPROVED happens inside the RPC, atomically with the plan write.
    const cards = await pgGet(`coach_action_inbox?select=type&id=eq.${encodeURIComponent(id)}&status=eq.PENDING&limit=1`);
    const card = Array.isArray(cards) && cards.length ? cards[0] : null;
    if (!card) return jsonResponse({ error: 'not_found_or_processed' }, 404);
    const rpc = card.type === 'ONBOARDING_PLAN' ? 'bbf_apply_onboarding_plan' : 'bbf_apply_plan_override';
    const result = await pgRpc(rpc, { p_action_id: id });
    if (!result?.ok) return jsonResponse({ error: result?.error ?? 'apply_failed' }, 409);
    return jsonResponse({ ok: true, id, applied: rpc, ...result });
  }

  if (status !== 'APPROVED' && status !== 'DISMISSED') return jsonResponse({ error: 'invalid_status' }, 400);
  const updated = await pgWrite('PATCH',
    `coach_action_inbox?id=eq.${encodeURIComponent(id)}&status=eq.PENDING`,
    { status, processed_at: new Date().toISOString() },
  );
  if (!Array.isArray(updated) || !updated.length) return jsonResponse({ error: 'not_found_or_processed' }, 404);
  return jsonResponse({ ok: true, id, status });
}

function actHealth(): Response {
  return jsonResponse({
    ok: true,
    gemini_key_configured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
    triggers: [...TRIGGER_TYPES],
  });
}

// ── Router ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }
  const action = String(body?.action ?? 'generate');

  try {
    if (action === 'generate') {
      const gate = await isSentinelAuthorized(req);
      if (!gate.ok) return jsonResponse({ error: gate.error }, gate.status);
      return await actGenerate(body);
    }
    if (action === 'list' || action === 'resolve' || action === 'health') {
      if (!(await isCoachAuthorized(req))) return jsonResponse({ error: 'unauthorized' }, 401);
      if (action === 'list') return await actList();
      if (action === 'resolve') return await actResolve(body);
      return actHealth();
    }
    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('[bbf-agent-brain] fatal:', e);
    return jsonResponse({ error: 'server_error', detail: String(e).slice(0, 300) }, 500);
  }
});
