# AG Directive — Vapi Phase 5: Sales Recovery (Pathfinder Closer)

**Status:** OPEN
**Issued:** 2026-04-30
**Issued by:** Claude (post Phase 1.7 verification)
**Branch target:** `ag/vapi-phase-5`
**Phase label:** Phase 5

## Context

Phase 1.6/1.7 ship the **accountability** outbound voice loop: existing paid clients who miss 3+ days of training logs get an automated call from "Rex" (Vapi assistant) once per 7-day window. Verified end-to-end 2026-04-30 (sha `dd75091`).

Phase 5 adds a **second** outbound voice loop on the same infrastructure: prospects who completed the Pathfinder questionnaire but never paid get a sales-recovery call from a separate Vapi assistant ("Pathfinder closer", persona TBD by Akeem — likely "Vance" or similar). Akeem has already built this assistant in the Vapi dashboard; its ID is stored in Edge Function Secrets as `VAPI_SALES_ASSISTANT_ID`.

What's left is server-side: a new SQL trigger function, an edge fn that picks the right assistant by use case, and a new cron schedule.

## Locked design decisions (Akeem, 2026-04-30)

| Decision | Value |
|---|---|
| "Abandoned" threshold | **3 days** since Pathfinder fill with no payment |
| Max attempts per prospect | **1 initial call + 1 follow-up at 7 days** if first attempt didn't close them |
| Hard stop | **30 days** since Pathfinder fill — past that, leave them alone |
| Cron timing | Distinct from accountability (`0 17 * * *`) — recommend `0 19 * * *` (7pm UTC ≈ 2pm EST / 11am PST), Akeem to override if preferred |

## Deliverables

### 1. Migration: `supabase/migrations/<timestamp>_vapi_phase_5_sales_recovery.sql`

Single migration containing:

**(a)** Add a `use_case` column to `bbf_vapi_calls` so we can distinguish accountability vs. sales-recovery calls:

```sql
ALTER TABLE public.bbf_vapi_calls
  ADD COLUMN use_case TEXT NOT NULL DEFAULT 'accountability'
    CHECK (use_case IN ('accountability', 'sales_recovery'));
```

The DEFAULT handles existing rows (all are accountability — only path that existed pre-Phase 5).

**(b)** Update `bbf_evaluate_streaks()` to pass `use_case='accountability'` and rename the days field for cross-use-case consistency. Replace the function body so:
- The `INSERT INTO bbf_vapi_calls` includes `use_case = 'accountability'`
- The `net.http_post` body sends `'use_case', 'accountability'` and `'days', days_missed` (renamed from `days_missed` for consistency across use cases — the edge fn handles the variable mapping per use case)

Keep all other behavior identical: same selection criteria, same 7-day rate limit, same Vault token lookup, same exception swallow.

**(c)** Create `bbf_evaluate_abandoned_carts()` — sales recovery counterpart. Logic:

```sql
CREATE OR REPLACE FUNCTION public.bbf_evaluate_abandoned_carts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    cart_record RECORD;
    days_since_pathfinder INTEGER;
    invoke_token TEXT;
BEGIN
    SELECT decrypted_secret INTO invoke_token
    FROM vault.decrypted_secrets
    WHERE name = 'bbf_vapi_invoke_token'
    LIMIT 1;

    FOR cart_record IN
        WITH call_history AS (
            SELECT
                client_email,
                COUNT(*) FILTER (WHERE use_case = 'sales_recovery') AS sales_call_count,
                MAX(called_at) FILTER (WHERE use_case = 'sales_recovery') AS last_sales_called_at
            FROM public.bbf_vapi_calls
            WHERE called_at > now() - INTERVAL '30 days'
            GROUP BY client_email
        )
        SELECT
            ac.client_email,
            ac.client_name,
            ac.client_phone,
            ac.training_protocol,
            ac.created_at,
            EXTRACT(DAY FROM (now() - ac.created_at))::int AS days_since
        FROM public.bbf_active_clients ac
        LEFT JOIN public.bbf_users u ON ac.client_email = u.email
        LEFT JOIN call_history ch ON ac.client_email = ch.client_email
        WHERE ac.onboarding_status = 'Pending'
          AND ac.client_phone IS NOT NULL
          AND u.id IS NULL  -- not yet paid (no matching bbf_users row)
          AND ac.created_at < now() - INTERVAL '3 days'   -- abandoned threshold
          AND ac.created_at > now() - INTERVAL '30 days'  -- hard stop
          AND (
              ch.sales_call_count IS NULL                                            -- never called
              OR (ch.sales_call_count = 1 AND ch.last_sales_called_at < now() - INTERVAL '7 days')  -- 1 prior + 7d follow-up window
          )
    LOOP
        days_since_pathfinder := cart_record.days_since;

        INSERT INTO public.bbf_vapi_calls (client_email, call_status, use_case)
        VALUES (cart_record.client_email, 'initiated', 'sales_recovery');

        BEGIN
            PERFORM net.http_post(
                url := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/vapi-outbound-trigger',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'X-BBF-Token', COALESCE(invoke_token, '')
                ),
                body := jsonb_build_object(
                    'use_case', 'sales_recovery',
                    'client_email', cart_record.client_email,
                    'client_name', cart_record.client_name,
                    'client_phone', cart_record.client_phone,
                    'days', days_since_pathfinder,
                    'protocol', cart_record.training_protocol
                )
            );
        EXCEPTION WHEN OTHERS THEN
            -- Mirror bbf_evaluate_streaks: swallow HTTP errors so loop continues
        END;
    END LOOP;
END;
$function$;
```

**(d)** Schedule the new cron job:

```sql
SELECT cron.schedule(
    'vapi-daily-abandoned-cart-check',
    '0 19 * * *',
    $$ SELECT public.bbf_evaluate_abandoned_carts() $$
);
```

### 2. Edge function: `supabase/functions/vapi-outbound-trigger/index.ts`

Refactor to route by `use_case`:

```ts
const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
const VAPI_ASSISTANT_ID = Deno.env.get('VAPI_ASSISTANT_ID');                    // accountability (Rex)
const VAPI_SALES_ASSISTANT_ID = Deno.env.get('VAPI_SALES_ASSISTANT_ID');         // sales recovery
const VAPI_PHONE_NUMBER_ID = Deno.env.get('VAPI_PHONE_NUMBER_ID');

if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_SALES_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID) {
  throw new Error("Missing Vapi configuration environment variables");
}

const {
  use_case = 'accountability',  // default for safety / backwards compat with any caller that still sends old shape
  client_email,
  client_name,
  client_phone,
  days,
  days_missed,                  // legacy field name — accept for one deploy cycle in case migration order slips
  protocol
} = await req.json();

if (!client_phone) {
  throw new Error(`Cannot initiate call for ${client_email}: No phone number provided.`);
}

if (!['accountability', 'sales_recovery'].includes(use_case)) {
  throw new Error(`Unknown use_case: ${use_case}`);
}

const effectiveDays = days ?? days_missed ?? 3;
const assistantId = use_case === 'sales_recovery' ? VAPI_SALES_ASSISTANT_ID : VAPI_ASSISTANT_ID;
const variableValues = use_case === 'sales_recovery'
  ? {
      clientName: client_name || 'Client',
      daysSincePathfinder: String(effectiveDays),
      programFocus: protocol || 'Training Protocol',
      coachName: 'Akeem'
    }
  : {
      clientName: client_name || 'Client',
      daysMissed: String(effectiveDays),
      programFocus: protocol || 'Training Protocol',
      coachName: 'Akeem'
    };

const vapiPayload = {
  phoneNumberId: VAPI_PHONE_NUMBER_ID,
  customer: { number: client_phone },
  assistantId,
  assistantOverrides: { variableValues }
};
```

Everything else in the edge fn (CORS, 503/401 auth guard, the `fetch` to Vapi, success/error responses, console logging) stays exactly as-is.

### 3. `api/VAPI_DESIGN.md`

- Add a new section §3.5 "Sales Recovery Use Case" describing:
  - Trigger: `bbf_evaluate_abandoned_carts()` cron at `0 19 * * *`
  - Selection criteria (Pending, no paid user, 3-30 days old, has phone, 0 or 1 prior sales call ≥ 7d ago)
  - Variables passed to assistant: `clientName`, `daysSincePathfinder`, `programFocus`, `coachName`
  - Reference: assistant config lives in Vapi dashboard ("Pathfinder closer"), ID stored as `VAPI_SALES_ASSISTANT_ID`
- Update §3 "Webhook Payload Spec" to show the new payload shape with `use_case` and `days` fields
- Update §7 "Operational Setup" Edge Function Secrets list to reflect 5 secrets (add `VAPI_SALES_ASSISTANT_ID`)
- Add a "Phase 5 (2026-04-30)" note explaining the addition

### 4. `api/CLAUDE_SESSION_HANDOFF.md`

- §3: append "Phase 5 — sales recovery loop merged" once verified post-deploy
- §4: replace the Phase 5 to-do with concrete completed checklist items
- §5: remove Phase 5 from backlog (it's done)
- §9: add PR entry

(Claude will do these doc updates post-merge, not AG. Don't touch the handoff doc, AG.)

## What NOT to do

- Do NOT apply the migration or deploy the edge function. Claude does that via MCP after merge.
- Do NOT modify `api/supabase-schema-actual.sql` (workflow rule §6 #3).
- Do NOT introduce `_v2`, `_new`, or `*_2026` suffixes (rule §6 #1).
- Do NOT touch the `BBF_VAPI_INVOKE_TOKEN` / 503 / 401 auth guard in the edge function. That's correct as-is.
- Do NOT add SMS / Stripe / Twilio tool wiring. The Pathfinder closer assistant is voice-only by design (no tools wired). The system prompt explicitly forbids promising actions it can't perform — same model as Rex. Real SMS payment-link tooling is a future phase.
- Do NOT add Phase 4 callback receiver work (that's its own phase, scoped separately in §5 backlog).
- Do NOT modify `bbf_evaluate_streaks()` selection criteria, rate limiting, or behavior. Only update its `INSERT` to include `use_case='accountability'` and rename `days_missed` → `days` in the `net.http_post` body.
- Do NOT change the cron schedule of `vapi-daily-accountability-check`. Leave it on `0 17 * * *`.
- Do NOT modify `bbf_active_clients` schema, RLS policies, or onboarding_status semantics. Treat `onboarding_status='Pending'` + `bbf_users` LEFT JOIN with NULL as the canonical "not yet paid" signal.
- Do NOT touch `api/CLAUDE_SESSION_HANDOFF.md` — Claude updates it after the smoke test passes.

## Akeem's prerequisites

Already done:
- ✅ `VAPI_SALES_ASSISTANT_ID` Edge Function Secret in Supabase (added 2026-04-30)
- ✅ Pathfinder closer assistant published in Vapi dashboard with the agreed prompt + variables (`clientName`, `daysSincePathfinder`, `programFocus`, `coachName`)

Nothing else needed before AG drafts.

## Test plan (Claude runs post-deploy)

**Migration apply order (safety):**
1. Deploy edge function FIRST (with backwards-compat default `use_case='accountability'` + `days_missed` legacy field accepted) — so any in-flight calls from the existing `bbf_evaluate_streaks()` keep working.
2. Apply migration second — `bbf_evaluate_streaks()` updated to send new shape, `bbf_evaluate_abandoned_carts()` created, cron scheduled.

**Smoke tests:**
1. **Accountability regression** — confirm Phase 1.6/1.7 still works after edge fn refactor:
   - Insert synthetic Active client + paid user, no recent logs
   - `SELECT public.bbf_evaluate_streaks();`
   - Verify `bbf_vapi_calls` row with `use_case='accountability'`, edge fn 200, Vapi `status:queued`
   - Phone rings with Rex
   - Cleanup
2. **Sales recovery positive path:**
   - Insert synthetic Pending `bbf_active_clients` row, `created_at = now() - INTERVAL '5 days'`, with phone, NO matching `bbf_users` row
   - `SELECT public.bbf_evaluate_abandoned_carts();`
   - Verify `bbf_vapi_calls` row with `use_case='sales_recovery'`, edge fn 200, Vapi `status:queued`
   - Phone rings with Pathfinder closer
   - Cleanup
3. **Sales recovery rate limiting (1+1 follow-up):**
   - Insert synthetic Pending row, no prior calls → trigger fires (call 1)
   - Within 7 days → re-run function → no trigger (rate limited)
   - Manually backdate the call to 8 days ago → re-run → trigger fires (call 2 / follow-up)
   - Re-run again → no trigger (max attempts reached)
   - Cleanup
4. **Sales recovery exclusion checks:**
   - Insert Pending row, `created_at = now() - INTERVAL '1 day'` → re-run → no trigger (under threshold)
   - Insert Pending row, `created_at = now() - INTERVAL '40 days'` → re-run → no trigger (past hard stop)
   - Insert Pending row matched with a paid `bbf_users` row → re-run → no trigger (already paid)
   - Cleanup
5. **Negative auth** — re-confirm 401 on no/wrong token (unchanged from Phase 1.7)

## PR template

**Title:** `Phase 5 — Vapi sales recovery (Pathfinder closer)`

**Body:**
- **Why:** Adds a second outbound voice loop on existing infrastructure to call Pathfinder-completed prospects who didn't pay within 3-30 days, with 1+1 follow-up cadence. Pre-locked design decisions in `api/AG_DIRECTIVE_VAPI_PHASE_5.md`.
- **What:**
  - DB: new column `bbf_vapi_calls.use_case`, new function `bbf_evaluate_abandoned_carts()`, new cron `vapi-daily-abandoned-cart-check`, updated `bbf_evaluate_streaks()` to tag calls with use_case.
  - Edge fn: routes assistant by `use_case` field in payload; backwards-compatible default for safety.
  - Docs: `VAPI_DESIGN.md` updated. (Handoff doc updated by Claude post-verify.)
- **Test plan:** See `api/AG_DIRECTIVE_VAPI_PHASE_5.md` §"Test plan". Five separate smoke tests cover regression + new path + rate limiting + exclusions + auth.
- **Risk:** Edge fn keeps backwards-compat default so deploy order is safe. Migration is additive (no destructive changes). New cron runs at `0 19 * * *` UTC, doesn't collide with `0 17 * * *` accountability. Vapi assistant for Pathfinder closer is voice-only (no tools) — same anti-hallucination guardrails as Rex.
