// supabase/functions/bbf-season-brain/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// SP-2 · SEASON BRAIN — the weekly game-week taper pass (Sunday cron).
//
// Deterministic calendar first, AI judgment second, founder approval always:
//   1. Native SQL finds athletes whose calendar (bbf_athlete_season /
//      bbf_athlete_games) shows a game inside the coming week. No calendar →
//      no call (SQL sentinels decide IF the agent runs at all).
//   2. For each, Sonnet (season_taper_adjustment · §4) drafts the week's
//      micro-adjustments — taper the 48h pre-game window, recovery emphasis
//      the day after, front-load CNS work early — as day-keyed focus notes +
//      volume multipliers.
//   3. The draft lands as a SEASON_TAPER card in coach_action_inbox. NOTHING
//      is applied until the founder taps approve; bbf_apply_season_adjustment
//      then writes the overlay with deterministic clamps (volume 0.5-1.0,
//      reduce-only) into bbf_athlete_week_overrides, which
//      bbf_get_my_sport_block merges into the served week.
//
// Auth: X-BBF-Admin-Token (the Sunday pg_cron injects it from Vault
// in-database — the token never leaves Postgres). Spend-gated, telemetry-
// logged, PENDING-dedup + existing-overlay dedup per athlete/week.
// Caps: MAX_ATHLETES_PER_RUN per invocation.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';
import { checkSpendGate, spendLimitResponse } from '../_shared/spend-gate.ts';
import { logLlmCall } from '../_shared/llm-telemetry.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-bbf-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const MAX_ATHLETES_PER_RUN = 20;
const DAY_RE = /^Day [1-7]$/;

const TAPER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    adjustments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'string', description: 'Exactly "Day 1" through "Day 7"' },
          focus_note: { type: 'string', description: 'One athlete-readable line explaining the adjustment' },
          volume_multiplier: { type: 'number', description: 'Working-volume scale for the day, 0.5-1.0. Omit-equivalent: 1.0' },
        },
        required: ['day', 'focus_note'],
      },
    },
    rationale: { type: 'string', description: '2-3 sentence coach-facing rationale for the whole week' },
  },
  required: ['adjustments', 'rationale'],
} as const;

const SYSTEM_PROMPT = [
  'You are the season planner inside Build Believe Fit, adjusting ONE youth athlete\'s upcoming training week around their real game schedule.',
  'You receive: the athlete\'s sport, the coming week (Monday = "Day 1" ... Sunday = "Day 7"), which of those days are game days, their current training block\'s day focuses, and their acute:chronic workload ratio.',
  'Rules (an automated validator + a founder review both stand between you and the athlete):',
  '- A taper REDUCES load, never adds. volume_multiplier between 0.5 and 1.0 only.',
  '- Trim the 24-48h window before each game (0.6-0.8 volume, drop heavy lower-body and high-amplitude plyometrics from emphasis).',
  '- The day after a game biases recovery (0.5-0.7 volume, movement quality emphasis).',
  '- Front-load the week\'s CNS-heavy work into the earliest non-game-adjacent days.',
  '- Only include days that actually need an adjustment (typically 2-4 days). Untouched days carry the normal block.',
  '- If the workload ratio is high (>1.3), be more conservative everywhere.',
  '- focus_note is athlete-readable: direct, encouraging, no jargon, no AI mentions.',
].join('\n');

async function callClaude(apiKey: string, model: string, userMessage: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: TAPER_SCHEMA } },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* handled below */ }
  if (!res.ok) {
    const err = (body?.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    return { ok: false as const, error: String(err), body };
  }
  return { ok: true as const, body };
}

function extractJson(content: any[]): any | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      try { return JSON.parse(block.text); } catch { return null; }
    }
  }
  return null;
}

// Monday of the coming week (UTC). Sunday cron → tomorrow; any other day →
// next Monday, so a manual mid-week run still targets the NEXT full week.
function nextWeekStart(): { start: Date; iso: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const daysToMonday = day === 0 ? 1 : 8 - day;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday));
  return { start, iso: start.toISOString().slice(0, 10) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'backend_unconfigured' }, 503);
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return jsonResponse({ error: 'unauthorized' }, 401);

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const gate = await checkSpendGate(SUPABASE_URL, SERVICE_KEY);
  if (gate.stopped) return spendLimitResponse(gate);

  const { start: weekStart, iso: weekIso } = nextWeekStart();
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);

  // Athletes with a game inside the coming week (the SQL sentinel).
  const { data: gameRows, error: gErr } = await supabase
    .from('bbf_athlete_games')
    .select('user_id, game_date')
    .gte('game_date', weekIso)
    .lt('game_date', weekEndIso)
    .order('game_date');
  if (gErr) return jsonResponse({ error: 'games_query_failed', detail: gErr.message }, 500);

  const byAthlete = new Map<string, string[]>();
  for (const r of gameRows ?? []) {
    const list = byAthlete.get(r.user_id) ?? [];
    list.push(r.game_date);
    byAthlete.set(r.user_id, list);
  }
  if (!byAthlete.size) return jsonResponse({ ok: true, drafted: 0, reason: 'no_games_in_coming_week' });

  const model = routeAndLog('bbf-season-brain', 'season_taper_adjustment');

  // Gateway idle limit is 150s — draft in the background, report via inbox cards.
  const runPass = async () => {
  const results: Array<Record<string, unknown>> = [];
  let drafted = 0;

  for (const [userId, games] of [...byAthlete.entries()].slice(0, MAX_ATHLETES_PER_RUN)) {
    // Dedup: one live proposal per athlete, one overlay per athlete-week.
    const { data: pending } = await supabase
      .from('coach_action_inbox').select('id')
      .eq('athlete_id', userId).eq('type', 'SEASON_TAPER').eq('status', 'PENDING').limit(1);
    if (pending?.length) { results.push({ userId, skipped: 'proposal_pending' }); continue; }
    const { data: existing } = await supabase
      .from('bbf_athlete_week_overrides').select('id')
      .eq('user_id', userId).eq('week_start', weekIso).eq('source', 'season_brain').limit(1);
    if (existing?.length) { results.push({ userId, skipped: 'overlay_exists' }); continue; }

    const { data: u } = await supabase
      .from('bbf_users').select('sport, email, name, uid').eq('id', userId).is('deleted_at', null).maybeSingle();
    if (!u) { results.push({ userId, skipped: 'user_missing' }); continue; }

    // Current block context: phase + the week's day focuses if a protocol is staged.
    let phase = 1;
    let dayFocuses: string[] = [];
    const { data: ac } = await supabase
      .from('bbf_active_clients').select('sports_protocol').eq('vault_email', u.email).maybeSingle();
    if (ac?.sports_protocol) {
      try {
        const proto = typeof ac.sports_protocol === 'string' ? JSON.parse(ac.sports_protocol) : ac.sports_protocol;
        phase = Math.min(3, Math.max(1, Number(proto.phase_number) || 1));
        dayFocuses = (proto.blocks ?? []).map((b: any) => String(b.title ?? '')).filter(Boolean).slice(0, 8);
      } catch { /* context is best-effort */ }
    }

    let acwr: number | null = null;
    try {
      const { data: a } = await supabase.rpc('bbf_compute_acwr', { p_athlete_id: userId });
      const row = Array.isArray(a) && a.length ? a[0] : (a && typeof a === 'object' ? a : null);
      if (row && Number.isFinite(Number(row.acwr))) acwr = Number(row.acwr);
    } catch { /* context is best-effort */ }

    // Game dates → Day N of the coming week (Day 1 = Monday = weekStart).
    const gameDays = games.map((g) => {
      const idx = Math.round((new Date(`${g}T00:00:00Z`).getTime() - weekStart.getTime()) / 86400000) + 1;
      return { date: g, day: `Day ${Math.min(7, Math.max(1, idx))}` };
    });

    const userMessage = [
      `ATHLETE WEEK: ${weekIso} (Day 1=Mon) → ${weekEndIso}`,
      `Sport: ${u.sport || 'general'} · Training phase: ${phase}/3`,
      `Game day(s) this week: ${gameDays.map((g) => `${g.day} (${g.date})`).join(', ')}`,
      `Acute:chronic workload ratio: ${acwr ?? 'unknown'}`,
      dayFocuses.length ? `Current block structure: ${dayFocuses.join(' · ')}` : 'Current block: standard 7-day sport week.',
      '',
      'Draft the game-week adjustments JSON now.',
    ].join('\n');

    const t0 = Date.now();
    const call = await callClaude(ANTHROPIC_API_KEY, model, userMessage);
    const latencyMs = Date.now() - t0;
    const usage = call.ok ? call.body?.usage : null;
    const gen = call.ok ? extractJson(call.body?.content) : null;

    // Deterministic shaping: only valid Day keys, clamp volumes, cap notes.
    const days: Record<string, { focus_note: string; volume_multiplier: number | null }> = {};
    for (const adj of (Array.isArray(gen?.adjustments) ? gen.adjustments : [])) {
      const key = String(adj?.day ?? '');
      if (!DAY_RE.test(key)) continue;
      const rawMult = Number(adj?.volume_multiplier);
      days[key] = {
        focus_note: String(adj?.focus_note ?? '').slice(0, 200),
        volume_multiplier: Number.isFinite(rawMult) ? Math.round(Math.min(1.0, Math.max(0.5, rawMult)) * 100) / 100 : null,
      };
    }
    const ok = call.ok && Object.keys(days).length > 0;

    await logLlmCall(supabase, {
      agent: 'bbf-season-brain', model, ok,
      latencyMs, inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null,
      finishReason: call.ok ? (call.body?.stop_reason ?? null) : null,
      error: ok ? null : (call.ok ? 'no_valid_adjustments' : call.error), promptName: 'season_taper_adjustment',
    });
    if (!ok) { results.push({ userId, skipped: call.ok ? 'no_valid_adjustments' : call.error }); continue; }

    const rationale = String(gen?.rationale ?? '').slice(0, 500);
    const dayList = Object.entries(days)
      .map(([k, v]) => `${k}${v.volume_multiplier != null ? ` ×${v.volume_multiplier}` : ''}`)
      .join(', ');
    const { error: insErr } = await supabase.from('coach_action_inbox').insert({
      athlete_id: userId,
      type: 'SEASON_TAPER',
      insight_summary: `Season Brain: game week detected (${gameDays.map((g) => g.day).join(', ')}). ${rationale}`.slice(0, 1900),
      proposed_action: `Apply the week-of-${weekIso} overlay: ${dayList}. Volume clamps [0.5-1.0] enforced at apply time.`,
      draft_message: '',
      proposed_plan_modification: {
        season_taper: { user_id: userId, week_start: weekIso, days, rationale, games: gameDays },
      },
    });
    if (insErr) { results.push({ userId, skipped: `stage_failed:${insErr.message.slice(0, 100)}` }); continue; }
    drafted++;
    results.push({ userId, drafted: true, days: Object.keys(days) });
  }

  console.log(`[bbf-season-brain] week=${weekIso} drafted=${drafted} considered=${byAthlete.size} detail=${JSON.stringify(results).slice(0, 400)}`);
  };

  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(runPass());
  else runPass();
  return jsonResponse({ ok: true, accepted: true, week_start: weekIso, considered: byAthlete.size, model }, 202);
});
