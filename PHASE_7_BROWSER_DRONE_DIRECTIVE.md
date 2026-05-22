# OPERATION PANTHEON · PHASE 7 · BROWSER DRONE DIRECTIVE

**Mission:** Take Phase 7 from "committed + partially deployed" to "fully live in production."
The chokepoint code is on `origin/main` at commit `b6d8649`. 8 of 13 edge function
deploys landed via the Supabase MCP. The Render proxy redeploy is pending. 5 edge
function deploys are pending. This document is your complete playbook.

---

## CONTEXT YOU NEED

| Field | Value |
|---|---|
| **Repo** | `buildbelievefitllc/Buildbelievefit` |
| **Branch (live)** | `main` |
| **HEAD commit** | `b6d8649` |
| **Supabase project ID** | `ihclbceghxpuawymlvgi` (name: `bbf-lab`) |
| **Supabase project URL** | `https://supabase.com/dashboard/project/ihclbceghxpuawymlvgi` |
| **Render proxy URL** | `https://buildbelievefit.onrender.com` |
| **Render dashboard** | `https://dashboard.render.com/` |
| **SW cache version** | `bbf-v214` (clients on `v213` need a refresh) |

**Founder login email:** `buildbelievefit@gmail.com`. The founder will sign in for
you on both dashboards before handing off control.

**What is "the chokepoint"?**
Phase 7 moved the full Phase 6 safety pipeline (idempotency dedup, in-flight
conflict arbitration, CNS snapshot fetch, Sentinel two-bin verify, fail-CLOSED
posture on safety/vulnerable tiers, episodic memory recording) into the Render
proxy at `/api/proposal-submit` plus stale revalidation at `/api/proposal-approve`.
Until the Render proxy redeploys, the chokepoint code sits dormant — the old
proxy keeps running. **Priority 1 below activates the chokepoint.**

---

## PRIORITY 1 · ACTIVATE THE CHOKEPOINT (Render proxy redeploy)

**This is the load-bearing step. Until this lands, ~80 % of proposal traffic
still bypasses the Phase 6 safety layer.**

1. Open `https://dashboard.render.com/`.
2. Find the **Build Believe Fit** web service (it serves `buildbelievefit.onrender.com`).
3. Click into the service → **"Manual Deploy"** → **"Deploy latest commit"**.
   - The latest commit on `main` is `b6d8649`. Render should auto-detect.
   - If the dropdown lets you, choose **"Clear build cache & deploy"** so the
     refactored `index.js` doesn't get short-circuited by a cached build.
4. Watch the deploy log. Wait for **"Your service is live"** (or the equivalent
   green-banner success).
5. **Verification:**
   - `curl https://buildbelievefit.onrender.com/health` → expect HTTP 200 with
     a `{"ok":true,...}` body.
   - `curl -i -X POST https://buildbelievefit.onrender.com/api/proposal-submit
     -H 'Content-Type: application/json' -H 'X-BBF-Admin-Token: <token>'
     -d '{}'` → expect HTTP 400 with `{"ok":false,"error":"proposed_by_required"}`.
     (We're not actually submitting a proposal — we just want to confirm the
     new handler is wired. The 400 means the new validation chain is active.)

**Stop here and tell the founder if:**
- Render shows a build failure (capture the log).
- The smoke-test curl returns 502 / 503 / connection error.

---

## PRIORITY 2 · VERIFY `BBF_COACH_AGENT_TOKEN` on Render

This token is what `/api/proposal-submit` uses to call `bbf-sentinel verify_proposal`.
**If it is missing in Render's env, the chokepoint will mark every Sentinel call
`not_verified` and refuse every safety/vulnerable proposal with HTTP 503 (correct
posture but visible outage).**

1. In the Render dashboard, open the BBF service → **"Environment"** tab.
2. Confirm an env var named `BBF_COACH_AGENT_TOKEN` exists with a non-empty value.
3. If missing:
   - The same value already exists in Supabase secrets under the same name (used
     by `bbf-agentic-orchestrator` and `bbf-sentinel`).
   - Founder: please paste the value from the Supabase Edge Functions Secrets
     page into Render's env, then re-trigger the deploy.
4. After save, Render auto-redeploys. Repeat the Priority 1 verification curl.

---

## PRIORITY 3 · DEPLOY THE 5 REMAINING EDGE FUNCTIONS

The source at `b6d8649` has Workstream B routing changes for these five
functions, but production is still running the older code. None of these are
safety-critical (the three CEO-mandated downgrades — peaking, comlink,
kinematics — already landed). These are cost-savings + observability deploys.

Each function imports from `../_shared/model-router.ts`. The Supabase function
deploy UI lets you upload the bundle.

**Functions to redeploy (in this order):**

| Function | Current ver | Target ver | Source tier | Notes |
|---|---|---|---|---|
| `bbf-agentic-prehab` | v6 | v7 | Sonnet | downgrade from Opus |
| `bbf-agentic-linguist` | v4 | v5 | Haiku | downgrade from Opus |
| `bbf-agentic-pathfinder` | v3 | v4 | Sonnet | downgrade from Opus |
| `bbf-agentic-interrogator` | v3 | v4 | Sonnet | downgrade from Opus |
| `bbf-agentic-orchestrator` | v1 | v2 | Haiku | no model change · router observability |

**Per-function steps:**

1. Open `https://supabase.com/dashboard/project/ihclbceghxpuawymlvgi/functions`.
2. Click the function name (e.g. `bbf-agentic-prehab`).
3. Click **"Deploy a new version"** → **"Upload from local files"** (or
   **"Edit in editor"** if uploads aren't available).
4. Upload **two** files:
   - `index.ts` ← contents from
     `https://raw.githubusercontent.com/buildbelievefitllc/Buildbelievefit/main/supabase/functions/<name>/index.ts`
   - `../_shared/model-router.ts` ← contents from
     `https://raw.githubusercontent.com/buildbelievefitllc/Buildbelievefit/main/supabase/functions/_shared/model-router.ts`
5. **`verify_jwt`: false** (all BBF agentic functions use custom token auth
   via `X-BBF-Admin-Token` / `X-BBF-Cron-Token`, NOT Supabase JWT).
6. Click **"Deploy"**. Wait for the green banner.
7. **Verification:** Open the function's **Logs** tab. Within ~30 seconds you
   should see a startup log line:
   ```
   [model-router] fn=bbf-agentic-prehab use_case=prehab_assignment model=claude-sonnet-4-6
   ```
   (One log line per function with its routed model.) If you DON'T see it, the
   deploy may have silently fallen back to a cached old version — try again with
   "Clear cache" if Supabase offers it.

**Faster path if you have shell access to the founder's laptop:**
```bash
git clone https://github.com/buildbelievefitllc/Buildbelievefit
cd Buildbelievefit
git checkout b6d8649
npx supabase login   # founder's Supabase access token
npx supabase functions deploy bbf-agentic-prehab       --project-ref ihclbceghxpuawymlvgi
npx supabase functions deploy bbf-agentic-linguist     --project-ref ihclbceghxpuawymlvgi
npx supabase functions deploy bbf-agentic-pathfinder   --project-ref ihclbceghxpuawymlvgi
npx supabase functions deploy bbf-agentic-interrogator --project-ref ihclbceghxpuawymlvgi
npx supabase functions deploy bbf-agentic-orchestrator --project-ref ihclbceghxpuawymlvgi
```
(The Supabase CLI auto-bundles `_shared/` siblings.)

---

## PRIORITY 4 · SMOKE TEST THE CHOKEPOINT END-TO-END

After Priority 1 lands, prove the chokepoint actually fires.

1. Open `https://buildbelievefit.onrender.com/bbf-app.html` (or whichever URL
   the founder uses for the BBF web app).
2. Hard-refresh (Cmd-Shift-R / Ctrl-Shift-R) so the new `bbf-v214` service
   worker activates.
3. Open browser DevTools → **Application** → **Service Workers** → confirm
   `bbf-v214` is the active cache.
4. Navigate to the **Founder Admin / Trainer Dashboard** (the page that renders
   `#orchestrator-gauge` and `#orchestrator-greenline`).
5. Open DevTools console and run:
   ```js
   BBF_ORCHESTRATOR.debugFireProposedAction('program_swap', 'performance',
     'Phase 7 smoke test · ignore');
   ```
6. Watch the network panel. You should see:
   - `POST .../api/proposal-submit` → HTTP 200 with response body that
     INCLUDES new Phase 7 fields:
     - `sentinel.verdict` (one of `clean | recoverable | substantive | not_verified`)
     - `orchestrator.idempotency_key` (sha256 hex)
     - `orchestrator.pattern_hash` (sha256 hex)
     - `orchestrator.magnitude_bucket` (`none | small | moderate | large | severe`)
     - `orchestrator.priority_tier` (`performance` for this test)
     - `orchestrator.legacy_direct` (`false` — proves the orchestrator stamp landed)
   - The response headers should NOT include `Deprecation: true` (since the
     debug fire goes through `BBF_ORCHESTRATOR.submitProposal`).
7. Verify the memory write landed. Open Supabase SQL editor at
   `https://supabase.com/dashboard/project/ihclbceghxpuawymlvgi/sql` and run:
   ```sql
   SELECT action_type, priority_tier, arbitration_result,
          sentinel_verdict, pattern_hash, proposal_id, created_at
   FROM bbf_orchestrator_memory
   ORDER BY created_at DESC
   LIMIT 3;
   ```
   The top row should be `action_type='program_swap'`, `arbitration_result='allowed'`,
   `sentinel_verdict='clean'` (or whatever sentinel returned), and a non-null
   `pattern_hash`. **This row is proof the chokepoint fired end-to-end.**
8. Fire the SAME action again immediately:
   ```js
   BBF_ORCHESTRATOR.debugFireProposedAction('program_swap', 'performance',
     'Phase 7 smoke test · second fire');
   ```
   This time you should get HTTP 409 `duplicate_idempotency` (because the
   first one's idempotency key is still in the 5-min TTL window).

---

## PRIORITY 5 · VERIFY THE FAIL-CLOSED GATE

This is the safety-critical posture. **Only run if Sentinel is currently
intentionally offline or you can simulate it** (e.g., temporarily blank the
`BBF_COACH_AGENT_TOKEN` env on Render — DON'T leave it blank, restore it
right after).

1. Sentinel returns `not_verified` for any of {token missing, fetch fail,
   non-200, timeout}.
2. From the founder console, fire a `safety`-tier proposal:
   ```js
   BBF_ORCHESTRATOR.submitProposal({
     uid: '<a test athlete slug>',
     action_type: 'cns_intervention',
     priority_tier: 'safety',
     risk_level: 'critical',
     rationale: 'Phase 7 fail-CLOSED smoke test · ignore',
     diff: {
       target_table: 'bbf_users',
       target_uid:   '<same slug>',
       fields:       ['daily_brief'],
       before:       { daily_brief: 'before' },
       after:        { daily_brief: 'fail-closed test · ' + Date.now() },
     },
   });
   ```
3. Expected response: HTTP 503 `sentinel_fail_closed` with body including
   `tier: 'safety'` and `sentinel.reason: 'sentinel_token_missing'`.
4. Confirm in Supabase:
   ```sql
   SELECT arbitration_result, sentinel_verdict, arbitration_detail
   FROM bbf_orchestrator_memory
   WHERE action_type = 'cns_intervention'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Should show `arbitration_result='sentinel_fail_closed'`.
5. **RESTORE the `BBF_COACH_AGENT_TOKEN`** in Render env immediately.
6. Refire the same proposal — should now go through (status `clean` or
   `substantive`).

---

## PRIORITY 6 · STALE-HOLD PATH (slow test · 6h+ delay)

This proves `/api/proposal-approve` blocks stale proposals.

1. From the founder console, submit a `performance`-tier proposal (use the
   smoke-test pattern from Priority 4).
2. Note the returned `proposal_id`.
3. Wait > 6 hours OR manually update the row to backdate it:
   ```sql
   UPDATE bbf_pending_review
   SET proposed_at = now() - interval '7 hours'
   WHERE id = '<proposal_id>';
   ```
4. Try to approve it:
   ```js
   fetch('https://buildbelievefit.onrender.com/api/proposal-approve', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json',
                'X-BBF-Admin-Token': sessionStorage.getItem('BBF_ADMIN_TOKEN') },
     body: JSON.stringify({ id: '<proposal_id>', approver: 'phase7_smoke' }),
   }).then(r => r.json()).then(console.log);
   ```
5. Expected: HTTP 409 with `error='stale_holds_required_recompute'` and a
   `staleness` object showing `age_stale: true, age_ms: > 21600000`.
6. Verify the row was held:
   ```sql
   SELECT id, status, decided_at, execution_error FROM bbf_pending_review
   WHERE id = '<proposal_id>';
   ```
   `status` should be `stale_hold` (the new value added by the Phase 7
   migration). `execution_error` should be `stale_holds_required_recompute`.

---

## PRIORITY 7 · CLEAN UP

1. Delete the smoke-test proposal rows:
   ```sql
   DELETE FROM bbf_pending_review WHERE rationale ILIKE '%phase 7 smoke test%';
   DELETE FROM bbf_orchestrator_memory
     WHERE proposed_action->>'source' = 'orchestrator_client'
       AND created_at > now() - interval '1 day'
       AND proposed_action->>'idempotency_key' IS NOT NULL
       AND arbitration_result IN ('allowed', 'duplicate_idempotency', 'sentinel_fail_closed');
   ```
   (Be specific — don't blow away real episodic memory rows.)
2. Confirm the audit feed shows the new Phase 7 action types appearing:
   `proposal_submit_dedup`, `proposal_submit_suppressed`,
   `proposal_submit_recoverable_kickback`, `proposal_submit_fail_closed`,
   `proposal_approve_stale_held`.

---

## SUCCESS CRITERIA · COPY THIS BLOCK INTO YOUR HAND-OFF MESSAGE

When you're done, the founder needs to see:

- [ ] Render proxy redeployed at commit `b6d8649` (Priority 1)
- [ ] `BBF_COACH_AGENT_TOKEN` confirmed present in Render env (Priority 2)
- [ ] 5 remaining edge functions deployed (Priority 3) · 13 of 13 total live
- [ ] Smoke test fires `program_swap` and gets back `orchestrator.*` fields (Priority 4)
- [ ] Duplicate-fire returns 409 `duplicate_idempotency` (Priority 4)
- [ ] Fail-CLOSED returns 503 `sentinel_fail_closed` for safety tier (Priority 5)
- [ ] Stale-hold returns 409 `stale_holds_required_recompute` (Priority 6)
- [ ] Cleanup complete · audit feed shows new action types (Priority 7)

---

## OUT OF SCOPE FOR THIS RUN

The browser drone should NOT:
- Modify any source code (everything is already on `main`).
- Push new commits.
- Modify Supabase schema (the Phase 7 migration is already applied).
- Touch the `comlink` or `midnight-haiku` model-router migration — those have a
  TODO at code level for Workstream B follow-up; they currently use hardcoded
  models that match the router's output.

If you hit something unexpected, **stop and tell the founder.** The Pantheon is
load-bearing; don't improvise.

---

**Phase 7 Browser Drone Directive · prepared at commit `b6d8649` · 2026-05-22.**
