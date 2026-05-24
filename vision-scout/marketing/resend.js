// Resend wrapper · uses the official `resend` npm package. Outbound
// email + List-Unsubscribe headers (RFC 8058 one-click) baked in so we
// don't get dunked into the spam folder.
import { Resend } from 'resend';

const RESEND_API_KEY     = process.env.RESEND_API_KEY;
const BBF_FROM_NAME      = process.env.BBF_FROM_NAME      || 'Akeem Brown';
const BBF_FROM_EMAIL     = process.env.BBF_FROM_EMAIL     || 'akeem@buildbelievefit.fitness';
const BBF_REPLY_TO       = process.env.BBF_REPLY_TO       || BBF_FROM_EMAIL;
const BBF_BUSINESS_ADDR  = process.env.BBF_BUSINESS_ADDRESS || 'Build Believe Fit · USA';
const BBF_UNSUB_BASE_URL = process.env.BBF_UNSUB_BASE_URL || ''; // e.g. https://vision-scout.onrender.com

if (!RESEND_API_KEY) {
  console.error('[marketing/resend] WARN · RESEND_API_KEY unset · dispatcher will 500');
}

const resend = new Resend(RESEND_API_KEY || 'missing');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function unsubscribeUrl(token) {
  const base = BBF_UNSUB_BASE_URL.replace(/\/$/, '');
  return `${base}/api/v1/marketing/unsubscribe?t=${encodeURIComponent(token)}`;
}

// sendPitch · transmits an athlete-personalized pitch with full
// CAN-SPAM compliance (clear sender, physical address, unsub link)
// AND RFC 8058 one-click unsubscribe headers (List-Unsubscribe +
// List-Unsubscribe-Post). Returns { ok, message_id?, error?, detail? }.
export async function sendPitch(lead) {
  if (!RESEND_API_KEY) return { ok: false, error: 'resend_key_missing' };
  if (!lead?.email)    return { ok: false, error: 'lead_email_missing' };
  if (!lead?.personalized_pitch) return { ok: false, error: 'lead_pitch_missing' };

  const unsubUrl = unsubscribeUrl(lead.unsubscribe_token);
  const subject  = `Performance audit · ${lead.athlete_name}`;

  const text = [
    `${lead.athlete_name},`,
    '',
    lead.personalized_pitch,
    '',
    '— Akeem · Build Believe Fit',
    '',
    `Don't want these? Unsubscribe: ${unsubUrl}`,
    BBF_BUSINESS_ADDR,
  ].join('\n');

  const html = [
    `<p>${esc(lead.athlete_name)},</p>`,
    `<p>${esc(lead.personalized_pitch).replace(/\n/g, '<br>')}</p>`,
    `<p>— Akeem · Build Believe Fit</p>`,
    `<hr style="border:0;border-top:1px solid #ddd">`,
    `<p style="font-size:11px;color:#888">`,
    `<a href="${esc(unsubUrl)}">Unsubscribe</a> · ${esc(BBF_BUSINESS_ADDR)}`,
    `</p>`,
  ].join('');

  try {
    const result = await resend.emails.send({
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
