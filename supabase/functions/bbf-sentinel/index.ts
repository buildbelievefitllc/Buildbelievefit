// ═══════════════════════════════════════════════════════════════
// supabase/functions/bbf-sentinel/index.ts
// Sentinel Protocol — daily roster audit. Runs the entire active
// roster through the BBF Intelligence Engine; if any athlete
// trips the ACWR or Micro-Recovery guardrails (the RED zone),
// posts a structured payload to the Zapier webhook so the CEO
// gets a Slack/Email/SMS alert.
//
// Auth model (CEO-approved):
//   - verify_jwt: false (cron-invoked, no user JWT available)
//   - x-cron-secret header must match Deno.env.get("CRON_SECRET")
//
// Triggers:
//   - pg_cron daily at 08:00 UTC (08:00 UTC = 01:00 MST briefing slot)
//   - Manual ad-hoc invocation: curl -X POST <url> -H "x-cron-secret: …"
//
// Required environment variables (set in Supabase Dashboard):
//   CRON_SECRET           shared secret matching pg_cron's GUC value
//   ZAPIER_WEBHOOK_URL    Catch Hook URL from the Zapier Zap (optional —
//                         function still runs and returns the audit result
//                         when unset; just skips the POST)
// Auto-injected by Supabase:
//   SUPABASE_URL                  the project's REST URL
//   SUPABASE_SERVICE_ROLE_KEY     elevated DB access (bypasses RLS)
// ═══════════════════════════════════════════════════════════════

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  runLoadAudit,
  classifyRisk,
  type Bout,
} from "../_shared/intel-core.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 28;

// ─── Single-shot fetch (Phase 8 N+1 avoidance, ported to Deno) ─────
async function fetchGlobalRoster(supa: ReturnType<typeof createClient>) {
  const todayMid = new Date();
  todayMid.setUTCHours(0, 0, 0, 0);
  const todayMs = todayMid.getTime();
  const sinceISO    = new Date(todayMs - (WINDOW_DAYS - 1) * DAY_MS).toISOString();
  const todayISO    = todayMid.toISOString();
  const tomorrowISO = new Date(todayMs + DAY_MS).toISOString();

  const [usersR, logsR, boutsR, progR] = await Promise.all([
    supa.from("bbf_users")
        .select("id,uid,name,role")
        .order("name", { ascending: true }),
    supa.from("bbf_athlete_load_logs")
        .select("athlete_id,session_timestamp,load_au")
        .gte("session_timestamp", sinceISO)
        .order("session_timestamp", { ascending: true }),
    supa.from("bbf_athlete_load_bouts")
        .select("bout_type,exercise_name,start_timestamp,end_timestamp,log:bbf_athlete_load_logs!inner(athlete_id)")
        .gte("start_timestamp", todayISO)
        .lt("start_timestamp", tomorrowISO)
        .order("start_timestamp", { ascending: true }),
    supa.from("bbf_athlete_progression")
        .select("user_id,sport,position,phase,protocol_completed,updated_at")
        .order("updated_at", { ascending: false })
        .limit(1000),
  ]);

  const users         = usersR.data ?? [];
  const logs          = logsR.data  ?? [];
  const bouts         = boutsR.data ?? [];
  const progressions  = progR.data  ?? [];

  // Bucket per athlete (UTC midnight aligned, newest at index 27)
  type AthleteRow = {
    athlete_id: string; slug: string | null; name: string; role: string;
    sport: string | null; position: string | null; phase: string | null;
    dailyLoads: number[]; bouts: Bout[];
  };
  const byAthlete: Record<string, AthleteRow> = {};

  for (const u of users) {
    if (!u || !u.id) continue;
    if (u.role === "admin" || u.role === "trainer") continue;
    byAthlete[u.id] = {
      athlete_id: u.id,
      slug:       u.uid ?? null,
      name:       u.name || u.uid || "Unknown",
      role:       u.role || "client",
      sport:      null,
      position:   null,
      phase:      null,
      dailyLoads: new Array(WINDOW_DAYS).fill(0),
      bouts:      [],
    };
  }

  for (const row of logs) {
    const a = byAthlete[row.athlete_id];
    if (!a) continue;
    const t = Date.parse(row.session_timestamp);
    if (isNaN(t)) continue;
    const d = new Date(t); d.setUTCHours(0, 0, 0, 0);
    const daysAgo = Math.round((todayMs - d.getTime()) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < WINDOW_DAYS) {
      a.dailyLoads[(WINDOW_DAYS - 1) - daysAgo] += (+row.load_au || 0);
    }
  }

  for (const b of bouts) {
    // PostgREST embedded resource arrives either as an object or a 1-element array
    // depending on relationship cardinality detection. Handle both.
    const logEmbed = (b as any).log;
    const aid = Array.isArray(logEmbed) ? logEmbed[0]?.athlete_id : logEmbed?.athlete_id;
    if (!aid) continue;
    const a = byAthlete[aid];
    if (!a) continue;
    const startMs = Date.parse(b.start_timestamp);
    const endMs   = Date.parse(b.end_timestamp);
    const dur     = (!isNaN(startMs) && !isNaN(endMs)) ? Math.max(0, (endMs - startMs) / 1000) : 0;
    a.bouts.push({
      type:        b.bout_type,
      start:       b.start_timestamp,
      durationSec: dur,
      label:       b.exercise_name || b.bout_type,
    });
  }

  for (const p of progressions) {
    const a = byAthlete[p.user_id];
    if (!a || a.sport) continue;
    a.sport    = p.sport    ?? null;
    a.position = p.position ?? null;
    a.phase    = p.phase    ?? null;
  }

  return {
    roster: Object.values(byAthlete),
    meta: { athletes: Object.keys(byAthlete).length, totalLogs: logs.length, totalBouts: bouts.length, totalProgressions: progressions.length },
  };
}

// ─── Risk processing + RED-zone filter ─────────────────────────────
function processAndFilterRedZone(roster: any[]) {
  const processed = roster.map((a) => {
    let totalLoad = 0;
    for (let i = 0; i < a.dailyLoads.length; i++) totalLoad += (+a.dailyLoads[i] || 0);
    const report = runLoadAudit({ dailyLoads: a.dailyLoads, bouts: a.bouts });
    const status = classifyRisk(report, totalLoad);
    return { athlete: a, report, status, totalLoad };
  });
  const counts = { red: 0, yellow: 0, green: 0, dormant: 0 } as Record<string, number>;
  for (const p of processed) counts[p.status] = (counts[p.status] || 0) + 1;
  const redZone = processed.filter((p) => p.status === "red");
  return { processed, counts, redZone };
}

// ─── Webhook payload (CEO-approved Slack-friendly shape) ───────────
function buildWebhookPayload(redZone: any[], counts: Record<string, number>) {
  const auditedAt = new Date().toISOString();
  const summary = `🚨 ${redZone.length} athlete${redZone.length === 1 ? "" : "s"} in RED zone`;
  return {
    alert_type:   "bbf_sentinel_red_zone",
    summary,
    audited_at:   auditedAt,
    red_count:    counts.red    || 0,
    yellow_count: counts.yellow || 0,
    green_count:  counts.green  || 0,
    dormant_count: counts.dormant || 0,
    athletes: redZone.map((p) => ({
      name:     p.athlete.name,
      slug:     p.athlete.slug,
      sport:    p.athlete.sport,
      position: p.athlete.position,
      acwr:     p.report.acwr.ratio,
      acute_load:   p.report.acwr.acuteLoad,
      chronic_load: p.report.acwr.chronicLoad,
      alerts:   p.report.alerts.map((a: any) => ({ rule: a.rule, reason: a.reason })),
    })),
  };
}

// ─── Handler ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Auth gate — shared CRON_SECRET header
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    console.error("[bbf-sentinel] CRON_SECRET env var is not set");
    return new Response(JSON.stringify({ ok: false, error: "server misconfigured" }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const provided = req.headers.get("x-cron-secret");
  if (provided !== expected) {
    console.warn("[bbf-sentinel] auth rejected (missing/wrong x-cron-secret)");
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[bbf-sentinel] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    return new Response(JSON.stringify({ ok: false, error: "supabase env missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const supa = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = Date.now();
  console.log("[bbf-sentinel] starting roster audit");

  try {
    const { roster, meta } = await fetchGlobalRoster(supa);
    const { counts, redZone } = processAndFilterRedZone(roster);
    const elapsedMs = Date.now() - startedAt;

    console.log(
      `[bbf-sentinel] audit complete in ${elapsedMs}ms — ${meta.athletes} athletes, ` +
      `${counts.red}R / ${counts.yellow}Y / ${counts.green}G / ${counts.dormant}D, ` +
      `red_zone=${redZone.length}`,
    );

    // Empty RED zone — silent operation per CEO Q4 sign-off
    if (redZone.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, posted: false, red_count: 0, audit_meta: meta, elapsed_ms: elapsedMs }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // RED zone present — build payload and POST if webhook configured
    const payload = buildWebhookPayload(redZone, counts);
    const webhookUrl = Deno.env.get("ZAPIER_WEBHOOK_URL");

    if (!webhookUrl) {
      console.warn(
        `[bbf-sentinel] ${redZone.length} athletes in RED zone but ZAPIER_WEBHOOK_URL is unset — ` +
        `payload not posted. Logged red list:`, redZone.map((p) => p.athlete.slug).join(","),
      );
      return new Response(
        JSON.stringify({ ok: true, posted: false, reason: "webhook url unset",
                          red_count: redZone.length, payload_preview: payload, elapsed_ms: elapsedMs }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    let postOk = false;
    let postStatus = 0;
    try {
      const r = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      postOk = r.ok;
      postStatus = r.status;
      if (!r.ok) {
        const txt = await r.text();
        console.error(`[bbf-sentinel] Zapier POST failed status=${r.status} body=${txt.slice(0, 200)}`);
      } else {
        console.log(`[bbf-sentinel] Zapier POST ok — ${redZone.length} athletes flagged`);
      }
    } catch (e) {
      console.error(`[bbf-sentinel] Zapier POST threw:`, e instanceof Error ? e.message : String(e));
    }

    return new Response(
      JSON.stringify({
        ok: postOk,
        posted: postOk,
        post_status: postStatus,
        red_count: redZone.length,
        audit_meta: meta,
        elapsed_ms: Date.now() - startedAt,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[bbf-sentinel] audit failed:`, msg);
    return new Response(JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
