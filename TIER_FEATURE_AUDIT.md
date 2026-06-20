# BBF Tier × Feature Mapping — System Reality Audit

**Generated:** 2026-06-04 · **Mode:** Read-only (no DB mutations)
**Sources:** Live Supabase `ihclbceghxpuawymlvgi` (`execute_sql` / `list_tables` / `list_edge_functions`), `frontend/src/lib/{entitlements,pricingMatrix,useEntitlement}.js`, `supabase/functions/stripe-webhook`, and a live Stripe spot-check (`acct_1TLzQCQ4j3uHTi7P`).

> Machine-readable companion: `tier-feature-audit.json`.

> **UPDATE 2026-06-07:** The Access-Control kill-switch (flag #7 below) has since been **applied to production** by parallel swarm work — `20260604174357 bbf_access_control_kill_switch` + `20260604230927 bbf_verify_user_pin_restore_plan_source` (a regression fix for its plan-source read). Verified live: `bbf_validate_vault_session` + `bbf_admin_set_access_status` exist, and `bbf_verify_user_pin` / `bbf_sync_vault_session` / `bbf_sync_readiness` all carry the `access_status` lock guard. **Do NOT re-run the raw `20260602120000` migration file — it predates the RESTORE fix and would reintroduce the login-path regression.** Flag #7 is RESOLVED.

---

## TL;DR — what's real vs. what the brief assumed

| Brief assumption | Reality |
|---|---|
| Tiers are `gateway / architect / sovereign` | Those are **legacy** slugs. Canonical live set = **13 new slugs** (catalyst/momentum/autonomous, fuel_*, rising_athlete, 6 hybrids). |
| 22 edge functions | **33 deployed & ACTIVE** (25 in repo, 8 deployed-only). |
| `bbf_feature_gates` table maps Gateway→X, Architect→X+Y… | **No such table.** Gating is **frontend-only**, **cosmetic**, **fail-open** — explicitly "not an access-control security boundary." |
| `bbf_readiness` = wearable sync (dormant?) | `bbf_readiness` = **manual** in-app readiness, **LIVE (721 rows)**. The actual **wearable device sync** (`bbf_wearable_readings`) is **DORMANT (0 rows)**. |
| Sports Hub mock data? | **LIVE — real athlete data.** |
| Nutrition Locker callable? | **LIVE & callable.** |

---

## 1 · Pricing tiers — `bbf_tiers` (13 rows, LIVE)

All 13 rows are seeded and live. **Every row's `stripe_price_id` and `stripe_payment_link` are `NULL` in the DB** — the live checkout links exist only in `pricingMatrix.js` + the webhook's `PRICE_TO_TIER` map (drift, see §6). Prices are consistent across DB ↔ frontend ↔ Stripe (spot-checked Autonomous = `price_1TdtVDQ4j3uHTi7PP2uWTj0y` → 4999 USD ✓).

| Tier | Price | Billing | Access group | Tabs unlocked | Status |
|---|---|---|---|---|---|
| **Catalyst** (`catalyst`) | $9.99/mo | recurring | FITNESS_BASE | program, generator, cardio, mindset | live |
| **Momentum** (`momentum`) | $19.99/mo | recurring | FITNESS_PRO | + prehab | live |
| **Autonomous** (`autonomous`) ★ Most Chosen | $49.99/mo | recurring | FITNESS_PRO | + prehab | live |
| **Fuel: Foundation** (`fuel_foundation`) | $7.99/mo | recurring | NUTRITION | nutrition | live |
| **Fuel: Performance** (`fuel_performance`) | $14.99/mo | recurring | NUTRITION | nutrition | live |
| **Fuel: Sovereign** (`fuel_sovereign`) ★ | $29.99/mo | recurring | NUTRITION | nutrition | live |
| **Rising Athlete** (`rising_athlete`) ★ Youth Flagship | $14.99/mo | recurring | YOUTH | /sports + Kinematic HUD | live |
| **Kickstart 6-Wk 3×** (`kickstart_6wk_3x`) | $399 | one-time | ALL (God Mode) | everything | live |
| **Kickstart 6-Wk 4×** (`kickstart_6wk_4x`) | $499 | one-time | ALL | everything | live |
| **Transformation 8-Wk 3×** (`transformation_8wk_3x`) | $499 | one-time | ALL | everything | live |
| **Transformation 8-Wk 4×** (`transformation_8wk_4x`) | $649 | one-time | ALL | everything | live |
| **Sovereign 12-Wk 3×** (`sovereign_12wk_3x`) ★ Founder-Direct | $699 | one-time | ALL | everything | live |
| **Sovereign 12-Wk 4×** (`sovereign_12wk_4x`) | $899 | one-time | ALL | everything | live |

**Legacy slugs (NOT in `bbf_tiers`, still honored)** for grandfathering until the monolith storefront retires: `lite`→FITNESS_BASE · `gateway`→FITNESS_PRO · `architect`→FITNESS_PRO · `sovereign`→ALL · `youth_athlete`→YOUTH · `nutrition_essentials`→NUTRITION · `nutrition_platinum`→NUTRITION. Webhook default on an unresolvable tier = `gateway`.

**Live user distribution (8 users):** `sovereign`×6, `gateway`×1, `rising_athlete`×1 — i.e. **no live user is on any canonical fitness/nutrition slug yet.**

---

## 2 · Edge functions — 33 deployed & ACTIVE

> ⚠️ Edge functions are **not tier-gated server-side.** `entitlements.js` gates only the UI tab; the underlying (paid) function stays callable. "Accessible per tier" = "feeds a tab that tier's UI unlocks."

- **In repo & deployed:** all 25 repo functions are live.
- **Deployed-only (not in repo tree):** `bbf-user-profile`, `bbf-lead-concierge`, `bbf_vision_scout`, `bbf-meal-macros`, `bbf-meal-image`, `bbf-agentic-cardio-shadow`, `bbf-agentic-cardio-antagonism-shadow`, `bbf-agentic-prehab-shadow`.
- **JWT-verified:** only `bbf_vision_scout` and `bbf-science-digest` (`verify_jwt=true`); the rest use custom/admin-token/webhook auth.

| Tier / surface | Edge functions feeding it |
|---|---|
| Fitness core (Catalyst+) | bbf-co-coach · bbf-agentic-pathfinder · bbf-agentic-orchestrator · bbf-ai-hub · bbf-agentic-cardio (+2 shadows) · bbf-midnight-haiku |
| Prehab (Momentum/Autonomous + God) | bbf-agentic-prehab (+ shadow) |
| Nutrition (Fuel + God) | bbf-meal-macros · bbf-meal-image |
| Youth / Sports / Kinematic HUD | bbf-agentic-kinematics · bbf_vision_scout · bbf-agentic-comlink · bbf-agentic-peaking · bbf-agentic-forecasting · bbf-admin-roster |
| i18n / comms / voice | bbf-agentic-linguist · bbf-agentic-immersion · bbf-agentic-interrogator · bbf-tts-eleven |
| Science Hub | bbf-science-digest |
| Lead/sales (pre-purchase, ungated) | bbf-lead-capture · bbf-lead-concierge · bbf-agentic-sales-router |
| Billing | stripe-webhook |
| Ops/system | bbf-sentinel · bbf-command-feed · bbf-user-profile · bbf-wearable-ingest |

---

## 3 · Feature-gate audit

**There is no `bbf_feature_gates` table.** The real gate is `frontend/src/lib/entitlements.js`, resolved at Vault landing via the LIVE RPC `bbf_get_trial_state`. Its own header calls it a **cosmetic, fail-open upsell funnel** — every tab stays visible; locked tabs render a padlock + upgrade CTA. A network blip or unknown tier → **God Mode** (never locks a payer). The only hard, binary gate is `bbf_users.access_status` (`locked|unlocked`; all 8 users currently `unlocked`).

```
FITNESS_BASE  → program, generator, cardio, mindset        (prehab + nutrition padlocked)
FITNESS_PRO   → + prehab                                    (nutrition padlocked)
NUTRITION     → nutrition                                   (all physical/cognitive padlocked)
YOUTH         → /sports + Kinematic Form HUD                (advanced Vault tabs padlocked)
ALL (God)     → everything                                  (hybrids, legacy sovereign, admins, trial)
NONE          → everything sellable padlocked
hub + settings → universal (never gated)
```

The Gateway→X / Architect→X+Y / Sovereign→X+Y+Z model the brief asked for **does not exist** in those terms. The closest live stacking is **within** a path: Catalyst ⊂ {Momentum = Autonomous}; and Fuel Foundation = Performance = Sovereign (identical access). See §6.

---

## 4 · Wearable sync — split verdict

| Layer | Table | Rows | Verdict |
|---|---|---|---|
| **In-app readiness** (manual: score/sleep/soreness) | `bbf_readiness` | **721** (5/13–5/31) | **LIVE** |
| **Device / wearable sync** | `bbf_wearable_readings` | **0** | **DORMANT** |

`bbf-wearable-ingest` (v5) is deployed but no device data is flowing; the `bbf_wearable_acwr` analytics RPC is **not applied to prod**. The brief conflated the two — in-app readiness logging is live; the wearable device integration is dormant pending a real feed / app review.

## 5 · Sports Hub & Nutrition Locker

- **Sports Hub — LIVE, real data (not mock).** `bbf_athlete_progression` = 11 rows (basketball ×5, football ×5, soccer ×1) through 5/30; coaches see rosters via `bbf-admin-roster` (v13) + `coach_analytics` RPCs. Caveat: `bbf_active_clients` (5) = 4 real "Pending" + 1 "BBF Webhook Test" artifact.
- **Nutrition Locker — LIVE & callable.** `bbf-meal-macros` (v9) + `bbf-meal-image` (v10) deployed; `bbf_meal_macros` 53 rows (to 5/31), `bbf_meal_logs` 10 rows (to 5/29).
- **Cardio engine — IN-PROGRESS:** deployed (`bbf-agentic-cardio` v19 + 2 shadows) but `bbf_cardio_protocols`/`bbf_cardio_logs` are empty.
- **Conversions capture — STAGED/EMPTY:** `bbf_conversions` 0 rows despite live payment links; `bbf_monetization_metrics` deployed but unwired.

---

## 6 · Flagged discrepancies (action items)

1. **Tier taxonomy** — marketing must use the canonical 13, not legacy `gateway/architect/sovereign`.
2. **Edge count** — 33 live, not 22.
3. **No feature-gate table** — gating is cosmetic & fail-open; do not market it as enforced entitlement/security.
4. **Stripe-link drift** — backfill `bbf_tiers.stripe_price_id` / `stripe_payment_link` from `pricingMatrix.js`, or have the frontend read the table, so one source of truth exists.
5. **Within-category access collapse** — the 3 Fuel tiers grant identical UI access; Momentum & Autonomous grant identical UI access. Price ladders aren't backed by distinct gated surfaces.
6. **Autonomous copy mismatch** — says nutrition "fully unlocked," but the nutrition tab maps to `GROUP.NUTRITION`, not `FITNESS_PRO`.
7. ~~**Kill-switch not deployed**~~ → **RESOLVED 2026-06-07.** Applied to prod (`20260604174357` + `20260604230927` RESTORE fix); all three functions now carry the `access_status` guard and both kill-switch RPCs exist. The CEO "Lock Account" control is **live**. ⚠️ Do not re-run the raw `20260602120000` file — it predates the RESTORE fix.
8. **Wearable device sync dormant** (0 rows); ACWR RPC undeployed.
9. **Zero conversions captured** through the new pipeline despite live Stripe links.
