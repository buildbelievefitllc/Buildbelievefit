// supabase/functions/bbf-morning-brief/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// OP-1 · THE MORNING COMMAND BRIEF — one narrative, whole business, daily.
//
// Intelligence is fragmented across the Action Inbox, roster telemetry, lead
// lanes, the content queue, and LLM spend. Once a day (05:00 ET cron), this fn:
//   1. Collects the day's deltas with DETERMINISTIC SQL only — pending/overdue
//      inbox cards by type, roster risk flags (friction, RPE, ACWR), new leads,
//      new active clients, content queue due today, LLM call health/spend.
//   2. Makes ONE Sonnet call (morning_command_brief · §4) that narrates the
//      state in ~150 words and ranks the top 3 approve/veto decisions —
//      pointing at cards that already sit in the same inbox (the 1-tap
//      approve/veto lives on those cards).
//   3. Pins the result as a MORNING_BRIEF card (dedup: one per day). Resolving
//      it is an acknowledgement — it proposes nothing that bypasses the
//      per-card approval rails.
//
// Auth: X-BBF-Admin-Token (daily pg_cron injects it from Vault in-database).
// Spend-gated, telemetry-logged. The single highest leverage-per-token call
// in the stack: one call, whole business.
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

const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', description: 'One punchy line — the single most important thing today, under 90 chars' },
    brief: { type: 'string', description: 'The 120-180 word executive narrative: what moved, what is at risk, what is working. Plain text.' },
    top_actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'The decision, imperative, under 80 chars' },
          why: { type: 'string', description: 'One line of evidence from the facts' },
        },
        required: ['title', 'why'],
      },
    },
  },
  required: ['headline', 'brief', 'top_actions'],
} as const;

const SYSTEM_PROMPT = [
  'You are the chief of staff writing the 5:00 AM command brief for the founder-CEO of Build Believe Fit, a fitness coaching platform.',
  'You receive today\'s verified operational facts as JSON: pending decision cards in his approval inbox (by type, with overdue counts), athlete risk flags, new leads, new clients, content scheduled today, and AI-system health/spend.',
  'Rules:',
  '- Write for a founder with 60 seconds: what moved, what is at risk, what is quietly working. Numbers over adjectives.',
  '- Never invent facts not in the data. If a lane is empty, one clause at most ("no new leads overnight").',
  '- top_actions: at most 3, ranked by consequence. Each must correspond to something actually actionable in the data (a pending card type, a risk flag, a stalled lane). These map to one-tap approve/veto cards already sitting in his inbox.',
  '- Direct, confident, zero filler. No greetings, no sign-off, no AI mentions.',
].join('\n');

async function callClaude(apiKey: string, model: string, userMessage: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: BRIEF_SCHEMA } },
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'backend_unconfigured' }, 503);
  if (!ADMIN_TOKEN || (req.headers.get('x-bbf-admin-token') ?? '') !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const gate = await checkSpendGate(SUPABASE_URL, SERVICE_KEY);
  if (gate.stopped) return spendLimitResponse(gate);

  const today = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  // One brief per day (dedup against PENDING or same-day resolved).
  const { data: existing } = await supabase
    .from('coach_action_inbox').select('id')
    .eq('type', 'MORNING_BRIEF').gte('created_at', `${today}T00:00:00Z`).limit(1);
  if (existing?.length) return jsonResponse({ ok: true, deduped: true, existing_id: existing[0].id });

  // ── Deterministic collectors — zero AI ─────────────────────────────────────
  const facts: Record<string, unknown> = { date: today };

  const { data: pending } = await supabase
    .from('coach_action_inbox').select('type, created_at').eq('status', 'PENDING').limit(200);
  const byType: Record<string, number> = {};
  let overdue = 0;
  for (const c of pending ?? []) {
    byType[c.type] = (byType[c.type] ?? 0) + 1;
    const ageH = (Date.now() - new Date(c.created_at).getTime()) / 3600000;
    if (ageH > 72) overdue++;
  }
  facts.inbox_pending_by_type = byType;
  facts.inbox_overdue = overdue;

  const { data: risky } = await supabase
    .from('bbf_athlete_progression')
    .select('user_id, rpe_avg_last_3, friction_avg_last_3, mesocycle_week')
    .or('rpe_avg_last_3.gt.8.5,friction_avg_last_3.gt.4')
    .limit(20);
  facts.roster_risk_flags = (risky ?? []).length;

  const { count: newLeads } = await supabase
    .from('bbf_leads').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo);
  facts.leads_last_24h = newLeads ?? 0;

  const { count: newClients } = await supabase
    .from('bbf_active_clients').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo);
  facts.new_active_clients_24h = newClients ?? 0;

  const { count: contentDue } = await supabase
    .from('bbf_content_manager_queue').select('id', { count: 'exact', head: true })
    .eq('status', 'scheduled').lte('scheduled_at', new Date(Date.now() + 86400000).toISOString());
  facts.content_scheduled_next_24h = contentDue ?? 0;

  const { data: llm } = await supabase
    .from('bbf_llm_calls').select('ok').gte('ts', dayAgo).limit(1000);
  const llmTotal = (llm ?? []).length;
  const llmFails = (llm ?? []).filter((r) => !r.ok).length;
  facts.llm_calls_24h = llmTotal;
  facts.llm_failures_24h = llmFails;
  facts.spend_24h_usd = gate.spend_24h_usd;
  facts.spend_ceiling_usd = gate.ceiling_usd;

  const { count: catalogDrafts } = await supabase
    .from('bbf_sport_block_catalog').select('id', { count: 'exact', head: true }).eq('status', 'draft');
  facts.catalog_drafts_awaiting_activation = catalogDrafts ?? 0;

  // ── One Sonnet call over the pre-computed facts ────────────────────────────
  const model = routeAndLog('bbf-morning-brief', 'morning_command_brief');
  const t0 = Date.now();
  const call = await callClaude(ANTHROPIC_API_KEY, model, [
    `COMMAND FACTS for ${today}:`,
    JSON.stringify(facts),
    '',
    'Write the brief JSON now.',
  ].join('\n'));
  const latencyMs = Date.now() - t0;
  const usage = call.ok ? call.body?.usage : null;
  const gen = call.ok ? extractJson(call.body?.content) : null;
  const ok = !!(gen?.headline && gen?.brief);

  await logLlmCall(supabase, {
    agent: 'bbf-morning-brief', model, ok,
    latencyMs, inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null,
    finishReason: call.ok ? (call.body?.stop_reason ?? null) : null,
    error: ok ? null : (call.ok ? 'schema_miss' : call.error), promptName: 'morning_command_brief',
  });
  if (!ok) return jsonResponse({ error: 'brief_generation_failed', detail: call.ok ? 'schema_miss' : call.error }, 502);

  const topActions = (Array.isArray(gen.top_actions) ? gen.top_actions : []).slice(0, 3)
    .map((a: any) => ({ title: String(a?.title ?? '').slice(0, 120), why: String(a?.why ?? '').slice(0, 200) }));

  const { data: founder } = await supabase
    .from('bbf_users').select('id').eq('uid', 'akeem').is('deleted_at', null).maybeSingle();
  if (!founder?.id) return jsonResponse({ error: 'founder_row_missing' }, 500);

  const { data: card, error: insErr } = await supabase.from('coach_action_inbox').insert({
    athlete_id: founder.id,
    type: 'MORNING_BRIEF',
    insight_summary: `☀️ ${String(gen.headline).slice(0, 180)}`,
    proposed_action: topActions.map((a: any, i: number) => `${i + 1}. ${a.title}`).join('  ·  ') || 'No decisions pending — clean board.',
    draft_message: String(gen.brief).slice(0, 2500),
    proposed_plan_modification: { morning_brief: { date: today, top_actions: topActions, facts } },
  }).select('id').maybeSingle();
  if (insErr) return jsonResponse({ error: 'stage_failed', detail: insErr.message }, 500);

  return jsonResponse({ ok: true, id: card?.id ?? null, date: today, model });
});
