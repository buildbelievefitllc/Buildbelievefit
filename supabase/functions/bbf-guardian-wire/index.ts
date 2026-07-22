// supabase/functions/bbf-guardian-wire/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// SP-9 · THE GUARDIAN WIRE — monthly parent digest generator + dispatcher.
//
// The youth edition of the narrative discipline, aimed at the person who pays:
//   1. DISPATCH SWEEP — approved digests from the founder's inbox queue go out
//      on the EXISTING Brevo transactional rail to the account email (the
//      family login address). Text only, founder-approved, audit-logged.
//   2. DRAFT PASS — for each active youth athlete (sport set + activity in the
//      window), deterministic SQL gathers the month's facts (phase/tier, block
//      week, check-off compliance, form-ledger safety stats, RPE trend), then
//      Sonnet (guardian_wire_digest · §4 — parent-facing warmth) writes a
//      ~200-word digest in the athlete's language. Drafts stage as
//      GUARDIAN_WIRE cards; NOTHING dispatches without founder approval
//      (bbf_apply_guardian_wire). Included in Rising Athlete.
//
// Auth: X-BBF-Admin-Token (monthly pg_cron injects it from Vault in-database).
// Actions: run (dispatch sweep + draft pass) · dispatch (sweep only).
// Spend-gated, telemetry-logged, one digest per athlete-month (UNIQUE).
// Background execution (202 + EdgeRuntime.waitUntil) — gateway idle limit.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';
import { checkSpendGate, spendLimitResponse } from '../_shared/spend-gate.ts';
import { logLlmCall } from '../_shared/llm-telemetry.ts';
import { localeDirective, localeCode } from '../_shared/locale.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-bbf-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const MAX_DIGESTS_PER_RUN = 15;

const DIGEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: { type: 'string', description: 'Email subject line, warm and specific, under 80 chars' },
    digest: { type: 'string', description: 'The digest body: 150-250 words, 3-4 short paragraphs, plain text (no markdown)' },
  },
  required: ['subject', 'digest'],
} as const;

const SYSTEM_PROMPT = [
  'You write the monthly progress letter Build Believe Fit sends home to the parent/guardian of a youth athlete.',
  'You receive the month\'s verified facts: training phase and tier, weeks in the current block, workout completion, joint-safety form scans, effort (RPE) trend, and the next block\'s focus.',
  'Rules:',
  '- Warmth + specificity. This is a coach\'s letter home, not a report card. Celebrate what the numbers show; be honest but encouraging about gaps.',
  '- Lead with the athlete by first name. Address the guardian directly ("your athlete", never "the client").',
  '- Cite 2-3 CONCRETE facts from the data (weeks trained, completion, form-scan results, phase status). Never invent numbers not provided.',
  '- One safety line: what the platform is watching to keep them protected (joint-friction flags, form scans, load ceilings).',
  '- Close with next month\'s focus in one sentence.',
  '- 150-250 words, 3-4 short paragraphs, plain text. Sign off as "Coach Akeem & the Build Believe Fit Lab".',
  '- Never mention AI, systems, dashboards, or internal tooling.',
].join('\n');

async function callClaude(apiKey: string, model: string, localeInput: string, userMessage: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: DIGEST_SCHEMA } },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: localeDirective(localeInput, 'the entire letter (subject and body)') },
      ],
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

function digestHtml(bodyText: string): string {
  const paras = bodyText.split(/\n{2,}|\n/).filter((p) => p.trim())
    .map((p) => `<p style="font-size:14px;line-height:1.6;margin:0 0 14px">${p.trim()}</p>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
    <h2 style="color:#6a0dad;margin-bottom:4px">Build Believe Fit · Athlete Progress</h2>
    <div style="height:3px;background:#f5c800;width:64px;margin-bottom:18px"></div>
    ${paras}
    <p style="font-size:12px;color:#666;margin-top:24px">Build Believe Fit · BBF Athlete Portal</p>
  </div>`;
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

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { body = {}; }
  const action = String(body?.action ?? 'run');

  // ── 1 · DISPATCH SWEEP — send founder-approved digests on the Brevo rail ──
  const dispatchSweep = async (): Promise<{ dispatched: number; failed: number }> => {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    let dispatched = 0, failed = 0;
    if (!BREVO_API_KEY) {
      console.warn('[bbf-guardian-wire] BREVO_API_KEY missing — approved digests stay queued');
      return { dispatched, failed };
    }
    const { data: queue } = await supabase
      .from('bbf_guardian_wire_log')
      .select('id, user_id, subject, digest_html')
      .eq('status', 'approved').limit(30);
    for (const row of queue ?? []) {
      const { data: u } = await supabase
        .from('bbf_users').select('email, name, uid').eq('id', row.user_id).is('deleted_at', null).maybeSingle();
      if (!u?.email) {
        await supabase.from('bbf_guardian_wire_log')
          .update({ status: 'dispatch_failed' }).eq('id', row.id);
        failed++;
        continue;
      }
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, 'accept': 'application/json' },
        body: JSON.stringify({
          sender: { name: Deno.env.get('BREVO_FROM_NAME') || 'Build Believe Fit', email: Deno.env.get('BREVO_FROM_EMAIL') || 'coach@buildbelievefit.fitness' },
          to: [{ email: u.email, name: u.name || u.email }],
          subject: row.subject,
          htmlContent: row.digest_html,
          tags: ['bbf-guardian-wire'],
        }),
      });
      if (r.ok) {
        await supabase.from('bbf_guardian_wire_log')
          .update({ status: 'dispatched', dispatched_at: new Date().toISOString() }).eq('id', row.id);
        dispatched++;
      } else {
        console.error(`[bbf-guardian-wire] Brevo send failed status=${r.status} log=${row.id}`);
        await supabase.from('bbf_guardian_wire_log').update({ status: 'dispatch_failed' }).eq('id', row.id);
        failed++;
      }
    }
    return { dispatched, failed };
  };

  if (action === 'dispatch') {
    const res = await dispatchSweep();
    return jsonResponse({ ok: true, ...res });
  }
  if (action !== 'run') return jsonResponse({ error: 'unknown_action' }, 400);

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
  const gate = await checkSpendGate(SUPABASE_URL, SERVICE_KEY);
  if (gate.stopped) return spendLimitResponse(gate);

  const now = new Date();
  // The digest covers LAST month (cron fires on the 1st).
  const periodDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const period = periodDate.toISOString().slice(0, 7);
  const windowStart = periodDate.toISOString();
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const runPass = async () => {
    const sweep = await dispatchSweep();
    const model = routeAndLog('bbf-guardian-wire', 'guardian_wire_digest');
    let drafted = 0;

    // Youth roster: sport set + PAR-Q screened. Activity filter applied per athlete below.
    const { data: youth } = await supabase
      .from('bbf_users')
      .select('id, uid, name, email, sport, "position", preferred_language, youth_progress, par_q_screened_at')
      .not('sport', 'is', null).not('par_q_screened_at', 'is', null)
      .is('deleted_at', null).limit(100);

    for (const u of (youth ?? []).slice(0, MAX_DIGESTS_PER_RUN)) {
      // One digest per athlete-month.
      const { data: existing } = await supabase
        .from('bbf_guardian_wire_log').select('id')
        .eq('user_id', u.id).eq('period', period).limit(1);
      if (existing?.length) continue;

      // ── Deterministic facts (native SQL reads — zero AI) ──
      const { data: sets } = await supabase
        .from('bbf_athlete_set_log')
        .select('rpe, completed_at')
        .eq('user_id', u.id).gte('completed_at', windowStart).lt('completed_at', windowEnd)
        .limit(500);
      const setCount = (sets ?? []).length;
      if (setCount === 0) continue; // silent months draft nothing — no fabricated progress

      const rpeAvg = setCount
        ? Math.round(((sets ?? []).reduce((a, s) => a + Number(s.rpe || 0), 0) / setCount) * 10) / 10
        : null;

      const { data: prog } = await supabase
        .from('bbf_athlete_progression')
        .select('mesocycle_week, protocol_completed, friction_avg_last_3, phase_history')
        .eq('user_id', u.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();

      const { data: scans } = await supabase
        .from('bbf_form_ledger')
        .select('form_score')
        .eq('user_id', u.id).gte('scanned_at', windowStart).lt('scanned_at', windowEnd).limit(50);
      const scanCount = (scans ?? []).length;
      const avgForm = scanCount ? Math.round((scans ?? []).reduce((a, s) => a + s.form_score, 0) / scanCount) : null;
      const redFlags = (scans ?? []).filter((s) => s.form_score < 55).length;

      // Days with check-offs in the current protocol map (compliance snapshot).
      const yp = u.youth_progress ?? {};
      const daysDone = Object.values(yp as Record<string, any>).filter((d) =>
        Object.values(d?.ex ?? {}).some((v) => v === true) || Object.values(d?.dr ?? {}).some((v) => v === true),
      ).length;

      let phase = 1;
      const { data: ac } = await supabase
        .from('bbf_active_clients').select('sports_protocol').eq('vault_email', u.email).maybeSingle();
      if (ac?.sports_protocol) {
        try { phase = Math.min(3, Math.max(1, Number(JSON.parse(ac.sports_protocol).phase_number) || 1)); }
        catch { /* facts survive without phase */ }
      }

      const facts = {
        period, sport: u.sport, position: u.position ?? null, phase,
        mesocycle_week: prog?.mesocycle_week ?? null,
        protocol_completed: prog?.protocol_completed ?? false,
        friction_avg: prog?.friction_avg_last_3 ?? null,
        sets_logged: setCount, rpe_avg: rpeAvg, checkoff_days: daysDone,
        form_scans: scanCount, form_avg: avgForm, form_red_flags: redFlags,
      };

      const firstName = String(u.name || u.uid || 'your athlete').split(/\s+/)[0];
      const locale = localeCode(u.preferred_language);
      const userMessage = [
        `Athlete first name: ${firstName}`,
        `Sport: ${u.sport}${u.position ? ` (${u.position})` : ''}`,
        `Month covered: ${period}`,
        `Verified facts: ${JSON.stringify(facts)}`,
        '',
        'Write the letter JSON now (subject + digest).',
      ].join('\n');

      const t0 = Date.now();
      const call = await callClaude(ANTHROPIC_API_KEY, model, locale, userMessage);
      const latencyMs = Date.now() - t0;
      const usage = call.ok ? call.body?.usage : null;
      const gen = call.ok ? extractJson(call.body?.content) : null;
      const ok = !!(gen?.subject && gen?.digest);

      await logLlmCall(supabase, {
        agent: 'bbf-guardian-wire', model, ok,
        latencyMs, inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null,
        finishReason: call.ok ? (call.body?.stop_reason ?? null) : null,
        error: ok ? null : (call.ok ? 'schema_miss' : call.error), promptName: 'guardian_wire_digest',
      });
      if (!ok) continue;

      const subject = String(gen.subject).slice(0, 160);
      const digestText = String(gen.digest).slice(0, 4000);

      const { data: logRow } = await supabase.from('bbf_guardian_wire_log').insert({
        user_id: u.id, period, locale, subject,
        digest_html: digestHtml(digestText), facts, status: 'drafted',
      }).select('id').maybeSingle();
      if (!logRow?.id) continue;

      const { data: card } = await supabase.from('coach_action_inbox').insert({
        athlete_id: u.id,
        type: 'GUARDIAN_WIRE',
        insight_summary: `Guardian Wire ${period}: ${setCount} sets logged · ${daysDone} protocol days checked · ${scanCount} form scan${scanCount === 1 ? '' : 's'}${avgForm != null ? ` (avg ${avgForm})` : ''}${redFlags ? ` · ${redFlags} red flag${redFlags === 1 ? '' : 's'}` : ' · zero red flags'} · RPE avg ${rpeAvg ?? '—'}.`,
        proposed_action: `Approve to queue this month's letter home (dispatches to ${u.email} on the next wire run).`,
        draft_message: digestText,
        proposed_plan_modification: { guardian_wire: { log_id: logRow.id, period, locale, subject } },
      }).select('id').maybeSingle();
      if (card?.id) await supabase.from('bbf_guardian_wire_log').update({ card_id: card.id }).eq('id', logRow.id);
      drafted++;
    }

    console.log(`[bbf-guardian-wire] period=${period} drafted=${drafted} dispatched=${sweep.dispatched} dispatch_failed=${sweep.failed}`);
  };

  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(runPass());
  else runPass();
  return jsonResponse({ ok: true, accepted: true, period }, 202);
});
