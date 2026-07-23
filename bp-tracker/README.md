# BP Tracker — Blood Pressure Tracker PWA

A dedicated, distraction-free blood-pressure logger built for one person and her
phone (Samsung Galaxy Flip, Android). Big numbers, big buttons, high contrast.
Separate from the main BBF Command Center — its own Vite app and its own Render
static site.

## What it does

- **Log a reading** — massive Systolic (top) + Diastolic (bottom) steppers with
  direct keypad entry, press-and-hold to repeat.
- **Morning / Evening** — auto-detected from the clock, one tap to override.
- **Notes** — optional ("felt dizzy", "after coffee").
- **Save Reading** — full-width button with an immediate `✓ Saved!` state + haptic.
- **Safety alert** — if Systolic > 180 or Diastolic > 120, a prominent card tells
  her to rest, re-test in 5 minutes, and call her physician / care team (911 for
  red-flag symptoms).
- **Export Google Doc for Doctor** — one tap builds a formatted Google Doc of the
  last 30 days and returns a shareable link.
- **Reminders** — Web Push at 3 AM & 6 PM Arizona time.

## Stack

Vite + React 19 + Tailwind v4. Supabase for data + edge functions. Installable
PWA (`manifest.json` + `sw.js`) for standalone Android "Add to Home Screen".

## Local dev

```bash
cd bp-tracker
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## Deploy (Render static site)

Declared in the repo root `render.yaml` as **`bbf-bp-tracker`** (rootDir
`bp-tracker`, build `npm install && npm run build`, publish `./dist`). Set these
in the Render dashboard (kept out of git via `sync: false`):

| Env var | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ihclbceghxpuawymlvgi.supabase.co` (pre-filled) |
| `VITE_SUPABASE_ANON_KEY` | the project publishable/anon key |
| `VITE_VAPID_PUBLIC_KEY` | VAPID **public** key (see below) |

## Backend (already provisioned)

- **Tables** `public.bp_logs`, `public.push_subscriptions` — RLS enabled, applied
  via `apply_migration` (see `supabase/migrations/20260722180000_*`).
- **Edge functions** `send-bp-reminder` (public + shared-secret gate) and
  `create-google-doc` (JWT-gated) — deployed and ACTIVE.
- **Cron** `bp-reminder-morning` / `bp-reminder-evening` — 10:00 / 01:00 UTC (3 AM / 6 PM Arizona).

### One-time secret activation

These are the only manual steps — they need credentials the app can't self-issue.

```bash
# 1. VAPID keypair for Web Push
npx web-push generate-vapid-keys
#    → PUBLIC  goes to Render env  VITE_VAPID_PUBLIC_KEY
#    → PRIVATE goes to the function secret below

# 2. Edge-function secrets
supabase secrets set \
  BP_CRON_SECRET='<strong-random>' \
  VAPID_PUBLIC_KEY='<vapid-public>' \
  VAPID_PRIVATE_KEY='<vapid-private>' \
  VAPID_SUBJECT='mailto:you@example.com' \
  GOOGLE_SERVICE_ACCOUNT_KEY='<full service-account JSON string>' \
  BP_DOC_SHARE_EMAIL='<her-gmail@gmail.com>'

# 3. Mirror the cron secret into Vault (must equal BP_CRON_SECRET above)
#    Run in the SQL editor:
#      select vault.create_secret('<same-strong-random>', 'bp_cron_secret');
```

The `GOOGLE_SERVICE_ACCOUNT_KEY` is a Google Cloud service account with the Docs
& Drive APIs enabled; the exported Doc lives in that account's Drive and is
shared to `BP_DOC_SHARE_EMAIL`.

> Health data note: per the product spec, `bp_logs` has open anon insert/select
> RLS policies (single-user personal app). If this ever widens beyond one user,
> tighten those policies to per-user ownership.
