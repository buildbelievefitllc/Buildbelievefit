// vision-scout · interactive smoke-test for the production Build Believe
// Fit app. Receives a GitHub push webhook (or a manual POST), navigates
// to the target URL with Playwright, runs a sequence of user-journey
// actions (click/fill/press/wait), captures a screenshot of either the
// end state OR the broken state if a step failed, and sends both the PNG
// and the journey trace to Claude (Sonnet 4.6 by default · override via
// VISION_MODEL) for visual + behavioral review. Verdict forwards to
// Slack / Discord plus the server log.
//
// Endpoints
//   GET  /health        liveness probe for Render
//   POST /scan          manual trigger · body { url?, actions? } · Bearer auth via SCAN_API_KEY
//   POST /smoke-test    GitHub push webhook · HMAC SHA-256 via GITHUB_WEBHOOK_SECRET
//
// Actions array (optional · falls back to DEFAULT_JOURNEY env on /smoke-test)
//   { "type": "click",           "selector": "#login-btn" }
//   { "type": "fill",            "selector": "input[name=email]", "text": "demo@bbf.app" }
//   { "type": "press",           "selector": "input[name=pw]",    "key":  "Enter" }
//   { "type": "waitForTimeout",  "ms": 1500 }
//   { "type": "waitForSelector", "selector": ".dashboard" }

import express  from 'express';
import crypto   from 'node:crypto';
import { chromium } from 'playwright';
import Anthropic    from '@anthropic-ai/sdk';
import cron         from 'node-cron';
import { buildMarketingRouter } from './marketing/router.js';
import { runOrchestrator }      from './marketing/orchestrator.js';

// ─── Config ─────────────────────────────────────────────────────────────
const PORT                  = Number(process.env.PORT) || 3000;
const ANTHROPIC_API_KEY     = process.env.ANTHROPIC_API_KEY;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const SLACK_WEBHOOK_URL     = process.env.SLACK_WEBHOOK_URL || '';
const DISCORD_WEBHOOK_URL   = process.env.DISCORD_WEBHOOK_URL || '';
const PROD_URL              = process.env.PROD_URL || 'https://buildbelievefit.fitness';
const SCAN_API_KEY          = process.env.SCAN_API_KEY || '';
const PLAYWRIGHT_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_TIMEOUT_MS) || 30_000;
const ACTION_TIMEOUT_MS     = Number(process.env.ACTION_TIMEOUT_MS)     || 15_000;
const ANTHROPIC_TIMEOUT_MS  = Number(process.env.ANTHROPIC_TIMEOUT_MS)  || 60_000;
const ALLOWED_HOSTS         = (process.env.ALLOWED_HOSTS || 'buildbelievefit.fitness,buildbelievefit.com,buildbelievefit.onrender.com')
  .split(',').map((s) => s.trim()).filter(Boolean);

// claude-sonnet-4-6 is the current latest vision-capable Sonnet · upgrade
// from the 3.5-era id the original directive named. Override via VISION_MODEL.
const VISION_MODEL = process.env.VISION_MODEL || 'claude-sonnet-4-6';

if (!ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY is required');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const app       = express();

// ─── Middleware ─────────────────────────────────────────────────────────
// /smoke-test uses raw body so HMAC verification gets the EXACT bytes
// GitHub signed. Everything else uses normal JSON parsing.
app.use('/smoke-test', express.raw({ type: '*/*', limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));

// Marketing engine · mounted at /api/v1/marketing.
// Routes: /ingest /analyze /dispatch /inbound /unsubscribe /health
//
// Build wrapped in try/catch so a module-load failure in any agent
// (missing env, bad dep, etc.) cannot take down the whole server ·
// vision-scout's /scan + /smoke-test + /health stay up regardless.
try {
  app.use('/api/v1/marketing', buildMarketingRouter());
  console.log('[server] marketing router mounted at /api/v1/marketing');
} catch (err) {
  console.error('[server] marketing router build failed · serving stub:', err?.message);
  app.use('/api/v1/marketing', (req, res) => res.status(503).json({
    ok:     false,
    error:  'marketing_module_unavailable',
    detail: err?.message || 'unknown',
  }));
}

function verifyGitHubSignature(rawBody, sigHeader) {
  if (!GITHUB_WEBHOOK_SECRET) {
    console.warn('[security] GITHUB_WEBHOOK_SECRET unset · accepting unsigned hooks (DEV ONLY)');
    return true;
  }
  if (!sigHeader) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    const a = Buffer.from(sigHeader);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.some((host) => u.hostname === host || u.hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

// ─── Action parsing + execution ─────────────────────────────────────────
// Validates the incoming actions array up-front so a malformed request
// returns 400 instead of a confusing mid-journey runtime error.
const VALID_ACTION_TYPES = new Set(['click', 'fill', 'press', 'waitfortimeout', 'waitforselector']);

function validateActions(actions) {
  if (!Array.isArray(actions)) return { ok: false, error: 'actions_must_be_array' };
  for (let i = 0; i < actions.length; i++) {
    const a   = actions[i];
    if (!a || typeof a !== 'object') return { ok: false, error: 'action_' + i + '_not_object' };
    const t = String(a.type || '').toLowerCase();
    if (!VALID_ACTION_TYPES.has(t)) return { ok: false, error: 'action_' + i + '_invalid_type_' + (a.type || 'undefined') };
    if ((t === 'click' || t === 'waitforselector') && !a.selector) {
      return { ok: false, error: 'action_' + i + '_' + t + '_missing_selector' };
    }
    if (t === 'fill' && (!a.selector || a.text === undefined || a.text === null)) {
      return { ok: false, error: 'action_' + i + '_fill_missing_selector_or_text' };
    }
    if (t === 'press' && (!a.selector || !a.key)) {
      return { ok: false, error: 'action_' + i + '_press_missing_selector_or_key' };
    }
    if (t === 'waitfortimeout' && !(Number(a.ms) > 0)) {
      return { ok: false, error: 'action_' + i + '_waitForTimeout_invalid_ms' };
    }
  }
  return { ok: true };
}

function summarizeAction(action) {
  const t = String(action?.type || '?');
  switch (t.toLowerCase()) {
    case 'click':           return 'click(' + action.selector + ')';
    case 'waitforselector': return 'waitForSelector(' + action.selector + ')';
    case 'fill':            return 'fill(' + action.selector + ', "' + String(action.text || '').slice(0, 40) + '")';
    case 'press':           return 'press(' + action.selector + ', ' + action.key + ')';
    case 'waitfortimeout':  return 'waitForTimeout(' + action.ms + 'ms)';
    default:                return t;
  }
}

async function executeAction(page, action) {
  const t    = String(action.type || '').toLowerCase();
  const opts = { timeout: ACTION_TIMEOUT_MS };
  switch (t) {
    case 'click':
      await page.click(action.selector, opts);
      return;
    case 'fill':
      await page.fill(action.selector, String(action.text), opts);
      return;
    case 'press':
      await page.press(action.selector, String(action.key), opts);
      return;
    case 'waitfortimeout':
      // page.waitForTimeout doesn't take a timeout option · just block.
      await page.waitForTimeout(Number(action.ms));
      return;
    case 'waitforselector':
      await page.waitForSelector(action.selector, opts);
      return;
    default:
      throw new Error('unknown_action_type_' + t);
  }
}

function _parseDefaultJourney() {
  const raw = process.env.DEFAULT_JOURNEY;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const v      = validateActions(parsed);
    if (!v.ok) {
      console.warn('[config] DEFAULT_JOURNEY invalid:', v.error);
      return [];
    }
    return parsed;
  } catch (err) {
    console.warn('[config] DEFAULT_JOURNEY parse failed:', err?.message);
    return [];
  }
}

const DEFAULT_JOURNEY = _parseDefaultJourney();
if (DEFAULT_JOURNEY.length) {
  console.log('[config] DEFAULT_JOURNEY loaded · ' + DEFAULT_JOURNEY.length + ' actions');
}

// ─── Endpoints ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok:    true,
    ts:    Date.now(),
    model: VISION_MODEL,
    prod:  PROD_URL,
    default_journey_steps: DEFAULT_JOURNEY.length,
  });
});

app.post('/scan', async (req, res) => {
  if (SCAN_API_KEY) {
    const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (token !== SCAN_API_KEY) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
  }
  const url = req.body?.url || PROD_URL;
  if (!isAllowedUrl(url)) {
    return res.status(400).json({ ok: false, error: 'url_not_allowed', allowed: ALLOWED_HOSTS });
  }
  // Actions: explicit body wins, otherwise fall back to DEFAULT_JOURNEY,
  // otherwise plain navigation-only smoke test (empty array).
  const actions = Array.isArray(req.body?.actions) ? req.body.actions : DEFAULT_JOURNEY;
  const v       = validateActions(actions);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

  try {
    const result = await runSmokeTest(url, actions, { source: 'manual' });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[scan] failed:', err);
    res.status(500).json({ ok: false, error: err?.message || 'smoke_test_failed' });
  }
});

app.post('/smoke-test', async (req, res) => {
  const rawBody = req.body;
  const sig     = req.get('X-Hub-Signature-256');
  if (!verifyGitHubSignature(rawBody, sig)) {
    console.warn('[smoke-test] invalid HMAC signature');
    return res.status(401).json({ ok: false, error: 'invalid_signature' });
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const event  = req.get('X-GitHub-Event') || 'unknown';
  const commit = payload.after || payload.head_commit?.id || '';
  const ref    = payload.ref    || '';
  const pusher = payload.pusher?.name || payload.sender?.login || '';
  const ctx    = { source: 'github', event, commit, ref, pusher };

  // GitHub aborts hooks at 10s; smoke test takes 20-40s+. ACK now, work later.
  res.status(202).json({ ok: true, accepted: true, commit, ref, journey_steps: DEFAULT_JOURNEY.length });

  runSmokeTest(PROD_URL, DEFAULT_JOURNEY, ctx)
    .then(async (result) => {
      if (SLACK_WEBHOOK_URL)   await postToSlack(SLACK_WEBHOOK_URL,   result, ctx);
      if (DISCORD_WEBHOOK_URL) await postToDiscord(DISCORD_WEBHOOK_URL, result, ctx);
    })
    .catch(async (err) => {
      console.error('[smoke-test] async run failed:', err);
      const errorResult = {
        url:           PROD_URL,
        analysis:      { status: 'ERROR', summary: err?.message || 'unknown error', issues: [] },
        journey:       { trace: [], failedStep: null, pageError: err?.message || null },
        consoleErrors: [],
      };
      if (SLACK_WEBHOOK_URL)   await postToSlack(SLACK_WEBHOOK_URL,   errorResult, ctx);
      if (DISCORD_WEBHOOK_URL) await postToDiscord(DISCORD_WEBHOOK_URL, errorResult, ctx);
    });
});

// ─── Core ───────────────────────────────────────────────────────────────
async function runSmokeTest(url, actions = [], meta = {}) {
  const t0 = Date.now();
  console.log('[scout] start url=' + url + ' actions=' + actions.length + ' meta=' + JSON.stringify(meta));

  const journey  = await runJourney(url, actions);
  const stepInfo = (journey.failedStep != null)
    ? 'FAILED at step ' + journey.failedStep
    : 'COMPLETED ' + journey.trace.length + ' steps';
  console.log('[scout] journey ' + stepInfo + ' · screenshot=' + (journey.screenshot ? journey.screenshot.length + 'B' : 'none') +
              ' · ' + (Date.now() - t0) + 'ms');

  const analysis = await analyzeWithClaude(journey, { url, ...meta });
  console.log('[scout] analysis status=' + analysis.status + ' summary="' + (analysis.summary || '') + '"');
  if (journey.consoleErrors.length) console.log('[scout] console errors:', journey.consoleErrors);

  return {
    url,
    analysis,
    journey: {
      trace:      journey.trace,
      failedStep: journey.failedStep,
      pageError:  journey.pageError,
    },
    consoleErrors: journey.consoleErrors,
    meta,
    duration_ms: Date.now() - t0,
  };
}

// runJourney · navigate, run actions, screenshot. Resilient to per-action
// failures · catches, marks the failed step in the trace, screenshots the
// broken state, then returns. Caller passes EVERYTHING to Claude so the
// model sees the visual state + the journey log + the page console.
async function runJourney(url, actions) {
  let browser;
  const consoleErrors = [];
  const trace         = []; // [{ step, action, status, error? }]
  let failedStep      = null;
  let pageError       = null;
  let screenshot      = null;

  try {
    // Low-RAM Chromium launch · tuned for Render starter plan (512 MB).
    // CEO directive flag set.
    //
    // ⚠ Two flags here are known-fragile · keeping them per CEO request:
    //   --single-process       : prevents per-renderer process forks (saves
    //                            ~80-120 MB) but Playwright/Chromium docs
    //                            warn this causes navigation flakiness and
    //                            blank screenshots on some pages. If Vision
    //                            Scout starts returning empty PNGs or hung
    //                            sessions, this is the first suspect.
    //   --max-old-space-size=150 : caps V8 old generation at 150 MB. Heavy
    //                            real-world PWAs (deep DOM, large SVG)
    //                            can hit this and fatal · raise to 256-384
    //                            if we see "JavaScript heap out of memory"
    //                            in Render logs.
    //
    // The durable fix for OOM is bumping the Render plan to standard
    // (2 GB RAM); these flags are a short-term measure.
    browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',          // use disk, not /dev/shm
        '--disable-accelerated-2d-canvas',  // CPU canvas, no GPU memory
        '--no-first-run',
        '--no-zygote',                      // skip zygote process spawning
        '--single-process',                 // ⚠ see note above
        '--disable-gpu',                    // no GPU process
        '--js-flags=--max-old-space-size=150', // ⚠ see note above
      ],
    });
    const context = await browser.newContext({
      viewport:  { width: 1280, height: 2000 },
      userAgent: 'BBF-VisionScout/1.0 (+https://buildbelievefit.com)',
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + (err?.message || String(err))));
    page.on('console',   (msg) => {
      if (msg.type() === 'error') consoleErrors.push('console.error: ' + msg.text().slice(0, 200));
    });

    // Step 0 · navigation.
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: PLAYWRIGHT_TIMEOUT_MS });
      trace.push({ step: 0, action: 'goto(' + url + ')', status: 'ok' });
    } catch (err) {
      const msg = err?.name === 'TimeoutError'
        ? 'playwright_timeout: page did not reach networkidle within ' + PLAYWRIGHT_TIMEOUT_MS + 'ms'
        : (err?.message || String(err));
      trace.push({ step: 0, action: 'goto(' + url + ')', status: 'failed', error: msg });
      pageError  = msg;
      failedStep = 0;
      // Don't return early · still try to screenshot whatever painted.
    }

    // Steps 1..N · user-journey actions. Stop the journey on the first
    // failure but DO NOT throw · we want to screenshot the broken state.
    if (failedStep == null) {
      for (let i = 0; i < actions.length; i++) {
        const stepNum = i + 1;
        const action  = actions[i];
        try {
          await executeAction(page, action);
          trace.push({ step: stepNum, action: summarizeAction(action), status: 'ok' });
        } catch (err) {
          const msg = err?.name === 'TimeoutError'
            ? 'action_timeout: ' + summarizeAction(action) + ' did not complete within ' + ACTION_TIMEOUT_MS + 'ms'
            : (err?.message || String(err));
          trace.push({ step: stepNum, action: summarizeAction(action), status: 'failed', error: msg });
          pageError  = msg;
          failedStep = stepNum;
          break;
        }
      }
    }

    // Always try to capture a screenshot · success state OR broken state.
    try {
      screenshot = await page.screenshot({ fullPage: false, type: 'png' });
    } catch (err) {
      console.error('[scout] screenshot capture failed:', err?.message);
      screenshot = null;
    }

    await context.close().catch(() => {});
  } catch (err) {
    // Browser launch / context creation failed · catastrophic but recoverable
    // for the API caller. We have no screenshot, just an error to relay.
    console.error('[scout] runJourney outer failure:', err?.message);
    pageError = pageError || ('browser_launch_failed: ' + (err?.message || String(err)));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return { screenshot, consoleErrors, trace, failedStep, pageError };
}

const SYSTEM_PROMPT = [
  'You are a senior frontend QA engineer reviewing a production smoke test of the Build Believe Fit fitness PWA. You receive ONE 1280x2000 viewport screenshot taken after Playwright navigated to the URL and (optionally) executed an interactive user journey.',
  '',
  'The user message includes a JOURNEY TRACE — a numbered list of every step Playwright attempted. Step 0 is always the initial navigation. Subsequent steps are the actions from the test script (click, fill, press, waitForSelector, waitForTimeout).',
  '',
  'If the journey halted mid-flight (failedStep set), the screenshot shows the broken state when Playwright gave up. If the journey completed, the screenshot shows the final state.',
  '',
  'Look for ship-blocking issues in BOTH:',
  '1. The visible UI in the screenshot — layout breaks, missing/broken images, untranslated i18n keys (e.g. "app-nutr-noplan"), "undefined" / "NaN" / "[object Object]" leaking into the UI, empty states where data belongs, visible error banners, white-on-white text, critical CTAs missing.',
  '2. The journey trace — if a step failed, decide whether it is a real bug (the UI broke and Playwright could not find a previously-stable selector) or noise (flaky waiting, transient network). Use the visible UI to disambiguate.',
  '',
  'Severity calibration:',
  '- high   = ship-blocker · rollback or hotfix recommended.',
  '- medium = noticeable bug, file but do not block deploy.',
  '- low    = cosmetic blemish.',
  '',
  'Status calibration:',
  '- PASS = nothing notable. Journey completed cleanly, UI looks correct.',
  '- WARN = minor cosmetic issue or recoverable journey hiccup.',
  '- FAIL = core surface broken, critical journey step impossible, or both.',
  '',
  'Return ONLY this JSON shape — no prose, no markdown fences:',
  '{',
  '  "status":  "PASS" | "WARN" | "FAIL",',
  '  "summary": "<one sentence verdict>",',
  '  "issues": [',
  '    { "severity": "low" | "medium" | "high", "description": "<what you saw>" }',
  '  ]',
  '}',
].join('\n');

async function analyzeWithClaude(journey, ctx) {
  // No screenshot · catastrophic Playwright failure. Skip Claude, return
  // ERROR straight back so /scan response and notifiers have something
  // meaningful instead of an empty model reply.
  if (!journey.screenshot) {
    return {
      status:  'ERROR',
      summary: 'no screenshot captured · ' + (journey.pageError || 'unknown failure'),
      issues:  journey.pageError ? [{ severity: 'high', description: journey.pageError }] : [],
    };
  }

  const base64 = journey.screenshot.toString('base64');

  const headerLine = [
    'Smoke test of ' + (ctx.url || 'production'),
    ctx.commit ? 'after commit ' + ctx.commit.slice(0, 7) : null,
    ctx.ref    ? 'on ' + ctx.ref : null,
    ctx.pusher ? 'pushed by ' + ctx.pusher : null,
  ].filter(Boolean).join(' · ');

  const traceLines = journey.trace.map((t) =>
    '  ' + t.step + '. [' + t.status.toUpperCase() + '] ' + t.action +
    (t.error ? ' · error: ' + t.error : '')
  ).join('\n');

  const journeyVerdict = journey.failedStep != null
    ? 'Journey FAILED at step ' + journey.failedStep + '. The screenshot is the broken state.'
    : (journey.trace.length > 1
        ? 'Journey COMPLETED all ' + journey.trace.length + ' steps. The screenshot is the final state.'
        : 'Static smoke test · navigation only, no interactive steps.');

  const consoleSection = journey.consoleErrors.length
    ? '\n\nPAGE CONSOLE ERRORS:\n' + journey.consoleErrors.slice(0, 10).map((e) => '  - ' + e).join('\n')
    : '';

  const userText = [
    headerLine,
    '',
    'JOURNEY TRACE:',
    traceLines || '  (no steps)',
    '',
    journeyVerdict + consoleSection,
  ].join('\n');

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
  let resp;
  try {
    resp = await anthropic.messages.create({
      model:      VISION_MODEL,
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
          { type: 'text',  text: userText },
        ],
      }],
    }, { signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError' || /aborted/i.test(err?.message || '')) {
      return {
        status:  'ERROR',
        summary: 'anthropic_timeout: model did not reply within ' + ANTHROPIC_TIMEOUT_MS + 'ms',
        issues:  [],
      };
    }
    return { status: 'ERROR', summary: 'anthropic_call_failed: ' + (err?.message || 'unknown'), issues: [] };
  } finally {
    clearTimeout(timer);
  }

  const block = (resp?.content || []).find((b) => b?.type === 'text');
  const text  = block?.text || '';
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return { status: 'UNKNOWN', summary: 'no JSON in model reply', issues: [], raw: text.slice(0, 400) };
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return { status: 'UNKNOWN', summary: 'parse failed', issues: [], raw: text.slice(0, 400) };
  }
}

// ─── Notifiers ──────────────────────────────────────────────────────────
function statusEmoji(status) {
  return status === 'PASS'  ? ':white_check_mark:'
       : status === 'WARN'  ? ':warning:'
       : status === 'FAIL'  ? ':x:'
       : status === 'ERROR' ? ':rotating_light:'
       :                      ':grey_question:';
}
function statusColor(status) {
  return status === 'PASS'  ? 0x22c55e
       : status === 'WARN'  ? 0xf59e0b
       : status === 'FAIL'  ? 0xef4444
       : status === 'ERROR' ? 0x7f1d1d
       :                      0x6b7280;
}

function journeyHeadline(result) {
  const j = result.journey || {};
  if (!Array.isArray(j.trace) || j.trace.length <= 1) return null;
  if (j.failedStep != null) {
    const failed = j.trace[j.failedStep] || j.trace.find((t) => t.status === 'failed');
    return 'Journey FAILED at step ' + j.failedStep + ': ' + (failed?.action || '?') +
           (failed?.error ? ' · ' + failed.error : '');
  }
  return 'Journey COMPLETED all ' + j.trace.length + ' steps cleanly.';
}

async function postToSlack(webhookUrl, result, ctx) {
  const a     = result.analysis || {};
  const lines = [
    statusEmoji(a.status) + ' *Vision Scout · ' + (a.status || '?') + '* — ' + (a.summary || ''),
    'Commit `' + (ctx.commit || '?').slice(0, 7) + '` on `' + (ctx.ref || '?') + '` by ' + (ctx.pusher || '?'),
    'URL: ' + (result.url || ''),
  ];
  const jh = journeyHeadline(result);
  if (jh) lines.push(jh);
  if (a.issues?.length) {
    lines.push('*Issues:*');
    a.issues.slice(0, 8).forEach((i) => lines.push('• [' + i.severity + '] ' + i.description));
  }
  if (result.consoleErrors?.length) {
    lines.push('*Console:*');
    result.consoleErrors.slice(0, 5).forEach((e) => lines.push('`' + e.slice(0, 200) + '`'));
  }
  await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text: lines.join('\n') }),
  }).catch((err) => console.error('[slack] post failed:', err));
}

async function postToDiscord(webhookUrl, result, ctx) {
  const a      = result.analysis || {};
  const fields = [
    { name: 'URL',    value: result.url || '?',                              inline: false },
    { name: 'Commit', value: '`' + (ctx.commit || '?').slice(0, 7) + '`',    inline: true  },
    { name: 'Ref',    value: '`' + (ctx.ref || '?') + '`',                   inline: true  },
    { name: 'Pusher', value: ctx.pusher || '?',                              inline: true  },
  ];
  const jh = journeyHeadline(result);
  if (jh) fields.push({ name: 'Journey', value: jh.slice(0, 1024), inline: false });
  if (a.issues?.length) {
    fields.push({
      name:   'Issues',
      value:  a.issues.slice(0, 8).map((i) => '• [' + i.severity + '] ' + i.description).join('\n').slice(0, 1024),
      inline: false,
    });
  }
  if (result.consoleErrors?.length) {
    fields.push({
      name:   'Console',
      value:  result.consoleErrors.slice(0, 5).map((e) => '`' + e.slice(0, 200) + '`').join('\n').slice(0, 1024),
      inline: false,
    });
  }
  const embed = {
    title:       'Vision Scout · ' + (a.status || '?'),
    description: a.summary || '',
    color:       statusColor(a.status),
    fields,
    timestamp:   new Date().toISOString(),
  };
  await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ embeds: [embed] }),
  }).catch((err) => console.error('[discord] post failed:', err));
}

// ─── Boot ───────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log('[vision-scout] listening on :' + PORT);
  console.log('[vision-scout] model=' + VISION_MODEL + ' prod=' + PROD_URL);
  console.log('[vision-scout] allowed=' + JSON.stringify(ALLOWED_HOSTS));
  console.log('[vision-scout] action_timeout=' + ACTION_TIMEOUT_MS + 'ms · default_journey=' + DEFAULT_JOURNEY.length + ' steps');
  // Env wiring snapshot · no secrets, just presence flags so the
  // operator can see at boot which routes will work without curling
  // /health or /api/v1/marketing/health.
  console.log('[vision-scout] env: ' + JSON.stringify({
    anthropic:    !!process.env.ANTHROPIC_API_KEY,
    gemini:       !!process.env.GEMINI_API_KEY,
    resend:       !!process.env.RESEND_API_KEY,
    supabase_url: !!process.env.SUPABASE_URL,
    service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    admin_token:  !!process.env.BBF_MARKETING_ADMIN_TOKEN,
    github_secret: !!process.env.GITHUB_WEBHOOK_SECRET,
  }));
});

// Graceful shutdown so in-flight scans get a chance to finish their
// Slack/Discord post on a redeploy.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('[vision-scout] received ' + sig + ' · closing server');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}

// ─── Marketing orchestrator cron ────────────────────────────────────────
// Schedule the daily run. Env-controlled · BBF_ORCHESTRATOR_CRON empty/unset
// disables the in-process cron (useful for tests + when an external
// scheduler is preferred). Default '0 14 * * *' UTC = 10am ET / 7am PT,
// firing the full Scout -> Analyst -> Dispatcher chain.
const ORCH_CRON = process.env.BBF_ORCHESTRATOR_CRON || '';
if (ORCH_CRON) {
  if (cron.validate(ORCH_CRON)) {
    cron.schedule(ORCH_CRON, async () => {
      console.log('[vision-scout] cron tick · firing marketing orchestrator');
      try {
        const result = await runOrchestrator({ source: 'cron' });
        console.log('[vision-scout] orchestrator finished ok=' + result.ok +
                    ' duration_ms=' + result.duration_ms);
      } catch (err) {
        console.error('[vision-scout] orchestrator threw:', err?.message);
      }
    }, { timezone: 'UTC' });
    console.log('[vision-scout] orchestrator cron registered · schedule=' + ORCH_CRON + ' UTC');
  } else {
    console.warn('[vision-scout] BBF_ORCHESTRATOR_CRON invalid: "' + ORCH_CRON + '" · cron disabled');
  }
} else {
  console.log('[vision-scout] orchestrator cron disabled · set BBF_ORCHESTRATOR_CRON to enable');
}
