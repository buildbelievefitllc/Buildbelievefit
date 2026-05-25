// Agent 3b · The Triage Engine · inbound reply handler.
// POST /api/v1/marketing/inbound
//   Public webhook from Resend (or any compatible provider).
//
// Classifies intent via gemini-3.5-flash, transitions status, drafts a
// contextual reply for the CEO to send manually, and emits a console
// alert containing the athlete dossier.
import { sb, requireSb, TABLE }   from '../db.js';
import { generate, extractJSON, MODEL_NAME } from '../gemini.js';
import { logRun, logLlmCall, newRunId } from '../telemetry.js';
import {
  isDeliveryEventPayload,
  logEmailEvent,
  suppressEmail,
  REASON,
} from '../suppression.js';

const AGENT                 = 'marketing.triage';
const EVENTS_AGENT          = 'marketing.events';
const PROMPT_INTENT         = 'marketing.triage.intent';
const PROMPT_INTENT_VER     = 1;
const PROMPT_DRAFT          = 'marketing.triage.reply_draft';
const PROMPT_DRAFT_VER      = 1;

const INTENT_SYSTEM = [
  'You classify cold-outreach email replies into a single intent.',
  '',
  'Return ONLY this JSON shape — no prose, no markdown fences:',
  '{"intent": "interested" | "not_interested" | "support"}',
  '',
  'Rules:',
  '- "interested": athlete expresses curiosity, asks questions, wants to know more, requests a call.',
  '- "not_interested": declines, asks to be removed, says "no thanks", "stop", or expresses zero interest.',
  '- "support": neither of the above — a support question, off-topic, unclassifiable, or a bounce-style auto-reply.',
].join('\n');

const REPLY_DRAFT_SYSTEM = [
  'You are Akeem Brown, founder of Build Believe Fit, drafting a warm reply to a high-performance athlete who responded with interest to a cold pitch you sent. Constraints:',
  '- 2-3 sentences max. Zero fluff.',
  '- Reference whatever specific plateau or metric they mentioned (or the original pitch hook if their reply is short).',
  '- The FINAL SENTENCE must always direct them to instantly deploy the system for their specific plateau by visiting https://buildbelievefit.fitness/join · self-service activation, not a sales call.',
  '- BANNED · do NOT propose a call, do NOT ask for "the best email", do NOT mention calendars, calendar links, scheduling, "this week", "next week", "15 minutes", "jump on a call", or any form of "let me know when". The path forward is self-service via the URL.',
  '- No "looking forward to hearing from you" / no corporate filler.',
  '- No subject line. Plain text only. Sign off "— Akeem".',
].join('\n');

// Best-effort extraction across provider shapes. Resend's inbound shape
// is { type: 'email.received', data: { from, to, subject, text, ... } }
// per their current spec; we also handle SendGrid / Mailgun / Postmark
// fallbacks so the route works regardless of provider switch.
function extractSenderAndBody(payload) {
  const candidatesFrom = [
    payload?.data?.from?.[0]?.email,
    payload?.data?.from?.email,
    payload?.data?.from,
    payload?.from?.email,
    payload?.from,
    payload?.envelope?.from,
    payload?.sender,
    payload?.From,
  ];
  let from = '';
  for (const c of candidatesFrom) {
    if (typeof c === 'string' && c.trim()) { from = c.trim(); break; }
  }
  // "Akeem <a@b.com>" -> "a@b.com"
  const m = /<([^>]+)>/.exec(from);
  if (m) from = m[1];
  from = from.toLowerCase().trim();

  const body = String(
    payload?.data?.text ||
    payload?.data?.body_plain ||
    payload?.text ||
    payload?.body_plain ||
    payload?.body ||
    payload?.message ||
    payload?.stripped_text ||
    ''
  ).trim();

  return { from, body };
}

export async function inbound(req, res) {
  if (!requireSb(res)) return;
  const startedAt = Date.now();
  const payload   = req.body || {};

  // Phase 1.1 · Resend delivery-event branch · runs BEFORE the athlete-
  // reply path so a delivery webhook never falls through to Gemini.
  // Resend ships these with type: 'email.delivered' | 'email.bounced'
  // | 'email.opened' | 'email.complained' | etc. Inbound athlete
  // replies use 'email.received' (or no type at all from non-Resend
  // providers) · those flow to the existing triage logic below.
  if (isDeliveryEventPayload(payload)) {
    const eventsRunId = newRunId('events');
    const result = await logEmailEvent(payload);
    await logRun({
      agent: EVENTS_AGENT, runId: eventsRunId, source: 'webhook',
      startedAt, finishedAt: Date.now(), ok: !!result.ok,
      error: result.ok ? null : result.error,
      summary: {
        event_type:         result.type || null,
        message_id:         result.message_id || null,
        email:              result.email || null,
        auto_suppressed:    !!result.suppressed,
        suppression_reason: result.suppression_reason || null,
      },
    });
    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error, detail: result.detail });
    }
    return res.json({
      ok:               true,
      kind:             'delivery_event',
      event_type:       result.type,
      message_id:       result.message_id,
      email:            result.email,
      auto_suppressed:  result.suppressed,
      run_id:           eventsRunId,
    });
  }

  const runId          = newRunId('triage');
  const { from, body } = extractSenderAndBody(payload);

  if (!from || !body) {
    console.warn('[marketing/triage] missing from or body · raw payload keys:', Object.keys(payload));
    await logRun({
      agent: AGENT, runId, source: 'webhook',
      startedAt, finishedAt: Date.now(), ok: false, error: 'missing_from_or_body',
      summary: { payload_keys: Object.keys(payload) },
    });
    return res.status(400).json({ ok: false, error: 'missing_from_or_body' });
  }

  const { data: lead, error: lookupErr } = await sb
    .from(TABLE).select('*').eq('email', from).maybeSingle();
  if (lookupErr) {
    console.error('[marketing/triage] lookup failed:', lookupErr);
    await logRun({
      agent: AGENT, runId, source: 'webhook',
      startedAt, finishedAt: Date.now(), ok: false, error: lookupErr.message,
      summary: { from, phase: 'lookup' },
    });
    return res.status(500).json({ ok: false, error: 'db_lookup_failed', detail: lookupErr.message });
  }
  if (!lead) {
    console.warn('[marketing/triage] unknown sender · skipping:', from);
    await logRun({
      agent: AGENT, runId, source: 'webhook',
      startedAt, finishedAt: Date.now(), ok: true,
      summary: { from, skipped: 'unknown_sender' },
    });
    return res.json({ ok: true, skipped: 'unknown_sender' });
  }

  // 1. Classify intent.
  const classify = await generate({
    system:          INTENT_SYSTEM,
    user:            body.slice(0, 4000),
    temperature:     0,
    maxOutputTokens: 64,
  });
  await logLlmCall({
    agent: AGENT, runId,
    provider:      classify.provider || 'gemini',
    model:         classify.model    || MODEL_NAME,
    promptName:    PROMPT_INTENT,
    promptVersion: PROMPT_INTENT_VER,
    inputTokens:   classify.input_tokens,
    outputTokens:  classify.output_tokens,
    latencyMs:     classify.latency_ms,
    finishReason:  classify.finishReason,
    ok:            classify.ok,
    error:         classify.ok ? null : `${classify.error}: ${classify.detail || ''}`,
  });
  if (!classify.ok) {
    console.error('[marketing/triage] classify failed:', classify);
    await logRun({
      agent: AGENT, runId, source: 'webhook',
      startedAt, finishedAt: Date.now(), ok: false, error: classify.error,
      summary: { from, lead_id: lead.id, phase: 'classify' },
    });
    return res.status(502).json({ ok: false, error: 'intent_classify_failed', detail: classify.error });
  }
  const parsed = extractJSON(classify.text);
  const intent = ['interested', 'not_interested', 'support'].includes(parsed?.intent)
    ? parsed.intent
    : 'support';

  // 2. Transition state based on intent.
  const nowIso = new Date().toISOString();
  const update = { intent, replied_at: nowIso };

  // Phase 1.3 · suppression hooks · this athlete is no longer a cold-
  // outreach target regardless of which way they replied. Both branches
  // record into the cross-system ledger so any future scout/analyst
  // pass that re-discovers them gets dispatcher-side-blocked.
  let suppressionWritten = null;

  if (intent === 'not_interested') {
    update.status = 'bounced';
    suppressionWritten = await suppressEmail(lead.email, REASON.UNSUBSCRIBED);
  } else {
    update.status = 'replied';
    if (intent === 'interested') {
      suppressionWritten = await suppressEmail(lead.email, REASON.ACTIVE_INBOUND_LEAD);
      // Draft a contextual reply for the CEO to review + send manually.
      const draftPrompt = [
        `Original pitch you sent:`,
        lead.personalized_pitch || '(pitch missing)',
        '',
        `Their reply:`,
        body.slice(0, 2000),
      ].join('\n');
      const draft = await generate({
        system:          REPLY_DRAFT_SYSTEM,
        user:            draftPrompt,
        temperature:     0.6,
        maxOutputTokens: 220,
      });
      await logLlmCall({
        agent: AGENT, runId,
        provider:      draft.provider || 'gemini',
        model:         draft.model    || MODEL_NAME,
        promptName:    PROMPT_DRAFT,
        promptVersion: PROMPT_DRAFT_VER,
        inputTokens:   draft.input_tokens,
        outputTokens:  draft.output_tokens,
        latencyMs:     draft.latency_ms,
        finishReason:  draft.finishReason,
        ok:            draft.ok,
        error:         draft.ok ? null : `${draft.error}: ${draft.detail || ''}`,
      });
      if (draft.ok) update.draft_reply = draft.text;
    }
  }

  const { error: updErr } = await sb.from(TABLE).update(update).eq('id', lead.id);
  if (updErr) {
    console.error('[marketing/triage] update failed:', updErr);
    await logRun({
      agent: AGENT, runId, source: 'webhook',
      startedAt, finishedAt: Date.now(), ok: false, error: updErr.message,
      summary: { from, lead_id: lead.id, intent, phase: 'update' },
    });
    return res.status(500).json({ ok: false, error: 'db_update_failed', detail: updErr.message });
  }

  // 3. CEO alert · console dossier so the founder can step in to close.
  if (intent === 'interested' || intent === 'support') {
    console.log('======= BBF CEO ALERT · ATHLETE REPLIED =======');
    console.log('Intent:        ' + intent.toUpperCase());
    console.log('Name:          ' + lead.athlete_name);
    console.log('Email:         ' + lead.email);
    console.log('Discipline:    ' + (lead.discipline         || '—'));
    console.log('Profile URL:   ' + (lead.public_profile_url || '—'));
    console.log('Lead ID:       ' + lead.id);
    console.log('Sent at:       ' + (lead.contacted_at       || '—'));
    console.log('Replied at:    ' + nowIso);
    console.log('--- their reply (first 800 chars) ---');
    console.log(body.slice(0, 800));
    if (update.draft_reply) {
      console.log('--- drafted response ---');
      console.log(update.draft_reply);
    }
    console.log('=================================================');
  } else {
    console.log(`[marketing/triage] not_interested → bounced · ${lead.email}`);
  }

  await logRun({
    agent: AGENT, runId, source: 'webhook',
    startedAt, finishedAt: Date.now(), ok: true,
    summary: {
      from,
      lead_id:        lead.id,
      intent,
      new_status:     update.status,
      draft_attached: !!update.draft_reply,
      suppressed:     !!suppressionWritten?.ok,
    },
  });

  return res.json({
    ok:             true,
    kind:           'athlete_reply',
    lead_id:        lead.id,
    intent,
    new_status:     update.status,
    draft_attached: !!update.draft_reply,
    suppressed:     !!suppressionWritten?.ok,
    run_id:         runId,
  });
}
