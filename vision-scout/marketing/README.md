# marketing · Multi-Agent Outbound Engine

Native Express module mounted at `/api/v1/marketing` inside the
vision-scout Render service. Backs the `public.bbf_outbound_athletes`
table in the BBF Supabase project (`ihclbceghxpuawymlvgi`).

## Agents

| File                       | Agent                         | Route                                | Purpose                                                       |
|----------------------------|-------------------------------|--------------------------------------|---------------------------------------------------------------|
| `agents/scout.js`          | 1 · Target Scout              | `POST /ingest`                       | Upsert leads by email · safe re-ingest preserves funnel state |
| `agents/analyst.js`        | 2 · Performance Analyst       | `POST /analyze`                      | Pulls `status=raw` batch, generates pitch via Gemini, → `analyzed` |
| `agents/dispatcher.js`     | 3 · Dispatcher                | `POST /dispatch`                     | Pulls `status=analyzed` batch, sends via Resend, → `contacted`   |
| `agents/triage.js`         | 3 · Triage Engine             | `POST /inbound`                      | Public webhook · classifies intent + drafts reply + CEO alert  |
| `agents/unsubscribe.js`    | Compliance · One-Click Unsub  | `GET/POST /unsubscribe?t=<token>`    | RFC 8058 one-click · flips status to `unsubscribed`            |

## Auth

| Route                 | Auth                                                        |
|-----------------------|-------------------------------------------------------------|
| `/ingest /analyze /dispatch` | `Authorization: Bearer $BBF_MARKETING_ADMIN_TOKEN` |
| `/inbound`            | Public · webhook (TODO: verify Resend signature when configured) |
| `/unsubscribe`        | Token in `?t=` query is the auth                            |
| `/health`             | Public · env wiring snapshot, no secrets revealed           |

## Environment variables

| Variable                    | Required | Purpose                                                   |
|-----------------------------|----------|-----------------------------------------------------------|
| `GEMINI_API_KEY`            | yes      | Pitch generation + intent triage + reply drafting         |
| `GEMINI_MODEL`              | no       | Defaults to `gemini-3.5-flash`                            |
| `RESEND_API_KEY`            | yes      | Outbound dispatch via `resend` npm package                |
| `SUPABASE_URL`              | yes      | Project URL                                               |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | Bypass RLS on `bbf_outbound_athletes`                     |
| `BBF_MARKETING_ADMIN_TOKEN` | yes      | Bearer token gating admin worker routes                   |
| `BBF_FROM_NAME`             | no       | Default `Akeem Brown`                                     |
| `BBF_FROM_EMAIL`            | no       | Default `akeem@buildbelievefit.fitness`                   |
| `BBF_REPLY_TO`              | no       | Default same as `BBF_FROM_EMAIL`                          |
| `BBF_BUSINESS_ADDRESS`      | no       | CAN-SPAM footer · physical mailing address                |
| `BBF_UNSUB_BASE_URL`        | yes      | Public base URL for unsub links · e.g. `https://vision-scout.onrender.com` |

## Quickstart (after Render env is set)

```bash
ADMIN="<BBF_MARKETING_ADMIN_TOKEN>"
BASE="https://vision-scout.onrender.com/api/v1/marketing"

# Confirm wiring
curl "$BASE/health"

# Ingest
curl -X POST "$BASE/ingest" \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
  -d '{"leads":[{
    "athlete_name":       "Sample Athlete",
    "email":              "sample@example.com",
    "discipline":         "Hybrid Athlete",
    "public_profile_url": "https://strava.com/athletes/xxxx",
    "performance_notes":  "5K stuck at 18:30 for 6 weeks. Squat 1RM static 365lb x 8 weeks."
  }]}'

# Analyze the batch (default size 5)
curl -X POST "$BASE/analyze" \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{}'

# Dispatch the batch (will actually email)
curl -X POST "$BASE/dispatch" \
  -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{}'
```

## Wire the Resend inbound webhook

Resend dashboard → Webhooks → Add endpoint
- URL: `https://vision-scout.onrender.com/api/v1/marketing/inbound`
- Events: at minimum `email.received` (their inbound reply event)

## Operational notes

- Status transitions are append-only in spirit · the dispatcher only
  pulls `status='analyzed'`, never re-sends.
- `last_error` on each row carries the most recent worker failure for
  retry triage. `null` once the next run succeeds.
- `unsubscribe_token` is generated on row insert (column default) so
  every lead has a working unsub link before the dispatcher fires.
- Drafted replies (`draft_reply` column) are NEVER sent automatically ·
  the CEO sends manually after reviewing the alert.
