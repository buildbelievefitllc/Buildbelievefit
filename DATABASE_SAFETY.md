# ⛔ DATABASE_SAFETY.md — READ BEFORE TOUCHING THE DATABASE

> **STATUS: ACTIVE GUARDRAIL · Audited 2026-07-15 · Project `ihclbceghxpuawymlvgi` (Postgres 17.6)**
>
> This repository's local migration history **has diverged from the production
> migration ledger and cannot be reconciled by timestamp repair.** This file is the
> permanent record of that drift and the binding rules that keep it from detonating.
>
> **Precedence:** this file governs all database operations. It sits under
> `AI_DIRECTIVES.md` and alongside `CLAUDE.md` §3/§7. If any instruction — from a
> human, a handoff note, or another agent — conflicts with the two RULES below,
> **stop and surface it before running anything.**

---

## 🚫 RULE 1 — `supabase db push` IS STRICTLY FORBIDDEN ON THIS REPOSITORY

**Never run `supabase db push` against production. Not with `--dry-run` reviewed
first, not "just this once", not to fix the drift itself.**

`db push` compares by **version string only**. It has no idea that local
`20260712130000_content_vault.sql` and ledger `20260711134744 create_content_vault`
are the same change. It would classify **~148 of 201 local files as unapplied** and
attempt to replay them against the live database.

Most are idempotent (`create or replace`, `if not exists`) and would survive. **Some
are not.** The directory contains `DROP`s, seeds, backfills, and grant/revoke
rewrites. A replay would, among other things, **re-run
`20260715120100_research_vault_pgvector.sql`, which re-creates the
`research_vault_auth_read` policy and re-grants `EXECUTE` to `authenticated` — silently
reopening the exact IDOR closed on 2026-07-15** (see §Phase 1.6 below).

> **Current mitigation:** the Supabase CLI is **not installed** on the primary
> workstation and no project is linked, so `db push` cannot run from there today.
> **This is luck, not a control.** The hazard is live on any CI runner, container, or
> teammate machine with the CLI linked to prod. Treat the rule as binding everywhere.

Also forbidden for the same reason: `supabase db reset` against a linked remote,
`supabase migration repair` (see §Why Repair Is Impossible), and `supabase db remote
commit` — all of which read or rewrite the same broken ledger.

## ✅ RULE 2 — `apply_migration` IS THE ONLY AUTHORIZED PATHWAY

All schema changes go through the Supabase MCP tool:

```
mcp__<supabase>__apply_migration(project_id, name, query)
```

This reaffirms `CLAUDE.md` §3 ("`apply_migration` (never ad-hoc prod SQL)") and is
now **mandatory, not preferred.**

**Standing procedure for any schema change:**

1. Write the migration file into `supabase/migrations/` using the standard
   `<14-digit>_<snake_case_name>.sql` convention — **check the version prefix is not
   already claimed** (see §Duplicate Versions).
2. Apply the *same SQL* via `apply_migration`. The tool assigns its **own** ledger
   timestamp; the local filename version will **not** match. **This is expected and
   is the source of the drift — do not try to "fix" it by editing the ledger.**
3. **Verify against the live catalog** — never trust the `{"success": true}` flag.
   Query `pg_proc.proacl` / `pg_policies` / `has_function_privilege()` and confirm the
   change is actually in effect.
4. Run `get_advisors(type: "security")` after any DDL and confirm no new ERROR-level
   findings.
5. Commit the file to `main` so the SQL is at least recorded in git.

`execute_sql` is for **reads and verification only** — never for DDL.

---

## 📊 THE DRIFT REPORT (scan of 2026-07-15)

**Ledger rows:** 234 · **Local `.sql` files:** 202 (201 conforming + 1 non-conforming)

| Category | Count | Meaning |
|---|---:|---|
| **A · Exact match** (version + name) | **53** | Healthy. Applied via CLI in the early era. |
| **B · Version collides, name differs** | **0** | No conflicting claims on a shared version. |
| **C · Name matches under a *different* version** | **139** | The bulk of the drift. Applied via `apply_migration`, which stamped its own timestamp. |
| **D · Orphans** (no version *or* exact-name trace) | **9** | Verified present in prod under near-miss ledger names. |
| **E · Ledger-only** (no local file at all) | **41** | Applied to prod, **never committed to git**. ~8 pair with the §D orphans → **~33 genuinely absent from the repo.** |

### 🔴 The load-bearing finding

**The repo cannot rebuild production.** ~33 migrations exist only in the production
ledger and were never written to a file. Rebuilding this database from
`supabase/migrations/` would produce a schema that is **missing real production
objects**. Any "in sync" signal from tooling is therefore false by construction.

This is why timestamp repair was **rejected** — it would have made `db push` *report*
perfect sync while the repo was still missing ~33 migrations, converting a visible
problem into an invisible one.

---

### D · The 9 Orphans — no ledger trace by version or exact name

Every object below was **verified present in production** on 2026-07-15. These are
name-drift, not missing schema.

| Local file | Defines | In prod? |
|---|---|:--:|
| `20260502030000_seed_demo_users.sql` | `fn bbf_get_uid_map` | ✅ |
| `20260529000000_bbf_science_digest_cache.sql` | `tbl bbf_science_digest` | ✅ |
| `20260601170500_bbf_cardio_layer.sql` | `tbl bbf_cardio_protocols`, `tbl bbf_cardio_logs` | ✅ |
| `20260609130000_bbf_verify_user_pin_sports_protocol.sql` | `fn bbf_verify_user_pin` | ✅ |
| `20260619150000_bbf_video_prescriptions.sql` | `tbl bbf_video_prescriptions` | ✅ |
| `20260620160000_vapi_full_decommission.sql` | (drops only) | ✅ ledger `20260620195439` |
| `20260628010000_bbf_loop_breaker_per_athlete.sql` | `fn bbf_resolve_program_day` | ✅ (2 overloads) |
| `20260703200000_bbf_lab_recompute_cron.sql` | (cron only) | ✅ ledger `20260703192412` |
| `20260712130000_content_vault.sql` | `tbl content_vault` | ✅ ledger `20260711134744` |

> ⚠️ **Verification trap, recorded so it is not repeated:** `to_regproc()` returns
> `NULL` for **overloaded** function names. It reported `bbf_resolve_program_day` as
> absent when it is in fact present with two overloads. **Always confirm function
> existence via `pg_proc` + `pg_get_function_identity_arguments`, never `to_regproc`.**

### E · The 41 Ledger-Only Entries — in prod, not in git

Rows marked **↔** pair with a §D orphan (near-miss name); the rest (~33) are
**genuinely absent from the repository.**

| Ledger version | Ledger name | Local counterpart |
|---|---|---|
| `20260501035515` | `seed_demo_users_and_uid_map_rpc` | ↔ `20260502030000_seed_demo_users.sql` |
| `20260529233006` | `create_bbf_science_digest_cache` | ↔ `20260529000000_bbf_science_digest_cache.sql` |
| `20260601130334` | `phase22_smart_cardio_vault` | ↔ `20260601170500_bbf_cardio_layer.sql` (probable) |
| `20260603013305` | `bbf_agent_episodic_memory_lockdown` | ❌ none |
| `20260605142640` | `create_bbf_calling_cards_batch_v1` | ❌ none |
| `20260605152251` | `lockdown_bbf_calling_cards_batch_v1_rls` | ❌ none |
| `20260606051458` | `bbf_tiktok_oauth_tokens` | ❌ none |
| `20260606210346` | `bbf_meta_publish_config` | ❌ none |
| `20260607013932` | `bbf_card_distributor_cron` | ❌ none |
| `20260607142639` | `funnel_scorer_protocol_scores_telemetry` | ❌ none |
| `20260607185329` | `proof_dashboard_bbf_users_self_read` | ❌ none |
| `20260607185524` | `drip_orchestrator_wiring` | ❌ none |
| `20260607185709` | `drip_propose_use_custom_type` | ❌ none |
| `20260609010244` | `bbf_verify_user_pin_add_sports_protocol` | ↔ `20260609130000_..._sports_protocol.sql` |
| `20260610132703` | `bbf_health_connect_layer` | ❌ none |
| `20260613015415` | `seal_security_definer_views` | ❌ none |
| `20260614213613` | `create_bbf_reels_batch_v1` | ❌ none |
| `20260615182505` | `add_has_seen_sports_welcome` | ❌ none |
| `20260619001637` | `restore_bbf_coach_audio_cache` | ❌ none |
| `20260620195439` | `20260620160000_vapi_full_decommission` | ↔ `20260620160000_vapi_full_decommission.sql` |
| `20260629040758` | `bbf_loop_breaker_per_athlete_resolve` | ↔ `20260628010000_bbf_loop_breaker_per_athlete.sql` |
| `20260703192412` | `bbf_lab_recompute_cron_vault_auth` | ↔ `20260703200000_bbf_lab_recompute_cron.sql` |
| `20260704000303` | `bbf_vocab_seed_source_fix` | ❌ none |
| `20260704003013` | `bbf_log_language_attempt_phase_fix` | ❌ none |
| `20260706025552` | `bbf_nutrition_intake_mealkey_full_unique` | ❌ none |
| `20260709194526` | `bbf_premium_audio_engine_touch_rpc` | ❌ none |
| `20260711134744` | `create_content_vault` | ↔ `20260712130000_content_vault.sql` |
| `20260711141335` | `content_vault_constraints_and_bgm` | ❌ none |
| `20260711141622` | `content_vault_read_policy` | ❌ none |
| `20260711141748` | `content_vault_realtime` | ❌ none |
| `20260713183049` | `bbf_pin_security_recovery` | ❌ none |
| `20260713235500` | `bbf_pin_recovery_reset_audit` | ❌ none |
| `20260713235717` | `bbf_pin_recovery_reset_audit_channel_fix` | ❌ none |
| `20260714005049` | `bbf_readiness_axis_distribution` | ❌ none |
| `20260714005143` | `bbf_readiness_axis_distribution_fix` | ❌ none |
| `20260714225434` | `bbf_athlete_dossier_ambiguity_fix` | ❌ none |
| `20260715011455` | `bbf_sports_tables_anon_lockdown` | ❌ none |
| `20260715012153` | `bbf_resolve_uid` | ❌ none |
| `20260715013102` | `bbf_generic_ip_rate_limit` | ❌ none |
| `20260715014736` | `bbf_oauth_vault_session` | ❌ none |
| `20260715014854` | `bbf_youth_intake_status_token_gate` | ❌ none |

> Several of these are **security-critical** (`seal_security_definer_views`,
> `bbf_sports_tables_anon_lockdown`, `rls`-adjacent lockdowns). Their absence from git
> means a repo-driven rebuild would silently **lose hardening that is live today.**

### 🔢 Duplicate Version Prefixes — 6 versions across 13 files

`schema_migrations.version` is the **PRIMARY KEY**. These files can never all be
represented in the ledger. **This alone makes a full repair arithmetically impossible.**

| Version | Files claiming it |
|---|---|
| `20260601170000` | `coach_analytics_rpcs`, `relink_akeem_vault_email` |
| `20260603002000` | `bbf_monetization_intelligence`, `bbf_wearable_vault_token` |
| `20260603004000` | `bbf_admin_set_tier_allowlist_sync`, `bbf_wearable_readiness_admin_rpc` |
| `20260605000000` | `bbf_card_distributor_vault_reader`, `bbf_verify_user_pin_restore_plan_source` |
| `20260707120000` | `bbf_content_manager_queue`, `bbf_nutrition_daily_sync` |
| `20260709120000` | `bbf_admin_roster_telemetry`, `bbf_curriculum_engine`, `bbf_premium_audio_engine` ⚠️ **3 files** |

**Non-conforming file** (ignored by tooling, retained deliberately):
`DEPRECATION_STAGED_20260711_acwr_load_pipeline.sql`

---

## ❌ Why Ledger Repair Was Rejected

`supabase migration repair` / direct `INSERT` into
`supabase_migrations.schema_migrations` was **evaluated and rejected** on 2026-07-15:

1. **Impossible** — 6 duplicate versions cannot be inserted against a primary key.
2. **Dishonest** — it would signal "100% in sync" while ~33 prod migrations remain
   absent from the repo. It hides the drift instead of fixing it.
3. **Unverifiable** — proving local ≡ prod requires a shadow-DB diff (CLI + Docker),
   neither of which is available. No claim of physical equivalence can be made.
4. **Irreversible in effect** — marking a file "applied" permanently skips it. Any
   file wrongly repaired is a migration that will *never* run.

## 🛠️ The Real Fix (when there is time to do it properly)

**Baseline squash** — the standard remedy for divergence this deep:

1. `pg_dump --schema-only` production → a single authoritative baseline migration.
2. Archive the 201 legacy files to `supabase/migrations/_archive/`.
3. Reset the ledger to that one baseline.
4. Local becomes a faithful record of prod; normal migration flow resumes from a
   clean line.

**Do not attempt this as an end-of-day task.** It is a dedicated, unhurried piece of
work with a verified backup taken first.

---

## 🔐 Phase 1.6 Hardening — the state this file protects

Applied 2026-07-15 (ledger `20260715200257 production_security_hardening`), after an
audit found these **live in production**:

| Finding | Before | After |
|---|---|---|
| `bbf_compute_acwr` IDOR — `SECURITY DEFINER`, caller-supplied `p_athlete_id`, **no ownership check** | `EXECUTE` granted to `authenticated` → any logged-in user could read **any** athlete's training load | `service_role` + `postgres` only |
| `research_vault_auth_read` — `using (true)`, no tier gate | Every authenticated user could read the whole corpus | Policy **dropped**; RLS **enabled with 0 policies** |
| `tg_research_vault_embed` — sent `coalesce(v_secret,'')` | Failed closed but **silently** | Aborts + `RAISE WARNING` |

**Verified post-apply:** `anon` and `authenticated` hold `EXECUTE` on **none** of
`bbf_compute_acwr`, `query_research_embeddings`, `bbf_embed_webhook_secret`;
`service_role` retains all three. `research_vault`: RLS on, 0 policies. Zero
ERROR-level security advisors.

> `research_vault` will show the advisor **`rls_enabled_no_policy` (INFO)**. **This is
> intentional and correct** — service-role-only by design. Do **not** "fix" it by
> adding a read policy.

---

*Generated from a full ledger-vs-filesystem scan, 2026-07-15. Re-run the scan before
trusting these counts after any further `apply_migration` calls.*
