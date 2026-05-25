# BBF · Engineering Passover · 2026-05-25

You're picking up the Build Believe Fit codebase mid-flight. **Read this file end-to-end before touching code.** Then read `api/BBF_MASTER_PLAN.md`. Then ask Akeem what to attack.

---

## Mission in one paragraph

Build Believe Fit (BBF) is a fitness-coaching PWA + multi-agent AI backend run by Akeem Brown (founder, sole operator). The app lives at https://buildbelievefit.fitness as a static PWA, backed by Supabase Postgres + 25+ Supabase edge functions + a Node.js Express service on Render called `vision-scout` that hosts a Playwright smoke-test surface AND the new outbound marketing engine. Two parallel email systems exist: System 1 (Brevo · inbound lead recovery via `bbf-lead-concierge`) and System 2 (Resend · outbound athlete cold-pitch via `vision-scout/marketing/*`). Multiple AI agents have edited this codebase — Akeem coordinates them but warns context loss across sessions is real. Always confirm state from code/database, never from memory.

---

## System state right now (snapshot · 2026-05-25)

| Layer | What's running |
|---|---|
| **Main app** | `bbf-app.html` (22k-line monolith) on GitHub Pages at buildbelievefit.fitness |
| **Database** | Supabase project `ihclbceghxpuawymlvgi` ("bbf-lab"), ACTIVE_HEALTHY, us-east-1 |
| **Edge functions** | 25 deployed (21 in repo, 2 deployed-not-in-repo — see "Known gotchas") |
| **Render service** | `vision-scout` · Docker · Starter plan ($7/mo, 512 MB) · autoDeploy from main |
| **Marketing engine** | Live · /api/v1/marketing/* on vision-scout · daily cron 14:00 UTC |
| **Concierge** | Live · `bbf-lead-concierge` edge fn · daily pg_cron at 09:00 UTC |
| **Domains** | buildbelievefit.fitness · DKIM/SPF/DMARC verified on Resend + Brevo |

---

## Active git state

- **Default branch:** `main` (production)
- **Active feature branch (this session 2026-05-25 cont.):** `claude/dazzling-fermat-eVFBH`
- **Prior feature branch:** `claude/gallant-pascal-11d8p` (FF-merged on 2026-05-25)
- **Workflow established:** commit on feature branch → push → checkout main → pull → FF-merge feature → push main → checkout back to feature. Akeem authorized this workflow explicitly. NO force pushes. NO direct commits to main without going through the FF flow.
- **Recent commits (most recent first):**
  - `6db5afb` feat(marketing): observability backbone + timing-safe admin auth (Phase 0.1 hardening · Phase 0.2 complete)
  - `70d86d8` docs: master plan + canonical passover for "superior service" track
  - `3186acb` fix(marketing/triage): self-service `/join` close
  - `f878aaf` feat(marketing): autonomous orchestration · scout engine + node-cron + run-orchestrator route
  - `a3243f6` fix(marketing): real from-address · buildbelievefitllc@buildbelievefit.fitness
  - `86cb670` fix(marketing/dispatcher): correct CEO test override email
  - `28dfeba` feat(marketing/dispatcher): pitch subject/body split + CEO test override
  - `046fb17` perf(vision-scout): low-RAM Chromium flags per CEO directive

---

## Architecture map · where things live

```
/                                  # Repo root (GitHub Pages static + sources)
├── bbf-app.html                   # ⚠ 22k-line monolith · the main PWA
├── sw.js                          # Service worker · cache version bump REQUIRED on bbf-app.html changes
├── render.yaml                    # Render Blueprint at root (don't move)
├── meal-data.js / kfh-*.js        # Misc engines · audit before touching
├── api/                           # AI agent docs + handoff briefs (this file lives here)
│   ├── BBF_MASTER_PLAN.md         # ⭐ The roadmap · read second
│   └── BBF_PASSOVER_2026_05_25.md # ⭐ This file · read first
├── supabase/
│   ├── migrations/                # All schema changes · NEVER edit applied migrations
│   └── functions/
│       ├── _shared/               # model-router.ts · shared deps
│       ├── bbf-*/                 # 21 edge functions · each is a deno module
│       └── (bbf-lead-concierge)   # ⚠ DEPLOYED but NOT in repo · see gotchas
└── vision-scout/                  # Render Express service
    ├── server.js                  # Boot + Playwright smoke-test routes + cron registration
    ├── package.json
    ├── Dockerfile                 # FROM mcr.microsoft.com/playwright:v1.48.0-jammy
    ├── README.md                  # Vision Scout ops
    └── marketing/                 # ⭐ The outbound marketing engine
        ├── router.js              # Mounts at /api/v1/marketing
        ├── orchestrator.js        # 24h cron chain · scout → analyze → dispatch
        ├── db.js                  # Supabase service-role client · lazy init · WS transport
        ├── gemini.js              # gemini-3.5-flash wrapper · thinking disabled · multi-part text
        ├── resend.js              # Resend npm wrapper · RFC 8058 List-Unsubscribe
        ├── README.md              # Marketing engine ops
        ├── sources/
        │   └── seed-leads.json    # Operator-maintained lead seed file
        └── agents/
            ├── scout.js           # Agent 1 · /ingest handler
            ├── scout-engine.js    # Agent 1 · pluggable-source ingest worker
            ├── analyst.js         # Agent 2 · pitch generation · runBatch() exposed
            ├── dispatcher.js      # Agent 3a · Resend send · runBatch() exposed
            ├── triage.js          # Agent 3b · /inbound · intent + draft_reply
            └── unsubscribe.js     # Compliance · one-click unsub
```

---

## Database schema · key tables

| Table | Purpose | RLS |
|---|---|---|
| `bbf_users` | Paid clients | (check) |
| `bbf_active_clients` | Pathfinder intake (in-progress) | (check) |
| `bbf_leads` | Inbound site form captures (Brevo Concierge target) | (check) |
| `bbf_outbound_athletes` | Outbound prospects (Resend Marketing target) ⭐ | service_role only ✓ |
| `bbf_lead_actions` | Brevo Concierge audit log + 14-day cooldown | (check) |
| `bbf_meal_macros` | LLM-generated macros + meal photo URLs | read-all / svc-write |
| `bbf_meal_logs` | Client's logged meals | (check) |
| `bbf_vapi_calls` | Vapi voice-call audit log | (check) |
| `bbf_email_suppression` | ❌ Not yet built · Phase 1.1 in master plan |
| `bbf_email_events` | ❌ Not yet built · Phase 1.2 (Resend webhooks) |
| `bbf_agent_runs` | ✅ Phase 0.2 shipped · commit `6db5afb` 2026-05-25 · service_role only |
| `bbf_llm_calls` | ✅ Phase 0.2 shipped · commit `6db5afb` 2026-05-25 · service_role only |
| `bbf_prompts` | ❌ Not yet built · Phase 2.1 (prompt registry) |
| `bbf_events` | ❌ Not yet built · Phase 4.4 (frontend telemetry) |

Email is the de facto user key but isn't a foreign key anywhere. Three+ tables key by email without referential integrity. Master plan Phase 0.4 documents this.

---

## Conventions (follow these)

### Branching
- Production: `main`
- Feature branch this session: `claude/gallant-pascal-11d8p`
- Workflow: commit feature → push → checkout main → pull → `git merge --ff-only <feature>` → push main → back to feature

### Commit messages
- Format: `type(scope): one-line summary` then blank line then detailed body
- Types observed: `feat`, `fix`, `refactor`, `perf`, `harden`, `diag`
- Scopes observed: `nutrition`, `marketing`, `marketing/dispatcher`, `marketing/triage`, `vision-scout`, `marketing/analyst`
- Body uses bullet points · explains WHY, not just WHAT
- Do NOT include AI-generated attribution strings, Claude/Gemini model IDs, or "🤖 Generated by..." footers in commit messages
- Do NOT include co-authored-by lines unless explicitly requested

### Deploys
- Push to `main` → Render auto-deploys vision-scout (~2-3 min including Docker rebuild)
- Push to `main` → GitHub Pages serves bbf-app.html / sw.js / other static files
- Supabase edge functions: deployed via MCP `deploy_edge_function` OR Supabase CLI · NOT auto-deployed from git
- Supabase migrations: applied via MCP `apply_migration` OR Supabase CLI · NOT auto-applied
- `render.yaml` values DO NOT auto-overwrite already-set Render env vars · manual env edits in Render dashboard required for changes

### Code style
- ESM in vision-scout (package.json `"type": "module"`)
- TypeScript in Supabase edge functions
- 2-space indent (mostly)
- Verbose top-of-file docstring explaining what the module does, why decisions were made, what the failure modes are
- Comments explain WHY, not WHAT
- No new dependencies without justification

### Service worker
- `sw.js:18` `var CACHE = 'bbf-vXXX'` MUST be bumped on every bbf-app.html / styles / JS change
- Auto-bumping is in Master Plan Phase 4.1

---

## Tools available to AI agents

If you have access to the same MCP setup as the previous Claude session:

- **Supabase MCP** (`mcp__3ff67aec-*`): full project access · `list_tables`, `execute_sql`, `apply_migration`, `deploy_edge_function`, `get_edge_function`, `get_logs`, `get_publishable_keys`, etc. Use this freely for queries; be careful with `apply_migration` and `deploy_edge_function` (production writes).
- **GitHub MCP** (`mcp__github_*`): scoped to `buildbelievefitllc/buildbelievefit`. Available when MCP server is connected (sometimes disconnects mid-session).
- **Bash tool**: shell access, but outbound HTTP to render.com / supabase.co URLs is BLOCKED by the sandbox. Use `net.http_post` via Supabase MCP `execute_sql` to invoke endpoints from Postgres instead.
- **Web fetch / search**: limited, use only when necessary.

Loading tools: many MCP tools are "deferred" — schema is hidden until you call `ToolSearch` with `select:<name>`. The first call costs nothing; load tools as you need them.

---

## Known gotchas (these have bitten us)

1. **`bbf-lead-concierge` and `bbf-user-profile`** are deployed Supabase edge functions that **do NOT exist in `supabase/functions/`**. If you need to read or modify them, pull source via `mcp__supabase__get_edge_function`. Master Plan 0.3 imports them properly.

2. **Service worker cache version (`sw.js:18`)** must be bumped manually on every bbf-app.html change. Forgetting this caused the Nutrition Wheel bug to persist across multiple deploys. Master Plan 4.1 + 5.3 automate this.

3. **`render.yaml` does not overwrite existing env vars in Render.** New values in render.yaml require manual env edits in Render's UI for changes to take effect. New keys DO get added on Blueprint re-apply (sometimes).

4. **Supabase service role key is set per-process at boot.** If you add an env var to Render and the process is already running, the marketing module's `db.js` will report `sb_client_built:false`. Lazy re-init covers this (commit cd4cac4), but a restart is still cleaner.

5. **Gemini 3.x has implicit thinking tokens** that count against `maxOutputTokens`. Disable with `thinkingConfig:{thinkingBudget:0}` (done in vision-scout/marketing/gemini.js).

6. **supabase-js@2.45+ on Node 20** requires the `ws` package passed as `realtime.transport`. Without it, `createClient` throws at construction time. Fixed in vision-scout/marketing/db.js · commit c9a7910.

7. **Playwright `--single-process` flag is fragile.** Currently in vision-scout/server.js per CEO directive. May cause blank screenshots; if Vision Scout starts misbehaving, this flag is the first suspect.

8. **The `BBF_MARKETING_ADMIN_TOKEN` was leaked** — the original value was pasted in a Claude session transcript on 2026-05-24. As of commit `6db5afb` (2026-05-25), the auth middleware uses SHA-256 + `crypto.timingSafeEqual` so a leaked-prefix attack is moot — but the full rotation (paste new value into Render dashboard) is still required to fully close Master Plan 0.1. The new token is held in chat; mark 0.1 `[x]` only after the Render env var is updated AND the old token returns 401.

9. **The CEO test override email is hardcoded** in `vision-scout/marketing/agents/dispatcher.js`. `bbf_test_lead@bbf-marketing-sentinel.dev` routes to `akeemkbrown@gmail.com`. Production lead emails are untouched, but this hardcode should be env-driven eventually.

10. **`bbf-app.html` has multiple inline event handlers** (`onclick="..."`) that reference global functions. When refactoring (Master Plan Phase 4), do not silently remove globals without verifying every onclick.

11. **Outbound HTTP from this sandbox to `vision-scout.onrender.com` is BLOCKED.** Use `net.http_get` / `net.http_post` from Supabase SQL via the MCP `execute_sql` tool. Pattern: fire `select net.http_get(url := '...', timeout_milliseconds := 15000) as request_id`, wait ~5-10s, then `select status_code, content::text from net._http_response where id = <request_id>`. For POSTs with auth, pass `headers := '{"Authorization":"Bearer ..."}'::jsonb`. `pg_net` is at version 0.20.0; `pg_cron` 1.6.4.

12. **Telemetry can be disabled per-process via `BBF_TELEMETRY_DISABLED=true`.** Use this for local/dev runs that should not write to `bbf_agent_runs` / `bbf_llm_calls`. Default (env unset or anything other than `"true"`) is ENABLED. Telemetry writes are always try/catch-wrapped — a Supabase outage degrades gracefully (warns to console, swallows the error) so the outbound mail path stays healthy.

13. **Phase 0.2 telemetry is Node-side only right now.** The marketing engine in `vision-scout/marketing/` writes to `bbf_agent_runs` / `bbf_llm_calls`. The 25 Supabase edge functions do NOT yet. When adopting telemetry in a Deno-side function, port `vision-scout/marketing/telemetry.js` to a `supabase/functions/_shared/telemetry.ts` with the same `logRun()` / `logLlmCall()` shape so the rollup query keeps working.

14. **Agent naming convention for `bbf_agent_runs.agent`:** `marketing.<module>` (`marketing.scout`, `marketing.scout-engine`, `marketing.analyst`, `marketing.dispatcher`, `marketing.triage`, `marketing.unsubscribe`, `marketing.orchestrator`). For edge functions when they adopt telemetry, use `<area>.<function-name>` (e.g. `concierge.bbf-lead-concierge`). This keeps the dashboard groupings stable.

15. **Edge-function drift is BIDIRECTIONAL · the original passover only flagged one direction.** Phase 0.3's audit (2026-05-25, commit `6916a46`) confirmed `ls supabase/functions/` matches the 24 ACTIVE deployed functions exactly — but byte-equality showed SIX functions where the REPO has changes that were never deployed:
    - `stripe-webhook` · stale TODO comment + 49-line doc header in repo
    - `bbf-meal-macros` · repo has model-router refactor, deployed has hardcoded `claude-haiku-4-5` (incomplete refactor)
    - `bbf-meal-image` · repo has 31-line doc header
    - `bbf-sentinel` · repo has reformatted code body + different header text
    - `vapi-sms-closer` + `bbf-lead-capture` · cosmetic em-dash typography in repo only
    Decisions per function are pending (deploy repo → prod, or revert repo to match prod). Do NOT push `supabase functions deploy` on these without per-function review · `stripe-webhook` and `bbf-meal-macros` touch critical paths.

16. **`bbf_vision_scout` (Supabase edge fn) is NOT the Render `vision-scout` service.** Two completely different things sharing a confusing name. The Supabase one (slug uses underscores) is a small Browserless screenshot + Claude vision wrapper · model `claude-opus-4-7`. The Render one (path `vision-scout/`) is the Playwright smoke-test service + the entire outbound marketing engine. Don't conflate them in commits or env-var conversations.

---

## How Akeem operates (observed in this session)

- **Directives are commands, not requests.** "Execute." "Deploy." "Push to main." Treat them as authorized actions, not exploration.
- **Wants honest takes, not yes-manning.** Said explicitly: "be real, don't be nice". Push back when you disagree.
- **Will redirect course quickly.** If he says "stop, pivot to X", drop current work and pivot. Don't argue.
- **Cares about engineering quality, not just shipping.** Will accept "this could break" if you flag the risk explicitly.
- **Acknowledges his own typos.** Multiple times this session he's corrected an email address or detail he originally provided. Treat his corrections as authoritative; don't reference the typo afterward.
- **Voice transcription artifacts.** Some messages come from voice (mentions "Breville Breville" for Brevo, "demark" for DMARC, etc.). Parse intent, not literal words.
- **No emojis unless he uses them first.** Match his register.

## What NOT to do

- **Do not push to main without going through the FF-merge flow.** Akeem authorized this workflow once; he expects continuity.
- **Do not edit applied migrations.** Add new migrations only.
- **Do not invent file paths, env var names, or model IDs.** Verify by grep/read.
- **Do not fabricate Claude's, Gemini's, or Resend's behavior.** If unsure, test or ask.
- **Do not silently delete code.** If removing, explain why in the commit body.
- **Do not skip pre-flight checks** (syntax check, smoke-test, /health probe) before declaring something done.
- **Do not lecture.** Match Akeem's terseness when he's direct.
- **Do not narrate sandbox limitations on every message.** Mention them once when relevant.

---

## First 10 minutes of your session

1. **Read this file completely.** (You're doing it.)
2. **Read `api/BBF_MASTER_PLAN.md`.**
3. **Run `git log --oneline -10`** to see recent commits.
4. **Check the deploy state**: `curl https://vision-scout.onrender.com/api/v1/marketing/health` returns the live env+client state. (You may need to fire this via `net.http_post` in Supabase if your sandbox blocks outbound.)
5. **Ask Akeem what he wants to attack**, or — if he said "start at Phase X step Y" — start there.

---

## Active credentials / accounts (location, not value)

- **Anthropic API key**: Supabase env var `ANTHROPIC_API_KEY` (used by ~17 edge functions)
- **Gemini API key**: Supabase env var `GEMINI_API_KEY` + Render env (vision-scout) same name
- **Resend API key**: Render env (vision-scout) `RESEND_API_KEY`
- **Brevo API key**: Supabase env var `BREVO_API_KEY` (used by `bbf-lead-concierge`)
- **Supabase service role key**: project secret · auto-injected to edge functions · Render env `SUPABASE_SERVICE_ROLE_KEY`
- **Supabase anon key**: in `bbf-app.html` as `window.ENV_SUPABASE_KEY` (client-side, OK)
- **Stripe webhook secret**: edge function env
- **Vapi credentials**: edge function env

Akeem owns all accounts. He'll provide values when you need them. **Never log secret values to console or commit them to repo.**

---

## Reference links

- Render dashboard · https://dashboard.render.com/web/<vision-scout-id>
- Supabase project · https://supabase.com/dashboard/project/ihclbceghxpuawymlvgi
- Brevo dashboard · https://app.brevo.com
- Resend dashboard · https://resend.com/emails
- Production app · https://buildbelievefit.fitness
- Marketing health · https://vision-scout.onrender.com/api/v1/marketing/health

---

## Update this file when you finish your session

At the end of your session:
1. Mark completed Master Plan items with `[x]` + commit SHA.
2. Add new gotchas to the list above.
3. Update the "Active git state" section with new commits.
4. Move on. Don't write another handoff doc — update THIS one and the master plan.

Single source of truth. No more 12-doc handoff archaeology.
