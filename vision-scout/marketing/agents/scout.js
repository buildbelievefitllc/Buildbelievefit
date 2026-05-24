// Agent 1 · The Target Scout · ingestion.
// POST /api/v1/marketing/ingest
//   { leads: [{ athlete_name, email, discipline, public_profile_url, performance_notes }] }
//   OR a single lead object (auto-wrapped).
//
// Safe upsert on email. Status / personalized_pitch / funnel state on
// EXISTING rows is preserved · only descriptive fields refresh.
import { sb, requireSb, TABLE } from '../db.js';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function ingest(req, res) {
  if (!requireSb(res)) return;
  const payload = req.body || {};
  const rawLeads = Array.isArray(payload.leads) ? payload.leads
                 : payload.athlete_name ? [payload]
                 : [];
  if (!rawLeads.length) return res.status(400).json({ ok: false, error: 'no_leads' });

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
      discipline:         lead.discipline         ? String(lead.discipline).trim()         : null,
      public_profile_url: lead.public_profile_url ? String(lead.public_profile_url).trim() : null,
      performance_notes:  lead.performance_notes  ? String(lead.performance_notes).trim()  : null,
    });
  }

  if (!sanitized.length) return res.status(400).json({ ok: false, error: 'all_rejected', rejected });

  // Upsert by email · we only write the descriptive fields, so existing
  // status / personalized_pitch / funnel timestamps are preserved on
  // re-ingest. New rows get the table defaults (status='raw' etc.).
  const { data, error } = await sb
    .from(TABLE)
    .upsert(sanitized, { onConflict: 'email', ignoreDuplicates: false })
    .select('id, email, status, athlete_name, created_at, updated_at');

  if (error) {
    console.error('[marketing/scout] upsert failed:', error);
    return res.status(500).json({ ok: false, error: 'db_upsert_failed', detail: error.message });
  }

  return res.json({ ok: true, accepted: data?.length || 0, rejected, leads: data });
}
