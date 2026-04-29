# RLS Hardening Audit — Phase 3 P2

**Date captured:** 2026-04-29
**Production source:** Supabase project `ihclbceghxpuawymlvgi` (bbf-lab), Postgres 17.6
**Method:** Code grep across `*.html` + `*.js` for direct REST/RPC patterns + MCP introspection of production state
**Outcome:** Three tables (`bbf_sets`, `bbf_readiness`, `content_monarch`) need RLS enabled to close the security gap from `SCHEMA_DRIFT_REPORT.md` D10.

---

## TL;DR

The repo's `bbf-sync.js` issues ~30 direct anon-key REST calls against `bbf_users`, `bbf_logs`, `bbf_sets`, and `bbf_readiness`. **Three of those four tables already block anon access** (RLS enabled, no policies). The fourth (`bbf_sets`) plus `bbf_readiness` and `content_monarch` are still wide open.

The mismatch went unnoticed because the cloud sync layer **isn't operational in production today** — the app runs on `localStorage` and the failed REST calls die silently. Closing the security gap now is therefore a **zero-functional-impact change**.

This migration enables RLS on the three remaining tables with no policies, matching the de-facto-locked state of the others.

---

## Production data state (verified via MCP)

| Table | RLS | Policies | Rows | Source of rows |
|---|---|---|---|---|
| `bbf_users` | ENABLED | none | 2 | Founder-seeded directly (akeem trainer + NULL-uid admin) |
| `bbf_logs` | ENABLED | none | **0** | — |
| `bbf_sets` | **DISABLED** | n/a | **0** | — |
| `bbf_readiness` | **DISABLED** | n/a | **0** | — |
| `bbf_active_clients` | ENABLED | "Allow Webhook Inserts" (anon INSERT) | 4 | Lead capture webhook |
| `bbf_pin_attempts` | ENABLED | none | 1 | Phase 2 RPCs (SECURITY DEFINER) |
| `content_monarch` | **DISABLED** | n/a | 2 | Unknown — no client code refs (likely dashboard or external pipeline) |

Zero rows on `bbf_logs`, `bbf_sets`, `bbf_readiness` despite client-side code attempting to write to them = **the sync layer is not delivering data to production**. The reasons differ per table (RLS rejection for `bbf_logs`; schema mismatch silently dropping writes for `bbf_sets`/`bbf_readiness`) but the result is the same: tightening RLS won't break a working flow because there is no working flow.

---

## Client-side access map

### `bbf-sync.js` — central anon-key client (~30 call sites)

The `supa(method, table, body, queryStr)` helper at the top of the file builds REST URLs of the form `/rest/v1/<table>` with `apikey: <anon>` and `Authorization: Bearer <anon>`. All calls below use the anon key:

#### `bbf_users` (RLS enabled, no policies → currently failing)

| Line | Op | Purpose |
|---|---|---|
| 37 | POST | Upsert user metadata |
| 127 | GET | List all users (`?order=name.asc`) |
| 132 | GET | Lookup user by id (`?id=eq.<uid>&limit=1`) |
| 360, 381, 394, 400, 1563 | POST | Various seed/insert paths |
| 421 | GET | Household member list |
| 701, 732, 749, 784, 828 | PATCH | Sovereign overrides, Ghost Protocol, somatic sync |
| 1056, 1232, 1376 | PATCH | High-Ticket Sniper, Phantom Eye, somatic |
| 1581 | PATCH | Generic field update by id |

**All of these are 401-ing or returning empty results today.** The `id=eq.<uid>` pattern is also wrong (production uses `uid TEXT` for the username, not `id UUID`) — D7 in SCHEMA_DRIFT_REPORT.

#### `bbf_logs` (RLS enabled, no policies → currently failing)

| Line | Op | Purpose |
|---|---|---|
| 59 | POST | Workout/session log |
| 117 | GET | User's recent logs |
| 137 | GET | All logs, ordered |
| 270, 337, 480, 1393, 1496 | POST | Audit, somatic history, sets-as-log |
| 297, 316, 427 | GET | Targeted log queries |

**All silently failing in production.**

#### `bbf_sets` (RLS disabled → currently allowed at network level, but column-mismatch + no app data flow)

| Line | Op | Purpose |
|---|---|---|
| 86, 98 | POST | Insert set or batch of sets |
| 122 | GET | User's recent sets (`?user_id=eq.<uid>&order=day_key.desc`) |

The query uses `user_id` but production schema has no `user_id` column on `bbf_sets` (FK is `log_id`). So even with RLS disabled, the writes hit a column-mismatch wall and the GETs return malformed errors.

#### `bbf_readiness` (RLS disabled → same pattern as `bbf_sets`)

| Line | Op | Purpose |
|---|---|---|
| 104 | POST | Daily readiness score |
| 142 | GET | User's recent readiness scores |

Same column-mismatch issue (`date TEXT` in fiction vs no `date` column in reality).

### `bbf-data.js` — `clinical_yield_log` (table doesn't exist)

| Line | Op | Purpose |
|---|---|---|
| 1276 | POST | Insert biomarker row |
| 1291 | GET | Read biomarker history |

`clinical_yield_log` was declared in the legacy schema but **never created in production** (drift report D5). These calls 404 today. Out of scope for this PR but worth tracking.

### `index.js` (server-side, uses SERVICE key — not affected by RLS)

| Line | Op | Purpose |
|---|---|---|
| 89-90 | `.from('bbf_active_clients')` upsert | Lead webhook handler |

Uses `SUPABASE_SERVICE_KEY`, which bypasses RLS. Unaffected.

### Auth surfaces — RPCs only (SECURITY DEFINER, RLS-bypassing)

| File:line | Call |
|---|---|
| `bbf-app.html:4243` | `rpc/bbf_verify_user_pin` |
| `coach-lab.html:193` | `rpc/bbf_verify_admin_pin` |
| `admin.html` | (uses `BBF_SYNC.verifyAdminPin` → `rpc/bbf_verify_admin_pin`) |
| `bbf-sync.js` | wrappers around the same three RPCs |

All three Phase 2 RPCs are `SECURITY DEFINER` and run as the function owner. They access `bbf_users` and `bbf_pin_attempts` internally, bypassing RLS. **Unaffected by this migration.**

### `content_monarch` — zero client code references

Grepped all `*.html` and `*.js` files. Zero matches. The 2 rows in production were created via the Supabase dashboard or an external pipeline (not client code). Enabling RLS won't break anything in the app.

---

## Proposed migration

```sql
ALTER TABLE public.bbf_sets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_readiness   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_monarch ENABLE ROW LEVEL SECURITY;
```

Three statements. No new policies. Result: all three tables become anon-locked, matching `bbf_users` / `bbf_logs` / `bbf_pin_attempts`.

### Why no policies?

Policies that allow specific access patterns require knowing the access model. The current model is:
- **Server-side (service key)** → bypasses RLS, can do anything
- **Auth flow (anon, via RPCs)** → SECURITY DEFINER bypass, can do exactly what RPCs allow
- **Direct anon REST** → currently broken (no RLS-enabled table allows it)

If the future requires direct anon REST access for client sync (currently broken), the right path is **either** (a) move sync through RPCs that act on `auth.uid()` claims after migrating to Supabase Auth, **or** (b) introduce signed JWTs with custom claims. Both are bigger architectural changes that should be designed independently. Adding permissive policies now would re-open the gap before fixing the underlying access model.

---

## Out-of-scope items flagged during this audit

- **`clinical_yield_log` does not exist.** Two `bbf-data.js` functions (lines 1274–1295) call this non-existent table and 404 silently. Either create the table or remove the dead code. Tracked as Phase 3 P3.
- **`bbf-sync.js` ~30 broken anon calls.** Either re-route through SECURITY DEFINER RPCs (each call site needs a corresponding RPC) or migrate to Supabase Auth so policy-based access works. Larger architectural effort. Tracked as Phase 3 P3.
- **`bbf_users.uid` vs `id` queries.** `bbf-sync.js` uses `?id=eq.<uid>` patterns; production uses `uid TEXT` for the username. Even if policies are added later, these queries need updating too. Tracked as part of the sync re-route above.
- **Founder PIN row (NULL-uid 'admin')** in `bbf_users` is unused by any RPC (the verify functions all key on `uid='akeem'`). Either delete it or wire it into a real auth path. Cosmetic.

---

## Risk assessment

| Change | Risk | Mitigation |
|---|---|---|
| Enable RLS on `bbf_sets` | Low | Zero rows, no functioning client writes; trigger fires only on real (currently nonexistent) inserts |
| Enable RLS on `bbf_readiness` | Low | Zero rows, no functioning client writes |
| Enable RLS on `content_monarch` | Low–medium | 2 rows; if an external pipeline writes via service key it still works (service key bypasses RLS); if it writes via anon, that pipeline breaks. **Pre-merge ask:** confirm the 2 rows weren't dropped in via anon-key calls. |

### Pre-merge action: confirm `content_monarch` write path

The user should confirm one of the following before merging:

1. The two existing `content_monarch` rows were created via the Supabase Dashboard (manual SQL editor) or via a service-key pipeline → safe to enable RLS.
2. They were created via an anon-key call from somewhere (e.g., a Zapier action, a different repo, Make.com, a CMS) → adding a webhook-style INSERT policy similar to `bbf_active_clients` may be needed before enabling RLS.

If unsure, this migration can ship with `bbf_sets` and `bbf_readiness` only, leaving `content_monarch` for a separate PR after the write path is identified.

---

## Smoke test plan (after merge + apply)

1. **Auth flow regression** — sign into `bbf-app.html` with correct PIN → app loads. Sign into `coach-lab.html` with admin PIN → dashboard loads. Same for `admin.html`. (RPCs are SECURITY DEFINER, should be unaffected.)
2. **Wrong PIN → lockout** still works (3 attempts → 15-min countdown).
3. **`bbf_active_clients` webhook** — if you have a way to trigger a lead-capture webhook, do it. Confirm the row lands. (No change expected; this table's policy is untouched.)
4. **Verify RLS state** via MCP: `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('bbf_sets', 'bbf_readiness', 'content_monarch')` should show `t` for all three.
5. **`content_monarch` sanity** — verify the existing 2 rows are still readable via service key (they should be; service key bypasses RLS).

---

## Migration trail after merge

```
20260101000000_baseline                   (Phase 3 P1)
20260429054308_phase2_hotfix_uid_column   (Phase 2 emergency)
20260429140000_rls_hardening              (this PR)
```
