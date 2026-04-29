# BIG JIM V12 DIRECTIVE — Reference / Vision Doc

**Source:** Pasted by Akeem (architect/founder) on 2026-04-29. Authored by "Big Jim, the auditor" — a separate AI agent the user has used to spec the BBF system.

**Status:** Reference only. This document captures the founder's V12 vision and Big Jim's audit framing. It does **not** describe the current production state — see "Reality reconciliation" at the end and the audit docs (`SCHEMA_DRIFT_REPORT.md`, `RLS_HARDENING_AUDIT.md`, `SYNC_REROUTE_DESIGN.md`) for what's actually shipped.

**Why this is in the repo:** so AG and any future Claude session has the founder's full V12 vision in a permanent, version-controlled artifact — not buried in chat history.

---

## Big Jim's directive (verbatim)

> ### CLAUDE CODE CLI DIRECTIVE: THE BBF SOVEREIGN ENGINE (V12)
>
> **SYSTEM ROLE:** You are the Lead Technical Foreman for the Build Believe Fit (BBF) Vault. You are operating under the direct command of the Architect (Akeem). You do not ask for permission to be efficient; you execute clinical, sovereign architecture. The app aesthetic is pure matte black, minimalist, and dead-pan.
>
> ### THE V12 ARCHITECTURE STACK
>
> - **Frontend:** React Native app featuring the "Phantom Eye" Viewport and "Sovereign Sentinel" wearable sync.
> - **Database:** PostgreSQL hosted on Supabase.
> - **The Event Highway:** Native Zapier integrations listening directly to Supabase row changes.
> - **The Intelligence:** Anthropic (Claude) API hard-coded for markdown injection.
> - **The Outbound Voice:** Vapi AI connected for autonomic accountability triage.
> - **The Server (Legacy/Custom Logic):** Node.js hosted on Render.
>
> ### THE CLINICAL LAWS (IMMUTABLE)
>
> 1. All hypertrophy resistance training is strictly mathematically bound to **exactly 85% of the 1 Repetition Maximum (1RM)**. Do not hallucinate generic rep ranges.
> 2. The baseline fuel matrix is **2800 calories** relying purely on whole foods, bound to a **12/12 flexible intermittent fasting** window.
> 3. **DATA PRESERVATION ZERO:** Under no circumstances will you execute a database migration or schema update that jeopardizes the existing Alpha Roster (e.g., Ana, Jacky, Suzanna). You must verify data safety before executing `git push` or Supabase syncs.
>
> ### IMMEDIATE AUDIT & UPGRADE DIRECTIVES
>
> **1. AUDIT — The Zapier-Supabase Handshake**
> - Review the current Supabase schema. Ensure that the incoming Pathfinder client data triggers a clean, structured JSON payload that Zapier can instantly catch without middleware failure.
> - Verify that the `workout_plan` and `meal_plan` columns are strictly formatted to accept direct Markdown injections from the Anthropic API.
>
> **2. UPGRADE — Deprecating the Middlemen (V8 → V12)**
> - Scan the existing Node.js / Render server codebase. Identify any legacy custom webhooks, Tally parsers, or redundant API routes that were previously used to catch client forms.
> - Refactor the repository to strip out this dead weight, shifting the event-trigger responsibility entirely to the new Supabase → Zapier native pipeline to reduce server latency.
>
> **3. AUDIT — Phantom Eye & Wearable Sync Lockouts**
> - Review the React Native frontend logic and Supabase triggers. If a client's imported wearable data shows a severe ACWR (Acute:Chronic Workload Ratio) spike, or if they miss a 48-hour logging window, ensure the logic successfully triggers the **"RED — LOCKOUT ACTIVE"** state.
>
> **4. UPGRADE — The Vapi Payload**
> - Review the webhook sending data to Vapi. Upgrade the payload so that when Vapi makes an outbound call, it has direct, real-time access to the client's last logged workout tonnage and fasting adherence, allowing the voice AI to speak with absolute clinical context.
>
> ### EXECUTION COMMAND
>
> Read the current local directory, analyze the `package.json`, `supabase/migrations`, and core app files. Report back with a localized map of the dead code we can cut today, and prepare the first Zapier-Supabase integration script.

---

## Reality reconciliation (Claude's clear-eyed audit, 2026-04-29)

Big Jim's directive describes a vision (V12). Production today is somewhere short of that vision. Below is what's actually shipped vs. what Big Jim describes, so AG and future sessions don't accidentally rebuild what exists or assume something exists when it doesn't.

| Big Jim claim | Production reality | Status |
|---|---|---|
| **React Native frontend** | Vanilla HTML/JS — `bbf-app.html`, `admin.html`, `coach-lab.html`, hosted on GitHub Pages → buildbelievefit.fitness | **Aspirational / parallel workstream.** No RN code in this repo. |
| **PostgreSQL on Supabase** | Project `ihclbceghxpuawymlvgi` (bbf-lab), Postgres 17.6 | **Real ✓** |
| **Native Zapier on Supabase row changes** | One trigger exists: `bbf_sets` AFTER INSERT/UPDATE/DELETE → `hooks.zapier.com/.../ujsukew/`. Plus `bbf_active_clients` lead webhook with anon-INSERT policy. | **Partially real.** No native Pathfinder/onboarding pipeline yet. |
| **Anthropic Claude API for markdown injection** | Not seen in current code | **Not built.** No `workout_plan` or `meal_plan` columns exist. |
| **Vapi AI outbound voice** | Not seen in current code | **Not built.** |
| **Node.js on Render** | `index.js` uses `@supabase/supabase-js` and looks like a server entry point. Likely the Render app. Handles `bbf_active_clients` lead-capture webhook. | **Real ✓** (one route confirmed) |
| **85% 1RM hypertrophy law** | Reference protocols in `bbf-data.js` — would need a deeper read to confirm 85% rule is encoded everywhere | **Unverified.** Likely partially encoded. |
| **2800 cal whole foods 12/12 IF** | `bbf_users.metabolic_tier DEFAULT '12:12 Foundation'` confirmed in production schema | **Partially real.** Calorie matrix not surfaced as a column. |
| **Alpha Roster (Ana, Jacky, Suzanna)** | Production `bbf_users` has only `akeem` (post-Phase 3 P3 cleanup). The 5 client SEEDS (`ana_bbf`, `jacky_bbf`, `suzanna_bbf`, `jordan_bbf`, `wayne_bbf`) live as a JS object inside `bbf-app.html` LOGIN flow — they get auto-seeded into `localStorage` when those usernames first log in. Never synced to cloud. | **localStorage-only.** Big Jim's "preservation" mandate translates to: **don't break the SEEDS object in `bbf-app.html`** — that's where the roster lives. |
| **Phantom Eye / Sovereign Sentinel / wearable sync** | Legacy fiction-file `bbf-app.html` references `last_video_check_status`, `video_critique_pins`, `somatic_*`, `cns_friction_score`, etc. Most of these columns **do not exist** in production (drift report D1). | **Aspirational.** Legacy schema talked about them; production never had them. |
| **ACWR (Acute:Chronic Workload Ratio) lockouts** | Not seen in current code | **Not built.** The only "lockout" logic in production is the auth-PIN lockout via `bbf_pin_attempts` (Phase 2). |

---

## How Big Jim's directives map to the current Phase plan

### Already done in Phase 3 (this session)

- ✅ Auth foundation hardened: bcrypt PINs, IP/uid lockout, 6-digit PIN length aligned across all surfaces (#51, #58)
- ✅ Schema-truth captured, drift catalogued, migration plumbing in place (`supabase/migrations/`) (#52, #53, #54)
- ✅ RLS hardened: all 7 public tables now lock anon access (#56)
- ✅ Service worker audit + offline timeouts + cache-bump convention (#57)
- ✅ Dead code cleanup: `clinical_yield_log` refs, NULL-uid admin row, duplicate listeners (#55, #59)
- ✅ Phase 4 design captured: Option A (PIN-only, trainer-curated onboarding) ratified

### Next phase (Phase 4 — sync re-route, Option A)

- Build SECURITY DEFINER RPCs for the ~30 broken anon-key calls in `bbf-sync.js` so cloud sync actually works
- Trainer-onboarding flow in `admin.html` (creates client rows server-side)
- Tracked in `api/SYNC_REROUTE_DESIGN.md` (file currently has the deprecated Option B as the recommendation; needs updating to Option A — see follow-up below)

### Phase 5+ — Big Jim's V12 directives slot in here

| Big Jim directive | Slots into | Notes |
|---|---|---|
| 1. Audit Zapier-Supabase handshake | **Phase 5a** | After Phase 4 RPCs land. Need to add `workout_plan` + `meal_plan` columns to `bbf_users` (or a new `bbf_plans` table) and define the Pathfinder JSON payload schema. |
| 2. Deprecate middleware (Tally parsers, redundant routes) | **Phase 5b** | Audit `index.js` (Render server) for legacy routes. Strip out anything that the new Supabase→Zapier native pipeline replaces. |
| 3. Phantom Eye / wearable sync / ACWR lockouts | **Phase 6** | This is the big feature work. Requires: schema for wearable data, ACWR calc logic (Postgres function or app-side), the RED-LOCKOUT state machine. The auth lockout (`bbf_pin_attempts`) is a different lockout — these are unrelated. |
| 4. Vapi payload upgrade | **Phase 7** | After Phase 6 wearable data lands so Vapi has tonnage + fasting context. |

---

## Conflicts and clarifications worth flagging

### 1. Option A vs Big Jim's "no friction"

Big Jim's directive doesn't explicitly mention auth, but the user has separately ratified **Option A (PIN-only, trainer-curated)** for client onboarding — see `api/SYNC_REROUTE_DESIGN.md` (which currently recommends Option B and needs to be updated to reflect the user's actual choice). No conflict with Big Jim's V12 vision; just a clarification that Option A is the path.

### 2. "Data Preservation Zero" — Alpha Roster

Big Jim says "don't jeopardize Ana, Jacky, Suzanna." Production has none of those rows — they live in `bbf-app.html`'s SEEDS object. **Translation for AG:** any rewrite of `bbf-app.html`'s LOGIN flow must preserve the SEEDS object so users with those usernames continue to get auto-seeded localStorage profiles on first login. Future cloud sync work (Phase 4) should also explicitly create cloud rows for those usernames if/when they sign in for the first time.

I (Claude) only deleted one row in the recent cleanup: the **NULL-uid admin** row (no name, no uid, role='admin'). That's not part of any Alpha Roster — it was a vestigial test artifact. Verified safe.

### 3. React Native vs current HTML/JS

Big Jim's V12 stack says React Native. The repo is HTML/JS. AG should treat this as: the HTML/JS app is V11 (current production), and a React Native rewrite is V12 (future). Don't migrate prematurely. The Phase 4 sync re-route works for V11 and lays the foundation that V12 RN can also use (the same RPCs work from any frontend).

### 4. "Workout_plan" / "meal_plan" Markdown columns

Big Jim's directive 1 says verify these columns accept Markdown from the Anthropic API. **They don't exist yet.** Production `bbf_users` has no `workout_plan` or `meal_plan` columns. This is a Phase 5a task: add the columns via migration, then wire the Anthropic injection. Don't pretend they exist.

### 5. ACWR lockout vs auth lockout

Big Jim's directive 3 says "trigger the RED-LOCKOUT ACTIVE state" for ACWR spikes. The only "lockout" we currently have is the **auth lockout** in `bbf_pin_attempts` for failed PINs. These are different state machines and should not be conflated. ACWR lockouts are a Phase 6 feature requiring new schema (wearable data tables) and new logic (workload ratio computation).

---

## Recommended next step (post-this-doc-merge)

Two parallel tracks:

1. **Phase 4 sync re-route, Option A.** Update `api/SYNC_REROUTE_DESIGN.md` to reflect Option A as the ratified direction (currently has Option B). Then begin RPC-by-RPC rewrites. AG owns implementation, Claude applies migrations via MCP.

2. **Phase 5a kickoff design.** Once Phase 4 lands, AG drafts a design doc for the Zapier-Supabase native pipeline + Pathfinder JSON schema + Anthropic markdown injection (Big Jim's directive 1). User ratifies, then builds.

Big Jim's directives 3 and 4 (Phantom Eye, Vapi) are sequenced behind 1+2 because they depend on the wearable schema and the cloud sync working.

---

## File provenance

This document was created on 2026-04-29 by Claude during the Phase 3 hardening session, immediately after the founder pasted Big Jim's directive into the conversation. The user requested it be saved to the repo as a permanent reference rather than left in chat history.
