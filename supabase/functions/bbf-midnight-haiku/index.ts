// bbf-midnight-haiku v3 — Daily Brief + Sunday Recon + Orchestrator Synthesis
// ─────────────────────────────────────────────────────────────────────
// Phase 6 EXTENSION · Nightly Athlete Snapshot fan-out:
//   · For EVERY Sovereign athlete in the nightly batch, after the
//     daily brief is persisted, fan out to bbf-agentic-orchestrator
//     with intent='synthesize_athlete_snapshot'. The orchestrator's
//     Slow Path reads the 7-day episodic memory + CNS slice + meal +
//     set aggregates and writes a 2-4 sentence synthesis back to
//     bbf_orchestrator_memory as action_type='athlete_snapshot_synthesis'.
//   · Best-effort · a synthesis failure NEVER blocks the brief flow.
//   · Skipped in dry_run mode.
//
// Phase 5 EXTENSION · Sunday Macro Reconciliation (callable subsystem):
//   · On Sundays (UTC), every Sovereign athlete additionally gets a
//     weekly nutrition reconciliation pass: 7-day rolling avg of
//     bbf_meal_logs vs current bbf_users macro/TDEE targets. If the
//     averages drift > 8 % from current targets AND ≥ 3 logged days
//     exist in the window, a nutrition_target_recalc proposal is STAGED
//     to bbf_pending_review via /api/proposal-submit.
//   · PRECEDENCE RULE: a wellbeing halt SUPERSEDES the recalc. If an
//     unresolved cns_intervention proposal with metadata.wellbeing_halt
//     exists for the user in the last 30 days, NO restrictive numeric
//     proposal is generated for that user. Logged loudly to audit.
//   · The recalc is NEVER live · founder approves every target change
//     through the existing proposal queue.
//
// Phase 0-4 BASE · Daily Brief generation:
// Asynchronous, cron-triggered batch that generates the next-day
// daily_brief for every Sovereign-tier athlete. Reads each user's last
// 24h of training (bbf_logs) + autonomic readiness (bbf_readiness), asks
// Claude Haiku to write a 2–3 sentence clinical intelligence brief in
// the voice of a Sovereign-tier hypertrophy + biomechanics coach, then
// UPDATEs bbf_users.daily_brief with the result. The brief surfaces on
// the next render of the Sovereign Intelligence Brief widget on the
// Workout tab.
//
// CEO directive specified `claude-3-haiku-20240307` — that model is
// retired (2026 sunset). This function uses the current Haiku 4.5
// (`claude-haiku-4-5`) — the modern, cheaper, faster equivalent.
//
// Trigger:
//   POST /functions/v1/bbf-midnight-haiku
//   X-BBF-Cron-Token: <shared secret from BBF_MIDNIGHT_CRON_TOKEN>
//   (No body required; an optional { dry_run: true } skips the UPDATE.)
//
// Wire via pg_cron:
//   SELECT cron.schedule(
//     'bbf-midnight-haiku',
//     '0 5 * * *',  -- 05:00 UTC = 00:00 ET, late enough for last-set logs
//     $$ SELECT net.http_post(
//          url     := 'https://<project>.supabase.co/functions/v1/bbf-midnight-haiku',
//          headers := '{"X-BBF-Cron-Token":"<token>"}'::jsonb
//        ); $$
//   );
//
// Required secrets:
//   ANTHROPIC_API_KEY            — Anthropic API key
//   SUPABASE_URL                 — auto-provided by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    — auto-provided by Supabase
//   BBF_MIDNIGHT_CRON_TOKEN      — shared cron secret (optional but recommended)
//
// Required schema:
//   bbf_users.daily_brief        — text, nullable. Add via migration:
//     alter table bbf_users add column if not exists daily_brief text;
//   bbf_users.subscription_tier  — text, already present (gateway / youth_athlete / architect / sovereign)
//
// Response (200 OK):
//   { ok: true, processed, succeeded, failed,
//     model, dry_run, batch_size, errors: [{ uid, message }] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ─── Constants ────────────────────────────────────────────────────────
const MODEL          = 'claude-haiku-4-5';
const MAX_TOKENS     = 220; // 2–3 sentences ≈ 100–150 output tokens; small buffer.
const BATCH_SIZE     = 5;   // Concurrent Anthropic calls per batch.
const RETRY_LIMIT    = 3;   // Per-user retry attempts on transient API failures.
const RETRY_BASE_MS  = 800; // Exponential backoff base (800ms, 1.6s, 3.2s).
const LOOKBACK_HOURS = 24;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-bbf-cron-token',
};

// Cacheable system prompt — stable across every user in the batch. The
// first request in a batch writes the cache (~1.25× cost); the remaining
// N-1 reads it (~0.1× cost). Don't tweak this per-request or the prefix
// invalidates and the savings evaporate.
const SYSTEM_PROMPT = [
  'You are the BBF Midnight Haiku Engine — a Sovereign-tier hypertrophy and biomechanics coach reporting to Head Coach Akeem Brown, founder of Build Believe Fit. You write the daily intelligence brief that greets each Sovereign-tier athlete the moment they open today\'s Workout tab.',
  '',
  '# YOUR JOB',
  'Read the athlete\'s last 24 hours of training volume + intensity (bbf_logs / bbf_sets) and CNS readiness (bbf_readiness). Synthesize 2–3 sentences of highly specific, actionable intelligence the athlete can apply to today\'s session.',
  '',
  '# WHAT TO PRESCRIBE',
  '- Joint health and mobility cues when soreness is elevated or sleep is short',
  '- Glycogen routing and intra-workout fueling when volume was heavy and intensity stays heavy',
  '- Tempo, TUT, and biomechanical-form refinements when CNS is primed and volume is moderate',
  '- Recovery framing (parasympathetic emphasis, low-amplitude blood flow) when the score is sub-65 or sleep is sub-6h',
  '',
  '# TONE',
  'Relentless. Clinical. Elite. No fluff. No greeting (it is added by the client). No emoji. No exclamation marks. Speak directly to the athlete in second person. Reference their actual numbers when they sharpen the message; do not invent numbers that are not in the data.',
  '',
  '# OUTPUT CONTRACT',
  '- Exactly 2 to 3 sentences.',
  '- Plain text. No markdown, no headings, no lists, no JSON.',
  '- Do not begin with "Hey", "Hello", "Good morning", or the athlete\'s name — those are rendered by the client.',
  '- Do not end with motivational filler ("you got this", "let\'s go", etc.).',
  '- If the data is sparse (no logs, no readiness) prescribe joint integrity + sub-maximal warm-up volume and acknowledge the missing signal in one clause.',
].join('\n');

// ─── HTTP plumbing ────────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Types ────────────────────────────────────────────────────────────
type SovereignUser = {
  id: string;
  name: string | null;
};

type LogRow = {
  id: string;
  date: string;
  type: string | null;
  tier_phases: unknown;
  coach_notes: string | null;
};

type ReadinessRow = {
  timestamp: string;
  score: number | null;
  sleep_quality: number | null;
  soreness_level: number | null;
};

// ─── Sovereign roster sweep ───────────────────────────────────────────
async function fetchSovereignRoster(
  supabaseUrl: string,
  supabaseKey: string,
): Promise<SovereignUser[]> {
  const url = `${supabaseUrl}/rest/v1/bbf_users` +
    `?subscription_tier=eq.sovereign` +
    `&select=id,name`;
  const res = await fetch(url, {
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`roster_fetch_failed: HTTP ${res.status} ${detail}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows as SovereignUser[] : [];
}

// ─── Per-user 24h windows ─────────────────────────────────────────────
async function fetchRecentLogs(
  uuid: string,
  sinceIso: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<LogRow[]> {
  const select = 'id,date,type,tier_phases,coach_notes';
  const url = `${supabaseUrl}/rest/v1/bbf_logs` +
    `?user_id=eq.${encodeURIComponent(uuid)}` +
    `&date=gte.${encodeURIComponent(sinceIso)}` +
    `&order=date.desc` +
    `&select=${select}`;
  const res = await fetch(url, {
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows as LogRow[] : [];
}

async function fetchRecentReadiness(
  uuid: string,
  sinceIso: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<ReadinessRow[]> {
  const select = 'timestamp,score,sleep_quality,soreness_level';
  const url = `${supabaseUrl}/rest/v1/bbf_readiness` +
    `?user_id=eq.${encodeURIComponent(uuid)}` +
    `&timestamp=gte.${encodeURIComponent(sinceIso)}` +
    `&order=timestamp.desc` +
    `&select=${select}`;
  const res = await fetch(url, {
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows as ReadinessRow[] : [];
}

// ─── Anthropic call with retry/backoff ────────────────────────────────
async function generateBrief(
  user: SovereignUser,
  logs: LogRow[],
  readiness: ReadinessRow[],
  apiKey: string,
): Promise<string> {
  const userPayload = {
    athlete: {
      name: user.name || 'Athlete',
      uid:  user.id,
    },
    window_hours: LOOKBACK_HOURS,
    bbf_logs:      logs,
    bbf_readiness: readiness,
  };

  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    // System prompt is cacheable — identical across every user in the
    // batch. The first request writes; the rest read at ~0.1×.
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content:
          'Last 24h telemetry for one Sovereign-tier athlete. Write the brief.\n\n' +
          '```json\n' + JSON.stringify(userPayload, null, 2) + '\n```',
      },
    ],
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Retry transient: 408 timeout, 409, 429 rate limit, 5xx server.
      if (res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500) {
        const detail = await res.text().catch(() => '');
        lastError = new Error(`anthropic_${res.status}: ${detail.slice(0, 200)}`);
      } else if (!res.ok) {
        // Non-transient — fail fast.
        const detail = await res.text().catch(() => '');
        throw new Error(`anthropic_${res.status}: ${detail.slice(0, 200)}`);
      } else {
        const body = await res.json();
        const text = extractTextBlock(body?.content);
        if (!text) throw new Error('anthropic_empty_response');
        return text.trim();
      }
    } catch (e) {
      // Network-level failure — count as transient.
      lastError = e instanceof Error ? e : new Error(String(e));
    }

    if (attempt < RETRY_LIMIT - 1) {
      await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new Error('anthropic_unknown_error');
}

function extractTextBlock(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
      const text = (block as { text?: unknown }).text;
      if (typeof text === 'string') return text;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 5 · Sunday Macro Reconciliation subsystem
// ───────────────────────────────────────────────────────────────────────
// Runs ONLY on Sundays (UTC). For each Sovereign user:
//   1. Check wellbeing-halt precedence · skip if an unresolved
//      cns_intervention proposal with metadata.wellbeing_halt exists
//      for this user within the last 30 days.
//   2. Pull 7-day rolling bbf_meal_logs averages.
//   3. If ≥ 3 logged days AND drift > 8 % from current targets,
//      stage a nutrition_target_recalc proposal via the Render proxy.
// ═══════════════════════════════════════════════════════════════════════

const NUTRITION_RECALC_DRIFT_THRESHOLD_PCT = 0.08;
const NUTRITION_RECALC_MIN_LOGGED_DAYS     = 3;
const NUTRITION_RECALC_WINDOW_DAYS         = 7;
const WELLBEING_HALT_LOOKBACK_DAYS         = 30;

type MealLogDayBucket = {
  date: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  entries: number;
};

type UserNutritionState = {
  tdee_target: number | null;
  macro_p:     number | null;
  macro_c:     number | null;
  macro_f:     number | null;
  somatic_fasting_hours:     number | null;
  ghost_intervention_needed: boolean;
};

async function fetchUserNutritionState(
  uuid: string, supabaseUrl: string, supabaseKey: string,
): Promise<UserNutritionState> {
  const url = `${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(uuid)}` +
              `&select=tdee_target,macro_p,macro_c,macro_f,somatic_fasting_hours,ghost_intervention_needed&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    if (!res.ok) {
      return { tdee_target: null, macro_p: null, macro_c: null, macro_f: null, somatic_fasting_hours: null, ghost_intervention_needed: false };
    }
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const r = rows[0];
      return {
        tdee_target: r.tdee_target != null ? Number(r.tdee_target) : null,
        macro_p:     r.macro_p     != null ? Number(r.macro_p)     : null,
        macro_c:     r.macro_c     != null ? Number(r.macro_c)     : null,
        macro_f:     r.macro_f     != null ? Number(r.macro_f)     : null,
        somatic_fasting_hours:     r.somatic_fasting_hours != null ? Number(r.somatic_fasting_hours) : null,
        ghost_intervention_needed: !!r.ghost_intervention_needed,
      };
    }
  } catch (_) {}
  return { tdee_target: null, macro_p: null, macro_c: null, macro_f: null, somatic_fasting_hours: null, ghost_intervention_needed: false };
}

async function fetchMealLogTotals(
  uuid: string, supabaseUrl: string, supabaseKey: string,
): Promise<MealLogDayBucket[]> {
  const sinceDate = new Date(Date.now() - NUTRITION_RECALC_WINDOW_DAYS * 86400000).toISOString().slice(0,10);
  const qs = `user_id=eq.${encodeURIComponent(uuid)}` +
             `&log_date=gte.${encodeURIComponent(sinceDate)}` +
             `&select=log_date,calories,protein_g,carbs_g,fats_g` +
             `&order=log_date.desc`;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bbf_meal_logs?${qs}`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    const buckets: Record<string, MealLogDayBucket> = {};
    for (const row of rows) {
      const d = row.log_date;
      if (!buckets[d]) buckets[d] = { date: d, kcal: 0, p: 0, c: 0, f: 0, entries: 0 };
      buckets[d].kcal += Number(row.calories)  || 0;
      buckets[d].p    += Number(row.protein_g) || 0;
      buckets[d].c    += Number(row.carbs_g)   || 0;
      buckets[d].f    += Number(row.fats_g)    || 0;
      buckets[d].entries++;
    }
    return Object.values(buckets);
  } catch (_) { return []; }
}

// PRECEDENCE GATE · check for active wellbeing halt via queue lookup
async function hasActiveWellbeingHalt(
  uuid: string, supabaseUrl: string, supabaseKey: string,
): Promise<boolean> {
  // Resolve uuid → slug for the proposal_review.diff.target_uid field
  // (target_uid is stored as the slug · queue lookup uses the slug).
  // Easier path: query the queue for any cns_intervention proposal
  // submitted in the last 30 days whose population.uids contains the
  // user's uuid OR slug. Simpler yet · since we have the uuid, we can
  // pull the user's slug first and then query by slug in the diff.
  try {
    const userRes = await fetch(`${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(uuid)}&select=uid&limit=1`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    if (!userRes.ok) return false;
    const userRows = await userRes.json();
    if (!Array.isArray(userRows) || userRows.length === 0) return false;
    const slug = userRows[0].uid;
    if (!slug) return false;

    const sinceIso = new Date(Date.now() - WELLBEING_HALT_LOOKBACK_DAYS * 86400000).toISOString();
    const qs = `proposal_type=eq.cns_intervention` +
               `&proposed_at=gte.${encodeURIComponent(sinceIso)}` +
               `&status=in.(pending,executed)` +
               `&select=id,metadata,diff,status`;
    const propRes = await fetch(`${supabaseUrl}/rest/v1/bbf_pending_review?${qs}`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    if (!propRes.ok) return false;
    const rows = await propRes.json();
    if (!Array.isArray(rows)) return false;
    return rows.some((r: any) => {
      const tgt = r && r.diff && r.diff.target_uid;
      const wellbeing = r && r.metadata && r.metadata.wellbeing_halt === true;
      return wellbeing && tgt === slug;
    });
  } catch (_) { return false; }
}

async function stageNutritionTargetRecalcProposal(
  uidSlug: string, state: UserNutritionState, avg: { kcal: number; p: number; c: number; f: number; count: number },
  renderOrigin: string, adminToken: string,
): Promise<{ staged: boolean; proposal_id: string | null; error?: string }> {
  const body = {
    proposal_type: 'nutrition_target_recalc',
    risk_level:    'medium',
    population:    { uids: [uidSlug], cohort: 'single' },
    diff: {
      target_table: 'bbf_users',
      target_uid:   uidSlug,
      before: {
        tdee_target: state.tdee_target,
        macro_p:     state.macro_p,
        macro_c:     state.macro_c,
        macro_f:     state.macro_f,
      },
      after: {
        tdee_target: avg.kcal,
        macro_p:     avg.p,
        macro_c:     avg.c,
        macro_f:     avg.f,
      },
      fields: ['tdee_target','macro_p','macro_c','macro_f'],
    },
    rationale: 'Sunday weekly trend reconciliation by bbf-midnight-haiku.v2. 7-day rolling averages: ' +
               avg.kcal + ' kcal · ' + avg.p + 'g P / ' + avg.c + 'g C / ' + avg.f + 'g F across ' +
               avg.count + ' logged days. Drift > ' + Math.round(NUTRITION_RECALC_DRIFT_THRESHOLD_PCT * 100) +
               ' % from current targets · founder reviews actual-vs-target drift before any target write goes live.',
    proposed_by: 'bbf-midnight-haiku.v2',
    metadata: {
      weekly_aggregation: { avg_kcal: avg.kcal, avg_p: avg.p, avg_c: avg.c, avg_f: avg.f, logged_days: avg.count },
      somatic_fasting_hours: state.somatic_fasting_hours,
      generated_at:       new Date().toISOString(),
    },
  };
  try {
    // No Origin header on the server-side call · the Render proxy's
    // ALLOWED_ORIGINS check is `if (origin && !ALLOWED_ORIGINS.has(origin))`,
    // so omitting Origin skips the browser-origin gate entirely. The
    // admin-token gate remains the load-bearing auth check.
    const res = await fetch(`${renderOrigin}/api/proposal-submit`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'X-BBF-Admin-Token': adminToken,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[bbf-midnight-haiku:sunday] proposal-submit HTTP ${res.status}: ${txt.slice(0,300)}`);
      return { staged: false, proposal_id: null, error: `proxy_http_${res.status}` };
    }
    const j = await res.json().catch(() => null) as any;
    return {
      staged:      !!(j && j.ok && j.proposal && j.proposal.id),
      proposal_id: (j && j.proposal && j.proposal.id) || null,
    };
  } catch (e) {
    console.error(`[bbf-midnight-haiku:sunday] proposal-submit threw: ${(e as Error).message}`);
    return { staged: false, proposal_id: null, error: (e as Error).message };
  }
}

type SundayReconResult = {
  uid: string;
  skipped: boolean;
  reason?: string;
  proposal_id?: string | null;
  drift_pct?:   number | null;
};

async function runSundayReconciliationForUser(
  user: SovereignUser, supabaseUrl: string, supabaseKey: string,
  renderOrigin: string, adminToken: string,
): Promise<SundayReconResult> {
  // 1. Precedence gate · wellbeing halt SUPERSEDES recalc
  const halted = await hasActiveWellbeingHalt(user.id, supabaseUrl, supabaseKey);
  if (halted) {
    console.log(`[bbf-midnight-haiku:sunday] uid=${user.id} SKIPPED · wellbeing_halt_active`);
    return { uid: user.id, skipped: true, reason: 'wellbeing_halt_active' };
  }

  // 2. Pull current state + meal logs
  const [state, dailyTotals] = await Promise.all([
    fetchUserNutritionState(user.id, supabaseUrl, supabaseKey),
    fetchMealLogTotals(user.id, supabaseUrl, supabaseKey),
  ]);
  if (!dailyTotals.length) {
    return { uid: user.id, skipped: true, reason: 'no_meal_logs' };
  }
  let totalKcal = 0, totalP = 0, totalC = 0, totalF = 0, count = 0;
  for (const b of dailyTotals) {
    if (b.kcal > 0) {
      totalKcal += b.kcal; totalP += b.p; totalC += b.c; totalF += b.f; count++;
    }
  }
  if (count < NUTRITION_RECALC_MIN_LOGGED_DAYS) {
    return { uid: user.id, skipped: true, reason: `insufficient_logged_days_${count}` };
  }
  const avg = {
    kcal:  Math.round(totalKcal / count),
    p:     Math.round(totalP / count),
    c:     Math.round(totalC / count),
    f:     Math.round(totalF / count),
    count,
  };
  // 3. Drift check vs current target (only fire when drift exceeds threshold)
  let driftPct: number | null = null;
  if (state.tdee_target && state.tdee_target > 0) {
    driftPct = Math.abs((avg.kcal - state.tdee_target) / state.tdee_target);
    if (driftPct < NUTRITION_RECALC_DRIFT_THRESHOLD_PCT) {
      return { uid: user.id, skipped: true, reason: 'drift_below_threshold', drift_pct: driftPct };
    }
  }
  // 4. Stage proposal · founder approves before any target write
  const staging = await stageNutritionTargetRecalcProposal(
    user.id, state, avg, renderOrigin, adminToken,
  );
  if (!staging.staged) {
    return { uid: user.id, skipped: true, reason: staging.error || 'stage_failed', drift_pct: driftPct };
  }
  console.log(`[bbf-midnight-haiku:sunday] STAGED · uid=${user.id} · proposal_id=${staging.proposal_id} · drift=${driftPct?.toFixed(2)}`);
  return { uid: user.id, skipped: false, proposal_id: staging.proposal_id, drift_pct: driftPct };
}

// ─── Injection: UPDATE bbf_users.daily_brief ──────────────────────────
async function persistBrief(
  uuid: string,
  brief: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(uuid)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      daily_brief: brief,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`update_failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 6 · Orchestrator Slow-Path fan-out · per-user nightly synthesis
// ───────────────────────────────────────────────────────────────────────
// Fires bbf-agentic-orchestrator with intent=synthesize_athlete_snapshot.
// Result is persisted server-side to bbf_orchestrator_memory by the
// orchestrator itself; we only forward the snapshot text for the
// response payload.
// ═══════════════════════════════════════════════════════════════════════

type SynthesisResult = { uid: string; ok: boolean; snapshot?: string; error?: string };

async function fetchUserSlug(
  uuid: string, supabaseUrl: string, supabaseKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(uuid)}&select=uid&limit=1`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0].uid) return String(rows[0].uid);
    return null;
  } catch (_) { return null; }
}

async function runOrchestratorSynthesisForUser(
  user: SovereignUser, supabaseUrl: string, agentToken: string,
): Promise<SynthesisResult> {
  // Orchestrator expects the slug · resolve uuid → slug first.
  const slug = await fetchUserSlug(user.id, supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
  const uid = slug || user.id;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/bbf-agentic-orchestrator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-BBF-Admin-Token': agentToken },
      body: JSON.stringify({ intent: 'synthesize_athlete_snapshot', uid: uid }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[bbf-midnight-haiku:orchestrator] uid=${uid} HTTP ${res.status}: ${txt.slice(0,200)}`);
      return { uid, ok: false, error: `orchestrator_http_${res.status}` };
    }
    const j = await res.json().catch(() => null) as any;
    return { uid, ok: !!(j && j.ok), snapshot: j && j.snapshot };
  } catch (e) {
    return { uid, ok: false, error: (e as Error).message };
  }
}

// ─── Per-user pipeline ────────────────────────────────────────────────
async function processUser(
  user: SovereignUser,
  sinceIso: string,
  supabaseUrl: string,
  supabaseKey: string,
  apiKey: string,
  dryRun: boolean,
  isSunday: boolean,
  renderOrigin: string,
  adminToken: string,
  agentToken: string,
): Promise<{ uid: string; brief: string; sunday_recon: SundayReconResult | null; orchestrator_synth: SynthesisResult | null }> {
  const [logs, readiness] = await Promise.all([
    fetchRecentLogs(user.id, sinceIso, supabaseUrl, supabaseKey),
    fetchRecentReadiness(user.id, sinceIso, supabaseUrl, supabaseKey),
  ]);
  const brief = await generateBrief(user, logs, readiness, apiKey);
  if (!dryRun) {
    await persistBrief(user.id, brief, supabaseUrl, supabaseKey);
  }
  // Phase 5 · Sunday-only macro reconciliation · runs AFTER the brief
  // is persisted so a recon failure never blocks the daily brief flow.
  let sundayRecon: SundayReconResult | null = null;
  if (isSunday && !dryRun && adminToken) {
    try {
      sundayRecon = await runSundayReconciliationForUser(
        user, supabaseUrl, supabaseKey, renderOrigin, adminToken,
      );
    } catch (e) {
      console.error(`[bbf-midnight-haiku:sunday] uid=${user.id} threw: ${(e as Error).message}`);
      sundayRecon = { uid: user.id, skipped: true, reason: 'exception_' + (e as Error).message.slice(0, 80) };
    }
  }
  // Phase 6 · Orchestrator Slow-Path synthesis · runs EVERY night for
  // every Sovereign athlete · best-effort, skipped in dry_run and when
  // the agent token is unset (so dev environments don't burn Anthropic
  // budget by accident).
  let orchestratorSynth: SynthesisResult | null = null;
  if (!dryRun && agentToken) {
    try {
      orchestratorSynth = await runOrchestratorSynthesisForUser(user, supabaseUrl, agentToken);
    } catch (e) {
      console.error(`[bbf-midnight-haiku:orchestrator] uid=${user.id} threw: ${(e as Error).message}`);
      orchestratorSynth = { uid: user.id, ok: false, error: 'exception_' + (e as Error).message.slice(0, 80) };
    }
  }
  return { uid: user.id, brief, sunday_recon: sundayRecon, orchestrator_synth: orchestratorSynth };
}

// ─── Batch orchestration ──────────────────────────────────────────────
async function runBatch(
  roster: SovereignUser[],
  sinceIso: string,
  supabaseUrl: string,
  supabaseKey: string,
  apiKey: string,
  dryRun: boolean,
  isSunday: boolean,
  renderOrigin: string,
  adminToken: string,
  agentToken: string,
) {
  const errors: { uid: string; message: string }[] = [];
  const sundayReconResults: SundayReconResult[] = [];
  const orchestratorResults: SynthesisResult[] = [];
  let succeeded = 0;

  for (let i = 0; i < roster.length; i += BATCH_SIZE) {
    const slice = roster.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      slice.map((user) =>
        processUser(user, sinceIso, supabaseUrl, supabaseKey, apiKey, dryRun, isSunday, renderOrigin, adminToken, agentToken)
      ),
    );
    results.forEach((r, idx) => {
      const user = slice[idx];
      if (r.status === 'fulfilled') {
        succeeded++;
        if (r.value.sunday_recon) sundayReconResults.push(r.value.sunday_recon);
        if (r.value.orchestrator_synth) orchestratorResults.push(r.value.orchestrator_synth);
        console.log(`[bbf-midnight-haiku] OK uid=${user.id} brief="${r.value.brief.slice(0, 80)}..."`);
      } else {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push({ uid: user.id, message });
        console.error(`[bbf-midnight-haiku] FAIL uid=${user.id} error=${message}`);
      }
    });
  }

  return {
    succeeded,
    failed: errors.length,
    errors,
    sunday_recon: sundayReconResults,
    orchestrator_synth: orchestratorResults,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // Cron-only gate. If the secret is set in env, demand it from the caller.
  const expectedToken = Deno.env.get('BBF_MIDNIGHT_CRON_TOKEN');
  if (expectedToken) {
    const presented = req.headers.get('x-bbf-cron-token');
    if (presented !== expectedToken) {
      console.warn('[bbf-midnight-haiku] rejected: missing or wrong cron token.');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  const ANTHROPIC_API_KEY      = Deno.env.get('ANTHROPIC_API_KEY');
  const SUPABASE_URL           = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!ANTHROPIC_API_KEY)    return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
  if (!SUPABASE_URL)         return jsonResponse({ error: 'config_missing_supabase_url' }, 503);
  if (!SUPABASE_SERVICE_KEY) return jsonResponse({ error: 'config_missing_service_role_key' }, 503);

  // Parse body ONCE · cron typically POSTs no body, but callers can
  // pass { dry_run: true } and/or { force_sunday: true } for QA.
  let dryRun = false;
  let forceSunday = false;
  try {
    const text = await req.text();
    if (text) {
      const parsed = JSON.parse(text);
      dryRun      = Boolean(parsed?.dry_run);
      forceSunday = Boolean(parsed?.force_sunday);
    }
  } catch {
    // Empty or malformed body is fine.
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  // Phase 5 · Sunday-only branch · UTC day-of-week 0 = Sunday
  const isSunday = (new Date().getUTCDay() === 0) || forceSunday;
  const RENDER_ORIGIN          = Deno.env.get('BBF_RENDER_PROXY_ORIGIN') || 'https://buildbelievefit.onrender.com';
  const BBF_ADMIN_TOKEN        = Deno.env.get('BBF_ADMIN_TOKEN') || '';
  const BBF_COACH_AGENT_TOKEN  = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';

  let roster: SovereignUser[];
  try {
    roster = await fetchSovereignRoster(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[bbf-midnight-haiku] roster sweep failed: ${message}`);
    return jsonResponse({ error: 'roster_fetch_failed', detail: message }, 502);
  }

  console.log(`[bbf-midnight-haiku] sweep: ${roster.length} sovereign athletes, dry_run=${dryRun}, sunday=${isSunday}`);

  if (roster.length === 0) {
    return jsonResponse({
      ok:                 true,
      processed:          0,
      succeeded:          0,
      failed:             0,
      model:              MODEL,
      dry_run:            dryRun,
      batch_size:         BATCH_SIZE,
      sunday:             isSunday,
      sunday_recon:       [],
      orchestrator_synth: [],
      errors:             [],
    });
  }

  const { succeeded, failed, errors, sunday_recon, orchestrator_synth } = await runBatch(
    roster,
    sinceIso,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    ANTHROPIC_API_KEY,
    dryRun,
    isSunday,
    RENDER_ORIGIN,
    BBF_ADMIN_TOKEN,
    BBF_COACH_AGENT_TOKEN,
  );

  return jsonResponse({
    ok:                 true,
    processed:          roster.length,
    succeeded,
    failed,
    model:              MODEL,
    dry_run:            dryRun,
    batch_size:         BATCH_SIZE,
    sunday:             isSunday,
    sunday_recon,
    orchestrator_synth,
    errors,
  });
});
