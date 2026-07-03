# THE CRUCIBLE AUDIT — Red-Team Report
## BBF Lab Phase 1–3 · branch `claude/bbf-lab-phase-1-docs-09ejw4`

**Auditor:** Fable 5 (Red-Team Lead) · **Date:** 2026-07-03 · **Production DB:** untouched (staging-only review)
**Method:** 5 parallel adversarial sweeps (gram boundary · RLS/auth · concurrency · UI degradation · deployment matrix), every structural CRITICAL/HIGH re-verified by hand against the source.

---

## VERDICT

**DO NOT deploy as-is.** The architecture is sound and the daily-rollup idempotency is genuinely clean, but there are **2 CRITICAL** and **6 HIGH** defects that will corrupt data or expose athlete records on a live, concurrent, paid-traffic system. All are small, surgical fixes. Ship the remediation bundle (`docs/crucible-remediation.sql` + 5 edge-function patches below), then deploy via the validated Wave A→C script in §6.

**Severity tally:** CRITICAL 2 · HIGH 6 · MEDIUM 6 · LOW 5 · INFO 4.
**Certified clean:** all Phase-1 table RLS; all 5 Phase-3 RPCs (SECURITY DEFINER + vault-token identity); the gram standard across DB/edge/frontend; storage-bucket privacy; the mounted Day-1 Hub degradation contract; daily-rollup upsert idempotency.

> **Correction to note up front:** the concurrency sweep flagged "duplicate `athlete_profiles` (no UNIQUE on user_id)" as CRITICAL. **That premise is false** — `athlete_profiles_user_id_key UNIQUE(user_id)` exists (migration `20260620170000`). The orchestrator's inline comment claiming otherwise is wrong. Real impact is reclassified to **HIGH-3** below (a racing insert *errors* rather than duplicates). The fix (upsert) still applies.

---

## VECTOR 1 · THE GRAM BOUNDARY — ✅ CERTIFIED SECURE

The gram standard holds end-to-end. No float mass, kg, or lb is persisted past any boundary.

- `bbf_sets.load_g` — `bigint generated always as (round(weight_lbs::numeric * 453.59237)) stored` — exact multiplier, integer, `::numeric` cast blocks float drift. ✅
- `lean_mass_g`, `body_mass_g`, `height_mm`, `tonnage_g`, `protein_g/carbs_g/fat_g`, `ee_kcal_est/sweat_loss_g_est/rehydration_g` — all `BIGINT`/`INTEGER` grams. **No `NUMERIC`/`DOUBLE PRECISION` mass column exists** (NUMERIC cols are all AU/ratio/percent/LUFS).
- Edge cores gram-denominated: `GRAMS_PER_POUND = 453.59237`, `GRAM_MET_KCAL = 1.75e-5`, `K_SWEAT 1.5e-4…3.0e-4`, `rmr_lean_coeff = 0.022/g`; every mass write wrapped in `Math.round`.
- Frontend submits pounds to the legacy `weight_lbs` surface; DB generates `load_g`. No client-side conversion with a wrong multiplier.

**Findings (non-blocking):**

| ID | Sev | Location | Issue | Fix |
|----|-----|----------|-------|-----|
| G-1 | MEDIUM (gap, not leak) | `20260702130000_...onboarding_identity.sql:8-23` | The intake "submit RPC" that converts lb/kg→`body_mass_g` is **referenced but never authored** → `bbf_pathfinder_intakes.body_mass_g` is never populated; cold-start always falls to the 81647 g persona default. | Author the submit RPC using `round(weight_lb::numeric*453.59237)` / `round(weight_kg::numeric*1000)` / `round(height_in*25.4)` in RPC-local scope. (Blueprint §0.1.) |
| G-2 | LOW | `frontend/src/components/vault/nutritionEngine.js:24` | Truncated constant `wt * 0.453592` in a **non-persisted** kcal BMR intermediate (<0.0002% error). Not a boundary leak. | `const kg = wt * 0.45359237;` for consistency. |
| G-3 | INFO | `PathfinderForm.jsx:256` | Weight written to legacy free-text `bbf_active_clients.height_weight` (not a gram column). | None — but this form doesn't feed `body_mass_g` (see G-1). |
| G-4 | INFO | `fitness_fueling.sql:51` | `creatine_g NUMERIC` — documented supplement-dose (tenths of g), outside the body-mass/load law. | None. |

---

## VECTOR 2 · SECURITY & RLS + AUTH SPLIT

Phase-1 RLS is **exemplary** — every new table ships `enable + force row level security` + `revoke all from anon, authenticated` with zero anon table policies. All 5 Phase-3 RPCs are `SECURITY DEFINER` and resolve identity from the vault token via `_bbf_uid_from_vault_token` (never trust caller `athlete_id`). Storage: `directed-v1` private with service-role-only + signed-read-after-ownership-check; `sovereign-fragments`/`language-fragments` deliberately public reference audio. **Certified clean.**

**Findings:**

| ID | Sev | Location | Issue |
|----|-----|----------|-------|
| **S-1** | **HIGH** | `20260619150000_bbf_video_prescriptions.sql:35-38` | INSERT policy `WITH CHECK (true)` with **no `TO` clause → defaults to PUBLIC** → **anon can INSERT arbitrary rows** (any user_id). Policy is misnamed "Service role" (service_role bypasses RLS and never needed it). |
| **S-2** | **HIGH** | same table, production | CEO-reported **RLS DISABLED in prod** (drift — migration enables it; prod diverged). Table fully exposed to any role holding GRANTs. |
| **S-3** | **HIGH** | `bbf-agentic-cns-video-prescription/index.ts:83-145` | Handler has **NO auth check of any kind**, reads `body.user_id`, and writes it into `bbf_video_prescriptions` via service role. Any anonymous caller injects prescription rows against any athlete. Direct violation of the vault-token plane. |
| **S-4** | **HIGH** | `bbf-agentic-immersion/index.ts:214-221`, `bbf-agentic-linguist/index.ts:174-181` | **Fail-OPEN**: `if (expectedToken) { …check… }` — if `BBF_COACH_AGENT_TOKEN` is unset, the auth block is skipped and the function runs unauthenticated (unbounded Anthropic spend + arbitrary athlete-data writes). Opposite of the sentinels, which fail closed. |
| S-5 | MEDIUM | `bbf-agentic-immersion:147-183`, `bbf-agentic-linguist:197-202`, `stripe-webhook:72` | (a) immersion/linguist resolve athlete by **caller-supplied `body.uid`** for writes — safe *only* while S-4 is fixed and the admin token never ships to a browser. (b) **Initial welcome PIN uses `Math.random()`** (non-CSPRNG); the retry path correctly uses `securePin`. |
| S-6 | LOW | 12 sites (sentinels, studio-io, webhook) | Secret comparisons use non-timing-safe `===`. High-entropy secrets → impractical, but harden. `bbf-email-events-webhook:54` also accepts `?secret=` (lands in logs). |
| S-7 | LOW | `bbf-studio-batch-compiler:97,115` | `target_athlete_id` interpolated into a PostgREST filter with **no UUID validation** (directed-delivery validates; this doesn't). Admin-gated → LOW. |

---

## VECTOR 3 · CONCURRENCY / RACES / IDEMPOTENCY

**Clean where it counts:** the daily-rollup tables (`athlete_workload_daily`, `athlete_recovery_state`, `athlete_nutrition_targets_daily`, `athlete_body_metrics`, brief context/playlists) use correct `upsert onConflict` keys and recompute EWMAs from history read with `.lt('day', day)` — **fully idempotent on re-run**. The Stripe ledger step-4 `on conflict (event_id) do nothing` is genuinely atomic. Floor-sync double-tap is absorbed (deterministic Dexie key + `flushing` re-entrancy guard). Check-in modal + vocab flashcard both have disabled-while-pending guards.

**But there is NO advisory lock, job-claim, or run-ledger anywhere in the cron path** — so overlapping cron fires and hot-path/nightly collisions are unguarded. Findings:

| ID | Sev | Location | Issue | Fix |
|----|-----|----------|-------|-----|
| **C-1** | **CRITICAL** | `bbf-fueling-sentinel/index.ts:136-145` | Volume-fingerprint **EWMA + `observation_count` double-apply**. Read-modify-write folds `todayStrain` into the *already-stored* EWMA; a retry / overlapping run folds it **again** and over-counts the counter → corrupts heavy-day prediction driving the entire carb-ramp schedule. Silent corruption. | Recompute fingerprint from the idempotent `athlete_workload_daily` daily strain, OR gate with a per-`(athlete,day)` run-ledger `insert … on conflict do nothing` + `pg_advisory_xact_lock(hashtext(athlete_id))`. |
| **C-2** | **CRITICAL** | `bbf_stripe_fulfillment_transaction` `20260601010000:42-80` | Replay guard is **check-then-act, not atomic**. `if exists(ledger)` at step 0 runs READ COMMITTED and can't see a concurrent sibling's uncommitted ledger row; the only atomic guard is `ON CONFLICT` at step 4 (end). Two concurrent deliveries of the same `event.id` (or a retry into the pre-commit window) **both provision + both dispatch a welcome email with a different PIN** — one email's PIN is dead. | Add `perform pg_advisory_xact_lock(hashtextextended(p_event_id,0));` as the RPC's first statement (before the exists-check), OR invert to `INSERT … ON CONFLICT (event_id) DO NOTHING RETURNING` first and treat no-row as replay. |
| **H-1** | HIGH | `bbf-workload-sentinel/index.ts:184-197` | Blind `INSERT` into `prehab_queue`, which has **only a non-unique index** (`idx_pq_athlete_day`) — no unique key. Confirmed. Hot-path floor-sync + nightly cron for the same athlete/day both read the same snapshot and both INSERT → **duplicate `queued` rows**, surfaced doubled in the Hub. The function's header comment claiming a UNIQUE key is **false**. | Add `create unique index uq_prehab_active on prehab_queue (athlete_id, scheduled_for, joint_zone) where status in ('queued','served');` + switch to `upsert onConflict`. |
| **H-2** | HIGH | `bbf-cold-start-orchestrator:252-308` | Same check-then-insert on unkeyed **`bbf_cardio_prescription`** (no unique on `(user_id,prescribed_for)`) + `athlete_injury_history` + session-less `bbf_onboarding_pipeline` (NULL `checkout_session_id` defeats the unique). Concurrent orchestrator invocations (webhook gate + heal + sweeper) → duplicate day-1 rows. | Add `bbf_cardio_prescription (user_id,prescribed_for) where status='active'` + `athlete_injury_history (athlete_id,joint_zone,reported_by)` uniques; upsert `do nothing`. |
| **H-3** | HIGH *(was C2, corrected)* | `bbf-cold-start-orchestrator:183-194` | `athlete_profiles` **DOES** have `UNIQUE(user_id)` (`athlete_profiles_user_id_key`) — the code comment "no UNIQUE" is wrong. So concurrent runs do **not** duplicate; the losing `INSERT` **throws a unique-violation** and fails that orchestrator run (partial cold-start, then healed by the sweeper). Availability bug, not corruption. | Convert to `upsert(..., { onConflict:'user_id', ignoreDuplicates:true })` then re-select — removes the throw. |
| **H-4** | HIGH | `bbf-fueling-sentinel:171-180` | `nutrition_phase_state` UPDATE-supersede then **blind INSERT**. The partial-unique `where status='active'` prevents dual-active (good), but two overlapping runs collide on the INSERT → **unique violation thrown → whole athlete's nightly returns 500** with fingerprint/schedule half-written. | Collapse to one statement: `insert … on conflict (athlete_id) where status='active' do update …`, inside an advisory lock. |
| M-1 | MEDIUM | `bbf_review_vocab_term` `20260703140000:114-139` | `ON CONFLICT` serializes writers, but there is **no per-attempt idempotency** — a double-submit that beats the client guard increments `attempts+2`, `correct+2`, advances `box_level` by **two**, over-pushes `due_at`. SRS drift. | Add `attempt_id uuid` + `unique(athlete_id,language,term,attempt_id)` dedup, or no-op repeat flips within a 2 s window. |
| M-2 | MEDIUM | `bbf-language-sentinel:56-63` + `language-core.ts:53-58` | `boostDecay` re-multiplies `priority_boost × 0.9` keyed on `last_reviewed` (which the sentinel doesn't touch) → a second run in-window compounds (0.9→0.81→…). Non-idempotent. | Gate on a `boost_decayed_on = today` marker, or recompute from an absolute base. |
| M-3 | MEDIUM | `bbf-language-sentinel:59-63` vs `bbf_review_vocab_term` | Blind `update box_level` from a stale read can **clobber a user's concurrent box promotion** (hot path vs nightly). | Optimistic `update … where box_level = :read_value`, or move into a recompute-from-live RPC. |
| M-4 | MEDIUM | `bbf-onboarding-sweeper:98-129` | `heal_attempts += 1` read-modify-write with no `WHERE heal_attempts = :read` and **no job-claim** → overlapping sweeps double-process a row and under-count the escalation guard. | Atomic claim: `update … set heal_attempts = heal_attempts+1 where id=:id and state=:observed returning heal_attempts` — process only if a row returns. |

---

## VECTOR 4 · THE DEGRADATION CONTRACT — ✅ CERTIFIED (mounted surface)

The only Phase-3 athlete-facing surface actually mounted is **`DashboardHub`** (ClientVault → hub tab). It honors the contract end-to-end:

- Never blank/crash on null/loading/error/hang — every slice read as `hydration?.slice ?? null`; the grid always renders; `loading` only adds a CSS class (not a render gate → no spinner-only state).
- Real Layer-2 fallback: live-row → RPC `defaults` → client `LAYER2_DEFAULTS` (gram-native constants). "Calibrating" chip localized EN/ES/PT.
- Gram formatters NaN-proof: `formatGrams`/`formatKcal` guard `null|''|!isFinite → '—'`. No `NaN g`.
- Single atomic `bbf_hub_hydration` RPC — no `Promise.all` fan-out, so one failed card can't kill the grid.

**Findings:**

| ID | Sev | Location | Issue | Fix |
|----|-----|----------|-------|-----|
| U-1 | LOW | `hub/CardioCard.jsx:34` | `ee_kcal_est` null renders `"— kcal"` (unit appended unconditionally) on partial-live data. | `value: c.ee_kcal_est != null ? \`${formatKcal(...)} ${hs.kcalUnit}\` : '—'` |
| U-2 | INFO | `hub/useHubHydration.js:70-73` | No timeout/abort — safe only because cards ignore `loading`. Fragile if a future change gates the grid on `loading`. | Add `AbortController` + 8 s timeout resolving to `{error:'hub_timeout', hydration:null}`. |
| **U-3** | HIGH *(latent — UNMOUNTED)* | `fitness/useBriefPlayer.js:54`, `PrehabQueueMatrix.jsx:24`, `language/useVocabGym.js:27` | These Phase-3.4 hooks **infinite-spin on a hung (not errored) RPC** — `try/catch` only guards a *thrown* error; `loading` inits `true` and never clears. **Not mounted on any athlete route today** (Command-Center/admin only or built-but-unmounted) → no live impact, but they MUST get timeouts before being wired to the Hub. | Wrap each RPC in a `Promise.race([rpc, timeout→degraded])` before mounting. |

---

## VECTOR 5 · DEPLOYMENT MATRIX — validated with corrections

**Claimed chain "Phase 1 → 2.2 Fueling → Phase 3 RPCs → Edge Fleet → Studio Compiler" is CORRECT in relative order but mis-typed.** "2.2 Fueling" and "Phase 3 RPCs" are **later-timestamped migrations in the same `apply_migration` wave** (timestamp order = dependency order — verified, no forward references). "Studio Compiler" is two members of the edge fleet. Correct model = **3 waves**. Hazards:

| ID | Sev | Issue | Mitigation |
|----|-----|-------|-----------|
| D-1 | HIGH (operational) | `20260702140000:198` `bbf_sets ADD COLUMN load_g GENERATED STORED` takes `ACCESS EXCLUSIVE` and **rewrites the entire floor-log table** — blocks all set reads/writes during the rewrite. | Apply in a low-traffic window; size with `SELECT count(*) FROM bbf_sets` first. |
| D-2 | MEDIUM | `20260702134000:70-101` drops+recreates `bbf_vocab_mastery` unique constraint and re-points its RPC — between DROP and CREATE the live RPC's `ON CONFLICT` would 42P10. | Safe **only as one transactional migration file** — do NOT split. `apply_migration` is transactional → OK. |
| D-3 | MEDIUM | **No cron/pg_net is registered** for the recompute fleet (workload/fueling/language sentinels, cardio/stitch routers) — grep shows nothing newer than `20260626160000`. They will **never run** post-deploy until a schedule is added. | Register schedules in Wave C pointing at already-deployed functions (each accepts `X-Cron-Secret`). |
| D-4 | MEDIUM | `BREVO_WEBHOOK_SECRET` is a **new required secret** — `bbf-email-events-webhook` 503s without it, silently killing the bounce loop. | Set before pointing the Brevo dashboard webhook at the endpoint. |
| D-5 | LOW | Cold-start gate defers dispatch if neither `BBF_COACH_AGENT_TOKEN` nor `CRON_SECRET` is set. Fails soft (retry worker). | Ensure ≥1 set with the stripe-webhook deploy. |
| D-6 | LOW | `sovereign_audio_fragments`/`language_audio_fragments` ship **empty** → briefs stay "Calibrating" until the audio bake runs. Fail-open, not a blocker. | Run the bake in Wave C. |

SW cache bump **verified** (`frontend/public/sw.js` `bbf-react-v200`, ↑ from v199). All migrations idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS`). Production-table ALTERs are additive/nullable except D-1/D-2. Edge functions read env with `?? ''` + request-time 503 → no boot crashes.

---

## §6 · VALIDATED MASTER DEPLOYMENT SCRIPT

**Blocking pre-condition:** apply the remediation bundle (`docs/crucible-remediation.sql` + the 5 edge patches in §7) **before** go-live, or at minimum fold the SQL uniques into Wave A and the auth patches into Wave B.

### WAVE 0 — Pre-flight (reversible, no state change)
1. Set/verify Supabase function secrets: **`BREVO_WEBHOOK_SECRET`** (new), `CRON_SECRET`, `BBF_COACH_AGENT_TOKEN`, `BREVO_WELCOME_TEMPLATE_{EN,ES,PT}`, `TWILIO_*`, `ONBOARDING_ALERT_EMAIL`, `ELEVENLABS_API_KEY`. **Do NOT enable the Brevo webhook yet.**
2. Size the D-1 rewrite: `SELECT count(*) FROM bbf_sets;` → pick a low-traffic window if large.

### WAVE A — Migrations, exact timestamp order (each via `apply_migration`, transactional)
3. `20260702120000_bbf_sovereign_briefing_score_aware_cache.sql`
4. `20260702130000_bbf_lab_p1_onboarding_identity.sql`
5. `20260702131000_bbf_lab_p1_fitness_fueling.sql`
6. `20260702132000_bbf_lab_p1_workload_recovery.sql`
7. `20260702133000_bbf_lab_p1_cardio_audio_stitching.sql`
8. `20260702134000_bbf_lab_p1_language_mastery.sql`  *(D-2 — keep atomic)*
9. `20260702135000_bbf_lab_p1_content_studio_v4.sql`
10. `20260702140000_bbf_lab_p1_dependencies_seeds_buckets.sql`  *(D-1 window; creates the 3 buckets)*
11. `20260702150000_bbf_lab_p22_fueling_state.sql`
12. `20260703120000_bbf_lab_p31_hub_hydration.sql`
13. `20260703140000_bbf_lab_p32_vocab_gym_rpcs.sql`
14. `20260703160000_bbf_lab_p34_athlete_reads.sql`
15. **`crucible-remediation.sql`** — the security + concurrency fixes (video_prescriptions RLS, the 3 missing UNIQUE indexes, the fulfillment advisory lock).
    - **Verify:** `to_regclass` non-null on new tables; `\df bbf_hub_hydration bbf_get_vocab_queue`; `SELECT id FROM storage.buckets WHERE id IN ('directed-v1','sovereign-fragments','language-fragments')` = 3; `get_advisors` shows zero "RLS disabled".
    - **Rollback:** additive/fix-forward; hard reverse of D-1 = `ALTER TABLE bbf_sets DROP COLUMN load_g` (rewrite).

### WAVE B — Edge functions (`deploy_edge_function`, `--no-verify-jwt` where noted) — apply §7 patches first
16. `bbf-cold-start-orchestrator` **first** (invoked by webhook + sweeper).
17. Recompute fleet: `bbf-workload-sentinel`, `bbf-fueling-sentinel`, `bbf-language-sentinel`, `bbf-smart-cardio-router`, `bbf-sovereign-stitch-router`.
18. Onboarding I/O: `bbf-onboarding-sweeper`, `bbf-email-events-webhook`, `bbf-resend-welcome`, then `stripe-webhook`.
19. Studio + voice: `bbf-studio-batch-compiler`, `bbf-studio-directed-delivery`, `bbf-readiness-score-voice`.
20. Changed LLM fns (with S-4 patch): `bbf-agentic-immersion`, `bbf-agentic-linguist`, `bbf-agentic-cns-video-prescription` (S-3 patch), `bbf-sovereign-briefing`, `bbf-midnight-haiku`, `bbf-weekly-brief-scenario-engine`.
    - **Verify:** POST each sentinel with `X-Cron-Secret` + test `athlete_id` → `ok:true`; `bbf-email-events-webhook` no-secret → 503, with-secret empty body → `ok:true, processed:0`; immersion/linguist with **no** admin token → **401** (confirms S-4 fixed).
    - **Rollback:** redeploy prior version (data-safe — writes idempotent-keyed after Wave A uniques).

### WAVE C — Frontend + triggers + verify
21. Merge branch → `main` (Render static + Pages rebuild; SW already bumped).
22. Point the **Brevo webhook** at `bbf-email-events-webhook` (secret now matches — D-4).
23. Register recompute cron/tripwires for the sentinels/routers targeting already-deployed functions (D-3).
24. Run the audio bake → populate fragment libraries (D-6).
25. **Post-deploy:** load Day-1 Hub, Vocab Gym, Prehab matrix, Brief player; run a Stripe **test** checkout → confirm `bbf_onboarding_pipeline.state` walks `paid → provisioned → cold_start_ready → activated` with exactly **one** welcome email; re-run `get_advisors`.
    - **Rollback:** revert the merge (re-bump SW), disable webhook + crons. Frontend fail-soft → no user stranded.

---

## §7 · EDGE-FUNCTION PATCHES (apply before Wave B)

**S-3 — `bbf-agentic-cns-video-prescription` (add auth, derive user server-side):**
```ts
// top of try{}, before reading body.user_id:
const vaultToken = body.vault_token ?? req.headers.get('x-bbf-vault-token');
const gate = await requireEntitlement({ supabaseUrl, serviceKey, vaultToken, feature: 'mindset' });
if (!gate.ok) return jsonResponse({ error: gate.denial.error }, gate.denial.status);
const userId = gate.ctx.user_id;            // use THIS everywhere; never body.user_id
```

**S-4 — immersion + linguist (fail CLOSED):**
```ts
const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
const sent = req.headers.get('x-bbf-admin-token') ?? '';
if (!expectedToken || sent !== expectedToken) return jsonResponse({ error: 'unauthorized' }, 401);
```

**S-5b — `stripe-webhook` PIN (CSPRNG + reject weak):**
```ts
function generatePin() {
  const WEAK = /^(\d)\1{5}$|^(?:012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210)$|^(19|20)\d{4}$/;
  const buf = new Uint32Array(1); let pin;
  do { crypto.getRandomValues(buf); pin = String(100000 + (buf[0] % 900000)); } while (WEAK.test(pin));
  return pin;
}
```

**C-2 — fulfillment RPC (serialize replay guard):** add as the FIRST statement of `bbf_stripe_fulfillment_transaction`, before the exists-check:
```sql
perform pg_advisory_xact_lock(hashtextextended(p_event_id, 0));
```

**H-3 — orchestrator profile create (remove the throw):**
```ts
const { data: up } = await supabase.from('athlete_profiles')
  .upsert({ user_id: userId, /* … */ }, { onConflict: 'user_id', ignoreDuplicates: true })
  .select('id').maybeSingle();
const { data: prof } = up ?? await supabase.from('athlete_profiles').select('id').eq('user_id', userId).maybeSingle();
```

**C-1 / H-1 / H-2 / H-4 — wrap each per-athlete nightly pass and the orchestrator cascade in an advisory lock** and rely on the new UNIQUE indexes (in the SQL bundle) so the `upsert onConflict` the code claims to do can actually be expressed. Minimal guard added to each sentinel loop body:
```ts
await supabase.rpc('bbf_try_athlete_lock', { p_athlete: profileId }); // pg_advisory_xact_lock wrapper
```

---

*Ruthless summary: the skeleton is strong, the RLS discipline is genuinely excellent, and the daily-rollup idempotency is textbook. The kills are all at the seams — an unauthenticated write endpoint, a fail-open token check, a non-CSPRNG credential, and four unguarded read-modify-write cron paths that a live concurrent load will find within a day. Fix the eight CRITICAL/HIGH items in §7 + the SQL bundle, deploy on the Wave A→C rails, and this is production-ready.*
