// Agent 1 · The Target Scout · ingestion.
// POST /api/v1/marketing/ingest
//   { leads: [{ athlete_name, email, discipline, public_profile_url, performance_notes }] }
//   OR a single lead object (auto-wrapped).
//
// Safe upsert on email. Status / personalized_pitch / funnel state on
// EXISTING rows is preserved · only descriptive fields refresh.
import { sb, requireSb, TABLE } from '../db.js';
import { logRun, newRunId } from '../telemetry.js';
import { sanitizeUserField } from '../prompt-armor.js';

const AGENT    = 'marketing.scout';
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function ingest(req, res) {
  if (!requireSb(res)) return;
  const startedAt = Date.now();
  const runId     = newRunId('ingest');
  const payload   = req.body || {};
  const rawLeads = Array.isArray(payload.leads) ? payload.leads
                 : payload.athlete_name ? [payload]
                 : [];
  if (!rawLeads.length) {
    await logRun({
      agent: AGENT, runId, source: 'http',
      startedAt, finishedAt: Date.now(), ok: false, error: 'no_leads',
      summary: { payload_keys: Object.keys(payload) },
    });
    return res.status(400).json({ ok: false, error: 'no_leads' });
  }

  const sanitized = [];
  const rejected  = [];

  for (let i = 0; i < rawLeads.length; i++) {
    const lead  = rawLeads[i] || {};
    const email = String(lead.email || '').trim().toLowerCase();
    const name  = String(lead.athlete_name || '').trim();
    if (!email || !EMAIL_RX.test(email)) { rejected.push({ index: i, reason: 'invalid_email' }); continue; }
    if (!name)                            { rejected.push({ index: i, email, reason: 'name_required' }); continue; }
    sanitized.push({
      athlete_name:       name,
      email,
      // Phase 6.0c · defense-in-depth · sanitizeUserField strips XML tag
      // tunneling, control chars, and caps length so the analyst's
      // <user_input> wrap can't be escaped from an ingested field.
      discipline:         lead.discipline         ? sanitizeUserField(lead.discipline)         : null,
      public_profile_url: lead.public_profile_url ? sanitizeUserField(lead.public_profile_url) : null,
      performance_notes:  lead.performance_notes  ? sanitizeUserField(lead.performance_notes)  : null,
    });
  }

  if (!sanitized.length) {
    await logRun({
      agent: AGENT, runId, source: 'http',
      startedAt, finishedAt: Date.now(), ok: false, error: 'all_rejected',
      summary: { rejected_count: rejected.length },
    });
    return res.status(400).json({ ok: false, error: 'all_rejected', rejected });
  }

  // Upsert by email · we only write the descriptive fields, so existing
  // status / personalized_pitch / funnel timestamps are preserved on
  // re-ingest. New rows get the table defaults (status='raw' etc.).
  const { data, error } = await sb
    .from(TABLE)
    .upsert(sanitized, { onConflict: 'email', ignoreDuplicates: false })
    .select('id, email, status, athlete_name, created_at, updated_at');

  if (error) {
    console.error('[marketing/scout] upsert failed:', error);
    await logRun({
      agent: AGENT, runId, source: 'http',
      startedAt, finishedAt: Date.now(), ok: false, error: error.message,
      summary: { phase: 'upsert', sanitized: sanitized.length, rejected: rejected.length },
    });
    return res.status(500).json({ ok: false, error: 'db_upsert_failed', detail: error.message });
  }

  await logRun({
    agent: AGENT, runId, source: 'http',
    startedAt, finishedAt: Date.now(), ok: true,
    summary: { accepted: data?.length || 0, rejected: rejected.length },
  });
  return res.json({ ok: true, accepted: data?.length || 0, rejected, leads: data, run_id: runId });
}
