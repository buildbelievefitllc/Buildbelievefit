# Sentinel Protocol — Setup Guide

This is the manual-provisioning checklist for the **bbf-sentinel** Edge Function: the daily roster audit that posts RED-zone alerts to a Zapier webhook.

The code is already deployed and the cron job is scheduled. What's left are **three manual steps you have to do**: generate a secret, build a Zap, and inject two environment variables. After that the system is fully autonomous.

---

## What's already live

| Component | Status | Location |
|---|---|---|
| Edge Function `bbf-sentinel` | Deployed (version 1, ACTIVE, `verify_jwt: false`) | Supabase project `ihclbceghxpuawymlvgi` |
| Shared audit kernel | Deployed inside the function | `supabase/functions/_shared/intel-core.ts` |
| pg_cron job `bbf-sentinel-daily` | Scheduled, active, schedule `0 8 * * *` (08:00 UTC) | `cron.job` jobid=3 |
| RED-zone payload shape | Locked | See `index.ts → buildWebhookPayload` |

The cron job is **already firing every day at 08:00 UTC** — but until you finish the three steps below, every invocation will return a 401 (silent, harmless).

---

## Step 1 — Generate a `CRON_SECRET`

This is a shared secret between pg_cron (which sends it as an HTTP header) and the Edge Function (which checks it). Anything random and long.

```bash
# Mac/Linux:
openssl rand -hex 32

# Or any 64-char random string of your choice.
```

Keep this value for Step 2. Treat it like a password — anyone with it can manually invoke the audit.

---

## Step 2 — Set the secret in two places

### 2a. In Supabase Edge Function secrets (read by the function)

1. Open the Supabase Dashboard for project `ihclbceghxpuawymlvgi`
2. Sidebar → **Edge Functions** → **Manage Secrets** (or **Project Settings** → **Edge Functions** → **Secrets**, depending on your dashboard version)
3. Click **Add new secret**, set:
   - Name: `CRON_SECRET`
   - Value: *(paste the value from Step 1)*
4. Save

### 2b. In Postgres as a database GUC (read by pg_cron)

1. Supabase Dashboard → **SQL Editor** → New query
2. Paste, replacing `<CRON_SECRET_VALUE>` with the same value:

```sql
ALTER DATABASE postgres SET app.bbf_cron_secret = '<CRON_SECRET_VALUE>';
```

3. Run it.

The GUC is read by pg_cron each time the job fires; it does not require a database restart.

---

## Step 3 — Build the Zap and capture the webhook URL

In Zapier:

1. **Create Zap**
2. **Trigger**: search for **Webhooks by Zapier** → choose **Catch Hook** → continue
3. Zapier shows a **Custom Webhook URL** like `https://hooks.zapier.com/hooks/catch/12345/abcdef/` — **copy this URL**
4. Click **Test Trigger** (optional — Zapier just confirms the endpoint is live; we'll send real data later)
5. **Action**: pick the channel that fits — Slack DM, Email, SMS via Twilio, etc.
6. Map fields from the incoming JSON. The payload looks like this:

```json
{
  "alert_type":   "bbf_sentinel_red_zone",
  "summary":      "🚨 2 athletes in RED zone",
  "audited_at":   "2026-05-04T08:00:00Z",
  "red_count":    2,
  "yellow_count": 1,
  "green_count":  4,
  "dormant_count": 1,
  "athletes": [
    {
      "name":         "Ana",
      "slug":         "ana_bbf",
      "sport":        "football",
      "position":     "skill",
      "acwr":         4.0,
      "acute_load":   4900,
      "chronic_load": 1225,
      "alerts": [
        { "rule": "Mandatory Volume Reduction",         "reason": "ACWR 4.00 exceeds the 1.5 elevated-injury-risk threshold" },
        { "rule": "Micro-Recovery Protocol Violation",  "reason": "1 of 1 ATP-PC bout pair fell below the 3-minute rest minimum" }
      ]
    }
  ]
}
```

   Sample Slack message template:
   ```
   {{summary}} as of {{audited_at}}

   {{#each athletes}}
   • *{{name}}* ({{sport}} / {{position}}) — ACWR {{acwr}}
     Acute: {{acute_load}} AU · Chronic: {{chronic_load}} AU/wk
   {{/each}}
   ```
7. Test the action (Zapier sends sample data). Confirm the message lands in the right destination.
8. **Publish** the Zap.

---

## Step 4 — Set the webhook URL in Supabase

1. Back to Supabase Dashboard → **Edge Functions** → **Manage Secrets**
2. Add:
   - Name: `ZAPIER_WEBHOOK_URL`
   - Value: *(the Catch Hook URL from Step 3.3)*
3. Save

The Edge Function picks up environment changes within a few seconds — no redeploy needed.

---

## Step 5 — Manual smoke test

Verify the entire chain end-to-end without waiting for 08:00 UTC.

### From your terminal:

```bash
curl -i -X POST \
  https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-sentinel \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET_VALUE>" \
  -d '{}'
```

### Expected responses:

- **All secrets set, no athletes in RED zone** → `200 { ok: true, posted: false, red_count: 0, audit_meta: {...} }` (silent — no Zapier post)
- **Athletes in RED + webhook configured** → `200 { ok: true, posted: true, red_count: N, post_status: 200 }` and a Slack/email arrives
- **Wrong/missing `x-cron-secret`** → `401 { ok: false, error: "unauthorized" }`
- **`CRON_SECRET` env var unset** → `500 { ok: false, error: "server misconfigured" }`

### Triggering a real RED-zone event (to verify the Slack message format):

Insert a test session that triggers an ACWR breach. The same E2E pattern from Phase 8 works:

```sql
-- Pick a real athlete UUID
SELECT id FROM public.bbf_users WHERE uid = 'jordan_bbf';

-- Insert 7 spike-week logs (700 AU each = ACWR 4.0 trigger)
INSERT INTO public.bbf_athlete_load_logs (athlete_id, session_timestamp, session_type, duration_minutes, srpe_intensity)
SELECT '1cbe0073-d515-49d3-b18d-3ab2059ba141',
       date_trunc('day', now() AT TIME ZONE 'UTC') - (g || ' days')::interval + interval '14 hours',
       '__sentinel_smoke__', 70, 10
FROM generate_series(0, 6) g;
```

Curl the function (Step 5 above) — you should see Jordan in the alert.

Cleanup:

```sql
DELETE FROM public.bbf_athlete_load_logs WHERE session_type = '__sentinel_smoke__';
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Cron fires but Zapier never gets a POST | `red_count` was 0 (silent operation by design) | Insert RED-zone test data and re-curl |
| Curl returns `401 unauthorized` | `CRON_SECRET` mismatch | Re-check Step 2a; the secret must match exactly |
| Curl returns `500 server misconfigured` | `CRON_SECRET` env var unset | Step 2a |
| Function logs say "ZAPIER_WEBHOOK_URL is unset" | Step 4 not done | Step 4 |
| pg_cron job fires but pg_net response shows 401 | `app.bbf_cron_secret` GUC unset or mismatched | Step 2b |
| Want to run manually outside the cron schedule | That's the curl in Step 5 — fully supported via the same auth header |

### Reading the Edge Function logs:

Supabase Dashboard → Edge Functions → `bbf-sentinel` → Logs tab. Filter by `[bbf-sentinel]` prefix to see only this function's structured logs.

### Inspecting cron job history:

```sql
SELECT runid, jobid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'bbf-sentinel-daily')
ORDER BY start_time DESC
LIMIT 10;
```

---

## What changes if you want to adjust the schedule

The cron expression `0 8 * * *` lives in `cron.job` row `bbf-sentinel-daily`. Change it via:

```sql
SELECT cron.alter_job(
  job_id    := (SELECT jobid FROM cron.job WHERE jobname = 'bbf-sentinel-daily'),
  schedule  := '0 14 * * *'  -- e.g. 14:00 UTC instead
);
```

Or pause it temporarily:

```sql
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'bbf-sentinel-daily'),
  active := false
);
```

Re-enable with `active := true`.
