// vision-scout · headless smoke-test for the production Build Believe Fit
// app. Receives a GitHub push webhook (or a manual POST), screenshots the
// production URL with Playwright, sends the PNG to Claude (Sonnet 4.6 by
// default · override via VISION_MODEL) for visual UI review, and forwards
// the verdict to Slack / Discord (if configured) plus the server log.
//
// Endpoints
//   GET  /health        liveness probe for Render
//   POST /scan          manual trigger · body {url?} · Bearer auth via SCAN_API_KEY
//   POST /smoke-test    GitHub push webhook · HMAC SHA-256 via GITHUB_WEBHOOK_SECRET

import express  from 'express';
import crypto   from 'node:crypto';
import { chromium } from 'playwright';
import Anthropic    from '@anthropic-ai/sdk';

// ─── Config ─────────────────────────────────────────────────────────────
const PORT                  = Number(process.env.PORT) || 3000;
const ANTHROPIC_API_KEY     = process.env.ANTHROPIC_API_KEY;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const SLACK_WEBHOOK_URL     = process.env.SLACK_WEBHOOK_URL || '';
const DISCORD_WEBHOOK_URL   = process.env.DISCORD_WEBHOOK_URL || '';
const PROD_URL              = process.env.PROD_URL || 'https://buildbelievefit.com';
const SCAN_API_KEY          = process.env.SCAN_API_KEY || '';
const PLAYWRIGHT_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_TIMEOUT_MS) || 30_000;
const ANTHROPIC_TIMEOUT_MS  = Number(process.env.ANTHROPIC_TIMEOUT_MS) || 60_000;
const ALLOWED_HOSTS         = (process.env.ALLOWED_HOSTS || 'buildbelievefit.com,buildbelievefit.onrender.com')
  .split(',').map((s) => s.trim()).filter(Boolean);

// claude-sonnet-4-6 is the current latest vision-capable Sonnet · upgrade
// from the 3.5-era id the directive mentioned. Override via VISION_MODEL.
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

// ─── Endpoints ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: Date.now(), model: VISION_MODEL, prod: PROD_URL });
});

app.post('/scan', async (req, res) => {
  // Bearer-token gate · prevents internet randos from burning Anthropic
  // + Playwright budget on demand. Unset SCAN_API_KEY for an open dev
  // endpoint.
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
  try {
    const result = await runSmokeTest(url, { source: 'manual' });
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

  // GitHub aborts hooks at 10s; smoke test takes 20-40s. ACK now, work later.
  res.status(202).json({ ok: true, accepted: true, commit, ref });

  runSmokeTest(PROD_URL, ctx)
    .then(async (result) => {
      if (SLACK_WEBHOOK_URL)   await postToSlack(SLACK_WEBHOOK_URL, result, ctx);
      if (DISCORD_WEBHOOK_URL) await postToDiscord(DISCORD_WEBHOOK_URL, result, ctx);
    })
    .catch(async (err) => {
      console.error('[smoke-test] async run failed:', err);
      const errorResult = {
        url:           PROD_URL,
        analysis:      { status: 'ERROR', summary: err?.message || 'unknown error', issues: [] },
        consoleErrors: [],
      };
      if (SLACK_WEBHOOK_URL)   await postToSlack(SLACK_WEBHOOK_URL, errorResult, ctx);
      if (DISCORD_WEBHOOK_URL) await postToDiscord(DISCORD_WEBHOOK_URL, errorResult, ctx);
    });
});

// ─── Core ───────────────────────────────────────────────────────────────
async function runSmokeTest(url, meta = {}) {
  const t0 = Date.now();
  console.log('[scout] start url=' + url + ' meta=' + JSON.stringify(meta));

  const { screenshot, consoleErrors } = await captureScreenshot(url);
  console.log('[scout] screenshot captured · bytes=' + screenshot.length + ' · ' + (Date.now() - t0) + 'ms');

  const analysis = await analyzeWithClaude(screenshot, { url, ...meta });
  console.log('[scout] analysis status=' + analysis.status + ' summary="' + (analysis.summary || '') + '"');
  if (consoleErrors.length) console.log('[scout] console errors:', consoleErrors);

  return { url, analysis, consoleErrors, meta, duration_ms: Date.now() - t0 };
}

async function captureScreenshot(url) {
  let browser;
  const consoleErrors = [];
  try {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

    await page.goto(url, { waitUntil: 'networkidle', timeout: PLAYWRIGHT_TIMEOUT_MS });
    const screenshot = await page.screenshot({ fullPage: false, type: 'png' });
    await context.close();
    return { screenshot, consoleErrors };
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new Error('playwright_timeout: page did not reach networkidle within ' + PLAYWRIGHT_TIMEOUT_MS + 'ms');
    }
    throw err;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

const SYSTEM_PROMPT = [
  'You are a senior frontend QA engineer reviewing a production smoke test of the Build Believe Fit fitness PWA. You receive a single 1280x2000 viewport screenshot of the production deploy.',
  '',
  'Look for ship-blocking visual regressions:',
  '- Layout breaks (overflow, broken grids, misaligned components, content cut off, z-index stacking errors)',
  '- Missing or broken images (broken-image icons, large blank placeholders where photos belong)',
  '- Empty states that should have data (zero readouts where numbers belong, blank nav, missing CTAs)',
  '- Untranslated i18n keys still rendered raw (e.g. "app-nutr-noplan", "{{count}}")',
  '- Text rendering bugs (overlapping copy, white-on-white, "undefined" / "NaN" / "[object Object]" leaking into the UI)',
  '- Critical CTAs invisible (gold buttons gone, missing tab nav)',
  '- Visible error banners (red error boxes, "Something went wrong")',
  '',
  'Return ONLY this JSON shape — no prose, no markdown fences:',
  '{',
  '  "status":  "PASS" | "WARN" | "FAIL",',
  '  "summary": "<one sentence verdict>",',
  '  "issues": [',
  '    { "severity": "low" | "medium" | "high", "description": "<what you saw>" }',
  '  ]',
  '}',
  '',
  'PASS  = nothing notable, ship it.',
  'WARN  = minor cosmetic blemish, not blocking.',
  'FAIL  = a core surface is broken; rollback or hotfix recommended.',
].join('\n');

async function analyzeWithClaude(screenshotBuffer, ctx) {
  const base64  = screenshotBuffer.toString('base64');
  const ctxLine = [
    'Smoke test of ' + (ctx.url || 'production'),
    ctx.commit ? 'after commit ' + ctx.commit.slice(0, 7) : null,
    ctx.ref    ? 'on ' + ctx.ref : null,
    ctx.pusher ? 'pushed by ' + ctx.pusher : null,
  ].filter(Boolean).join(' · ');

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
          { type: 'text',  text: ctxLine },
        ],
      }],
    }, { signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError' || /aborted/i.test(err?.message || '')) {
      throw new Error('anthropic_timeout: model did not reply within ' + ANTHROPIC_TIMEOUT_MS + 'ms');
    }
    throw err;
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

async function postToSlack(webhookUrl, result, ctx) {
  const a     = result.analysis || {};
  const lines = [
    statusEmoji(a.status) + ' *Vision Scout · ' + (a.status || '?') + '* — ' + (a.summary || ''),
    'Commit `' + (ctx.commit || '?').slice(0, 7) + '` on `' + (ctx.ref || '?') + '` by ' + (ctx.pusher || '?'),
    'URL: ' + (result.url || ''),
  ];
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
