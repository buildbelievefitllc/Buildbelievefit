// Resend wrapper · uses the official `resend` npm package. Outbound
// email + List-Unsubscribe headers (RFC 8058 one-click) baked in so we
// don't get dunked into the spam folder.
//
// LAZY INIT · client built only when RESEND_API_KEY is present. Missing
// key → sendPitch returns ok:false:resend_unconfigured, server stays up.
import { Resend } from 'resend';

const RESEND_API_KEY     = process.env.RESEND_API_KEY     || '';
const BBF_FROM_NAME      = process.env.BBF_FROM_NAME      || 'Akeem Brown';
const BBF_FROM_EMAIL     = process.env.BBF_FROM_EMAIL     || 'akeem@buildbelievefit.fitness';
const BBF_REPLY_TO       = process.env.BBF_REPLY_TO       || BBF_FROM_EMAIL;
const BBF_BUSINESS_ADDR  = process.env.BBF_BUSINESS_ADDRESS || 'Build Believe Fit · USA';
const BBF_UNSUB_BASE_URL = process.env.BBF_UNSUB_BASE_URL || '';

let _resend = null;
if (RESEND_API_KEY) {
  try {
    _resend = new Resend(RESEND_API_KEY);
    console.log('[marketing/resend] client ready · from=' + BBF_FROM_EMAIL);
  } catch (err) {
    console.error('[marketing/resend] constructor threw · dispatcher will 503:', err?.message);
    _resend = null;
  }
} else {
  console.warn('[marketing/resend] RESEND_API_KEY unset · dispatcher will return resend_unconfigured · server still boots');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function unsubscribeUrl(token) {
  const base = BBF_UNSUB_BASE_URL.replace(/\/$/, '');
  return `${base}/api/v1/marketing/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function isResendReady() { return _resend != null; }

export async function sendPitch(lead) {
  if (!_resend)        return { ok: false, error: 'resend_unconfigured' };
  if (!lead?.email)    return { ok: false, error: 'lead_email_missing' };

  // Dispatcher-supplied split (preferred) or fall back to raw pitch
  // as body with a generic subject.
  const subject = lead._subject || `Performance audit · ${lead.athlete_name}`;
  const body    = (lead._body   || lead.personalized_pitch || '').trim();
  if (!body)    return { ok: false, error: 'lead_body_missing' };

  const unsubUrl = unsubscribeUrl(lead.unsubscribe_token);

  const text = [
    `${lead.athlete_name},`,
    '',
    body,
    '',
    '— Akeem · Build Believe Fit',
    '',
    `Don't want these? Unsubscribe: ${unsubUrl}`,
    BBF_BUSINESS_ADDR,
  ].join('\n');

  const html = [
    `<p>${esc(lead.athlete_name)},</p>`,
    `<p>${esc(body).replace(/\n/g, '<br>')}</p>`,
    `<p>— Akeem · Build Believe Fit</p>`,
    `<hr style="border:0;border-top:1px solid #ddd">`,
    `<p style="font-size:11px;color:#888">`,
    `<a href="${esc(unsubUrl)}">Unsubscribe</a> · ${esc(BBF_BUSINESS_ADDR)}`,
    `</p>`,
  ].join('');

  try {
    const result = await _resend.emails.send({
      from:     `${BBF_FROM_NAME} <${BBF_FROM_EMAIL}>`,
      to:       [lead.email],
      reply_to: BBF_REPLY_TO,
      subject,
      text,
      html,
      headers: {
        'List-Unsubscribe':      `<${unsubUrl}>, <mailto:${BBF_REPLY_TO}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    if (result?.error) {
      return { ok: false, error: 'resend_error', detail: result.error?.message || JSON.stringify(result.error) };
    }
    return { ok: true, message_id: result?.data?.id || null };
  } catch (err) {
    return { ok: false, error: 'resend_throw', detail: err?.message || String(err) };
  }
}
