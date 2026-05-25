// Cross-system suppression + delivery-event helpers · Phase 1.1 + 1.3.
//
// Single chokepoint for two Supabase tables:
//   · bbf_email_suppression · global do-not-contact ledger
//   · bbf_email_events      · Resend delivery webhook log
//
// EVERY outbound from the dispatcher passes through isSuppressed() first.
// Hits get hard-skipped without ever touching Resend. Writes here are
// idempotent (ON CONFLICT DO UPDATE) so the same email can be suppressed
// twice with different reasons without throwing.
//
// READ ERROR POLICY · fail-CLOSED. If the suppression read errors out,
// treat the email as suppressed and skip the send. The cost of one
// missed cold-pitch is trivial; the cost of double-emailing an opted-out
// athlete is regulatory + reputational. Phase 1.5 will surface read
// failures as an explicit alert in /health so the operator notices.
//
// RESEND EVENT TYPE TAXONOMY (https://resend.com/docs/dashboard/webhooks/event-types)
//   email.sent · email.delivered · email.delivery_delayed
//   email.bounced · email.complained
//   email.opened · email.clicked
//   email.failed
// We log every type. Only bounced + complained trigger auto-suppression.
import { getSb } from './db.js';

export const SUPPRESSION_TABLE = 'bbf_email_suppression';
export const EVENTS_TABLE      = 'bbf_email_events';

export const REASON = Object.freeze({
  ACTIVE_INBOUND_LEAD: 'active_inbound_lead',
  UNSUBSCRIBED:        'unsubscribed',
  BOUNCED:             'bounced',
  COMPLAINT:           'complaint',
});

const DELIVERY_EVENT_PREFIXES = ['email.'];

function normalize(email) {
  return String(email || '').trim().toLowerCase();
}

// True iff the payload shape is a Resend delivery event (NOT an inbound
// athlete reply). Resend ships delivery events as { type: 'email.xxx',
// created_at, data: {...} }. Inbound replies use 'email.received' (which
// we route to triage, NOT to event logging).
const DELIVERY_EVENT_TYPES = new Set([
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.opened',
  'email.clicked',
  'email.failed',
]);

export function isDeliveryEventPayload(payload) {
  const t = payload?.type;
  if (typeof t !== 'string') return false;
  if (DELIVERY_EVENT_TYPES.has(t)) return true;
  // Forward-compat: accept any future email.* delivery event we haven't
  // seen yet, EXCEPT email.received which is the inbound triage path.
  if (t === 'email.received') return false;
  return DELIVERY_EVENT_PREFIXES.some((p) => t.startsWith(p));
}

// True iff this email is on the do-not-contact ledger. On DB error
// returns true (fail-closed). On normal not-found returns false.
export async function isSuppressed(email) {
  const sb = getSb();
  if (!sb) {
    console.warn('[marketing/suppression] supabase unavailable · failing CLOSED · treating as suppressed');
    return true;
  }
  const e = normalize(email);
  if (!e) return false;
  const { data, error } = await sb
    .from(SUPPRESSION_TABLE)
    .select('email, reason')
    .eq('email', e)
    .maybeSingle();
  if (error) {
    console.warn(`[marketing/suppression] read failed for ${e} · failing CLOSED:`, error.message);
    return true;
  }
  return !!data;
}

// Idempotent insert · ON CONFLICT updates the reason + timestamp so the
// latest signal wins (e.g. a manual unsubscribe over an earlier
// active_inbound_lead). Returns { ok, already }.
export async function suppressEmail(email, reason) {
  const sb = getSb();
  if (!sb) return { ok: false, error: 'supabase_unavailable' };
  const e = normalize(email);
  if (!e) return { ok: false, error: 'empty_email' };
  if (!reason || typeof reason !== 'string') {
    return { ok: false, error: 'missing_reason' };
  }
  const { error } = await sb
    .from(SUPPRESSION_TABLE)
    .upsert(
      { email: e, reason, suppressed_at: new Date().toISOString() },
      { onConflict: 'email' },
    );
  if (error) {
    console.error(`[marketing/suppression] upsert failed for ${e} (${reason}):`, error.message);
    return { ok: false, error: 'db_upsert_failed', detail: error.message };
  }
  console.log(`[marketing/suppression] +1 ${e} · reason=${reason}`);
  return { ok: true };
}

// Resend webhook events have shape:
//   { type: 'email.delivered', created_at: '<ISO>', data: {
//       email_id, from, to: ['...'], subject, ... } }
// We persist enough to join back to bbf_outbound_athletes by message_id
// AND we keep the full payload as JSONB so any field Resend adds later
// is queryable without a schema bump.
export function extractEventFields(payload) {
  const type = String(payload?.type || '').trim();
  const data = payload?.data || {};
  const messageId =
    data?.email_id ||
    data?.id ||
    data?.message_id ||
    payload?.email_id ||
    payload?.message_id ||
    null;
  const toRaw = data?.to ?? payload?.to;
  let email = '';
  if (Array.isArray(toRaw) && toRaw.length) email = String(toRaw[0]);
  else if (typeof toRaw === 'string')       email = toRaw;
  else if (typeof toRaw?.email === 'string') email = toRaw.email;
  email = normalize(email);
  const tsRaw = payload?.created_at || data?.created_at || data?.ts;
  const ts = tsRaw ? new Date(tsRaw).toISOString() : new Date().toISOString();
  return { type, messageId, email: email || null, ts };
}

export async function logEmailEvent(payload) {
  const sb = getSb();
  if (!sb) return { ok: false, error: 'supabase_unavailable' };
  const { type, messageId, email, ts } = extractEventFields(payload);
  if (!type) return { ok: false, error: 'missing_event_type' };
  const { error } = await sb
    .from(EVENTS_TABLE)
    .insert({
      message_id: messageId,
      email,
      event_type: type,
      ts,
      payload,
    });
  if (error) {
    console.error(`[marketing/events] insert failed (${type}):`, error.message);
    return { ok: false, error: 'db_insert_failed', detail: error.message };
  }

  // Auto-suppress on bounce + complaint. Idempotent.
  let suppressed = null;
  if (email && (type === 'email.bounced')) {
    suppressed = await suppressEmail(email, REASON.BOUNCED);
  } else if (email && (type === 'email.complained')) {
    suppressed = await suppressEmail(email, REASON.COMPLAINT);
  }

  return {
    ok:           true,
    type,
    message_id:   messageId,
    email,
    suppressed:   suppressed ? suppressed.ok : false,
    suppression_reason: suppressed?.ok ? (type === 'email.bounced' ? REASON.BOUNCED : REASON.COMPLAINT) : null,
  };
}

// Aggregate delivery metrics for the /health diagnostic matrix.
// Returns counts per event type over the last `hours` plus a derived
// complaint rate (complained / delivered). Service-role read.
export async function summarizeDeliveryMetrics({ hours = 24 } = {}) {
  const sb = getSb();
  if (!sb) return { ok: false, error: 'supabase_unavailable' };
  const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { data, error } = await sb
    .from(EVENTS_TABLE)
    .select('event_type')
    .gte('ts', sinceIso);
  if (error) {
    return { ok: false, error: 'db_query_failed', detail: error.message };
  }

  const counts = {
    'email.sent':              0,
    'email.delivered':         0,
    'email.delivery_delayed':  0,
    'email.bounced':           0,
    'email.complained':        0,
    'email.opened':            0,
    'email.clicked':           0,
    'email.failed':            0,
  };
  for (const row of data || []) {
    if (counts[row.event_type] !== undefined) counts[row.event_type] += 1;
    else counts[row.event_type] = 1; // forward-compat unknown types
  }

  const delivered  = counts['email.delivered'] || 0;
  const complaints = counts['email.complained'] || 0;
  const complaintRate = delivered > 0 ? +(complaints / delivered).toFixed(4) : 0;

  const { count: suppressionCount, error: countErr } = await sb
    .from(SUPPRESSION_TABLE)
    .select('*', { count: 'exact', head: true });
  if (countErr) {
    return { ok: false, error: 'suppression_count_failed', detail: countErr.message };
  }

  return {
    ok:                true,
    window_hours:      hours,
    counts,
    complaint_rate:    complaintRate,
    suppression_total: suppressionCount || 0,
  };
}
