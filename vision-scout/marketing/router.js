// Marketing module · Express router mounted at /api/v1/marketing.
// Bearer-token gates the admin endpoints (ingest/analyze/dispatch); the
// inbound webhook and unsubscribe handler are intentionally public so
// the email provider + email clients can hit them.
//
// AUTH · admin token comparison uses crypto.timingSafeEqual so an attacker
// cannot mount a timing oracle against the secret. Bare `===` short-circuits
// on the first mismatched byte · revealing length + prefix info to anyone
// patient enough to measure response time. timingSafeEqual is constant-time
// on equal-length buffers; we equalize length first by hashing both sides
// to SHA-256 (always 32 bytes) before the compare, which means a
// short/long candidate also doesn't leak length.
import { Router }    from 'express';
import crypto        from 'node:crypto';
import { ingest }    from './agents/scout.js';
import { analyze }   from './agents/analyst.js';
import { dispatch } from './agents/dispatcher.js';
import { inbound }   from './agents/triage.js';
import { unsubscribe } from './agents/unsubscribe.js';
import { scoutEngine }         from './agents/scout-engine.js';
import { runOrchestratorRoute } from './orchestrator.js';
import { isSbBuilt, sbBootKeyPresent, sbBuiltAt, sbBuildError, sbUsedFallback } from './db.js';
import { isResendReady } from './resend.js';
import { summarizeTelemetry } from './telemetry.js';
import { summarizeDeliveryMetrics } from './suppression.js';

const MARKETING_ADMIN_TOKEN = process.env.BBF_MARKETING_ADMIN_TOKEN || '';

// Pre-hashed expected token · digest once at module load, compare per
// request with timingSafeEqual. Empty string → null (open mode).
const EXPECTED_TOKEN_DIGEST = MARKETING_ADMIN_TOKEN
  ? crypto.createHash('sha256').update(MARKETING_ADMIN_TOKEN).digest()
  : null;

function constantTimeTokenMatch(candidate) {
  if (!EXPECTED_TOKEN_DIGEST) return false;
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const candidateDigest = crypto.createHash('sha256').update(candidate).digest();
  // Both digests are guaranteed 32 bytes; timingSafeEqual is safe.
  try {
    return crypto.timingSafeEqual(candidateDigest, EXPECTED_TOKEN_DIGEST);
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (!MARKETING_ADMIN_TOKEN) {
    console.warn('[marketing] BBF_MARKETING_ADMIN_TOKEN unset · admin routes are open (DEV ONLY)');
    return next();
  }
  const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!constantTimeTokenMatch(token)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return next();
}

export function buildMarketingRouter() {
  const r = Router();

  // Admin-gated worker triggers.
  r.post('/ingest',           requireAdmin, asyncHandler(ingest));
  r.post('/analyze',          requireAdmin, asyncHandler(analyze));
  r.post('/dispatch',         requireAdmin, asyncHandler(dispatch));
  r.post('/scout-engine',     requireAdmin, asyncHandler(scoutEngine));
  r.post('/run-orchestrator', requireAdmin, asyncHandler(runOrchestratorRoute));

  // Admin-gated telemetry rollup · GET /telemetry?hours=24
  // Returns aggregated bbf_agent_runs + bbf_llm_calls counts/costs.
  r.get('/telemetry', requireAdmin, asyncHandler(async (req, res) => {
    const hours   = Number(req.query?.hours) || 24;
    const summary = await summarizeTelemetry({ hours });
    if (!summary.ok) return res.status(503).json(summary);
    return res.json(summary);
  }));

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
  //
  // Phase 1.1 · delivery diagnostic matrix is rolled up best-effort with
  // a 2s ceiling · health stays fast even if the DB lookup hangs.
  r.get('/health', asyncHandler(async (req, res) => {
    const deliveryWindowHours = Number(req.query?.delivery_hours) || 24;
    const deliveryDeadlineMs  = 2000;
    let delivery;
    try {
      delivery = await Promise.race([
        summarizeDeliveryMetrics({ hours: deliveryWindowHours }),
        new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: 'delivery_timeout' }), deliveryDeadlineMs)),
      ]);
    } catch (e) {
      delivery = { ok: false, error: 'delivery_threw', detail: e?.message };
    }

    return res.json({
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
        sb_used_fallback:         sbUsedFallback(),
        sb_build_error:           sbBuildError(),
        resend_client_built:      isResendReady(),
      },
      orchestrator: {
        cron_schedule:        process.env.BBF_ORCHESTRATOR_CRON   || '(disabled · set BBF_ORCHESTRATOR_CRON)',
        analyze_batch:        Number(process.env.BBF_ORCH_ANALYZE_BATCH)  || 25,
        dispatch_batch:       Number(process.env.BBF_ORCH_DISPATCH_BATCH) || 25,
        demo_seeds_active:    String(process.env.BBF_SCOUT_USE_DEMO_SEEDS || '').toLowerCase() === 'true',
      },
      delivery,
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    });
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
