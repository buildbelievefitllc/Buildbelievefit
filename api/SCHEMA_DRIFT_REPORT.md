# Schema Drift Report — `api/supabase-schema.sql` vs Production

**Date captured:** 2026-04-29
**Production source:** Supabase project `ihclbceghxpuawymlvgi` (bbf-lab), Postgres 17.6
**Method:** MCP introspection (`information_schema`, `pg_proc`, `pg_indexes`, `pg_policies`, `pg_get_functiondef`, etc.) — equivalent to `pg_dump --schema-only`, with the Supabase platform schemas (`auth`, `storage`, `realtime`, etc.) excluded.
**Outcome:** `api/supabase-schema-actual.sql` is now the captured truth. The fiction file (`api/supabase-schema.sql`) should be deprecated or rewritten — see "Recommendation" at the end.

---

## TL;DR

The fiction file documents a **fundamentally different data model** than what exists in production. It is not "stale" — it was never accurate. Every primary-key type, the column set on every workout-related table, the seed data, the index list, the RLS policies, and the existence of two tables (`bbf_active_clients`, `content_monarch`) are wrong or missing. The fiction also declares a `clinical_yield_log` table that has never existed.

This drift caused the Phase 2 RPC bug (RPCs referenced `id` because the file said the username column was `id`; production had `id UUID` PK + `uid TEXT` for the username). The hotfix migration `phase2_hotfix_uid_column` corrected production, but never reconciled the file.

**14 distinct drift items** are catalogued below.

---

## Drift catalog

### D1. `bbf_users` — primary key type and identity column

| | Fiction | Reality |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` (e.g. `'akeem'`) | `UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4()` |
| Username column | (none — `id` doubles as username) | `uid TEXT` (separate, nullable) |
| Email | not declared | `email TEXT UNIQUE` |
| Streak / login / tier | not declared | `current_streak`, `last_login`, `metabolic_tier` |
| Other columns | ~50 (intake, blueprint, ghost protocol, somatic, video, sos, etc.) | NONE of those |

**Severity:** Critical. This is the bug we already paid for once.

---

### D2. `bbf_logs` — entire column set differs

| Column | Fiction | Reality |
|---|---|---|
| `id` | `BIGSERIAL` | `UUID DEFAULT extensions.uuid_generate_v4()` |
| `user_id` | `TEXT REFERENCES bbf_users(id)` | `UUID REFERENCES bbf_users(id)` |
| `date` | `TEXT NOT NULL` | `DATE DEFAULT CURRENT_DATE` |
| Other columns (fiction) | `type, duration, intensity, weight, body_fat, notes, mood, exercises JSONB, logged_at, logged_by` | — |
| Other columns (reality) | — | `sport, position, drill_name, coach_notes, language` |

**Severity:** Critical. The fiction models a lifter's log; production models a coach's session log.

---

### D3. `bbf_sets` — FK target, identity, types all differ

| Column | Fiction | Reality |
|---|---|---|
| `id` | `BIGSERIAL` | `UUID` |
| FK | `user_id TEXT REFERENCES bbf_users(id)` | `log_id UUID REFERENCES bbf_logs(id)` |
| Granularity columns | `day_key, exercise_key, set_num` | `set_number` only |
| `reps` | `TEXT` | `INTEGER` |
| `weight` | `TEXT` (column name `weight`) | `DOUBLE PRECISION` (column name `weight_lbs`) |
| New in reality | — | `rpe INTEGER` |
| UNIQUE constraint | `(user_id, day_key, exercise_key, set_num)` | none |

**Severity:** Critical.

---

### D4. `bbf_readiness` — column set differs

| Column | Fiction | Reality |
|---|---|---|
| `id` | `BIGSERIAL` | `UUID` |
| `user_id` | `TEXT` | `UUID` |
| `date` | `TEXT NOT NULL` | (no `date`) |
| Subjective inputs | `sleep, stress, energy` | `sleep_quality, soreness_level` (no stress, no energy) |
| `score` | declared | declared |
| `logged_at` | `TIMESTAMPTZ DEFAULT NOW()` | column is named `timestamp` |
| UNIQUE | `(user_id, date)` | none |

**Severity:** Critical.

---

### D5. Tables in fiction that **do not exist** in production

| Fiction table | Production status |
|---|---|
| `clinical_yield_log` (with FK to a non-existent `users(id)`) | Does not exist |

The fiction also declares two RLS policies on this table referencing `auth.uid()` and `auth.jwt() ->> 'role'`, neither of which would have worked because the table was never created.

**Severity:** Medium. Dead code in the file.

---

### D6. Tables in production that **are not** in fiction

| Production table | Rows | Notes |
|---|---|---|
| `bbf_active_clients` | 4 | Lead/client intake; populated via webhook |
| `content_monarch` | 2 | Marketing/content pipeline staging |

**Severity:** Medium. The file claims to be the source of truth but is silent on two live tables.

---

### D7. RPC functions — `id` vs `uid` (already-paid bug)

| | Fiction | Reality (after `phase2_hotfix_uid_column`) |
|---|---|---|
| `bbf_verify_admin_pin` | `WHERE id = 'akeem' AND role = 'trainer'` | `WHERE uid = 'akeem' AND role = 'trainer'` |
| `bbf_verify_user_pin` | `WHERE id = uid` | `WHERE bbf_users.uid = v_target_uid` |
| `bbf_admin_clear_lockout` | `WHERE id = 'akeem' AND role = 'trainer'` | `WHERE uid = 'akeem' AND role = 'trainer'` |

**Severity:** Critical (already fixed in production via MCP migration; file still wrong).

---

### D8. Indexes declared in fiction that **do not exist** in production

| Index | Status |
|---|---|
| `idx_logs_user` (`bbf_logs(user_id)`) | Missing |
| `idx_logs_date` (`bbf_logs(user_id, date)`) | Missing |
| `idx_sets_user` (`bbf_sets(user_id)`) | Missing |
| `idx_sets_day` (`bbf_sets(user_id, day_key)`) | Missing — also references columns that don't exist |
| `idx_readiness_user` (`bbf_readiness(user_id, date)`) | Missing — also references a non-existent `date` column |

**Severity:** Low (performance not blocked at current row counts; reintroduce only if profiling justifies).

---

### D9. Indexes in production that fiction doesn't declare

| Index | Notes |
|---|---|
| `bbf_active_clients_client_email_key` | UNIQUE on `client_email` |
| `bbf_active_clients_vault_email_key` | UNIQUE on `vault_email` |
| `bbf_users_email_key` | UNIQUE on `email` |
| `idx_pin_attempts_locked` | Phase 2 — IS in fiction, is in reality ✓ |

**Severity:** Low.

---

### D10. RLS state divergence

Fiction claimed:
- RLS enabled on `bbf_users`, `bbf_logs`, `bbf_sets`, `bbf_readiness`
- Single permissive policy `"Allow all for anon"` on each (`USING (true) WITH CHECK (true)`)

Reality:

| Table | RLS | Policies |
|---|---|---|
| `bbf_users` | **ENABLED** | **NONE** |
| `bbf_logs` | **ENABLED** | **NONE** |
| `bbf_active_clients` | ENABLED | 1 — anon INSERT only (`"Allow Webhook Inserts"`) |
| `bbf_pin_attempts` | ENABLED | NONE |
| `bbf_sets` | **DISABLED** | n/a |
| `bbf_readiness` | **DISABLED** | n/a |
| `content_monarch` | DISABLED | n/a |

**Severity:** **High — security-relevant.** Two implications:

1. The fiction's "Allow all for anon" policies were never created in production, so `bbf_users` and `bbf_logs` are effectively closed to the anon key. The Phase 2 auth flow only works because the RPCs are `SECURITY DEFINER` and bypass RLS. Any direct anon-key table access in client code that isn't going through an RPC would fail. This is worth auditing in Phase 3.
2. `bbf_sets` and `bbf_readiness` have RLS **disabled entirely**, meaning the anon key has full read/write to those tables. That is almost certainly unintentional — should be flagged for a Phase 3+ fix.

---

### D11. Triggers in production that fiction omits

| Trigger | Table | Events | Action |
|---|---|---|---|
| `"BBF workout videos"` | `bbf_sets` | `INSERT`, `UPDATE`, `DELETE` (AFTER) | `supabase_functions.http_request` → `https://hooks.zapier.com/hooks/catch/27190846/ujsukew/` |

**Severity:** Medium. Live trigger with a webhook secret in the URL; needs to be in source of truth.

---

### D12. Seed data divergence

| | Fiction | Reality |
|---|---|---|
| `akeem` (trainer) | inserted with sha256 hash | exists with **bcrypt** hash (rotated post-Phase 2) |
| `ana_bbf, jacky_bbf, suzanna_bbf, jordan_bbf, wayne_bbf` | inserted with sha256 hashes | **none of these exist** |
| (NULL-uid 'admin' row) | not declared | exists with bcrypt hash |

The 5 client seeds in the fiction never landed (or were deleted). Replaying the fiction file would clobber the bcrypt-rotated `akeem` row with a sha256 hash. The actual file therefore intentionally **does not** include `INSERT` statements.

**Severity:** Medium. Replaying fiction is destructive.

---

### D13. Migration registration

Only one migration is registered with the Supabase platform: `20260429054308_phase2_hotfix_uid_column`. Everything else (the original schema creation, the Zapier trigger, the `bbf_active_clients` policy, the `content_monarch` table, etc.) was applied via the dashboard or MCP without being captured as a migration. This is the gap that Phase 3 P1 (Supabase CLI setup) is meant to close.

**Severity:** Medium (process drift).

---

### D14. Default values, nullability, types — minor differences

A handful of column defaults differ between fiction and reality (e.g. fiction declares `role TEXT DEFAULT 'client'` on `bbf_users`; reality declares no default). All such differences are subsumed by `bbf_users`/`bbf_logs`/`bbf_sets`/`bbf_readiness` being entirely different tables (D1-D4); not enumerated separately.

**Severity:** Low (already covered).

---

## What I deliberately did **not** do

- **Did not modify production.** This is a read-only audit + a new file.
- **Did not delete or modify `api/supabase-schema.sql`.** Awaiting your call on whether to deprecate (rename + add header pointing to the actual file), rewrite (replace contents with the new file), or remove.
- **Did not include client-account seed `INSERT`s** in the actual file. Re-running the fiction would have clobbered bcrypt hashes; re-running this file is now safe.
- **Did not capture Supabase platform schemas** (`auth`, `storage`, etc.) — those are managed by Supabase and not part of our application schema.

---

## Recommendation for what to do with `api/supabase-schema.sql`

Three options, in order of my preference:

1. **Deprecate-and-rename** *(recommended)*: rename the fiction file to `api/supabase-schema.legacy.sql` and prepend a header that says "DO NOT USE — superseded by `supabase-schema-actual.sql` on 2026-04-29. Retained for git-history continuity only." Costs nothing, preserves history, keeps blame clean.

2. **Delete** the fiction file. Cleanest repo state, but loses the readable artifact of what we *thought* we had. Git history covers it.

3. **Rewrite in place**: overwrite `api/supabase-schema.sql` with the actual content and delete `api/supabase-schema-actual.sql`. Single canonical filename, but the diff in git will be massive and obscures the "drift discovery" nature of the change.

Once Phase 3 P1 (Supabase CLI) lands, the canonical source of truth shifts to `supabase/migrations/` anyway, and whichever flat-file we keep becomes a generated artifact (`supabase db dump` output) rather than something humans edit.

---

## Trust pattern from here

Until the actual file lands on `main` and Phase 3 P1 produces tracked migrations, **no SQL change should be authored against the fiction file's column names or types.** Every future SQL touchpoint should be cross-checked against `api/supabase-schema-actual.sql` or against live production via MCP introspection.
