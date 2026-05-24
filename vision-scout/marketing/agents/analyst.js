// Agent 2 · The Performance Analyst · pitch generation worker.
// POST /api/v1/marketing/analyze
//   { batch_size?: 1-50, lead_id?: uuid }
//
// Pulls raw leads, generates hyper-technical pitches via gemini-3.5-flash,
// flips status to 'analyzed'. Manual trigger now; wire pg_cron or a
// Render cron job to fire this on a schedule once verified.
import { sb, requireSb, TABLE } from '../db.js';
import { generate, MODEL_NAME } from '../gemini.js';

const DEFAULT_BATCH = 5;
const MAX_BATCH     = 50;

// CEO-mandated system prompt · verbatim from the original directive.
// Sets a hyper-technical, sports-science register; bans corporate filler.
const SYSTEM_PROMPT = [
  'You are the Lead Systems Analyst for Build Believe Fit. Critique this athlete\'s public training metrics. Write a hyper-technical, 3-sentence, zero-fluff email hook showing how the BBF Smart Cardio engine and BBF Nutrition Tracker math engine eliminate their exact performance plateaus. Speak strictly in advanced sports-science terms; ban all generic corporate marketing filler.',
].join('\n');

function buildUserPrompt(lead) {
  return [
    `Athlete:     ${lead.athlete_name}`,
    `Discipline:  ${lead.discipline         || 'unspecified'}`,
    `Profile:     ${lead.public_profile_url || 'n/a'}`,
    `Public training metrics & observed plateaus:`,
    lead.performance_notes || '(minimal data · infer from discipline)',
  ].join('\n');
}

async function analyzeOne(lead) {
  const out = await generate({
    system:          SYSTEM_PROMPT,
    user:            buildUserPrompt(lead),
    temperature:     0.7,
    maxOutputTokens: 400,
  });
  if (!out.ok) {
    await sb.from(TABLE).update({ last_error: `${out.error}: ${out.detail || ''}`.slice(0, 500) }).eq('id', lead.id);
    return { id: lead.id, email: lead.email, ok: false, error: out.error };
  }
  const { error: updErr } = await sb.from(TABLE).update({
    personalized_pitch: out.text,
    status:             'analyzed',
    last_error:         null,
  }).eq('id', lead.id);
  if (updErr) return { id: lead.id, email: lead.email, ok: false, error: 'db_update_failed', detail: updErr.message };
  return { id: lead.id, email: lead.email, ok: true };
}

export async function analyze(req, res) {
  if (!requireSb(res)) return;
  const body = req.body || {};
  const leadId    = body.lead_id ? String(body.lead_id) : null;
  const batchSize = Math.min(MAX_BATCH, Math.max(1, Number(body.batch_size) || DEFAULT_BATCH));

  let q = sb.from(TABLE).select('id, athlete_name, email, discipline, public_profile_url, performance_notes');
  if (leadId) q = q.eq('id', leadId);
  else        q = q.eq('status', 'raw').order('created_at', { ascending: true }).limit(batchSize);

  const { data: leads, error } = await q;
  if (error)        return res.status(500).json({ ok: false, error: 'db_fetch_failed', detail: error.message });
  if (!leads?.length) return res.json({ ok: true, processed: 0, results: [], model: MODEL_NAME, note: 'no raw leads' });

  // Run in parallel · Gemini Flash is fast and tolerates concurrency.
  const results = await Promise.all(leads.map(analyzeOne));
  const ok      = results.filter((r) => r.ok).length;

  console.log(`[marketing/analyst] processed=${results.length} ok=${ok} model=${MODEL_NAME}`);
  return res.json({ ok: true, processed: results.length, succeeded: ok, results, model: MODEL_NAME });
}
