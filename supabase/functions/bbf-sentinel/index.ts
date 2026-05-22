// ═══════════════════════════════════════════════════════════════
// supabase/functions/bbf-sentinel/index.ts · v11
// Sentinel Protocol — TWO modes, single endpoint:
//
//   (A) Default · daily roster audit (legacy):
//       Runs the active roster through the BBF Intelligence Engine.
//       Red-zone athletes get a Zapier webhook POST. Cron-invoked
//       at 08:00 UTC. Auth: x-cron-secret matches CRON_SECRET env.
//
//   (B) Phase 6 · intent='verify_proposal' (NEW v11):
//       Two-bin sorting on Claude proposals BEFORE they reach the
//       founder queue. Deterministic checks (no Claude) categorize
//       failures as either RECOVERABLE (vocab/syntax — retry via
//       BBF_INTERCEPT budget, ≤ 3) or SUBSTANTIVE (scope/safety/
//       cardiac — NEVER retry · escalate to founder as critical).
//       Auth: x-bbf-admin-token matches BBF_COACH_AGENT_TOKEN env.
//       Routed from BBF_ORCHESTRATOR.submitProposal · also callable
//       from any server-side agent that wants pre-queue verification.
//
// Required environment variables (set in Supabase Dashboard):
//   CRON_SECRET             shared secret for the audit path (cron-only)
//   BBF_COACH_AGENT_TOKEN   shared secret for the verifier path
//   ZAPIER_WEBHOOK_URL      Catch Hook URL (optional · audit path only)
// Auto-injected by Supabase:
//   SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
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

// ═══════════════════════════════════════════════════════════════
// Phase 6 · Sentinel v11 · verify_proposal · Two-Bin Sorting
// ───────────────────────────────────────────────────────────────
// Deterministic verifier · NO Claude on this path. Mirrors the
// BBF_OT_PROMPT vocab contract server-side for the recoverable bin
// and runs a fixed safety checklist for the substantive bin.
// ═══════════════════════════════════════════════════════════════

// Banned-term substitutions · mirrors BBF_OT_PROMPT.getBanList()
// shape but uses regex sources directly so we can flag matches
// without rewriting the text. ANY match flips the proposal to
// 'recoverable' so Claude retries with the failure reason and
// substitutes correct vocabulary on the next pass.
const VOCAB_BAN_LIST: Array<{ re: RegExp; label: string }> = [
  { re: /\binjury risk\b/i,        label: 'injury_risk' },
  { re: /\bchronic pain\b/i,       label: 'chronic_pain' },
  { re: /\bchronic condition\b/i,  label: 'chronic_condition' },
  { re: /\bacute injury\b/i,       label: 'acute_injury' },
  { re: /\bdysfunctions?\b/i,      label: 'dysfunction' },
  { re: /\bpathology\b/i,          label: 'pathology' },
  { re: /\bdiagnos(?:e|ed|es|is)\b/i, label: 'diagnose' },
  { re: /\bpatients?\b/i,          label: 'patient' },
  { re: /\btherap(?:y|ist)\b/i,    label: 'therapy' },
  { re: /\btreatments?\b/i,        label: 'treatment' },
  { re: /\bdiseases?\b/i,          label: 'disease' },
  { re: /\bsymptoms?\b/i,          label: 'symptom' },
  { re: /\bprognosis\b/i,          label: 'prognosis' },
  { re: /\billness\b/i,            label: 'illness' },
  { re: /\bclinical(?:ly)?\b/i,    label: 'clinical' },
  { re: /\bdisorder(?:ed)?\b/i,    label: 'disorder' },
];

// Cardiac vocabulary · ANY match in a non-cardio proposal is a
// substantive violation (Phase 0 contract rule #9 · no LLM may
// infer cardiac risk · PAR-Q+ is the only path).
const CARDIAC_VOCAB: RegExp[] = [
  /\b(?:heart\s*rate|HR|bpm|beats\s*per\s*minute)\b/i,
  /\b(?:cardiac|cardiovascular)\b/i,
  /\bzone\s*[1-5]\b/i,
  /\b(?:VO2\s*max|max\s*HR|target\s*HR)\b/i,
  /\b(?:angina|arrhythmia|hypertension|hypotension)\b/i,
];
const CARDIO_PROPOSAL_TYPES = new Set([
  'cardio_prescription', 'cardio_intensity_shift', 'cardio_structure_change',
]);

// Whitelisted target tables per the Render proxy PROPOSAL_TARGET_WHITELIST.
// Mismatch = substantive scope violation.
const ALLOWED_TARGET_TABLES = new Set([
  'bbf_users', 'bbf_active_clients', 'bbf_athlete_progression',
]);

// Required proposal fields.
const REQUIRED_PROPOSAL_FIELDS = ['proposal_type', 'rationale', 'proposed_by', 'diff'];
const REQUIRED_DIFF_FIELDS     = ['target_table', 'target_uid', 'after'];

// Action-type vs target-table affinity. Substantive scope violation
// when the proposal_type doesn't match the table it claims to mutate.
const TABLE_AFFINITY: Record<string, Set<string>> = {
  // bbf_users actions
  'bbf_users': new Set([
    'cns_intervention','redline_override','block_priority_shift','tier_upgrade',
    'provision_override','baseline_recompute','nutrition_swap','nutrition_rotate',
    'nutrition_macro_adjust','nutrition_target_recalc','cardio_prescription',
    'cardio_intensity_shift','cardio_structure_change','program_swap','program_create',
    'program_progress','prehab_assignment','prehab_escalation','athlete_evolution',
    'roster_action','custom','transient_swap',
  ]),
  // bbf_active_clients actions
  'bbf_active_clients': new Set([
    'nutrition_swap','nutrition_rotate','nutrition_macro_adjust','nutrition_target_recalc',
    'program_swap','program_create','program_progress','custom','roster_action',
  ]),
  // bbf_athlete_progression actions
  'bbf_athlete_progression': new Set([
    'phase_advancement','adaptive_drill_candidate','athlete_evolution',
    'youth_load_progression','baseline_recompute','custom',
  ]),
};

type VerifyVerdict = 'clean' | 'recoverable' | 'substantive' | 'not_verified';
type VerifyResult = {
  verdict: VerifyVerdict;
  reason?: string;
  findings: Array<{ kind: string; detail: string }>;
};

function _scanText(text: string, banList: Array<{ re: RegExp; label: string }>): string[] {
  const out: string[] = [];
  if (typeof text !== 'string' || !text) return out;
  for (const b of banList) {
    if (b.re.test(text)) out.push(b.label);
  }
  return out;
}
function _scanTextRegex(text: string, regexList: RegExp[]): string[] {
  const out: string[] = [];
  if (typeof text !== 'string' || !text) return out;
  for (const r of regexList) {
    const m = text.match(r);
    if (m) out.push(m[0]);
  }
  return out;
}

function _collectProposalText(proposal: any): string {
  const parts: string[] = [];
  if (proposal && typeof proposal.rationale === 'string') parts.push(proposal.rationale);
  const after = proposal && proposal.diff && proposal.diff.after;
  if (after && typeof after === 'object') {
    for (const k of Object.keys(after)) {
      const v = after[k];
      if (typeof v === 'string') parts.push(v);
    }
  }
  if (proposal && proposal.metadata) {
    for (const k of Object.keys(proposal.metadata)) {
      const v = proposal.metadata[k];
      if (typeof v === 'string') parts.push(v);
    }
  }
  return parts.join(' \n ');
}

function verifyProposal(proposal: any): VerifyResult {
  const findings: Array<{ kind: string; detail: string }> = [];
  // ── 1. Required-field check (recoverable) ──────────────────────
  for (const f of REQUIRED_PROPOSAL_FIELDS) {
    if (!proposal || proposal[f] == null || proposal[f] === '') {
      findings.push({ kind: 'schema_missing', detail: 'proposal.' + f + ' required' });
    }
  }
  const diff = proposal && proposal.diff;
  if (diff && typeof diff === 'object') {
    for (const f of REQUIRED_DIFF_FIELDS) {
      if (diff[f] == null || diff[f] === '') {
        findings.push({ kind: 'schema_missing', detail: 'diff.' + f + ' required' });
      }
    }
  }
  // ── 2. Target table whitelist (substantive) ────────────────────
  const targetTable: string | undefined = diff && diff.target_table;
  if (targetTable && !ALLOWED_TARGET_TABLES.has(targetTable)) {
    return {
      verdict: 'substantive',
      reason:  'target_table_not_whitelisted: ' + targetTable,
      findings: [...findings, { kind: 'scope', detail: 'target_table=' + targetTable + ' not in whitelist' }],
    };
  }
  // ── 3. Action-type affinity (substantive scope check) ──────────
  const proposalType: string | undefined = proposal && proposal.proposal_type;
  if (proposalType && targetTable) {
    const allowedTypes = TABLE_AFFINITY[targetTable];
    if (allowedTypes && !allowedTypes.has(proposalType)) {
      return {
        verdict: 'substantive',
        reason:  'scope_mismatch: proposal_type=' + proposalType + ' cannot target table=' + targetTable,
        findings: [...findings, { kind: 'scope', detail: proposalType + ' incompatible with ' + targetTable }],
      };
    }
  }
  // ── 4. Cardiac-inference check (substantive · Phase 0 rule #9) ──
  const proposalText = _collectProposalText(proposal);
  if (proposalType && !CARDIO_PROPOSAL_TYPES.has(proposalType)) {
    const cardiacHits = _scanTextRegex(proposalText, CARDIAC_VOCAB);
    if (cardiacHits.length > 0) {
      return {
        verdict: 'substantive',
        reason:  'cardiac_inference_in_non_cardio_proposal',
        findings: [...findings, { kind: 'cardiac', detail: 'matched terms: ' + cardiacHits.slice(0, 3).join(', ') }],
      };
    }
  }
  // ── 5. Vulnerable-population check (substantive) ───────────────
  const cohort = proposal && proposal.population && proposal.population.cohort;
  if (cohort === 'youth_athlete' || cohort === 'elderly') {
    // Youth + adult-progression fields = substantive violation.
    const adultProgressionFields = ['phase', 'target_phase', 'mesocycle_week'];
    if (proposalType !== 'youth_load_progression' && diff && diff.after) {
      const touchedAdult = adultProgressionFields.filter(function(f) { return Object.prototype.hasOwnProperty.call(diff.after, f); });
      if (touchedAdult.length > 0) {
        return {
          verdict: 'substantive',
          reason:  'vulnerable_population_mismatch: ' + cohort + ' touched ' + touchedAdult.join(','),
          findings: [...findings, { kind: 'vulnerable', detail: cohort + ' progression must use youth_load_progression action_type' }],
        };
      }
    }
  }
  // ── 6. Wellbeing-halt safety check (substantive) ───────────────
  // A wellbeing halt already escalates as critical · don't let any
  // restrictive numeric proposal slip through alongside it.
  if (proposal && proposal.metadata && proposal.metadata.wellbeing_halt === true
      && proposalType === 'nutrition_target_recalc') {
    return {
      verdict: 'substantive',
      reason:  'wellbeing_halt_supersedes_target_recalc',
      findings: [...findings, { kind: 'safety', detail: 'restrictive target recalc cannot run alongside wellbeing halt' }],
    };
  }
  // ── 7. Vocab check (recoverable · clinical-vocabulary contract) ─
  const banHits = _scanText(proposalText, VOCAB_BAN_LIST);
  if (banHits.length > 0) {
    findings.push({ kind: 'vocab', detail: 'banned terms detected: ' + banHits.join(',') });
    return {
      verdict: 'recoverable',
      reason:  'clinical_vocabulary_violation: ' + banHits.slice(0, 5).join(','),
      findings,
    };
  }
  // ── 8. Schema-missing findings → recoverable (after all substantive checks pass) ─
  if (findings.length > 0) {
    return {
      verdict: 'recoverable',
      reason:  'schema_missing: ' + findings.map(function(f) { return f.detail; }).join(' · '),
      findings,
    };
  }
  return { verdict: 'clean', findings };
}

// ─── Handler ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // ── Phase 6 · intent router · check verify_proposal FIRST ─────────
  // The verifier path uses X-BBF-Admin-Token (BBF_COACH_AGENT_TOKEN).
  // The cron audit path keeps the legacy x-cron-secret gate untouched.
  let parsedBody: any = null;
  try {
    if (req.method === 'POST') {
      const txt = await req.clone().text();
      if (txt) parsedBody = JSON.parse(txt);
    }
  } catch (_) { parsedBody = null; }
  const intent = parsedBody && typeof parsedBody.intent === 'string' ? parsedBody.intent : null;

  if (intent === 'verify_proposal') {
    const verifierExpected = Deno.env.get('BBF_COACH_AGENT_TOKEN');
    if (verifierExpected) {
      const sent = req.headers.get('x-bbf-admin-token') || '';
      if (sent !== verifierExpected) {
        console.warn('[bbf-sentinel:verify_proposal] auth rejected (bad/missing x-bbf-admin-token)');
        return new Response(JSON.stringify({ verdict: 'not_verified', reason: 'unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
    }
    const proposal = parsedBody && parsedBody.proposal;
    if (!proposal || typeof proposal !== 'object') {
      return new Response(JSON.stringify({ verdict: 'not_verified', reason: 'missing_proposal' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const t0 = Date.now();
    const verdict = verifyProposal(proposal);
    const dur = Date.now() - t0;
    console.log(`[bbf-sentinel:verify_proposal] verdict=${verdict.verdict} reason=${verdict.reason || 'n/a'} dur=${dur}ms type=${proposal.proposal_type} uid=${parsedBody.uid || 'n/a'}`);
    return new Response(JSON.stringify({
      verdict:  verdict.verdict,
      reason:   verdict.reason || null,
      findings: verdict.findings,
      duration_ms: dur,
      sentinel_version: 'v11',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // ── Default · daily roster audit (legacy cron path) ──────────────
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
