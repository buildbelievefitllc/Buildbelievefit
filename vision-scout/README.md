# vision-scout

Headless smoke-test microservice for Build Believe Fit production
deploys. Receives a GitHub push webhook (or a manual POST), screenshots
the prod URL with Playwright, sends the PNG to Claude for visual UI
review, and forwards the verdict to Slack / Discord plus the server log.

## Endpoints

| Method | Path          | Auth                                  | Purpose                               |
|--------|---------------|---------------------------------------|---------------------------------------|
| GET    | `/health`     | none                                  | Render liveness probe                 |
| POST   | `/scan`       | `Authorization: Bearer $SCAN_API_KEY` | Manual one-off scan · body `{url?}`   |
| POST   | `/smoke-test` | GitHub HMAC SHA-256                   | GitHub push webhook                   |

## Environment variables

| Variable                | Required | Default                                                                | Purpose                                              |
|-------------------------|----------|------------------------------------------------------------------------|------------------------------------------------------|
| `ANTHROPIC_API_KEY`     | yes      | —                                                                      | Claude API key                                       |
| `GITHUB_WEBHOOK_SECRET` | yes\*    | —                                                                      | HMAC secret matching the GitHub webhook config       |
| `SCAN_API_KEY`          | no       | —                                                                      | Bearer token gating `/scan`. Omit for open endpoint  |
| `SLACK_WEBHOOK_URL`     | no       | —                                                                      | Incoming webhook URL · results post here if set      |
| `DISCORD_WEBHOOK_URL`   | no       | —                                                                      | Incoming webhook URL · results post here if set      |
| `PROD_URL`              | no       | `https://buildbelievefit.com`                                          | URL to smoke-test                                    |
| `ALLOWED_HOSTS`         | no       | `buildbelievefit.com,buildbelievefit.onrender.com`                     | CSV of hostnames `/scan` may target                  |
| `VISION_MODEL`          | no       | `claude-sonnet-4-6`                                                    | Override the Claude model id                         |
| `PLAYWRIGHT_TIMEOUT_MS` | no       | `30000`                                                                | Page-load timeout                                    |
| `ANTHROPIC_TIMEOUT_MS`  | no       | `60000`                                                                | Claude API call timeout                              |

\* If `GITHUB_WEBHOOK_SECRET` is unset, the service accepts unsigned
webhooks (logs a warning). Do not deploy without it.

## Render deploy — one-click via Blueprint

1. Push this repo to GitHub.
2. Render dashboard → **New +** → **Blueprint**.
3. Pick this repo. Render reads `render.yaml` at the repo root and
   creates a Web Service named `vision-scout` on the **Starter** plan
   with `vision-scout/` as the root directory, Docker runtime,
   `/health` as the health check path, and auto-deploy on.
4. Fill in `ANTHROPIC_API_KEY` and `GITHUB_WEBHOOK_SECRET` when
   prompted. Add `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` /
   `SCAN_API_KEY` if you want them.
5. Click **Apply**. First build takes ~3 minutes (the Playwright base
   image is ~1.2 GB but Render caches it).

## Render deploy — manual (without Blueprint)

1. **New +** → **Web Service** → connect this repo.
2. Settings:
   - Root Directory: `vision-scout`
   - Runtime: `Docker`
   - Plan: **Starter** ($7/mo). The **Free** plan does NOT have enough
     RAM for Chromium and will OOM mid-launch.
   - Health Check Path: `/health`
   - Auto-Deploy: on
3. Add the env vars from the table above.
4. Deploy.

## Wire up the GitHub webhook

After Render gives you a public URL (e.g. `https://vision-scout.onrender.com`):

1. GitHub repo → **Settings** → **Webhooks** → **Add webhook**.
2. Configure:
   - **Payload URL**: `https://vision-scout.onrender.com/smoke-test`
   - **Content type**: `application/json`
   - **Secret**: same string you set as `GITHUB_WEBHOOK_SECRET`
   - **SSL verification**: enabled
   - **Events**: **Just the `push` event**
3. Save.
4. Push something and watch Render logs for `[scout] start ...`.

## Test it before wiring the webhook

```bash
# 1. Health check
curl https://vision-scout.onrender.com/health
# -> {"ok":true,"ts":...,"model":"claude-sonnet-4-6",...}

# 2. Manual scan
curl -X POST https://vision-scout.onrender.com/scan \
  -H "Authorization: Bearer $SCAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://buildbelievefit.com"}'
```

Expected response (after ~20-40s):

```json
{
  "ok": true,
  "url": "https://buildbelievefit.com",
  "analysis": {
    "status":  "PASS",
    "summary": "Home page renders cleanly with hero, CTAs, and nutrition wheel intact.",
    "issues":  []
  },
  "consoleErrors": [],
  "meta":         { "source": "manual" },
  "duration_ms":  24817
}
```

## Local development

```bash
cd vision-scout
npm install
npx playwright install --with-deps chromium
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Then hit `http://localhost:3000/scan` with the same curl invocation
above (drop the Bearer header if you don't have `SCAN_API_KEY` set).

## Notes on the model

The original directive named "Claude 3.5 Sonnet/Opus". Those ids are
deprecated. This service uses `claude-sonnet-4-6` — the current latest
vision-capable Sonnet, stronger on visual reasoning than the 3.5-era
models. Pin a different id via the `VISION_MODEL` env if needed.

## Cost ceiling

Per smoke test:
- Playwright on Render Starter plan: covered by the $7/mo flat
- Claude Sonnet 4.6 vision call: ~$0.005 (one 1280x2000 PNG + ~500
  output tokens)
- Slack / Discord webhook post: $0

A normal push cadence (a handful per day) sits well under $1/month of
Anthropic spend.

## Error handling

The service hardens four failure modes:
- **Playwright timeout** — page never reaches `networkidle` within
  `PLAYWRIGHT_TIMEOUT_MS`. The browser is closed in a `finally` so no
  zombie processes; the error surfaces as `playwright_timeout: ...`.
- **Anthropic timeout** — model doesn't reply within
  `ANTHROPIC_TIMEOUT_MS`. The request is aborted via `AbortController`;
  the error surfaces as `anthropic_timeout: ...`.
- **Anthropic malformed JSON** — model returns prose instead of the
  expected JSON object. Service returns `status: "UNKNOWN"` with the
  raw first 400 chars so you can debug without burning a re-run.
- **Slack/Discord post failure** — logged, never throws. Smoke test
  still succeeds; you just won't see it in the channel.

For `/smoke-test`, all errors during the async run are caught and
forwarded to the configured notifier with `status: "ERROR"` so the
push doesn't appear to silently pass.
