// Agent 3a · The Dispatcher · outbound email worker.
// POST /api/v1/marketing/dispatch
//   { batch_size?: 1-20, lead_id?: uuid }
//
// Pulls analyzed leads, sends via Resend, flips status to 'contacted'.
// Manual trigger now; cron this once Resend domain is verified.
import { sb, requireSb, TABLE } from '../db.js';
import { sendPitch } from '../resend.js';

const DEFAULT_BATCH = 5;
const MAX_BATCH     = 20;

async function dispatchOne(lead) {
  const out = await sendPitch(lead);
  if (!out.ok) {
    await sb.from(TABLE).update({ last_error: `${out.error}: ${out.detail || ''}`.slice(0, 500) }).eq('id', lead.id);
    return { id: lead.id, email: lead.email, ok: false, error: out.error };
  }
  const { error: updErr } = await sb.from(TABLE).update({
    status:            'contacted',
    contacted_at:      new Date().toISOString(),
    resend_message_id: out.message_id,
    last_error:        null,
  }).eq('id', lead.id);
  if (updErr) return { id: lead.id, email: lead.email, ok: false, error: 'db_update_failed', detail: updErr.message };
  return { id: lead.id, email: lead.email, ok: true, message_id: out.message_id };
}

export async function dispatch(req, res) {
  if (!requireSb(res)) return;
  const body      = req.body || {};
  const leadId    = body.lead_id ? String(body.lead_id) : null;
  const batchSize = Math.min(MAX_BATCH, Math.max(1, Number(body.batch_size) || DEFAULT_BATCH));

  let q = sb.from(TABLE).select('id, athlete_name, email, personalized_pitch, unsubscribe_token, discipline, public_profile_url');
  if (leadId) {
    // Manual single-lead send · still gated by status to prevent double-sends.
    q = q.eq('id', leadId).eq('status', 'analyzed');
  } else {
    q = q.eq('status', 'analyzed').not('personalized_pitch', 'is', null).order('updated_at', { ascending: true }).limit(batchSize);
  }

  const { data: leads, error } = await q;
  if (error)          return res.status(500).json({ ok: false, error: 'db_fetch_failed', detail: error.message });
  if (!leads?.length) return res.json({ ok: true, dispatched: 0, results: [], note: 'no analyzed leads ready to send' });

  // Sequential · don't burn Resend rate limits + lets us see ordered failures in the log.
  const results = [];
  for (const lead of leads) {
    results.push(await dispatchOne(lead));
  }
  const ok = results.filter((r) => r.ok).length;
  console.log(`[marketing/dispatcher] sent=${ok}/${results.length}`);
  return res.json({ ok: true, dispatched: results.length, succeeded: ok, results });
}
