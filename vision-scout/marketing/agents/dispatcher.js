// Agent 3a · The Dispatcher · outbound email worker.
// POST /api/v1/marketing/dispatch
//   { batch_size?: 1-20, lead_id?: uuid }
//
// Pulls analyzed leads, splits the LLM pitch into subject + body,
// sends via Resend, flips status to 'contacted'. Also exposes
// runBatch() for in-process orchestrator use.
//
// SUBJECT/BODY SPLIT · The Performance Analyst writes pitches that
// start with "Subject: <line>" on line 1, then a blank line, then the
// body sentences. splitPitch() extracts the subject (stripping the
// literal "Subject:" prefix), and uses the rest as the email body.
//
// CEO TESTING OVERRIDE · the placeholder email
// bbf_test_lead@bbf-marketing-sentinel.dev is intercepted at dispatch
// time and routed to Akeem's personal inbox so we can audit visual
// format + inbox delivery path without polluting a real athlete's
// inbox. The intercept is dispatch-only · the lead row keeps its
// original email value untouched.
import { sb, requireSb, getSb, TABLE } from '../db.js';
import { sendPitch } from '../resend.js';
import { logRun, newRunId } from '../telemetry.js';
import { isSuppressed } from '../suppression.js';

const AGENT         = 'marketing.dispatcher';
const DEFAULT_BATCH = 5;
const MAX_BATCH     = 20;

const TEST_LEAD_EMAIL           = 'bbf_test_lead@bbf-marketing-sentinel.dev';
const TEST_OVERRIDE_DESTINATION = 'akeemkbrown@gmail.com';

function splitPitch(rawPitch, athleteName) {
  const pitch = String(rawPitch || '').trim();
  const fallbackSubject = `Performance audit · ${athleteName}`;
  if (!pitch) return { subject: fallbackSubject, body: '' };

  const idx = pitch.indexOf('\n\n');
  if (idx < 0) return { subject: fallbackSubject, body: pitch };

  let subject = pitch.slice(0, idx).trim();
  subject = subject.replace(/^\s*subject\s*:\s*/i, '').trim();
  if (!subject) subject = fallbackSubject;

  const body = pitch.slice(idx + 2).trim();
  return { subject, body };
}

async function dispatchOne(client, lead) {
  // Phase 1.3 · cross-system suppression gate · BEFORE we spend a Resend
  // credit, before we touch the lead row, before we do anything. Hits
  // are flipped to status='suppressed' so the dispatcher doesn't loop
  // back on the same row at the next batch cycle.
  // Note: the gate runs on the ORIGINAL lead.email, not the test
  // override · the override is a dispatch-time visual redirect for
  // QA, the suppression ledger is keyed to the real recipient.
  if (await isSuppressed(lead.email)) {
    await client.from(TABLE).update({
      status:     'suppressed',
      last_error: 'suppressed_by_ledger',
    }).eq('id', lead.id);
    console.log(`[marketing/dispatcher] skipped (suppressed) · ${lead.email}`);
    return {
      id:           lead.id,
      email:        lead.email,
      delivered_to: null,
      intercepted:  false,
      ok:           false,
      skipped:      'suppressed',
    };
  }

  const { subject, body } = splitPitch(lead.personalized_pitch, lead.athlete_name);

  const destinationEmail = (lead.email === TEST_LEAD_EMAIL)
    ? TEST_OVERRIDE_DESTINATION
    : lead.email;
  const intercepted = destinationEmail !== lead.email;
  if (intercepted) {
    console.log(`[marketing/dispatcher] CEO test override · routing ${lead.email} -> ${destinationEmail}`);
  }

  const out = await sendPitch({
    ...lead,
    email:    destinationEmail,
    _subject: subject,
    _body:    body,
  });

  if (!out.ok) {
    await client.from(TABLE).update({
      last_error: `${out.error}: ${out.detail || ''}`.slice(0, 500),
    }).eq('id', lead.id);
    return {
      id:           lead.id,
      email:        lead.email,
      delivered_to: destinationEmail,
      intercepted,
      ok:           false,
      error:        out.error,
      detail:       out.detail,
    };
  }

  const { error: updErr } = await client.from(TABLE).update({
    status:            'contacted',
    contacted_at:      new Date().toISOString(),
    resend_message_id: out.message_id,
    last_error:        null,
  }).eq('id', lead.id);
  if (updErr) {
    return {
      id:           lead.id,
      email:        lead.email,
      delivered_to: destinationEmail,
      intercepted,
      ok:           false,
      error:        'db_update_failed',
      detail:       updErr.message,
      message_id:   out.message_id,
    };
  }

  return {
    id:           lead.id,
    email:        lead.email,
    delivered_to: destinationEmail,
    intercepted,
    ok:           true,
    message_id:   out.message_id,
    subject_used: subject,
    body_chars:   body.length,
  };
}

// runBatch · pure worker · used by both the HTTP handler and the
// orchestrator. Sequential per-lead so Resend rate limits + the
// ordered log are clean.
export async function runBatch({ batchSize, leadId, runId, source } = {}) {
  const startedAt = Date.now();
  const client    = getSb();
  if (!client) return { ok: false, error: 'supabase_unconfigured' };

  const effectiveRunId = runId || newRunId('dispatch');
  const size           = Math.min(MAX_BATCH, Math.max(1, Number(batchSize) || DEFAULT_BATCH));

  let q = client.from(TABLE).select('id, athlete_name, email, personalized_pitch, unsubscribe_token, discipline, public_profile_url');
  if (leadId) {
    q = q.eq('id', String(leadId)).eq('status', 'analyzed');
  } else {
    q = q.eq('status', 'analyzed').not('personalized_pitch', 'is', null).order('updated_at', { ascending: true }).limit(size);
  }

  const { data: leads, error } = await q;
  if (error) {
    const result = { ok: false, error: 'db_fetch_failed', detail: error.message };
    await logRun({
      agent: AGENT, runId: effectiveRunId, source: source || 'standalone',
      startedAt, finishedAt: Date.now(), ok: false, error: result.detail,
      summary: { phase: 'fetch' },
    });
    return result;
  }
  if (!leads?.length) {
    const result = { ok: true, dispatched: 0, results: [], note: 'no analyzed leads ready to send' };
    await logRun({
      agent: AGENT, runId: effectiveRunId, source: source || 'standalone',
      startedAt, finishedAt: Date.now(), ok: true,
      summary: { dispatched: 0, succeeded: 0, note: 'no_analyzed_leads' },
    });
    return result;
  }

  const results = [];
  for (const lead of leads) {
    results.push(await dispatchOne(client, lead));
  }
  const ok          = results.filter((r) => r.ok).length;
  const intercepted = results.filter((r) => r.intercepted).length;
  const suppressed  = results.filter((r) => r.skipped === 'suppressed').length;
  console.log(`[marketing/dispatcher] sent=${ok}/${results.length} suppressed=${suppressed}`);
  await logRun({
    agent:      AGENT,
    runId:      effectiveRunId,
    source:     source || 'standalone',
    startedAt,
    finishedAt: Date.now(),
    ok:         true,
    summary:    {
      dispatched: results.length,
      succeeded:  ok,
      failed:     results.length - ok - suppressed,
      suppressed,
      intercepted,
      batch_size: size,
      lead_id:    leadId || null,
    },
  });
  return { ok: true, dispatched: results.length, succeeded: ok, suppressed, results, run_id: effectiveRunId };
}

// HTTP handler · thin wrapper.
export async function dispatch(req, res) {
  if (!requireSb(res)) return;
  const body      = req.body || {};
  const leadId    = body.lead_id ? String(body.lead_id) : null;
  const batchSize = Number(body.batch_size) || DEFAULT_BATCH;
  const summary   = await runBatch({ batchSize, leadId, source: 'http' });
  return res.json(summary);
}
