// Agent 3a · The Dispatcher · outbound email worker.
// POST /api/v1/marketing/dispatch
//   { batch_size?: 1-20, lead_id?: uuid }
//
// Pulls analyzed leads, splits the LLM pitch into subject + body,
// sends via Resend, flips status to 'contacted'.
//
// SUBJECT/BODY SPLIT · The Performance Analyst writes pitches that
// start with "Subject: <line>" on line 1, then a blank line, then the
// body sentences. splitPitch() extracts the subject (stripping the
// literal "Subject:" prefix), and uses the rest as the email body.
// If the pitch has no blank line, falls back to a generic subject and
// uses the entire pitch as the body.
//
// CEO TESTING OVERRIDE · the placeholder email
// bbf_test_lead@bbf-marketing-sentinel.dev is intercepted at dispatch
// time and routed to Akeem's personal inbox so we can audit visual
// format + inbox delivery path without polluting a real athlete's
// inbox. The intercept is dispatch-only · the lead row keeps its
// original email value untouched.
import { sb, requireSb, TABLE } from '../db.js';
import { sendPitch } from '../resend.js';

const DEFAULT_BATCH = 5;
const MAX_BATCH     = 20;

const TEST_LEAD_EMAIL           = 'bbf_test_lead@bbf-marketing-sentinel.dev';
const TEST_OVERRIDE_DESTINATION = 'akeemkaronbrown@gmail.com';

function splitPitch(rawPitch, athleteName) {
  const pitch = String(rawPitch || '').trim();
  const fallbackSubject = `Performance audit · ${athleteName}`;
  if (!pitch) return { subject: fallbackSubject, body: '' };

  // Gemini writes:
  //   Subject: <one-line subject>
  //   <blank line>
  //   <body sentences>
  // Split on the first double newline.
  const idx = pitch.indexOf('\n\n');
  if (idx < 0) {
    // No blank-line break · whole pitch is body, default subject.
    return { subject: fallbackSubject, body: pitch };
  }

  let subject = pitch.slice(0, idx).trim();
  // Strip a literal "Subject:" / "subject:" / "SUBJECT:" prefix.
  subject = subject.replace(/^\s*subject\s*:\s*/i, '').trim();
  if (!subject) subject = fallbackSubject;

  const body = pitch.slice(idx + 2).trim();
  return { subject, body };
}

async function dispatchOne(lead) {
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
    email:           destinationEmail, // override To: address
    _subject:        subject,
    _body:           body,
  });

  if (!out.ok) {
    await sb.from(TABLE).update({
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

  const { error: updErr } = await sb.from(TABLE).update({
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

export async function dispatch(req, res) {
  if (!requireSb(res)) return;
  const body      = req.body || {};
  const leadId    = body.lead_id ? String(body.lead_id) : null;
  const batchSize = Math.min(MAX_BATCH, Math.max(1, Number(body.batch_size) || DEFAULT_BATCH));

  let q = sb.from(TABLE).select('id, athlete_name, email, personalized_pitch, unsubscribe_token, discipline, public_profile_url');
  if (leadId) {
    // Manual single-lead send · gated by status to prevent double-sends.
    q = q.eq('id', leadId).eq('status', 'analyzed');
  } else {
    q = q.eq('status', 'analyzed').not('personalized_pitch', 'is', null).order('updated_at', { ascending: true }).limit(batchSize);
  }

  const { data: leads, error } = await q;
  if (error)          return res.status(500).json({ ok: false, error: 'db_fetch_failed', detail: error.message });
  if (!leads?.length) return res.json({ ok: true, dispatched: 0, results: [], note: 'no analyzed leads ready to send' });

  // Sequential · don't burn Resend rate limits + lets us see ordered
  // failures in the log.
  const results = [];
  for (const lead of leads) {
    results.push(await dispatchOne(lead));
  }
  const ok = results.filter((r) => r.ok).length;
  console.log(`[marketing/dispatcher] sent=${ok}/${results.length}`);
  return res.json({ ok: true, dispatched: results.length, succeeded: ok, results });
}
