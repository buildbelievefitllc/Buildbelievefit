// vapi-sms-closer — Vapi Custom Tool webhook that texts a Stripe checkout
// link to the prospect's phone via Twilio. Wired to the "Lance" Vapi
// agent so he can close a verbal commit by handing the prospect a
// tappable payment link in SMS while the call is still live.
//
// Request shape (from Vapi):
//   POST /functions/v1/vapi-sms-closer
//   Content-Type: application/json
//   X-Vapi-Secret: <optional shared secret>
//   Body:
//   {
//     "message": {
//       "type": "tool-calls",
//       "toolCallList": [{
//         "id": "<toolCallId>",
//         "type": "function",
//         "function": {
//           "name": "send_stripe_link_sms",
//           "arguments": "{\"customer_phone\":\"+15555551234\",\"tier_name\":\"Sovereign\"}"
//         }
//       }]
//     }
//   }
//
// Response shape (Vapi-compliant):
//   { "results": [{ "toolCallId": "...", "result": "SMS successfully sent..." }] }
//
// Errors are still returned as 200 + a per-toolCall result string so
// Lance can hear the failure reason inline and recover (e.g. ask the
// prospect to repeat their number). Only true infra faults (bad JSON,
// auth fail) bounce with non-2xx.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-vapi-secret, authorization',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Tier → Stripe Payment Link map ─────────────────────────────────────
// Placeholders per CEO directive — swap in the real Stripe URLs once the
// dashboard is updated, no code change required for Lance's flow.
const TIER_MAP: Record<string, { url: string; label: string }> = {
  gateway:        { url: 'https://buy.stripe.com/test_placeholder_gateway',    label: 'Gateway' },
  essentials:     { url: 'https://buy.stripe.com/test_placeholder_essentials', label: 'Nutrition Essentials' },
  sovereign:      { url: 'https://buy.stripe.com/test_placeholder_sovereign',  label: 'Sovereign' },
  pathfinder:     { url: 'https://buy.stripe.com/test_placeholder_pathfinder', label: 'Pathfinder' },
  nutrition_lite: { url: 'https://buy.stripe.com/test_placeholder_lite',       label: 'Nutrition Lite' },
};

function normalizeTier(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
}

// Best-effort E.164 normalization. Strips formatting characters and adds
// the default country code (+1) if the input looks like a 10-digit US
// number with no plus prefix. Anything else passes through with non-digit
// chars (except +) stripped so Twilio's validator gets a clean string.
function normalizePhone(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  // Unknown format — return cleaned digits with + so Twilio surfaces the
  // real validation error in its response (logged below).
  return '+' + digits;
}

function isValidE164(p: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(p);
}

// Vapi sometimes serializes function.arguments as a JSON string and
// sometimes as a parsed object. Accept either.
function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

async function sendTwilioSms(opts: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toNumber: string;
  body: string;
}): Promise<{ ok: boolean; status: number; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(opts.accountSid)}/Messages.json`;
  const form = new URLSearchParams();
  form.append('To', opts.toNumber);
  form.append('From', opts.fromNumber);
  form.append('Body', opts.body);
  const basic = btoa(`${opts.accountSid}:${opts.authToken}`);
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  let body: any = null;
  try { body = await r.json(); } catch { /* twilio always returns JSON */ }
  if (!r.ok) {
    const msg = (body && (body.message || body.detail)) || `twilio ${r.status}`;
    console.error(`[vapi-sms-closer] twilio send failed: status=${r.status} body=${JSON.stringify(body)}`);
    return { ok: false, status: r.status, error: msg };
  }
  return { ok: true, status: r.status, sid: body?.sid };
}

interface ProcessedResult {
  toolCallId: string;
  result: string;
}

async function processToolCall(
  toolCall: any,
  twilio: { sid: string; token: string; from: string },
): Promise<ProcessedResult> {
  const toolCallId = String(toolCall?.id || '');
  const fn = toolCall?.function || {};
  const args = parseToolArgs(fn.arguments);

  const rawPhone = String((args as any).customer_phone || (args as any).phone || '').trim();
  const rawTier  = String((args as any).tier_name || (args as any).tier || '').trim();

  if (!rawPhone) {
    return { toolCallId, result: 'Could not send the link — no phone number was provided. Ask the prospect to confirm their mobile number.' };
  }
  if (!rawTier) {
    return { toolCallId, result: 'Could not send the link — no tier was provided. Confirm which tier the prospect committed to (Gateway, Essentials, or Sovereign).' };
  }

  const phone = normalizePhone(rawPhone);
  if (!isValidE164(phone)) {
    return { toolCallId, result: `Could not send the link — "${rawPhone}" is not a valid phone number. Ask the prospect to repeat it digit-by-digit.` };
  }

  const tierKey = normalizeTier(rawTier);
  const tier = TIER_MAP[tierKey];
  if (!tier) {
    const allowed = Object.values(TIER_MAP).map(t => t.label).join(', ');
    return { toolCallId, result: `Could not send the link — "${rawTier}" is not a recognized tier. Confirm one of: ${allowed}.` };
  }

  const messageBody = `Here is your secure checkout link for the BBF ${tier.label} Protocol: ${tier.url}`;
  const send = await sendTwilioSms({
    accountSid: twilio.sid,
    authToken:  twilio.token,
    fromNumber: twilio.from,
    toNumber:   phone,
    body:       messageBody,
  });

  if (!send.ok) {
    return { toolCallId, result: `Could not send the SMS to ${phone} — Twilio rejected the request (${send.error}). Apologize to the prospect and re-confirm the number.` };
  }

  console.log(`[vapi-sms-closer] sms sent · tier=${tierKey} to=${phone} sid=${send.sid}`);
  return { toolCallId, result: 'SMS successfully sent with the payment link.' };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // Optional shared-secret header check. Vapi can be configured to send a
  // custom header on tool webhooks; set VAPI_SHARED_SECRET in Supabase
  // secrets and match the same value in the Vapi tool's server-config to
  // reject any non-Vapi caller.
  const expectedSecret = Deno.env.get('VAPI_SHARED_SECRET');
  if (expectedSecret) {
    const sent = req.headers.get('x-vapi-secret') || req.headers.get('x-vapi-signature') || '';
    if (sent !== expectedSecret) {
      console.warn('[vapi-sms-closer] rejected: bad/missing X-Vapi-Secret header');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('[vapi-sms-closer] missing Twilio env vars (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER).');
    return jsonResponse({ error: 'config_missing_twilio' }, 503);
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  // Vapi has shipped the toolCall list under both `toolCallList` and
  // `toolCalls` across versions — accept either, and fall back to a
  // single-tool-call shape if Vapi ever flattens the payload.
  const msg = payload?.message || payload || {};
  const toolCalls: any[] =
    (Array.isArray(msg.toolCallList) && msg.toolCallList) ||
    (Array.isArray(msg.toolCalls)    && msg.toolCalls)    ||
    (msg.toolCall ? [msg.toolCall] : []);

  if (!toolCalls.length) {
    console.warn('[vapi-sms-closer] no toolCalls in payload', JSON.stringify(payload).slice(0, 400));
    return jsonResponse({ results: [] }, 200);
  }

  const twilio = { sid: TWILIO_ACCOUNT_SID, token: TWILIO_AUTH_TOKEN, from: TWILIO_PHONE_NUMBER };
  const results = await Promise.all(toolCalls.map(tc => processToolCall(tc, twilio)));

  return jsonResponse({ results }, 200);
});
