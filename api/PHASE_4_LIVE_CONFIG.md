# Phase 4 Live Config — Final Manual Steps

**What this is:** the exact dashboard configuration steps required to activate the closed-loop pipeline shipped in Phase 4 PRs #62–#66. The CODE is fully merged and Render auto-deploys; these are the **one-time** dashboard edits in Render, Zapier, and Brevo that wire the pieces together for live customer flow.

**When to read this:** any time you (or a future session) need to remember why these settings exist or how to reconfigure them.

**Status as of last code change (PR #66):**
- Render server: `/process` and `/provision` endpoints both deployed (V9)
- Supabase: `bbf_active_clients.workout_plan` / `meal_plan` / `plans_generated_at` columns added; `bbf_provision_client_pin` RPC live; `bbf_users.uid` UNIQUE constraint applied
- bbf-app.html: "YOUR PLAN" panel renders on login when plans are present
- Welcome email templates: credentials block + personal-call language removed (in `api/day0-welcome-emails.json` — needs to be copied into Brevo dashboard)

---

## Step 1 — Render: set `BBF_PROVISION_TOKEN` env var

The `/provision` endpoint requires this shared secret. Without it, every `/provision` call returns 503.

1. Generate a long random string locally:
   ```bash
   openssl rand -hex 16
   # Or any 32+ character random string
   ```
2. Render dashboard → `buildbelievefit` service → **Environment**
3. Add env var:
   - Key: `BBF_PROVISION_TOKEN`
   - Value: the random string from step 1
4. Save. Render auto-redeploys (~1-2 min).
5. Save the token value in your password manager — you'll paste it into Zapier in Step 2.

**Verify:**
```bash
# Without token — expect 401 (now that token IS set)
curl -X POST https://buildbelievefit.onrender.com/provision \
  -H 'Content-Type: application/json' -d '{}'
# → {"ok":false,"error":"unauthorized"}
```

If you get 503 instead, the token isn't set or Render hasn't finished redeploying.

---

## Step 2 — Zapier: insert `/provision` step between Stripe and Brevo

Open the existing Zap that catches Stripe payments and routes to Brevo (per `api/webhook-schema.json`).

### 2a. Add a new step
After the Stripe trigger and BEFORE the Brevo step:

- App: **Webhooks by Zapier**
- Action: **POST**

### 2b. Configure the POST

| Field | Value |
|---|---|
| URL | `https://buildbelievefit.onrender.com/provision` |
| Payload Type | `json` |
| Wrap Request in Array | No |

**Data (key/value pairs):**
| Key | Value |
|---|---|
| `customer_email` | `{{stripe.customer_email}}` |
| `customer_name`  | `{{stripe.customer_name}}` |
| `tier`           | `{{stripe.metadata.tier}}` (or derive from amount: 147=gateway, 497=architect, 1500=sovereign) |

**Headers:**
| Key | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-BBF-Token`  | `<the BBF_PROVISION_TOKEN value from Step 1>` |

### 2c. Test the step

Zapier will POST a sample to `/provision`. Expected response on success (HTTP 200):

```json
{
  "ok": true,
  "username": "marcus_bbf",
  "pin": "847291",
  "email": "marcus@example.com",
  "tier": "gateway",
  "app_url": "https://buildbelievefit.fitness/bbf-app.html"
}
```

**Failure responses:**
| Status | Meaning | Fix |
|---|---|---|
| 401 | Token mismatch | Verify `X-BBF-Token` header matches `BBF_PROVISION_TOKEN` on Render exactly |
| 503 | Token not set on Render | Complete Step 1 |
| 409 | Already provisioned | This email already has a `bbf_users` row (idempotent guard). For a real test, use a fresh email |
| 422 | No matching `bbf_active_clients` row | Pathfinder wasn't completed first. Submit Pathfinder, then trigger Stripe |

---

## Step 3 — Brevo: add `USERNAME` and `PIN` template params

In each of the 3 transactional templates (Community / Elite / Legacy):

### 3a. Add params

| Param | Source |
|---|---|
| `USERNAME` | `{{step2.username}}` (from the webhook step's response) |
| `PIN`      | `{{step2.pin}}` |

### 3b. Update template body

Open `api/day0-welcome-emails.json` in the BBF repo. Each tier has 3 language bodies (`en`, `es`, `pt`). Copy the new body content into Brevo, replacing the old body. Key changes:
- Adds a "Your access credentials" block at the top
- Removes "I will personally reach out within 24 hours" / "I will personally call or text you within 12 hours" lines
- Direct phone (`623-340-9254`) preserved in footer for support

In the Brevo template body, replace `{{params.USERNAME}}` and `{{params.PIN}}` references — Brevo will substitute them at send time.

### 3c. Map params in the Zapier Brevo step

In the existing Zapier step that calls Brevo, add the new params to the action config:
- `USERNAME` → `{{step2.username}}`
- `PIN`      → `{{step2.pin}}`

---

## Step 4 — Live smoke test

End-to-end test with a real purchase (use the cheapest tier — Gateway $147):

1. Open `https://buildbelievefit.fitness` in a clean browser
2. Hard reload to pick up SW v17
3. Fill the Pathfinder form with a test email you control (e.g., `your-name+test@yourdomain.com`)
4. Submit — expect to be redirected to Stripe checkout
5. Pay with a real card (or set up a Stripe test mode if preferred)
6. Stripe success → Zapier fires → `/provision` runs → Brevo sends email
7. Check inbox for the welcome email
8. Verify the email contains `Username: <something>_bbf` and a 6-digit PIN
9. Open `https://buildbelievefit.fitness/bbf-app.html`
10. Sign in with the credentials from the email
11. Confirm the "YOUR PLAN" panel appears at the top of the dashboard with the workout + fuel matrix Markdown rendered

If anything breaks, Claude (in a connected session) can verify each link via Supabase MCP:

```sql
-- Did Pathfinder land?
SELECT vault_email, plans_generated_at, length(workout_plan) AS workout_chars
FROM bbf_active_clients
ORDER BY created_at DESC LIMIT 5;

-- Did /provision create the user?
SELECT uid, email, role, created_at::text
FROM bbf_users
ORDER BY (SELECT count(*) FROM bbf_users) DESC
LIMIT 5;

-- Are plans being returned by the auth RPC?
SELECT bbf_verify_user_pin('test_username_bbf', '123456');
-- Should return ok:true, plans_available:true, workout_plan:..., meal_plan:...
```

---

## Troubleshooting cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Welcome email arrives with no Username/PIN | Brevo template params not mapped | Re-do Step 3a + 3c |
| Welcome email shows literal `{{params.USERNAME}}` text | Brevo template body uses wrong syntax | Use `{{params.USERNAME}}` exactly, no `{{stripe....}}` chaining |
| `/provision` returns 422 | Pathfinder wasn't completed before payment | Have customer fill Pathfinder first; check timing |
| `/provision` returns 401 | Token mismatch | Compare Render env var to Zapier header byte-for-byte |
| Customer signs in, no "YOUR PLAN" panel shows | `bbf_users.email` doesn't match `bbf_active_clients.vault_email` | Check Supabase: `SELECT email FROM bbf_users WHERE uid='<their uid>'` vs `SELECT vault_email FROM bbf_active_clients WHERE created_at > NOW() - INTERVAL '1 day'` |
| Customer signs in, panel shows but plans are blank | Render Phase 3 writeback failed silently | Render logs: search for "Phase 3 (writeback) failed". Re-run `/process` manually for that vault_email |
| Two customers share the same `firstname_bbf` | Username collision was handled correctly | Second customer gets `firstname2_bbf` automatically per RPC retry logic |

---

## Why this lives in the repo

- AG (or future Claude sessions) can read this verbatim and pick up the work without re-deriving
- If you forget the token → re-read Step 1
- If a customer reports a broken email → cheatsheet is right here
- If you change the architecture (e.g., move from Brevo to Resend), the diff against this doc is the migration plan

This document supersedes the implicit configuration knowledge that previously lived only in your head and Big Jim's prompts. It's permanent.
