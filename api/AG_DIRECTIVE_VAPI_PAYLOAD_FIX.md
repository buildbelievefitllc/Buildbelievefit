# AG Directive — Vapi Outbound Payload Fix (Phase 1.7, Path B)

**Status:** OPEN
**Issued:** 2026-04-30
**Issued by:** Claude (post-smoke-test of merged PR #74)
**Branch target:** `ag/vapi-payload-fix`
**Phase label:** Phase 1.7

## Context

The §8 smoke test of `bbf_evaluate_streaks() → pg_net → vapi-outbound-trigger → Vapi API` (Phase 1.6) ran end-to-end. The DB plumbing is sound: cron schedule, pg_net dispatch, edge function auth (X-BBF-Token), and the `bbf_vapi_calls` audit insert all work. Negative auth tests pass (401 on no/bad token).

**Failure point:** Vapi rejected the outbound payload with HTTP 400:

```
phoneNumber.property phoneNumber should not exist
phoneNumber.twilioAccountSid must be a string
```

Two issues in `supabase/functions/vapi-outbound-trigger/index.ts:48–62`:
1. The dial target is nested under `phoneNumber.phoneNumber`. Vapi expects it at `customer.number`.
2. For BYO Twilio, Vapi requires `twilioAccountSid` + `twilioAuthToken` inside `phoneNumber`. They aren't passed (and aren't currently configured as Edge Function Secrets).

**Decision (Akeem, 2026-04-30):** Switch to **Path B — Vapi-managed phone number**. The Twilio number gets registered inside the Vapi dashboard, which returns a `phoneNumberId`. The edge fn drops Twilio creds entirely and uses Vapi's `phoneNumberId` shorthand. Cleaner, fewer secrets in Supabase, standard Vapi setup.

## Deliverables

### 1. `supabase/functions/vapi-outbound-trigger/index.ts`

Replace the env-var read (lines 32–38) and Vapi payload construction (lines 47–62) so the function:

- Reads `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `VAPI_PHONE_NUMBER_ID` from env.
- No longer reads `TWILIO_PHONE_NUMBER`.
- Builds the payload as:

```ts
const vapiPayload = {
  phoneNumberId: VAPI_PHONE_NUMBER_ID,
  customer: {
    number: client_phone
  },
  assistantId: VAPI_ASSISTANT_ID,
  assistantOverrides: {
    variableValues: {
      clientName: client_name || 'Client',
      daysMissed: String(days_missed || 3),
      programFocus: protocol || 'Training Protocol',
      coachName: 'Akeem'
    }
  }
};
```

- The missing-config guard becomes:

```ts
if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID) {
  throw new Error("Missing Vapi configuration environment variables");
}
```

- Everything else in the file stays exactly as-is: the 503/401 auth guard, the CORS headers, the `fetch` to `https://api.vapi.ai/call/phone`, the success/error responses, the `console.log` lines.

### 2. `api/VAPI_DESIGN.md`

- Update the sample payload near line 28: drop the nested `phoneNumber` object, replace with `phoneNumberId` + `customer: { number }` matching the new shape above.
- Update the env-var list near line 86: replace `TWILIO_PHONE_NUMBER` with `VAPI_PHONE_NUMBER_ID`. Note Twilio creds are now held by Vapi, not BBF.
- Add a short paragraph noting Phase 1.7 migrated outbound from BYO Twilio to a Vapi-managed phone number, and the Twilio number is registered inside the Vapi dashboard.

## What NOT to do

- Do NOT apply migrations or deploy the edge function. Claude does that via MCP after merge.
- Do NOT modify `api/supabase-schema-actual.sql` (workflow rule §6 #3).
- Do NOT introduce `_v2`, `_new`, or `*_2026` suffixes (rule §6 #1).
- Do NOT remove or alter the `BBF_VAPI_INVOKE_TOKEN` / 503 / 401 auth guard at lines 16–30. That logic is correct.
- Do NOT touch `bbf_evaluate_streaks()`, the cron schedule, or any DB migration. The DB side is verified working.
- Do NOT add fallback / retry / "compatibility" code for the missing `VAPI_PHONE_NUMBER_ID` secret beyond the existing `throw`. Keep it simple.
- Do NOT delete the `TWILIO_PHONE_NUMBER` Edge Function Secret from the Supabase dashboard yet — Akeem does that manually after the redeploy succeeds.

## Akeem's prerequisites (dashboard work, not yours)

Before AG drafts the fix, Akeem will:
1. Open the Vapi dashboard → register the existing Twilio number → copy the resulting `phoneNumberId`.
2. Add `VAPI_PHONE_NUMBER_ID` as a new Edge Function Secret in Supabase (alongside the existing four).

These are dashboard-only operations and don't block the AG draft — the secret name is already locked.

## Test plan (Claude runs post-deploy)

Re-run the §8 smoke test:

1. Insert synthetic test row pair (`bbf_users` + `bbf_active_clients`) with `client_phone='+16233409254'` and `onboarding_status='Active'`.
2. `SELECT public.bbf_evaluate_streaks();`
3. Verify:
   - `bbf_vapi_calls` row inserted with `call_status='initiated'`.
   - `net._http_response` shows 200/201 from edge fn URL (Vapi typically returns 201 on call create).
   - +16233409254 actually rings; Vapi assistant runs the script with the override variables.
4. Cleanup synthetic rows (FK on `bbf_vapi_calls` is `ON DELETE CASCADE` — deleting active_client cascades).
5. Re-confirm negative auth via pg_net: 401 on missing token, 401 on wrong token.

## PR template

**Title:** `Phase 1.7 — Vapi outbound payload fix (phoneNumberId)`

**Body:**
- **Why:** §8 smoke test of #74 found Vapi 400 on outbound payload shape (nested `phoneNumber.phoneNumber` + missing `twilioAccountSid`).
- **What:** Switched to Vapi-managed phone number. Replaced `TWILIO_PHONE_NUMBER` env var with `VAPI_PHONE_NUMBER_ID`. Payload now uses `phoneNumberId` + `customer.number`. Updated `VAPI_DESIGN.md` to match.
- **Test plan:** See `api/AG_DIRECTIVE_VAPI_PAYLOAD_FIX.md` §"Test plan". Claude re-runs §8 of `CLAUDE_SESSION_HANDOFF.md` after merge + redeploy.
- **Risk:** Edge fn only, no DB changes. Existing auth guard preserved. If `VAPI_PHONE_NUMBER_ID` secret is missing, function throws — same behavior as missing `VAPI_API_KEY` today.
