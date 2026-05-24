// Agent 3b · The Triage Engine · inbound reply handler.
// POST /api/v1/marketing/inbound
//   Public webhook from Resend (or any compatible provider).
//
// Classifies intent via gemini-3.5-flash, transitions status, drafts a
// contextual reply for the CEO to send manually, and emits a console
// alert containing the athlete dossier.
import { sb, requireSb, TABLE }   from '../db.js';
import { generate, extractJSON } from '../gemini.js';

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
  '- End with ONE concrete next step: ask for the best email for a brief, or propose a 15-min call.',
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
  const payload = req.body || {};
  const { from, body } = extractSenderAndBody(payload);

  if (!from || !body) {
    console.warn('[marketing/triage] missing from or body · raw payload keys:', Object.keys(payload));
    return res.status(400).json({ ok: false, error: 'missing_from_or_body' });
  }

  const { data: lead, error: lookupErr } = await sb
    .from(TABLE).select('*').eq('email', from).maybeSingle();
  if (lookupErr) {
    console.error('[marketing/triage] lookup failed:', lookupErr);
    return res.status(500).json({ ok: false, error: 'db_lookup_failed', detail: lookupErr.message });
  }
  if (!lead) {
    console.warn('[marketing/triage] unknown sender · skipping:', from);
    return res.json({ ok: true, skipped: 'unknown_sender' });
  }

  // 1. Classify intent.
  const classify = await generate({
    system:          INTENT_SYSTEM,
    user:            body.slice(0, 4000),
    temperature:     0,
    maxOutputTokens: 64,
  });
  if (!classify.ok) {
    console.error('[marketing/triage] classify failed:', classify);
    return res.status(502).json({ ok: false, error: 'intent_classify_failed', detail: classify.error });
  }
  const parsed = extractJSON(classify.text);
  const intent = ['interested', 'not_interested', 'support'].includes(parsed?.intent)
    ? parsed.intent
    : 'support';

  // 2. Transition state based on intent.
  const nowIso = new Date().toISOString();
  const update = { intent, replied_at: nowIso };

  if (intent === 'not_interested') {
    update.status = 'bounced';
  } else {
    update.status = 'replied';
    if (intent === 'interested') {
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
      if (draft.ok) update.draft_reply = draft.text;
    }
  }

  const { error: updErr } = await sb.from(TABLE).update(update).eq('id', lead.id);
  if (updErr) {
    console.error('[marketing/triage] update failed:', updErr);
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

  return res.json({
    ok:            true,
    lead_id:       lead.id,
    intent,
    new_status:    update.status,
    draft_attached: !!update.draft_reply,
  });
}
