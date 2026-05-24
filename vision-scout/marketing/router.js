// Marketing module · Express router mounted at /api/v1/marketing.
// Bearer-token gates the admin endpoints (ingest/analyze/dispatch); the
// inbound webhook and unsubscribe handler are intentionally public so
// the email provider + email clients can hit them.
import { Router }    from 'express';
import { ingest }    from './agents/scout.js';
import { analyze }   from './agents/analyst.js';
import { dispatch } from './agents/dispatcher.js';
import { inbound }   from './agents/triage.js';
import { unsubscribe } from './agents/unsubscribe.js';
import { isSbBuilt, sbBootKeyPresent, sbBuiltAt } from './db.js';
import { isResendReady } from './resend.js';

const MARKETING_ADMIN_TOKEN = process.env.BBF_MARKETING_ADMIN_TOKEN || '';

function requireAdmin(req, res, next) {
  if (!MARKETING_ADMIN_TOKEN) {
    console.warn('[marketing] BBF_MARKETING_ADMIN_TOKEN unset · admin routes are open (DEV ONLY)');
    return next();
  }
  const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (token !== MARKETING_ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return next();
}

export function buildMarketingRouter() {
  const r = Router();

  // Admin-gated worker triggers.
  r.post('/ingest',   requireAdmin, asyncHandler(ingest));
  r.post('/analyze',  requireAdmin, asyncHandler(analyze));
  r.post('/dispatch', requireAdmin, asyncHandler(dispatch));

  // Public webhooks · no JWT, no admin token. The webhook payload itself
  // is the only auth (and Resend should be configured to sign the body
  // — sig verification is a TODO once that's wired).
  r.post('/inbound',     asyncHandler(inbound));

  // Unsubscribe · token-authed via query/body.
  r.get('/unsubscribe',  asyncHandler(unsubscribe));
  r.post('/unsubscribe', asyncHandler(unsubscribe));

  // Health snapshot · reports both env presence (request-time read)
  // AND whether the underlying clients were actually built (boot-time
  // outcome). Mismatch between the two surfaces the "key added after
  // process start" footgun automatically · operator sees it in one curl
  // instead of via a failed end-to-end test.
  r.get('/health', (req, res) => res.json({
    ok: true,
    env: {
      gemini_key_set:           !!process.env.GEMINI_API_KEY,
      resend_key_set:           !!process.env.RESEND_API_KEY,
      service_role_set:         !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      admin_token_set:          !!process.env.BBF_MARKETING_ADMIN_TOKEN,
      unsub_base_url_set:       !!process.env.BBF_UNSUB_BASE_URL,
    },
    clients: {
      sb_client_built:          isSbBuilt(),
      sb_boot_key_present:      sbBootKeyPresent(),
      sb_built_at:              sbBuiltAt(),
      resend_client_built:      isResendReady(),
    },
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  }));

  return r;
}

// Tiny wrapper so async handlers' rejections turn into 500s instead of
// hanging the response.
function asyncHandler(fn) {
  return async (req, res, next) => {
    try { await fn(req, res, next); }
    catch (err) {
      console.error('[marketing] unhandled:', err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal', detail: err?.message });
    }
  };
}
