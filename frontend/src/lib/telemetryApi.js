// src/lib/telemetryApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Panopticon data layer — a DISTINCT path from the Client Hub.
//
// Unlike rosterApi (POST bbf-admin-roster + X-BBF-Admin-Token + service role),
// the Panopticon mirrors the monolith's bbf-sync.fetchGlobalRosterTelemetry: four
// parallel DIRECT PostgREST reads via the ANON key, gated by RLS (the
// `phase8_bbf_users_anon_select` policy family). No admin token — the data is
// anon-readable by RLS design; the monolith's "admin-only" gate is client-side
// RBAC, not a data boundary.
//
// ⚠️ DEPENDENCY: this works only if the prod anon-SELECT RLS policies for
// bbf_users (id,uid,name,role) + bbf_athlete_load_logs / _bouts /
// bbf_athlete_progression are live. If they are not, the users query errors and
// we surface it (never a silent empty grid).
//
// Risk math is computed CLIENT-SIDE via intelCore (verbatim port of the canonical
// kernel) — same algorithm the monolith and the bbf-sentinel cron share.

import { supabase } from './supabaseClient.js';
import { runLoadAudit, classifyRisk } from './intelCore.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW = 28;

// Fetch + bucket the global roster telemetry. Returns { roster, meta }, where each
// roster entry is { athlete_id, slug, name, role, sport, position, phase,
// dailyLoads:number[28], bouts:[{type,start,durationSec,label}] }.
export async function fetchGlobalRosterTelemetry() {
  const todayMid = new Date();
  todayMid.setUTCHours(0, 0, 0, 0);
  const todayMs = todayMid.getTime();
  const sinceISO = new Date(todayMs - (WINDOW - 1) * DAY_MS).toISOString();
  const todayISO = todayMid.toISOString();
  const tomorrowISO = new Date(todayMs + DAY_MS).toISOString();

  const [usersR, logsR, boutsR, progR] = await Promise.all([
    supabase.from('bbf_users').select('id,uid,name,role').order('name', { ascending: true }),
    supabase.from('bbf_athlete_load_logs')
      .select('athlete_id,session_timestamp,load_au')
      .gte('session_timestamp', sinceISO)
      .order('session_timestamp', { ascending: true }),
    supabase.from('bbf_athlete_load_bouts')
      .select('bout_type,exercise_name,start_timestamp,end_timestamp,log:bbf_athlete_load_logs!inner(athlete_id)')
      .gte('start_timestamp', todayISO)
      .lt('start_timestamp', tomorrowISO)
      .order('start_timestamp', { ascending: true }),
    supabase.from('bbf_athlete_progression')
      .select('user_id,sport,position,phase,protocol_completed,updated_at')
      .order('updated_at', { ascending: false })
      .limit(1000),
  ]);

  // The users query is the gate — a hard error here (e.g. RLS block) is fatal and
  // surfaced. The other three degrade gracefully (athletes show dormant / no sport).
  if (usersR.error) {
    const e = new Error(`Roster telemetry blocked — ${usersR.error.message || 'users query failed'}.`);
    e.code = 'telemetry';
    throw e;
  }
  const users = usersR.data || [];
  const logs = logsR.data || [];
  const bouts = boutsR.data || [];
  const progressions = progR.data || [];

  const meta = (extra) => ({
    source: 'live', fetchedAt: new Date().toISOString(),
    athletes: 0, totalLogs: logs.length, totalBouts: bouts.length,
    totalProgressions: progressions.length, windowDays: WINDOW, ...extra,
  });

  if (!users.length) return { roster: [], meta: meta({ athletes: 0 }) };

  // Seed each athlete (drop admin/trainer) with empty dailyLoads / bouts.
  const byAthlete = {};
  users.forEach((u) => {
    if (!u || !u.id) return;
    if (u.role === 'admin' || u.role === 'trainer') return;
    byAthlete[u.id] = {
      athlete_id: u.id, slug: u.uid || null, name: u.name || u.uid || 'Unknown',
      role: u.role || 'client', sport: null, position: null, phase: null,
      dailyLoads: new Array(WINDOW).fill(0), bouts: [],
    };
  });

  // Bucket macro logs into per-athlete dailyLoads (UTC-midnight aligned).
  logs.forEach((row) => {
    const a = byAthlete[row.athlete_id];
    if (!a) return;
    const t = Date.parse(row.session_timestamp);
    if (isNaN(t)) return;
    const d = new Date(t); d.setUTCHours(0, 0, 0, 0);
    const daysAgo = Math.round((todayMs - d.getTime()) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < WINDOW) a.dailyLoads[(WINDOW - 1) - daysAgo] += (+row.load_au || 0);
  });

  // Group today's bouts via the embedded log.athlete_id (defensive: object or array).
  bouts.forEach((b) => {
    const logRel = b && (Array.isArray(b.log) ? b.log[0] : b.log);
    const aid = logRel && logRel.athlete_id;
    if (!aid) return;
    const a = byAthlete[aid];
    if (!a) return;
    const startMs = Date.parse(b.start_timestamp);
    const endMs = Date.parse(b.end_timestamp);
    const dur = (!isNaN(startMs) && !isNaN(endMs)) ? Math.max(0, (endMs - startMs) / 1000) : 0;
    a.bouts.push({ type: b.bout_type, start: b.start_timestamp, durationSec: dur, label: b.exercise_name || b.bout_type });
  });

  // Most-recent progression wins per athlete (rows already DESC by updated_at).
  progressions.forEach((p) => {
    const a = byAthlete[p.user_id];
    if (!a || a.sport) return; // first-seen wins
    a.sport = p.sport || null;
    a.position = p.position || null;
    a.phase = p.phase || null;
  });

  const roster = Object.values(byAthlete);
  return { roster, meta: meta({ athletes: roster.length }) };
}

const STATUS_ORDER = { red: 0, yellow: 1, green: 2, dormant: 3 };

// Pure: roster payload → athletes classified + sorted (red→yellow→green→dormant,
// ties by ACWR descending) + bucket counts. Mirrors panopticonPortal.processGlobalRoster.
export function processRoster(data) {
  const roster = (data && data.roster) || [];
  const athletes = roster.map((a) => {
    let totalLoad = 0;
    for (let i = 0; i < a.dailyLoads.length; i++) totalLoad += (+a.dailyLoads[i] || 0);
    const report = runLoadAudit({ dailyLoads: a.dailyLoads, bouts: a.bouts });
    return { athlete: a, report, status: classifyRisk(report, totalLoad), totalLoad };
  }).sort((x, y) => {
    const d = (STATUS_ORDER[x.status] ?? 9) - (STATUS_ORDER[y.status] ?? 9);
    if (d !== 0) return d;
    const rx = x.report && x.report.acwr.ratio;
    const ry = y.report && y.report.acwr.ratio;
    if (rx == null && ry == null) return (x.athlete.name || '').localeCompare(y.athlete.name || '');
    if (rx == null) return 1;
    if (ry == null) return -1;
    return ry - rx;
  });

  const counts = { red: 0, yellow: 0, green: 0, dormant: 0 };
  athletes.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
  return { athletes, counts, total: athletes.length, meta: data?.meta || null };
}

// Convenience: fetch + process in one call for the component.
export async function fetchPanopticon() {
  const data = await fetchGlobalRosterTelemetry();
  return processRoster(data);
}
