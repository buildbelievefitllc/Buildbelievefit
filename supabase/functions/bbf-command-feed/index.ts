// ═══════════════════════════════════════════════════════════════════════
// supabase/functions/bbf-command-feed/index.ts
// Sovereign Command Center · roster compliance feed
// ───────────────────────────────────────────────────────────────────────
// Read-only, deterministic (NO Claude) compliance engine that powers the
// frontend "Sovereign Command Center" toggles. Computes per-client
// training + nutrition compliance over a rolling window and returns a
// JSON array of readiness statuses.
//
// This is a NEW, separate function — it deliberately does NOT touch
// bbf-sentinel (the cron load-audit + proposal-safety verifier).
//
// ── Auth ──
//   Exposes whole-roster data → admin-gated. Send the shared admin token:
//     X-BBF-Admin-Token: <BBF_COACH_AGENT_TOKEN>
//   Same token the co-coach / sentinel-verifier admin surfaces use.
//
// ── Request ──
//   GET  /functions/v1/bbf-command-feed?days=14
//   POST /functions/v1/bbf-command-feed   { "days": 14 }
//   (days optional · default 14 · clamped 1..90)
//
// ── Data sources ──
//   bbf_users        — roster (clients only; admins/trainers + deleted excluded)
//   bbf_logs         — training sessions (date) · windows the sets
//   bbf_sets         — logged sets · "dropped" = reps AND weight both missing
//   bbf_meal_logs    — meal timestamps + macros · 16/8 fasting window + intake
//   (bbf_meal_macros is a GLOBAL food-macro reference library, not per-client
//    data, so it is intentionally NOT used for per-client compliance.)
//
// Response contract: see README block at bottom + the PR description.
// ═══════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-session-token',
};

// ─── Dual authorization (CEO directive · Elegant Auth Elevation) ─────────────────
// Authorized if the request carries the legacy shared secret OR a validated admin
// SESSION token (resolved via _bbf_uid_from_vault_token → admin/trainer role). A
// valid non-admin session is rejected. Mirrors bbf-admin-roster.isAuthorized so the
// two roster surfaces unlock identically for a logged-in Sovereign.
async function uidFromSession(url: string, key: string, session: string): Promise<string | null> {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
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
  } catch (_) {
    return false;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 14;

// ── Deterministic thresholds (documented in the contract) ──────────────
const TRAIN_GREEN_MAX_DROP = 0.10;  // ≤10% dropped sets → green
const TRAIN_YELLOW_MAX_DROP = 0.25; // ≤25% → yellow, else red
const FAST_WINDOW_HOURS = 8.0;      // 16/8 → eating window ≤ 8h is compliant
const FAST_GREEN_MIN_ADHERENCE = 0.80;
const FAST_YELLOW_MIN_ADHERENCE = 0.50;

type Status = 'green' | 'yellow' | 'red' | 'no_data';

function rank(s: Status): number {
  return s === 'red' ? 3 : s === 'yellow' ? 2 : s === 'green' ? 1 : 0;
}

function trainingStatus(setsLogged: number, dropRate: number): Status {
  if (setsLogged === 0) return 'no_data';
  if (dropRate <= TRAIN_GREEN_MAX_DROP) return 'green';
  if (dropRate <= TRAIN_YELLOW_MAX_DROP) return 'yellow';
  return 'red';
}

function nutritionStatus(daysLogged: number, adherence: number): Status {
  if (daysLogged === 0) return 'no_data';
  if (adherence >= FAST_GREEN_MIN_ADHERENCE) return 'green';
  if (adherence >= FAST_YELLOW_MIN_ADHERENCE) return 'yellow';
  return 'red';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // ─── Auth gate (whole-roster data → admin only) ───────────────────────
  // Accepts the legacy shared secret OR a validated admin session token, so a
  // logged-in Sovereign auto-unlocks this feed without pasting the secret.
  const SUPABASE_URL_AUTH = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE_KEY_AUTH = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const adminToken = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  if (!(await isAuthorized(req, SUPABASE_URL_AUTH, SERVICE_KEY_AUTH, adminToken))) {
    console.warn('[bbf-command-feed] auth rejected (no valid admin token or session)');
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // ─── Window resolution (?days= or body.days · clamp 1..90) ────────────
  let days = DEFAULT_WINDOW_DAYS;
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('days');
    if (q) days = parseInt(q, 10);
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (body && Number.isFinite(body.days)) days = body.days;
    }
  } catch (_) { /* keep default */ }
  if (!Number.isFinite(days)) days = DEFAULT_WINDOW_DAYS;
  days = Math.max(1, Math.min(90, Math.floor(days)));

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: 'config_missing_supabase' }, 503);
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const sinceDate = new Date(now - (days - 1) * DAY_MS).toISOString().slice(0, 10); // YYYY-MM-DD

  // ─── Fetch (service role bypasses RLS) ────────────────────────────────
  const [usersR, logsR, mealsR] = await Promise.all([
    supa.from('bbf_users')
      .select('id, uid, name, role, current_streak, subscription_tier, somatic_fasting_hours, cns_friction_score, biomechanical_redline')
      .is('deleted_at', null),
    supa.from('bbf_logs')
      .select('id, user_id, date')
      .gte('date', sinceDate),
    supa.from('bbf_meal_logs')
      .select('user_id, log_date, logged_at, calories')
      .gte('log_date', sinceDate),
  ]);

  if (usersR.error) return jsonResponse({ error: 'query_failed', detail: `users: ${usersR.error.message}` }, 502);
  if (logsR.error)  return jsonResponse({ error: 'query_failed', detail: `logs: ${logsR.error.message}` }, 502);
  if (mealsR.error) return jsonResponse({ error: 'query_failed', detail: `meals: ${mealsR.error.message}` }, 502);

  const users = (usersR.data ?? []).filter((u: any) => u.role !== 'admin' && u.role !== 'trainer');
  const logs  = logsR.data ?? [];
  const meals = mealsR.data ?? [];

  // Map log_id → user_id, and collect in-window log ids for the sets query.
  const logUser = new Map<string, string>();
  for (const l of logs as any[]) logUser.set(l.id, l.user_id);
  const logIds = [...logUser.keys()];

  // Fetch sets for the in-window sessions (bbf_sets has no date column of
  // its own, so we window it via its parent log).
  let sets: any[] = [];
  if (logIds.length > 0) {
    const setsR = await supa.from('bbf_sets').select('user_id, log_id, reps, weight_lbs').in('log_id', logIds);
    if (setsR.error) return jsonResponse({ error: 'query_failed', detail: `sets: ${setsR.error.message}` }, 502);
    sets = setsR.data ?? [];
  }

  // ─── Aggregate per client ─────────────────────────────────────────────
  type Agg = {
    setsLogged: number; setsDropped: number; sessions: Set<string>;
    // meals bucketed by day → [minTs, maxTs, count]
    mealDays: Map<string, { min: number; max: number; count: number }>;
  };
  const agg = new Map<string, Agg>();
  const ensure = (uid: string): Agg => {
    let a = agg.get(uid);
    if (!a) { a = { setsLogged: 0, setsDropped: 0, sessions: new Set(), mealDays: new Map() }; agg.set(uid, a); }
    return a;
  };

  for (const s of sets) {
    const uid = s.user_id || logUser.get(s.log_id);
    if (!uid) continue;
    const a = ensure(uid);
    a.setsLogged += 1;
    // A "dropped" set = NO reps AND NO weight recorded. A weight-only log
    // (reps null but weight present) is a completed set with reps simply
    // not entered — the dominant pattern in bbf_sets — and must NOT count
    // as dropped, or every active client false-flags red.
    const noReps   = s.reps == null || Number(s.reps) <= 0;
    const noWeight = s.weight_lbs == null || Number(s.weight_lbs) <= 0;
    if (noReps && noWeight) a.setsDropped += 1;
    if (s.log_id) a.sessions.add(s.log_id);
  }

  for (const m of meals as any[]) {
    if (!m.user_id || !m.log_date) continue;
    const a = ensure(m.user_id);
    const ts = m.logged_at ? Date.parse(m.logged_at) : NaN;
    let d = a.mealDays.get(m.log_date);
    if (!d) { d = { min: Infinity, max: -Infinity, count: 0 }; a.mealDays.set(m.log_date, d); }
    d.count += 1;
    if (!isNaN(ts)) { d.min = Math.min(d.min, ts); d.max = Math.max(d.max, ts); }
  }

  // ─── Build the readiness array ────────────────────────────────────────
  const clients = users.map((u: any) => {
    const a = agg.get(u.id);
    const setsLogged = a?.setsLogged ?? 0;
    const setsDropped = a?.setsDropped ?? 0;
    const dropRate = setsLogged > 0 ? setsDropped / setsLogged : 0;
    const tStatus = trainingStatus(setsLogged, dropRate);

    // Nutrition: per-day eating window from meal timestamps.
    let daysLogged = 0, compliantDays = 0, windowSum = 0, windowCount = 0;
    if (a) {
      for (const [, d] of a.mealDays) {
        daysLogged += 1;
        if (d.count >= 1 && isFinite(d.min) && isFinite(d.max)) {
          const windowH = (d.max - d.min) / (1000 * 60 * 60);
          windowSum += windowH; windowCount += 1;
          if (windowH <= FAST_WINDOW_HOURS) compliantDays += 1;
        } else {
          // day logged but no usable timestamps — treat as compliant (single/window-0)
          compliantDays += 1;
        }
      }
    }
    const adherence = daysLogged > 0 ? compliantDays / daysLogged : 0;
    const nStatus = nutritionStatus(daysLogged, adherence);
    const avgWindowH = windowCount > 0 ? Math.round((windowSum / windowCount) * 10) / 10 : null;

    // Overall = worst of training/nutrition, hard-red on a biomechanical redline.
    let overall: Status = rank(tStatus) >= rank(nStatus) ? tStatus : nStatus;
    if (u.biomechanical_redline === true) overall = 'red';

    return {
      uid: u.uid,
      name: u.name,
      subscription_tier: u.subscription_tier ?? null,
      current_streak: u.current_streak ?? 0,
      training: {
        sessions: a ? a.sessions.size : 0,
        sets_logged: setsLogged,
        sets_dropped: setsDropped,
        drop_rate: Math.round(dropRate * 1000) / 1000,
        status: tStatus,
      },
      nutrition: {
        days_logged: daysLogged,
        fasting_compliant_days: compliantDays,
        fasting_adherence_pct: Math.round(adherence * 1000) / 10, // e.g. 83.3
        avg_eating_window_hours: avgWindowH,
        status: nStatus,
      },
      signals: {
        cns_friction_score: u.cns_friction_score ?? null,
        somatic_fasting_hours: u.somatic_fasting_hours ?? null,
        biomechanical_redline: u.biomechanical_redline === true,
      },
      overall_status: overall,
    };
  });

  const summary = { green: 0, yellow: 0, red: 0, no_data: 0 } as Record<string, number>;
  for (const c of clients) summary[c.overall_status] = (summary[c.overall_status] || 0) + 1;

  return jsonResponse({
    ok: true,
    generated_at: new Date(now).toISOString(),
    window_days: days,
    since_date: sinceDate,
    summary,
    client_count: clients.length,
    clients,
  }, 200);
});

// ═══════════════════════════════════════════════════════════════════════
// RESPONSE CONTRACT (frozen for the frontend Command Center handoff)
// ───────────────────────────────────────────────────────────────────────
// 200 OK:
// {
//   "ok": true,
//   "generated_at": "2026-06-01T...Z",
//   "window_days": 14,
//   "since_date": "2026-05-19",
//   "summary": { "green": 2, "yellow": 1, "red": 1, "no_data": 2 },
//   "client_count": 6,
//   "clients": [
//     {
//       "uid": "jordan_bbf",
//       "name": "Jordan",
//       "subscription_tier": "sovereign",
//       "current_streak": 11,
//       "training": {
//         "sessions": 7, "sets_logged": 84, "sets_dropped": 3,
//         "drop_rate": 0.036, "status": "green"
//       },
//       "nutrition": {
//         "days_logged": 12, "fasting_compliant_days": 10,
//         "fasting_adherence_pct": 83.3, "avg_eating_window_hours": 7.4,
//         "status": "green"
//       },
//       "signals": {
//         "cns_friction_score": 0.21, "somatic_fasting_hours": 16.5,
//         "biomechanical_redline": false
//       },
//       "overall_status": "green"
//     }
//   ]
// }
//
// status enum: "green" | "yellow" | "red" | "no_data"
//   training:  green ≤10% dropped sets · yellow ≤25% · red >25% · no_data = 0 sets in window
//   nutrition: green ≥80% fasting-compliant days · yellow ≥50% · red <50% · no_data = 0 logged days
//   overall:   worst of training/nutrition; forced "red" if biomechanical_redline
//   "dropped set" = a bbf_sets row with BOTH reps and weight_lbs missing/≤0.
//     (No target-reps column exists; weight-only logs = completed sets with
//      reps simply unrecorded, so they do NOT count as dropped. This is a
//      weak proxy — a real target-reps field would make it meaningful.)
//   "fasting compliant day" = eating window (last−first meal timestamp) ≤ 8h (16/8)
//
// Errors: { "error": "<slug>", "detail"?: "..." }
//   401 unauthorized · 503 config_missing_* · 502 query_failed · 405 method_not_allowed
// ═══════════════════════════════════════════════════════════════════════
