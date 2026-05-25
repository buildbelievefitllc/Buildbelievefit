// Compliance handler · one-click unsubscribe.
// GET  /api/v1/marketing/unsubscribe?t=<token>   · browser click from email link
// POST /api/v1/marketing/unsubscribe?t=<token>   · RFC 8058 List-Unsubscribe-Post
//
// Flips status to 'unsubscribed'. Idempotent. No auth · token is the auth.
import { sb, requireSb, TABLE } from '../db.js';
import { logRun, newRunId } from '../telemetry.js';

const AGENT = 'marketing.unsubscribe';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export async function unsubscribe(req, res) {
  if (!requireSb(res)) return;
  const startedAt = Date.now();
  const runId     = newRunId('unsub');
  const token     = String(req.query?.t || req.body?.t || '').trim();
  if (!token) {
    await logRun({
      agent: AGENT, runId, source: req.method === 'POST' ? 'one_click' : 'browser',
      startedAt, finishedAt: Date.now(), ok: false, error: 'missing_token',
      summary: { method: req.method },
    });
    return res.status(400).send('Missing token.');
  }

  const { data, error } = await sb
    .from(TABLE)
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .neq('status', 'unsubscribed')
    .select('athlete_name, email');

  if (error) {
    console.error('[marketing/unsubscribe] failed:', error);
    await logRun({
      agent: AGENT, runId, source: req.method === 'POST' ? 'one_click' : 'browser',
      startedAt, finishedAt: Date.now(), ok: false, error: error.message,
      summary: { token_prefix: token.slice(0, 8) },
    });
    return res.status(500).send('Internal error.');
  }

  const lead = data?.[0];
  console.log(`[marketing/unsubscribe] token=${token.slice(0, 8)}… lead=${lead?.email || '(already unsubscribed or unknown token)'}`);
  await logRun({
    agent: AGENT, runId, source: req.method === 'POST' ? 'one_click' : 'browser',
    startedAt, finishedAt: Date.now(), ok: true,
    summary: {
      token_prefix: token.slice(0, 8),
      email:        lead?.email || null,
      already_unsubscribed_or_unknown: !lead,
    },
  });

  // Lightweight HTML confirmation · email clients open it in-browser.
  const html = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title>',
    '<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;color:#333;line-height:1.5}',
    'h1{color:#000;font-weight:600}p{color:#555}</style></head><body>',
    '<h1>Unsubscribed.</h1>',
    `<p>${lead ? `Goodbye, ${esc(lead.athlete_name)}.` : 'Done.'} You won’t receive any more emails from Build Believe Fit. Sorry for the noise.</p>`,
    '<p style="font-size:13px;color:#888">— Akeem</p>',
    '</body></html>',
  ].join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
