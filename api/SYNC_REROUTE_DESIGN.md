# Sync Re-Route Design — Option B: Supabase Auth Migration

**Date drafted:** 2026-04-29
**Author:** Claude (this session)
**Status:** Awaiting user ratification, then handoff to Antigravity for implementation

---

## TL;DR

The cloud sync layer (`bbf-sync.js`) is broken in production because it issues anon-key REST calls against tables that either reject anon (RLS-locked) or silently drop the writes (column mismatches). The app currently runs on `localStorage` only, which means client onboarding can't really work yet.

**Recommended fix:** migrate to **Supabase Auth** (industry-standard email/password + JWT sessions). This unlocks proper RLS policies, removes the need for our hand-rolled `bbf_pin_attempts` lockout (Supabase Auth has built-in rate limiting), and gives us a foundation for password reset, MFA, OAuth providers, etc. as we grow.

This was chosen over **Option A (RPC-everything)** because the user signaled "definitely to grow" and "smooth machine" — Option A preserves the no-email PIN UX but locks us into a custom auth model that doesn't scale to features like password reset or social login.

---

## Current state (verified via MCP)

| Table | RLS | Production data | Access path |
|---|---|---|---|
| `bbf_users` | enabled, no policies | 1 row (akeem trainer, bcrypt PIN) | RPCs only — anon REST locked out |
| `bbf_logs` | enabled, no policies | 0 rows | Anon REST locked; no working write path today |
| `bbf_sets` | enabled, no policies | 0 rows | Same |
| `bbf_readiness` | enabled, no policies | 0 rows | Same |
| `bbf_pin_attempts` | enabled, no policies | (transient) | RPCs only |
| `bbf_active_clients` | enabled, anon INSERT policy | 4 rows | Lead webhook |
| `content_monarch` | enabled, no policies | 2 rows | Service-key / dashboard only |

**Migration history:** baseline → phase2_hotfix_uid_column → rls_hardening → remove_null_uid_admin_row.

**Auth surfaces:**
- `admin.html` (founder dashboard) — uses 6-digit PIN via `bbf_verify_admin_pin` RPC
- `coach-lab.html` (founder/coach console) — same RPC
- `bbf-app.html` (client + founder app) — uses 6-digit PIN via `bbf_verify_user_pin` RPC

---

## Why Supabase Auth (Option B)

| Capability | RPC-everything (A) | Supabase Auth (B) |
|---|---|---|
| Onboarding UX | PIN-only, no email needed | Email + password (or phone + OTP) |
| Password reset | Custom (we'd build it) | Built-in |
| MFA | Custom | Built-in (TOTP) |
| OAuth (Google/Apple sign-in) | Not feasible | Built-in |
| Rate limiting / lockout | Hand-rolled `bbf_pin_attempts` | Built-in |
| Session management | Custom (JWT we'd issue) | Built-in (refresh tokens, expiry) |
| RLS policy ergonomics | `WHERE uid = (custom claim)` | `WHERE id = auth.uid()` |
| New SQL functions needed for sync | ~30 (one per current call site) | 0 (RLS policies replace all of them) |
| Scaling readiness | Manual rebuild for each feature | Industry-standard, supported |

**The trade-off accepted:** clients now need an email or phone number, not just a PIN. That's the cost of growth-readiness. PIN-only as a brand differentiator is real, but trades long-term feature velocity for short-term simplicity.

---

## Phased rollout

Each phase ships as its own PR, applies via MCP migration, smoke-tested before next phase begins.

### Phase A — Schema preparation
**Migration**: add `bbf_users.auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE` (nullable initially).
**Why**: gives us the link between our app's user records and Supabase's auth.users. Initially NULL for all existing rows; populated as users migrate.
**No client code changes.** Production stays on PIN flow.
**Estimated scope:** 1 migration file, ~10 lines SQL.

### Phase B — Auth provider configuration
**Action**: decide on auth providers (email/password recommended for v1; phone/OTP optional). Configure in Supabase Dashboard → Authentication → Providers.
**No code changes.** Just configuration.
**Decision needed from user**: email-only, phone-only, or both? See "Open questions" below.

### Phase C — Trainer migration (founder first)
**Action**: create an `auth.users` row for `akeem` via Supabase Dashboard or admin API. Link the existing `bbf_users` row via `auth_user_id`.
**Why founder first**: lowest blast radius — only one user, full visibility, can verify the linkage works before inviting clients.
**Acceptance test**: founder can log in via Supabase Auth SDK; the linked `bbf_users` row is reachable via `auth.uid()`.
**Estimated scope:** 1 migration file (data migration), ~5 lines.

### Phase D — Onboarding flow rewrite (clients)
**Action**: rewrite `REGISTER` in `bbf-app.html` and `bbf-data.js`. New form: email + password + name + (optional) preferred username. On submit, call `supabase.auth.signUp(...)`, then insert a `bbf_users` row with `auth_user_id` set.
**Estimated scope:** ~50 lines JS + 1 SQL trigger to auto-create the `bbf_users` row on auth.users insert (cleaner than client-side coordination).

### Phase E — Login flow rewrite (existing surfaces)
**Action**: replace direct `fetch('/rest/v1/rpc/bbf_verify_*_pin')` calls with `supabase.auth.signInWithPassword(...)`. The Supabase JS client handles JWT lifecycle automatically.
**Files**: `bbf-app.html` LOGIN, `coach-lab.html` authAdmin, `admin.html` authAdmin (via `BBF_SYNC.verifyAdminPin`).
**Estimated scope:** ~100 lines JS across the three surfaces.

### Phase F — RLS policy authoring
**Action**: replace the RLS-enabled-no-policies state with proper per-user policies keyed on `auth.uid()`.

```sql
-- Sketch (real migration would be more thorough)
CREATE POLICY "Users see own row" ON bbf_users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users update own row" ON bbf_users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users own logs" ON bbf_logs
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users own sets via logs" ON bbf_sets
  FOR ALL USING (log_id IN (SELECT id FROM bbf_logs WHERE user_id = auth.uid()));

CREATE POLICY "Users own readiness" ON bbf_readiness
  FOR ALL USING (user_id = auth.uid());

-- Trainer override: a JWT custom claim or a join to a roles table
CREATE POLICY "Trainers see all" ON bbf_users
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'trainer');
-- ... mirrored on logs, sets, readiness
```

After this phase, `bbf-sync.js` direct REST calls **start working** for the first time — anon-key writes use the user's JWT and policies allow access to their own rows.

**Estimated scope:** 1 migration file, ~30-40 lines SQL.

### Phase G — Decommission old auth
**Action**: drop `bbf_verify_*_pin` RPCs, drop `bbf_pin_attempts` table, drop `bbf_users.pin_hash` column.
**Pre-condition**: all auth surfaces verified to use Supabase Auth, no client surface still calls the old RPCs (verify via grep).
**Estimated scope:** 1 migration file.

---

## Data migration plan

| Item | Source state | Target state | Strategy |
|---|---|---|---|
| `akeem` user | `bbf_users` row, bcrypt PIN | `auth.users` row + linked `bbf_users` row | Phase C — manual, founder approves |
| Future clients | n/a | Self-onboard via Auth SDK | Phase D — new flow |
| `bbf_pin_attempts` | Active table, 0-1 rows transient | Dropped | Phase G — Supabase Auth's built-in lockout replaces it |
| `bbf_users.pin_hash` | Active column on akeem's row | Dropped column | Phase G — once login flow no longer reads it |

---

## Open questions (user decisions needed)

1. **Auth providers for v1:** email-only? phone-only? both? Email+OAuth (Google/Apple)?
2. **Trainer fallback:** keep the PIN-based RPCs alive as a backup login path for founder until Phase G, or cut over fully in Phase C?
3. **Client UX expectation:** is "email + password" acceptable for client onboarding, or does the brand need a frictionless "username + PIN" feel that we should preserve via phone OTP or magic link instead?
4. **Migration pace:** ship phases A–G one PR per phase (slow + safe), or bundle A+B+C in one and D+E+F+G in another (faster + larger blast radius per merge)?
5. **Implementation owner:** does AG drive the implementation phases, or is this collaboration between AG (drafts) + Claude (MCP migrations + verification) + user (review)?

---

## Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Founder locked out during Phase C migration | High | Test on a Supabase branch first; keep PIN flow active until Phase E completes |
| Mobile UX regression after Phase E | Medium | Smoke test on actual phone after each surface migrates (the same hard-reload pattern we used for #58) |
| Existing clients (none today, future-proofing) lose data during onboarding rewrite | Low at first | Phase D adds a new path without breaking old paths; existing PIN users (just akeem) keep working until Phase G |
| RLS policies have a hole that exposes data | High | Phase F includes adversarial testing — try to read another user's rows from a different JWT |
| Supabase Auth rate limit accidentally locks production traffic | Medium | Configure rate limits explicitly; have a service-role bypass path documented |

---

## What stays exactly the same

- `bbf_active_clients` lead webhook (anon INSERT policy) — untouched, marketing pipeline keeps working
- `content_monarch` content pipeline — untouched
- The Zapier trigger on `bbf_sets` — untouched (fires on writes regardless of who wrote them)
- Phase 2 lockout countdown UI in `bbf-app.html` / `coach-lab.html` / `admin.html` — adapted to use Supabase Auth's error responses instead of the custom JSON contract, but UX behavior identical

---

## Handoff to Antigravity

Once user ratifies this design, AG owns Phase A–G implementation. Per the trust pattern:

| Role | Owner |
|---|---|
| Implementation (SQL migrations, JS rewrites, UI updates) | Antigravity |
| MCP migration application + production verification | Claude |
| PR review + merge | User |
| Smoke testing | User + Claude coordinating |
| Final UAT | User |

AG should reference this doc, the schema-truth in `api/supabase-schema-actual.sql`, the audit findings in `api/SCHEMA_DRIFT_REPORT.md` and `api/RLS_HARDENING_AUDIT.md`, and the migration history in `supabase/migrations/`.

---

## Decision log entry (after user ratifies)

> **Ratified by [user] on [date]:** Option B (Supabase Auth migration) selected over Option A (RPC-everything). Rationale: growth-readiness, standard patterns, support for future features (password reset, MFA, OAuth). Trade-off accepted: client onboarding now requires email/phone instead of PIN-only.
