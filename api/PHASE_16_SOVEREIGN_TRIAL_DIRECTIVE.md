# Phase 16 — Sovereign Trial Backend Switch

**Created:** 2026-05-06 (closing message of Phase 15 session)
**Status:** Queued. Awaiting CEO greenlight on the open questions below.
**Tier classification:** §6.2 **Tier 2** — plan-then-greenlight. Touches auth/access surfaces with user-facing lockout consequences.
**Project lead:** Akeem (CEO). Next Claude session executes after the Q-list is answered.

---

## The problem (one sentence)

The Sovereign Trial toggle in the Mastermind Portal is currently a **cosmetic flag** — flipping it writes `trial_status` on `bbf_users` but does NOT lock the user out of any premium feature. The directive: make it a real gate.

## The goal (one sentence)

A user with `trial_status = 'inactive'` cannot access top-tier features. A user with `trial_status = 'active'` can. Admin (`akeem`) always wins per the existing `BBF_IS_ADMIN()` pattern.

---

## What's already in place — DO NOT REDO

| Layer | Component | Status |
|---|---|---|
| DB | `bbf_users.trial_status` column (CHECK `'inactive'\|'active'\|'completed'`) + `trial_start_date` + `updated_at` | ✓ migration `20260502040000_sovereign_trial_columns` applied (Phase 8) |
| DB | RPC `bbf_set_trial_status(p_uid text, p_active bool)` SECURITY DEFINER, slug-resolving | ✓ deployed |
| Frontend | `BBF_SYNC.toggleSovereignTrial(uid, active)` wrapper | ✓ in `bbf-sync.js` |
| Admin UI | Toggle in `mastermind-portal.html` with optimistic update + revert-on-failure | ✓ Phase 8 / PR #86 |
| Bypass | `BBF_IS_ADMIN()` at `bbf-app.html:4605` — Architect-everywhere | ✓ gates that OR with this stay open for Akeem |

---

## Open architecture questions (CEO answers BEFORE code is cut)

**Q1. WHICH surfaces gate behind the trial?**

Candidates (per current production state §3 of the handoff doc):

- Live AI Coach (Phantom Eye + Virtual Coach — Phase 15 Slices 1-6)
- Form Audit modals (`auditor-engine.js`, `prehab-auditor.js`)
- Sovereign Sentinel SVG with damaged-zone overlay (Phase 7)
- Wearable Sync (Phase 15 Slice 4)
- Friction Tracker (Phase 15 Slice 3)
- Bottom-nav tabs: Workout / Nutrition / Log / Prehab / Profile
- Mastermind Portal admin (already akeem-PIN-only; not in scope)
- Bespoke programming surface (Sovereign-tier exclusive; not currently rendered as a tab)

**Recommended scope:** ALL premium surfaces (Live Coach, Form Audit, Wearable, Friction Tracker, Sovereign Sentinel). Free surface stays accessible (Home tab, basic Log entry, Profile). Mirrors Phase 14 nutrition_only precedent.

**Q2. WHAT does the locked-out user see?**

- **(A) Hard modal takeover** — full-screen "Your Sovereign Trial has ended. Renew to continue." Mirrors `showRestrictedScreen()` at `bbf-app.html:7101` (used today for `access_status='locked'`).
- **(B) Soft degradation** — premium tabs hidden, free tabs accessible. Mirrors Phase 14 nutrition_only pattern.
- **Recommended:** **(A)** for users who HAD `'active'` and got flipped to `'inactive'` (clear "expired" UX); **(B)** for users who never started a trial in the first place.

**Q3. HOW does trial start / end happen?**

- Currently: admin manual toggle only.
- Should it auto-start on Sovereign Stripe purchase ($497 tier) + auto-end at N days (14? 7? 30?)?
- If yes: needs server-side cron OR client-side date check + RPC tick. The cron-server pattern from Vapi Phase 1 (`bbf_evaluate_streaks` at `0 17 * * *`) is the precedent.

**Q4. CROSS-DEVICE behavior.**

`trial_status` lives in `bbf_users`. Currently mirrored to `d.u[uid].trial_status` in localStorage. **On login, does the client fetch fresh from DB or rely on the cache?** If cache, a user who logs in on a new device wouldn't see the latest status. May need a fresh-fetch on every dashboard load via `BBF_SYNC.fetchUserProfile(uid)` (already exists at `bbf-sync.js:1401`, but doesn't currently include `trial_status` in its `select` clause — would need a one-line extension).

**Q5. PER-TIER applicability.**

Does this gate apply to Architect Hybrid users (`tier='architect'`) too if their access flips, or is it Sovereign-tier-exclusive (`tier='sovereign'`)?

**Q6. Composition with Phase 14 RBAC.**

Phase 14 added `nutrition_only` derive-on-read role for nutrition tier users. The Sovereign Trial gate should COMPOSE with it — a user can be `tier=nutrition_essentials` AND `trial_status='inactive'` and BOTH gates apply. Confirm composition direction (logical AND, not OR).

---

## Files the next session reads first

| File | Why |
|---|---|
| `mastermind-portal.html` — Sovereign Trial toggle | Admin UI surface |
| `bbf-sync.js` — `toggleSovereignTrial` + `fetchUserProfile` | RPC wrapper + read path |
| `bbf-app.html:4605` — `BBF_IS_ADMIN()` | Admin bypass pattern |
| `bbf-app.html:7101` — `showRestrictedScreen()` + `ENTER()` lockout flow | Existing hard-lockout pattern (`access_status='locked'`) |
| `bbf-app.html` — `BBF_IS_NUTRITION_ONLY()` + `BBF_APPLY_NUTRITION_GATE()` | Phase 14 soft-gate pattern |
| `supabase/migrations/20260502040000_sovereign_trial_columns.sql` | Schema + RPC |
| `api/CLAUDE_SESSION_HANDOFF.md` §3 (Phase 8 block) | Production state for Sovereign Trial today |

---

## Reference patterns

- **Phase 14 RBAC** (nutrition_only) — derive on read from server-mirrored data on login → DOM gating function. **Soft** pattern (hide tabs).
- **Phase 8 access_status='locked'** — `showRestrictedScreen()` full takeover. **Hard** pattern (deny everything except a renewal CTA).
- **`BBF_IS_ADMIN()`** — every gate ORs with this so Akeem keeps Architect-everywhere bypass.

---

## What this slice should NOT do

- ❌ Don't introduce a new auth model. PIN-auth (Option A) is the path per handoff §6.1.
- ❌ Don't add a new role hierarchy. Use existing `trial_status` + `tier` columns.
- ❌ Don't break Phase 14 nutrition_only RBAC. Compose with it.
- ❌ Don't direct-push to main. PR through `claude/phase-16-*` branch per §6.1.

---

## Phase 15 status snapshot (for context)

Phase 15 (Live AI Coach + bifurcated cost lock + Wearable Sync + Friction Tracker + Nutrition Portal expansion + mobile-UI fixes + TWA prep) shipped as **18 slices** across PRs **#97–#113** + a direct-push assetlinks.json at commit `6275eb2`.

The Android TWA is **submitted to Google Play Console internal testing** as of 2026-05-06. The CEO is in the **20-tester waiting period** per Google policy and applying for a DUNS number (business path). No Phase 15 follow-up work blocking Phase 16.

---

## Handoff doc state — flag for the next session

⚠️ **`api/CLAUDE_SESSION_HANDOFF.md` is HEAVILY behind.** The last refresh predates Phase 14. Phase 14 (Nutrition Tier System) and all 18 slices of Phase 15 are NOT captured there yet. The §3 production state, §4 immediate tasks, §5 backlog, §7 file inventory, and §9 merged-PR log all need updating.

**Recommendation for the next session:** the FIRST task is a handoff doc refresh — read §3/§4/§5/§9 against `git log origin/main --oneline -50` and reconcile. Phase 16 (this directive) starts AFTER that, because without the refresh the next Claude lacks production-state context for the gate composition decisions in Q6.

If the CEO wants Phase 16 work to start immediately, the next session can skip the full refresh and proceed with the directive's Q-list — but flag the gap up front.

---

## Kickoff prompt — paste into the new Claude session

> You are continuing work on Build Believe Fit. Read `AI_DIRECTIVES.md` first (especially §2.1 Operating Cadence) and `api/CLAUDE_SESSION_HANDOFF.md` (especially §6.2 Tiered Autonomy + §11 Context Discipline). Then read `api/PHASE_16_SOVEREIGN_TRIAL_DIRECTIVE.md` for the active project.
>
> **NOTE:** the handoff doc is heavily behind — Phase 14 (Nutrition Tier System) and all 18 slices of Phase 15 (Live AI Coach + Wearable + Friction Tracker + TWA prep) are not yet captured in §3/§4/§9. Recommend a handoff refresh as the first task before Phase 16 work begins.
>
> After reading, run `git fetch origin --prune` and `git log origin/main --oneline -20`. Report: (a) where main is, (b) which Phase 15 PRs landed (#97 through #113 + commit `6275eb2`), (c) confirm you read Phase 16's six open questions. Then stand by — the CEO answers the Q-list and authorizes execution.
