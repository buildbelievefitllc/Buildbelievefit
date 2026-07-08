// ═══════════════════════════════════════════════════════════════════════
// supabase/functions/bbf-eagle-eye/index.ts
// BBF EAGLE EYE · Command Center · the secondary brain
// ───────────────────────────────────────────────────────────────────────
// Oversight engine that watches ALL client data and guarantees the coaching
// cues bucketed for the DAILY Sovereign readiness message and the WEEKLY
// report stay aligned with sharp precision, per client.
//
// The two cue systems it reconciles:
//   • DAILY readiness bucket — derived from bbf_daily_protocols.readiness_score
//     (0-100, the LIVE ledger the dashboard + bbf-midnight-haiku +
//     bbf-sovereign-briefing all read). Banded RECOVERY_PRIORITY / REDUCED_LOAD
//     / MODERATE / PRIMED, with a rising/steady/dipping trend.
//   • WEEKLY report bucket — the deterministic scenario the coach's Monday brief
//     is built on (SAFETY → COMPLIANCE → PROGRESSION → NEUTRAL + substatus). We
//     read the PERSISTED brief (bbf_weekly_briefs, what the client actually got)
//     AND independently RE-DERIVE it from get_user_week_data, so a stale persisted
//     brief is caught too.
//
// It is a READ-ONLY secondary brain — it never mutates a plan. It emits a
// per-client alignment verdict (aligned / drift / conflict / no_data) with the
// exact findings, sorted worst-first. Optional Claude synthesis (deep_read mode)
// narrates the logic of a single client through the model router (Sonnet).
//
// Deliberately does NOT overlap bbf-command-feed (compliance) or bbf-sentinel
// (load-audit) — this is cue COHERENCE across the daily/weekly cadence.
//
// ── Auth ──  whole-roster data → admin only. Dual gate (mirrors bbf-command-feed):
//   X-BBF-Admin-Token: <BBF_COACH_AGENT_TOKEN>  OR  X-BBF-Session-Token: <admin session>
//
// ── Request ──
//   POST /functions/v1/bbf-eagle-eye              → roster scan (deterministic)
//   POST /functions/v1/bbf-eagle-eye { uid, mode:'deep_read' }
//        → single client + optional Claude synthesis of the client's logic
// ═══════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-session-token, x-bbf-vault-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// ─── Dual authorization (identical shape to bbf-command-feed) ────────────────────
async function uidFromSession(url: string, key: string, session: string): Promise<string | null> {
  const headers = pgHeaders(key);
  try {
    const r = await fetch(`${url}/rest/v1/rpc/_bbf_uid_from_vault_token`, {
      method: 'POST', headers, body: JSON.stringify({ p_session_token: session }),
    });
    if (r.ok) {
      const v = await r.json();
      const id = typeof v === 'string' ? v : (Array.isArray(v) && v.length ? v[0] : null);
      if (id) return String(id);
    }
  } catch (_) { /* fall through */ }
  try {
    const nowISO = new Date().toISOString();
    const r = await fetch(
      `${url}/rest/v1/bbf_vault_sessions?select=user_id&token=eq.${encodeURIComponent(session)}` +
      `&expires_at=gt.${encodeURIComponent(nowISO)}&limit=1`,
      { headers },
    );
    if (r.ok) {
      const rows = await r.json();
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      return row?.user_id ? String(row.user_id) : null;
    }
  } catch (_) { /* ignore */ }
  return null;
}
async function isAuthorized(req: Request, url: string, key: string, legacyToken: string): Promise<boolean> {
  const token = req.headers.get('x-bbf-admin-token') || '';
  if (legacyToken && token.length > 0 && token === legacyToken) return true;
  const session = req.headers.get('x-bbf-session-token') || '';
  if (!session || !url || !key) return false;
  const userId = await uidFromSession(url, key, session);
  if (!userId) return false;
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return false;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) { return false; }
}

// ═══════════════════════════════════════════════════════════════════════
// DAILY readiness bucket — from the LIVE ledger (bbf_daily_protocols)
// ───────────────────────────────────────────────────────────────────────
// Bands align with the thresholds the daily engines already act on:
//   bbf-readiness-calculator volume multipliers (0.5 / 0.8 / 1.0) scaled to 0-100
//   and bbf-midnight-haiku's "sub-65 → recovery framing" cue rule.
type DailyBand = 'RECOVERY_PRIORITY' | 'REDUCED_LOAD' | 'MODERATE' | 'PRIMED';
type Trend = 'rising' | 'steady' | 'dipping';
const DAILY_STALE_DAYS = 3; // no protocol in N days ⇒ the daily signal has gone dark

function bandForScore(score: number): DailyBand {
  if (score < 50) return 'RECOVERY_PRIORITY'; // vol 0.5 — restorative / prehab
  if (score < 65) return 'REDUCED_LOAD';       // vol 0.8 — recovery framing (midnight sub-65)
  if (score < 80) return 'MODERATE';           // tempo / TUT / form refinement
  return 'PRIMED';                             // full send
}
const BAND_LOAD: Record<DailyBand, number> = {
  RECOVERY_PRIORITY: 0.5, REDUCED_LOAD: 0.8, MODERATE: 1.0, PRIMED: 1.0,
};

interface DailyState {
  score: number | null;
  band: DailyBand | null;
  trend: Trend;
  readings: number;
  days_since_last: number | null;
  stale: boolean;
}
function deriveDaily(rows: { date: string; readiness_score: unknown }[]): DailyState {
  const scored = rows
    .map((r) => ({ date: String(r.date), score: num(r.readiness_score) }))
    .filter((r): r is { date: string; score: number } => r.score !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  if (!scored.length) {
    return { score: null, band: null, trend: 'steady', readings: 0, days_since_last: null, stale: true };
  }
  const scores = scored.map((r) => r.score);
  const current = scores[0];
  const recent = scores.slice(0, 7);
  const prior = scores.slice(7, 14);
  const rAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  const pAvg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
  const trend: Trend = (rAvg !== null && pAvg !== null)
    ? (rAvg > pAvg + 2 ? 'rising' : rAvg < pAvg - 2 ? 'dipping' : 'steady')
    : 'steady';
  const lastMs = Date.parse(scored[0].date);
  const daysSince = Number.isFinite(lastMs) ? Math.floor((Date.now() - lastMs) / 86400000) : null;
  return {
    score: current,
    band: bandForScore(current),
    trend,
    readings: scores.length,
    days_since_last: daysSince,
    stale: daysSince !== null && daysSince > DAILY_STALE_DAYS,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// WEEKLY report bucket — the deterministic scenario engine, re-derived here.
// ───────────────────────────────────────────────────────────────────────
// Faithful port of bbf-weekly-brief-scenario-engine.detectScenario over the
// SAME get_user_week_data RPC, so Eagle Eye computes the weekly bucket
// independently (the "secondary brain") — even for a client whose Monday brief
// has not been generated yet, and to catch a persisted brief that has drifted.
interface WeekData {
  sessions_logged: number; unique_days: number; avg_rpe: number;
  readiness_logs: number; app_open_days: number;
  max_weight_this_week: number; max_weight_last_week: number;
  plateau_weeks?: number | null; rep_delta?: number | null;
}
interface WeeklyBucket { scenario: string; substatus: string; locked_in: boolean; }

function detectScenario(d: WeekData): WeeklyBucket {
  if (d.avg_rpe > 8 && d.plateau_weeks && d.plateau_weeks >= 3) {
    return { scenario: 'PLATEAU_WITH_HIGH_RPE', substatus: 'PLATEAU_WITH_HIGH_RPE', locked_in: false };
  }
  if (d.sessions_logged < 3 || d.readiness_logs === 0) {
    let substatus = 'COMPLIANCE_NO_LOGS';
    if (d.sessions_logged >= 2 && d.readiness_logs === 0) substatus = 'COMPLIANCE_NO_READINESS';
    if (d.app_open_days < 3 && d.sessions_logged > 0) substatus = 'COMPLIANCE_LOW_ENGAGEMENT';
    return { scenario: 'COMPLIANCE', substatus, locked_in: false };
  }
  const lockedIn = d.app_open_days >= 5 && d.readiness_logs >= 4 && d.sessions_logged >= 3;
  if (lockedIn && d.max_weight_this_week > d.max_weight_last_week) {
    const substatus = d.avg_rpe > 7.5 ? 'PROGRESSION_FORM_FLAG' : 'PROGRESSION_NEW_MAX';
    return { scenario: 'PROGRESSION', substatus, locked_in: true };
  }
  if (lockedIn && d.rep_delta && d.rep_delta > 0) {
    return { scenario: 'PROGRESSION', substatus: 'PROGRESSION_REP_MAX', locked_in: true };
  }
  return { scenario: 'NEUTRAL', substatus: 'NEUTRAL', locked_in: true };
}

const PROGRESSION_PUSH = new Set([
  'PROGRESSION_NEW_MAX', 'PROGRESSION_REP_MAX', 'PROGRESSION_FORM_FLAG', 'NEUTRAL',
]);
const WEEKLY_RECOVERY = new Set([
  'PLATEAU_WITH_HIGH_RPE', 'COMPLIANCE_NO_LOGS', 'COMPLIANCE_NO_READINESS', 'COMPLIANCE_LOW_ENGAGEMENT',
]);

// ═══════════════════════════════════════════════════════════════════════
// THE ALIGNMENT ENGINE — deterministic cross-checks between the two buckets
// ───────────────────────────────────────────────────────────────────────
type Severity = 'conflict' | 'drift' | 'note';
interface Finding { code: string; severity: Severity; message: string; }
type Alignment = 'aligned' | 'drift' | 'conflict' | 'no_data';

function alignmentFor(
  daily: DailyState,
  weekly: WeeklyBucket | null,
  persisted: { scenario: string; substatus: string } | null,
  signals: { biomechanical_redline: boolean },
): { status: Alignment; findings: Finding[] } {
  const findings: Finding[] = [];
  const sub = weekly?.substatus ?? null;
  const weeklyPushes = sub !== null && PROGRESSION_PUSH.has(sub);
  const weeklyRecovers = sub !== null && WEEKLY_RECOVERY.has(sub);

  // 1 · Hard conflict — biomechanical redline but the weekly bucket pushes load.
  if (signals.biomechanical_redline && weeklyPushes) {
    findings.push({
      code: 'REDLINE_VS_PROGRESSION', severity: 'conflict',
      message: 'Biomechanical redline is active, yet the weekly bucket prescribes progression. Recovery cue must win.',
    });
  }

  // 2 · Conflict — weekly pushes progression while TODAY's readiness demands recovery.
  if (weeklyPushes && daily.band && (daily.band === 'RECOVERY_PRIORITY' || (daily.band === 'REDUCED_LOAD' && daily.trend === 'dipping'))) {
    findings.push({
      code: 'PUSH_VS_LOW_READINESS', severity: 'conflict',
      message: `Weekly bucket "${sub}" pushes load, but the daily readiness bucket is ${daily.band}${daily.trend === 'dipping' ? ' and dipping' : ''} (score ${daily.score}). The two cadences disagree on today's load.`,
    });
  }

  // 3 · Conflict — sustained low readiness with NO weekly recovery guidance.
  if (daily.band === 'RECOVERY_PRIORITY' && daily.trend !== 'rising' && weekly && !weeklyRecovers) {
    findings.push({
      code: 'LOW_READINESS_NO_WEEKLY_DELOAD', severity: 'conflict',
      message: `Daily readiness is in RECOVERY_PRIORITY (score ${daily.score}, ${daily.trend}) but the weekly bucket "${sub}" carries no recovery/deload cue.`,
    });
  }

  // 4 · Drift — the two engines disagree on whether readiness data even EXISTS.
  //     The weekly scenario reads readiness_logs from the retired bbf_readiness
  //     table; the daily engine reads the live bbf_daily_protocols ledger. A
  //     current daily score + a NO_READINESS weekly bucket = a stale weekly feed.
  if (sub === 'COMPLIANCE_NO_READINESS' && daily.score !== null && !daily.stale) {
    findings.push({
      code: 'READINESS_SOURCE_DRIFT', severity: 'drift',
      message: `Weekly bucket reports NO readiness data, but the daily ledger has a current score (${daily.score}). The weekly scenario engine is reading a stale readiness source.`,
    });
  }

  // 5 · Drift — weekly shows the client locked-in/engaged, but the daily signal has gone dark.
  if (weekly?.locked_in && daily.stale && daily.readings > 0) {
    findings.push({
      code: 'ENGAGED_BUT_DAILY_DARK', severity: 'drift',
      message: `Weekly bucket shows the client locked-in, but no readiness protocol has landed in ${daily.days_since_last} days — the daily cue is running on stale data.`,
    });
  }

  // 6 · Drift — the persisted Monday brief no longer matches what the logic says now.
  if (persisted && weekly && persisted.substatus !== weekly.substatus) {
    findings.push({
      code: 'PERSISTED_BRIEF_DRIFT', severity: 'drift',
      message: `The delivered weekly brief is "${persisted.substatus}", but the current data now derives "${weekly.substatus}". The client is holding a superseded cue.`,
    });
  }

  // 8 · Drift — the client is behind on the process itself. A COMPLIANCE weekly
  //     bucket (missed logs / low engagement) is the hurdle to act on directly,
  //     independent of any daily contradiction — this is what drives the
  //     re-engagement nudge. (NO_READINESS is handled by rule 4 as a data-source
  //     issue, so it is excluded here to avoid double-flagging.)
  if (weekly && weekly.scenario === 'COMPLIANCE' && (sub === 'COMPLIANCE_NO_LOGS' || sub === 'COMPLIANCE_LOW_ENGAGEMENT')) {
    findings.push({
      code: 'COMPLIANCE_LAG', severity: 'drift',
      message: `The client is behind on the process (weekly bucket "${sub}") — logging or engagement has lapsed. A re-engagement nudge is warranted to get them back on track.`,
    });
  }

  // 7 · Note — a deload week paired with a primed day is coherent (recovery working),
  //     surfaced so the coach sees the reasoning rather than a false alarm.
  if (weeklyRecovers && daily.band === 'PRIMED' && daily.trend === 'rising') {
    findings.push({
      code: 'DELOAD_WORKING', severity: 'note',
      message: `Weekly recovery bucket "${sub}" alongside a rising, PRIMED daily readiness — the deload is landing. Coherent.`,
    });
  }

  // Overall verdict.
  if (daily.band === null && weekly === null) return { status: 'no_data', findings };
  if (findings.some((f) => f.severity === 'conflict')) return { status: 'conflict', findings };
  if (findings.some((f) => f.severity === 'drift')) return { status: 'drift', findings };
  return { status: 'aligned', findings };
}

const ALIGN_RANK: Record<Alignment, number> = { conflict: 3, drift: 2, aligned: 1, no_data: 0 };

// ═══════════════════════════════════════════════════════════════════════
// Data reads
// ═══════════════════════════════════════════════════════════════════════
function isoYearWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

async function fetchRoster(url: string, key: string, uid?: string) {
  const filter = uid ? `&uid=eq.${encodeURIComponent(uid)}` : '';
  const r = await fetch(
    `${url}/rest/v1/bbf_users?deleted_at=is.null${filter}` +
    `&select=id,uid,name,role,subscription_tier,current_streak,biomechanical_redline,preferred_locale`,
    { headers: pgHeaders(key) },
  );
  if (!r.ok) throw new Error(`roster_${r.status}`);
  const rows = await r.json();
  return (Array.isArray(rows) ? rows : []).filter((u: any) => u.role !== 'admin' && u.role !== 'trainer');
}

async function fetchDailyRows(url: string, key: string, userId: string) {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_daily_protocols?athlete_id=eq.${encodeURIComponent(userId)}` +
      `&readiness_score=not.is.null&order=date.desc&limit=14&select=date,readiness_score`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return [];
    return await r.json().catch(() => []);
  } catch { return []; }
}

async function fetchPersistedBrief(url: string, key: string, userId: string, year: number, week: number) {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_weekly_briefs?user_id=eq.${encodeURIComponent(userId)}` +
      `&year=eq.${year}&week_of_year=eq.${week}&order=created_at.desc&limit=1` +
      `&select=scenario,substatus,locked_in,created_at`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}

async function fetchWeekData(url: string, key: string, userId: string): Promise<WeekData | null> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/get_user_week_data`, {
      method: 'POST', headers: pgHeaders(key), body: JSON.stringify({ p_user_id: userId }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const row = Array.isArray(j) ? j[0] : j;
    if (!row) return null;
    return {
      sessions_logged: Number(row.sessions_logged) || 0,
      unique_days: Number(row.unique_days) || 0,
      avg_rpe: Number(row.avg_rpe) || 0,
      readiness_logs: Number(row.readiness_logs) || 0,
      app_open_days: Number(row.app_open_days) || 0,
      max_weight_this_week: Number(row.max_weight_this_week) || 0,
      max_weight_last_week: Number(row.max_weight_last_week) || 0,
      plateau_weeks: row.plateau_weeks != null ? Number(row.plateau_weeks) : null,
      rep_delta: row.rep_delta != null ? Number(row.rep_delta) : null,
    };
  } catch { return null; }
}

// Assemble one client's full alignment dossier.
async function analyzeClient(url: string, key: string, u: any, year: number, week: number) {
  const [dailyRows, persisted, weekData] = await Promise.all([
    fetchDailyRows(url, key, u.id),
    fetchPersistedBrief(url, key, u.id, year, week),
    fetchWeekData(url, key, u.id),
  ]);
  const daily = deriveDaily(dailyRows as any[]);
  const weekly = weekData ? detectScenario(weekData) : null;
  const persistedBucket = persisted
    ? { scenario: String(persisted.scenario), substatus: String(persisted.substatus) }
    : null;
  const { status, findings } = alignmentFor(daily, weekly, persistedBucket, {
    biomechanical_redline: u.biomechanical_redline === true,
  });
  return {
    uid: u.uid,
    name: u.name || u.uid || 'Unknown',
    subscription_tier: u.subscription_tier ?? null,
    current_streak: u.current_streak ?? 0,
    daily: {
      score: daily.score, band: daily.band, trend: daily.trend,
      readings: daily.readings, days_since_last: daily.days_since_last, stale: daily.stale,
      volume_multiplier: daily.band ? BAND_LOAD[daily.band] : null,
    },
    weekly: weekly ? {
      scenario: weekly.scenario, substatus: weekly.substatus, locked_in: weekly.locked_in,
      delivered: persistedBucket ? { substatus: persistedBucket.substatus, at: persisted.created_at } : null,
    } : null,
    alignment: { status, findings },
    _weekData: weekData, // internal — used by deep_read synthesis, stripped from roster payload
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Optional Claude synthesis — the secondary brain narrates ONE client's logic
// ═══════════════════════════════════════════════════════════════════════
async function synthesizeLogic(apiKey: string, client: any): Promise<string | null> {
  const model = routeAndLog('bbf-eagle-eye', 'eagle_eye_alignment'); // → SONNET
  const ctx = {
    name: client.name,
    daily_readiness: client.daily,
    weekly_report_bucket: client.weekly,
    alignment: client.alignment,
    week_telemetry: client._weekData,
  };
  const system =
    'You are BBF EAGLE EYE — the secondary brain of Build Believe Fit, reporting to Head Coach Akeem Brown. ' +
    'You oversee every client\'s data and guarantee that the coaching cues bucketed for the DAILY Sovereign ' +
    'readiness message and the WEEKLY report stay aligned with sharp precision. A deterministic engine has ' +
    'already produced the alignment verdict and findings — do NOT re-score. Your job: in 2-4 tight sentences, ' +
    'explain the LOGIC of THIS client (what their daily readiness bucket and weekly bucket each imply about ' +
    'today\'s load) and, if the verdict is drift/conflict, state the single sharpest corrective the coach ' +
    'should make so the two cadences agree. Clinical, elite, no fluff, no markdown, no emoji, no greeting. ' +
    'Never invent numbers not present in the telemetry.';
  const user = `Client alignment dossier:\n${JSON.stringify(ctx).slice(0, 2200)}\n\nWrite the Eagle Eye read.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 320, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) { console.error(`[bbf-eagle-eye] anthropic ${res.status}`); return null; }
    const j = await res.json().catch(() => null);
    const block = Array.isArray(j?.content) ? j.content.find((b: any) => b?.type === 'text') : null;
    return block?.text?.trim() || null;
  } catch (e) {
    console.error('[bbf-eagle-eye] synthesis failed:', (e as Error).message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// EAGLE EYE INTERVENTIONS — the closed-loop action layer
// ───────────────────────────────────────────────────────────────────────
// Each finding maps to a corrective PLAY. Re-engagement nudges deliver an
// in-app card (client_message) instantly. Load/deload corrections STAGE a
// proposal into bbf_pending_review (founder approves — NEVER auto-applied to
// the client). Data-integrity findings are internal coach-facing repairs.
// The cycle reconciles + auto-resolves as drifts clear; a nudge left unresolved
// past ESCALATE_AFTER_DAYS escalates into an empathetic, intrinsic-motivation
// script (Sonnet) delivered in the same in-app card.
// ═══════════════════════════════════════════════════════════════════════
const RENDER_ORIGIN = Deno.env.get('BBF_RENDER_PROXY_ORIGIN') || 'https://buildbelievefit.onrender.com';
const ESCALATE_AFTER_DAYS = 3;

type Play = 'nudge' | 'load_proposal' | 'deload_proposal' | 'system_repair';
interface PlaySpec { play: Play; channel: 'in_app' | 'proposal' | 'internal'; }

// Finding code → corrective play + delivery channel. Notes (DELOAD_WORKING) map
// to null — coherent states never generate an intervention.
function playFor(code: string): PlaySpec | null {
  switch (code) {
    case 'COMPLIANCE_LAG':
    case 'ENGAGED_BUT_DAILY_DARK':
      return { play: 'nudge', channel: 'in_app' };
    case 'PUSH_VS_LOW_READINESS':
    case 'REDLINE_VS_PROGRESSION':
      return { play: 'load_proposal', channel: 'proposal' };
    case 'LOW_READINESS_NO_WEEKLY_DELOAD':
      return { play: 'deload_proposal', channel: 'proposal' };
    case 'READINESS_SOURCE_DRIFT':
    case 'PERSISTED_BRIEF_DRIFT':
      return { play: 'system_repair', channel: 'internal' };
    default:
      return null;
  }
}

type Loc = 'en' | 'es' | 'pt';
function loc(preferred: unknown): Loc {
  const s = String(preferred ?? '').trim().toLowerCase();
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('pt') || s.includes('bra')) return 'pt';
  return 'en';
}

// Deterministic first-touch nudges (trilingual · instant · free) — the in-app
// awareness card. Direct and actionable, in the BBF coach voice.
const NUDGE: Record<string, Record<Loc, string>> = {
  COMPLIANCE_LAG: {
    en: "Coach's eye is on you. Your work isn't landing in the log this week — and I can't sharpen what I can't see. Drop in today's sets: weight, reps, how it felt. Even one. That's how the momentum stays yours.",
    es: 'El ojo del coach está en ti. Tu trabajo no está quedando registrado esta semana, y no puedo afinar lo que no veo. Registra las series de hoy: peso, repeticiones, cómo se sintió. Aunque sea una. Así el impulso sigue siendo tuyo.',
    pt: 'O olho do coach tá em você. Seu trabalho não tá sendo registrado essa semana, e eu não consigo afinar o que eu não vejo. Registra as séries de hoje: peso, repetições, como foi. Nem que seja uma. É assim que o momento continua seu.',
  },
  ENGAGED_BUT_DAILY_DARK: {
    en: "You're showing up — don't let the readiness check slip. Thirty seconds this morning: your sleep and how you feel. It's how today's plan gets built around the real you, not a guess.",
    es: 'Estás presente, no dejes que se escape el chequeo de preparación. Treinta segundos esta mañana: tu sueño y cómo te sientes. Así el plan de hoy se arma alrededor del verdadero tú, no de una suposición.',
    pt: 'Você tá aparecendo, não deixa o check-in de prontidão escapar. Trinta segundos hoje de manhã: seu sono e como você se sente. É assim que o plano de hoje é montado em volta do verdadeiro você, não de um chute.',
  },
};
function nudgeText(code: string, l: Loc): string {
  const t = NUDGE[code] || NUDGE.COMPLIANCE_LAG;
  return t[l] || t.en;
}

// Corrective coaching directive carried by a load/deload proposal. On founder
// approval it lands in the client's daily_brief (a whitelisted proposal field).
const REALIGN_DIRECTIVE: Record<'load' | 'deload', Record<Loc, string>> = {
  load: {
    en: "Eagle Eye realignment: your readiness is below the level this week's plan assumed. Hold today's top loads, keep every rep clean, and let recovery lead — we resume the push the moment your numbers rebound.",
    es: 'Reajuste de Eagle Eye: tu preparación está por debajo de lo que asumía el plan de esta semana. Mantén las cargas de hoy, cada repetición limpia, y deja que la recuperación mande; retomamos el empuje en cuanto tus números reboten.',
    pt: 'Reajuste do Eagle Eye: sua prontidão está abaixo do que o plano desta semana assumiu. Segura as cargas de hoje, cada repetição limpa, e deixa a recuperação liderar; a gente retoma o avanço assim que seus números voltarem.',
  },
  deload: {
    en: 'Eagle Eye realignment: your readiness has been low and the week carries no deload. Take today restorative — lighter load, full range, unhurried breathing. This is the smart move that protects the next PR.',
    es: 'Reajuste de Eagle Eye: tu preparación ha estado baja y la semana no trae descarga. Toma hoy de forma restaurativa: menos carga, rango completo, respiración sin prisa. Esta es la jugada inteligente que protege tu próximo récord.',
    pt: 'Reajuste do Eagle Eye: sua prontidão tem estado baixa e a semana não traz deload. Faz hoje de forma restaurativa: carga leve, amplitude total, respiração sem pressa. Essa é a jogada inteligente que protege o próximo recorde.',
  },
};

function resolveReason(code: string): string {
  if (code === 'COMPLIANCE_LAG') return 'logs_or_engagement_resumed';
  if (code === 'ENGAGED_BUT_DAILY_DARK') return 'readiness_resumed';
  if (code === 'READINESS_SOURCE_DRIFT' || code === 'PERSISTED_BRIEF_DRIFT') return 'weekly_feed_realigned';
  if (code === 'PUSH_VS_LOW_READINESS' || code === 'REDLINE_VS_PROGRESSION') return 'load_conflict_cleared';
  if (code === 'LOW_READINESS_NO_WEEKLY_DELOAD') return 'readiness_rebounded';
  return 'drift_cleared';
}

// The empathetic, intrinsic-motivation escalation script — when a client stays
// dark past a first nudge. Sonnet-generated (warmth + nuance + trilingual);
// deterministic fallback if no key. Never shames, never uses ungiven numbers.
async function escalationScript(apiKey: string | null, ctx: { streak: unknown; days_dark: unknown; weekly_bucket: unknown }, l: Loc): Promise<string> {
  const fallback: Record<Loc, string> = {
    en: "I noticed you've been away from the log for a few days. No lecture — just real talk. Every session you record is a promise you keep to yourself, and the momentum you built is still here, waiting for you. The gap doesn't erase the work; it just pauses the story you're writing. Come back to one small thing today. That's all it takes to feel like you again.",
    es: 'Noté que llevas unos días lejos del registro. Sin sermones, solo la verdad. Cada sesión que registras es una promesa que te cumples a ti mismo, y el impulso que construiste sigue aquí, esperándote. La pausa no borra el trabajo; solo detiene la historia que estás escribiendo. Vuelve a una cosa pequeña hoy. Eso basta para volver a sentirte tú.',
    pt: 'Percebi que você tá uns dias longe do registro. Sem sermão, só a real. Cada sessão que você registra é uma promessa que você cumpre com você mesmo, e o momento que você construiu ainda tá aqui, te esperando. A pausa não apaga o trabalho; só pausa a história que você tá escrevendo. Volta pra uma coisa pequena hoje. É só isso pra você voltar a se sentir você.',
  };
  if (!apiKey) return fallback[l];
  const model = routeAndLog('bbf-eagle-eye', 'eagle_eye_intervention'); // → SONNET
  const LN: Record<Loc, string> = { en: 'English', es: 'neutral Latin-American Spanish', pt: 'Brazilian Portuguese' };
  const system =
    `You are BBF EAGLE EYE speaking privately and warmly to a Build Believe Fit client who has drifted from the ` +
    `process (missed logging / readiness) for several days and did not respond to a first gentle nudge. Write a ` +
    `short message (60-90 words) in ${LN[l]} that connects — with genuine empathy and INTRINSIC motivation — how ` +
    `forgetting these small steps quietly costs the momentum and the identity they are building. Do NOT shame, do ` +
    `NOT threaten, do NOT cite any number or streak you were not explicitly given. Second person, natural spoken ` +
    `cadence, no markdown, no emoji, no greeting line. End on ONE tiny, doable step.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 320, system, messages: [{ role: 'user', content: `Context (only reference what is present): ${JSON.stringify(ctx)}. Write the message now.` }] }),
    });
    if (!res.ok) { console.error(`[bbf-eagle-eye] escalation anthropic ${res.status}`); return fallback[l]; }
    const j = await res.json().catch(() => null);
    const b = Array.isArray(j?.content) ? j.content.find((x: any) => x?.type === 'text') : null;
    return (b?.text?.trim()) || fallback[l];
  } catch (e) { console.error('[bbf-eagle-eye] escalation failed:', (e as Error).message); return fallback[l]; }
}

// ── Interventions ledger CRUD (service-role mediated) ────────────────────────────
async function fetchActiveInterventions(url: string, key: string): Promise<any[]> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_eagle_eye_interventions?status=in.(open,dispatched,acknowledged,escalated)&select=*`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return [];
    return await r.json().catch(() => []);
  } catch { return []; }
}
async function insertIntervention(url: string, key: string, row: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_eagle_eye_interventions`, {
      method: 'POST', headers: { ...pgHeaders(key), Prefer: 'return=representation' }, body: JSON.stringify(row),
    });
    if (!r.ok) return null; // 409 on the active-finding unique index ⇒ already tracked
    const j = await r.json().catch(() => []);
    return Array.isArray(j) && j.length ? String(j[0].id) : null;
  } catch { return null; }
}
async function patchIntervention(url: string, key: string, id: string, patch: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${url}/rest/v1/bbf_eagle_eye_interventions?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { ...pgHeaders(key), Prefer: 'return=minimal' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
  } catch { /* best-effort */ }
}
async function fetchClientNudge(url: string, key: string, userId: string): Promise<any | null> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_eagle_eye_interventions?user_id=eq.${encodeURIComponent(userId)}` +
      `&channel=eq.in_app&status=in.(dispatched,escalated)` +
      `&order=escalated_at.desc.nullslast,dispatched_at.desc&limit=1` +
      `&select=id,client_message,finding_code,status,locale`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}

// Stage a load/deload correction into the founder approval queue (the chokepoint).
// NEVER writes the client directly — the corrective directive lands in daily_brief
// only after the founder approves. Returns the proposal id (or 'staged').
async function stageProposal(adminToken: string, opts: {
  slug: string; type: string; risk: string; directive: string; rationale: string; metadata: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const res = await fetch(`${RENDER_ORIGIN}/api/proposal-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-BBF-Admin-Token': adminToken },
      body: JSON.stringify({
        proposal_type: opts.type,
        risk_level: opts.risk,
        population: { uids: [opts.slug], cohort: 'single' },
        diff: { target_table: 'bbf_users', target_uid: opts.slug, before: {}, after: { daily_brief: opts.directive }, fields: ['daily_brief'] },
        rationale: opts.rationale,
        proposed_by: 'bbf-eagle-eye',
        metadata: opts.metadata,
      }),
    });
    if (!res.ok) { console.error(`[bbf-eagle-eye] proposal-submit ${res.status}`); return null; }
    const j = await res.json().catch(() => null) as any;
    return (j && j.proposal && j.proposal.id) ? String(j.proposal.id) : (j && j.ok ? 'staged' : null);
  } catch (e) { console.error('[bbf-eagle-eye] proposal-submit threw:', (e as Error).message); return null; }
}

// ── THE AUTONOMOUS CYCLE ─────────────────────────────────────────────────────────
// Scan → reconcile (auto-resolve cleared drifts · escalate stale nudges) →
// dispatch new plays. dryRun computes the full plan WITHOUT writing/staging/paying,
// so the founder previews exactly what would reach a client before it does.
async function runCycle(
  url: string, key: string, adminToken: string, anthropic: string | null, dryRun: boolean, year: number, week: number,
) {
  const roster = await fetchRoster(url, key);
  const pairs: { u: any; c: any }[] = [];
  const CHUNK = 6;
  for (let i = 0; i < roster.length; i += CHUNK) {
    const slice = roster.slice(i, i + CHUNK);
    const res = await Promise.all(slice.map((u) => analyzeClient(url, key, u, year, week)));
    res.forEach((c, idx) => pairs.push({ u: slice[idx], c }));
  }
  const userById = new Map<string, any>();
  const pairById = new Map<string, { u: any; c: any }>();
  const currentByUser = new Map<string, Set<string>>();
  for (const p of pairs) {
    userById.set(p.u.id, p.u);
    pairById.set(p.u.id, p);
    currentByUser.set(p.u.id, new Set((p.c.alignment?.findings || []).map((f: any) => f.code)));
  }

  const active = await fetchActiveInterventions(url, key);
  const activeKeys = new Set(active.map((iv) => `${iv.user_id}|${iv.finding_code}`));

  const digest = {
    dry_run: dryRun, scanned: pairs.length,
    nudges: [] as any[], proposals: [] as any[], repairs: [] as any[],
    resolved: [] as any[], escalated: [] as any[],
  };

  // ── Reconcile the ledger against the fresh scan ──
  for (const iv of active) {
    const cur = currentByUser.get(iv.user_id);
    const stillHere = cur ? cur.has(iv.finding_code) : false;
    const uid = userById.get(iv.user_id)?.uid || iv.user_id;
    if (!stillHere && currentByUser.has(iv.user_id)) {
      // Only resolve when we actually re-scanned this client (in roster now).
      digest.resolved.push({ uid, finding: iv.finding_code });
      if (!dryRun) await patchIntervention(url, key, iv.id, { status: 'resolved', resolved_at: new Date().toISOString(), resolution_reason: resolveReason(iv.finding_code) });
    } else if (stillHere && iv.play === 'nudge' && iv.status === 'dispatched') {
      const ageDays = (Date.now() - Date.parse(iv.dispatched_at || iv.created_at)) / 86400000;
      if (ageDays > ESCALATE_AFTER_DAYS) {
        const p = pairById.get(iv.user_id);
        const l = loc(p?.u?.preferred_locale);
        digest.escalated.push({ uid, finding: iv.finding_code });
        if (!dryRun) {
          const script = await escalationScript(anthropic, { streak: p?.u?.current_streak ?? null, days_dark: p?.c?.daily?.days_since_last ?? null, weekly_bucket: p?.c?.weekly?.substatus ?? null }, l);
          await patchIntervention(url, key, iv.id, { status: 'escalated', escalated_at: new Date().toISOString(), client_message: script });
        }
      }
    }
  }

  // ── Dispatch new plays for fresh findings ──
  for (const { u, c } of pairs) {
    const l = loc(u.preferred_locale);
    for (const f of (c.alignment?.findings || [])) {
      const spec = playFor(f.code);
      if (!spec) continue;
      if (activeKeys.has(`${u.id}|${f.code}`)) continue; // already tracked
      const base = {
        user_id: u.id, finding_code: f.code, severity: f.severity, play: spec.play, channel: spec.channel,
        iso_year: year, iso_week: week, locale: l, status: 'dispatched', dispatched_at: new Date().toISOString(),
      };
      if (spec.play === 'nudge') {
        const msg = nudgeText(f.code, l);
        digest.nudges.push({ uid: u.uid, finding: f.code, message: msg });
        if (!dryRun) await insertIntervention(url, key, { ...base, client_message: msg });
      } else if (spec.play === 'load_proposal' || spec.play === 'deload_proposal') {
        const directive = REALIGN_DIRECTIVE[spec.play === 'deload_proposal' ? 'deload' : 'load'][l];
        const type = spec.play === 'deload_proposal' ? 'eagle_eye_deload' : 'eagle_eye_load_realignment';
        digest.proposals.push({ uid: u.uid, finding: f.code, type, gated: true });
        if (!dryRun) {
          const pid = adminToken
            ? await stageProposal(adminToken, { slug: u.uid, type, risk: 'high', directive, rationale: `Eagle Eye cue-alignment · ${f.message}`, metadata: { finding_code: f.code, source: 'bbf-eagle-eye', daily: c.daily, weekly: c.weekly } })
            : null;
          await insertIntervention(url, key, { ...base, client_message: directive, proposal_id: pid && pid !== 'staged' ? pid : null });
        }
      } else if (spec.play === 'system_repair') {
        digest.repairs.push({ uid: u.uid, finding: f.code });
        if (!dryRun) await insertIntervention(url, key, { ...base });
      }
    }
  }

  return digest;
}

// Standing digest — the ledger state for the panel (no cycle run).
async function standingDigest(url: string, key: string) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_eagle_eye_interventions?created_at=gte.${encodeURIComponent(since)}` +
      `&order=created_at.desc&limit=200&select=finding_code,play,channel,status,severity,created_at,dispatched_at,resolved_at,escalated_at,proposal_id`,
      { headers: pgHeaders(key) },
    );
    const rows: any[] = r.ok ? (await r.json().catch(() => [])) : [];
    const summary = { open: 0, dispatched: 0, acknowledged: 0, resolved: 0, escalated: 0 } as Record<string, number>;
    for (const row of rows) summary[row.status] = (summary[row.status] || 0) + 1;
    return { window_days: 7, summary, total: rows.length, recent: rows.slice(0, 40) };
  } catch { return { window_days: 7, summary: {}, total: 0, recent: [] }; }
}

// ═══════════════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  const PROPOSAL_TOKEN = Deno.env.get('BBF_ADMIN_TOKEN') || '';
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing_supabase' }, 503);

  let body: any = null;
  if (req.method === 'POST') { try { body = await req.json(); } catch { body = null; } }
  const mode = String(body?.mode || '').trim();
  const targetUid = String(body?.uid || '').trim();

  const { year, week } = isoYearWeek(new Date());
  const now = new Date().toISOString();

  // ═══ CLIENT · my_nudge (vault-gated, NOT admin) ══════════════════════════════
  // The in-app awareness card read: a client fetches its own active Eagle Eye
  // nudge/escalation message. { ack:true } marks it acknowledged.
  if (mode === 'my_nudge') {
    const vaultToken = String(body?.vault_token || req.headers.get('x-bbf-vault-token') || req.headers.get('x-bbf-session-token') || '').trim();
    if (!vaultToken) return jsonResponse({ error: 'missing_session', detail: 'A vault session token is required.' }, 401);
    const userId = await uidFromSession(SUPABASE_URL, SERVICE_KEY, vaultToken);
    if (!userId) return jsonResponse({ error: 'invalid_session', detail: 'Vault session is invalid or expired.' }, 401);
    const nudge = await fetchClientNudge(SUPABASE_URL, SERVICE_KEY, userId);
    if (nudge && body?.ack === true && nudge.id) {
      await patchIntervention(SUPABASE_URL, SERVICE_KEY, nudge.id, { status: 'acknowledged', acknowledged_at: now });
    }
    return jsonResponse({
      ok: true,
      nudge: nudge ? { message: nudge.client_message, finding_code: nudge.finding_code, escalated: nudge.status === 'escalated', locale: nudge.locale } : null,
    });
  }

  // ═══ everything below exposes whole-roster data → admin only ══════════════════
  if (!(await isAuthorized(req, SUPABASE_URL, SERVICE_KEY, ADMIN_TOKEN))) {
    console.warn('[bbf-eagle-eye] auth rejected (no valid admin token or session)');
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // ─── AUTONOMOUS CYCLE · scan → reconcile → dispatch (dry-run by default) ──────
  if (mode === 'run') {
    const dryRun = body?.dry_run !== false; // preview unless explicitly { dry_run:false }
    const digest = await runCycle(SUPABASE_URL, SERVICE_KEY, PROPOSAL_TOKEN, ANTHROPIC_API_KEY || null, dryRun, year, week);
    console.log(`[bbf-eagle-eye] cycle dry_run=${dryRun} nudges=${digest.nudges.length} proposals=${digest.proposals.length} resolved=${digest.resolved.length} escalated=${digest.escalated.length}`);
    return jsonResponse({ ok: true, generated_at: now, iso_year: year, iso_week: week, mode: 'run', digest });
  }

  // ─── STANDING DIGEST · ledger state for the panel (no cycle) ──────────────────
  if (mode === 'digest') {
    const d = await standingDigest(SUPABASE_URL, SERVICE_KEY);
    return jsonResponse({ ok: true, generated_at: now, mode: 'digest', ...d });
  }

  // ─── DEEP READ · one client + optional Claude synthesis ─────────────────────
  if (mode === 'deep_read') {
    if (!targetUid) return jsonResponse({ error: 'missing_uid', detail: 'deep_read requires a uid.' }, 400);
    let roster: any[];
    try { roster = await fetchRoster(SUPABASE_URL, SERVICE_KEY, targetUid); }
    catch (e) { return jsonResponse({ error: 'query_failed', detail: (e as Error).message }, 502); }
    if (!roster.length) return jsonResponse({ error: 'not_found', detail: `No client "${targetUid}".` }, 404);

    const client = await analyzeClient(SUPABASE_URL, SERVICE_KEY, roster[0], year, week);
    let synthesis: string | null = null;
    let synthesis_model: string | null = null;
    if (ANTHROPIC_API_KEY) {
      synthesis = await synthesizeLogic(ANTHROPIC_API_KEY, client);
      if (synthesis) synthesis_model = 'claude-sonnet-4-6';
    }
    const { _weekData, ...clean } = client;
    return jsonResponse({
      ok: true, generated_at: now, iso_year: year, iso_week: week, mode: 'deep_read',
      client: clean, synthesis, synthesis_model,
    });
  }

  // ─── ROSTER SCAN · deterministic alignment across every client ──────────────
  let roster: any[];
  try { roster = await fetchRoster(SUPABASE_URL, SERVICE_KEY); }
  catch (e) { return jsonResponse({ error: 'query_failed', detail: (e as Error).message }, 502); }

  // Active interventions keyed by user_id, so each card can show its live action
  // state (nudged / staged proposal / escalated) alongside the finding.
  const activeIv = await fetchActiveInterventions(SUPABASE_URL, SERVICE_KEY);
  const ivByUser = new Map<string, any>();
  for (const iv of activeIv) {
    const prev = ivByUser.get(iv.user_id);
    // Prefer an escalated row, else the most recent, as the card's headline state.
    if (!prev || iv.status === 'escalated' || Date.parse(iv.dispatched_at || iv.created_at) > Date.parse(prev.dispatched_at || prev.created_at)) {
      ivByUser.set(iv.user_id, iv);
    }
  }

  // Bounded concurrency so a large roster doesn't fan out unbounded per-client reads.
  const CHUNK = 6;
  const analyzed: any[] = [];
  for (let i = 0; i < roster.length; i += CHUNK) {
    const slice = roster.slice(i, i + CHUNK);
    const results = await Promise.all(slice.map((u) => analyzeClient(SUPABASE_URL, SERVICE_KEY, u, year, week)));
    results.forEach((c, idx) => {
      const { _weekData, ...clean } = c;
      const iv = ivByUser.get(slice[idx].id);
      (clean as any).intervention = iv
        ? { play: iv.play, channel: iv.channel, status: iv.status, finding_code: iv.finding_code, proposal_id: iv.proposal_id || null }
        : null;
      analyzed.push(clean);
    });
  }

  // Worst-first: conflict → drift → aligned → no_data (Panopticon ethos — highest
  // risk is most visible), ties by a sharper daily score surfacing sooner.
  analyzed.sort((a, b) => {
    const d = ALIGN_RANK[b.alignment.status as Alignment] - ALIGN_RANK[a.alignment.status as Alignment];
    if (d !== 0) return d;
    return (a.daily.score ?? 999) - (b.daily.score ?? 999);
  });

  const summary = { aligned: 0, drift: 0, conflict: 0, no_data: 0 } as Record<string, number>;
  for (const c of analyzed) summary[c.alignment.status] = (summary[c.alignment.status] || 0) + 1;

  return jsonResponse({
    ok: true, generated_at: now, iso_year: year, iso_week: week,
    summary, client_count: analyzed.length, clients: analyzed,
  });
});

// ═══════════════════════════════════════════════════════════════════════
// RESPONSE CONTRACT (frozen for the frontend Eagle Eye surface)
// ───────────────────────────────────────────────────────────────────────
// 200 OK (roster scan):
// {
//   "ok": true, "generated_at": "…Z", "iso_year": 2026, "iso_week": 28,
//   "summary": { "aligned": 3, "drift": 1, "conflict": 1, "no_data": 1 },
//   "client_count": 6,
//   "clients": [{
//     "uid": "jordan_bbf", "name": "Jordan", "subscription_tier": "sovereign",
//     "current_streak": 11,
//     "daily":  { "score": 58, "band": "REDUCED_LOAD", "trend": "dipping",
//                 "readings": 12, "days_since_last": 0, "stale": false,
//                 "volume_multiplier": 0.8 },
//     "weekly": { "scenario": "PROGRESSION", "substatus": "PROGRESSION_NEW_MAX",
//                 "locked_in": true, "delivered": { "substatus": "…", "at": "…Z" } },
//     "alignment": { "status": "conflict",
//       "findings": [{ "code": "PUSH_VS_LOW_READINESS", "severity": "conflict", "message": "…" }] }
//   }]
// }
//
// 200 OK (deep_read): { ok, mode:"deep_read", client:{…}, synthesis:"…"|null, synthesis_model }
//
// alignment.status: "conflict" | "drift" | "aligned" | "no_data"
//   conflict — the daily and weekly cue buckets prescribe opposing load today
//   drift    — the buckets are built on disagreeing / stale data sources
//   aligned  — the two cadences agree
//   no_data  — neither bucket could be derived
//
// Errors: { "error": "<slug>", "detail"?: "…" }
//   401 unauthorized · 400 missing_uid · 404 not_found · 502 query_failed · 503 config_missing_supabase
// ═══════════════════════════════════════════════════════════════════════
