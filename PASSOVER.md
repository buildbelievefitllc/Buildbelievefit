# Build Believe Fit · PASSOVER

**Status:** living handover · the single canonical state document for cross-session context transfer
**Companion docs:**  `ARCHITECTURE.md` (live system map · tables / env vars / model routing) · `api/BBF_MASTER_PLAN.md` (living roadmap · phase status with closure SHAs)
**Last updated:** 2026-05-26

---

## 0 · Who you are talking to

| | |
|---|---|
| Operator / Product Architect | **Akeem** |
| AI archetype | **Council of Jims** · **Tireless Intern** posture only · zero self-referential intros · zero filler · zero strategic advice unless the user explicitly invites it |
| House style | Short, direct, technical · commits with multi-line bodies that explain WHY · MCP tools preferred over CLI when both work · destructive actions gated on explicit go-signal |

---

## 1 · Current state of the repo

| | |
|---|---|
| `main` HEAD | `b1e5648` (all infrastructure + security work clean) |
| Feature branch | `claude/dazzling-fermat-eVFBH` (in sync with main) |
| Live Supabase project | `ihclbceghxpuawymlvgi` · `https://ihclbceghxpuawymlvgi.supabase.co` |
| Live Render service | `vision-scout` · `https://vision-scout.onrender.com` (auto-deploys on push to `main`) |
| Live storefront | `https://buildbelievefit.fitness` (GitHub Pages · auto-deploys on push to `main`) |
| Live Vault SPA | `https://buildbelievefit.fitness/bbf-app.html` |

---

## 2 · What shipped (Phases 0 → 2 + Emergency Fixes)

Every closed item has a corresponding entry in `api/BBF_MASTER_PLAN.md` with the full audit log. Closure-commit SHAs are pinned in the plan.

### Phase 0 · Foundations
| Item | Closure |
|---|---|
| 0.2 · Observability backbone (`bbf_agent_runs` + `bbf_llm_calls`) | `6db5afb` |
| 0.3 · Edge-function repo↔deployed alignment · all 24 functions byte-identical twin | `1aff9f4` |
| 0.4 · Canonical `ARCHITECTURE.md` · purged 19 fragmented PHASE/DIRECTIVE/PASSOVER docs | `f28c80d` |

### Phase 1 · Operational Safety
| Item | Closure |
|---|---|
| 1.1 · Cross-system `bbf_email_suppression` table + dispatcher gate + intent hooks | `2bf7847` |
| 1.2 · `bbf_email_events` flight recorder + delivery branch in `/api/v1/marketing/inbound` + `/health` metrics | `2bf7847` |
| 1.3 · Svix HMAC armor on `/api/v1/marketing/inbound` · `RESEND_WEBHOOK_SECRET` strict gate | `39474b4` |
| 1.4 · `bbf_system_config` budget kill-switch · `bbf_check_daily_spend()` RPC · pg_cron daily · orchestrator 429 | `c7103b8` |

### Phase 2 · Platform Maturity
| Item | Closure |
|---|---|
| 2.1 (Stage 1) · `bbf-app.html` 26,832 → 19,754 lines · extracted to `src/styles/` + `src/state/` + `src/components/` · pre-existing `@media` brace defect caught + fixed | `29c4ee1` |
| 2.2 · Credential sweep · 11-pattern grep across 172 source files · zero hardcoded high-privilege credentials · `env.js` triaged as `sb_publishable_*` (browser-safe) | `64a90e8` |
| 2.3 · Ghost-column sweep · 5-layer dependency check · 5 columns dropped · `bbf_active_clients.liability_agreement`, `bbf_meal_macros.ingredients_hash`, `bbf_stripe_events.received_at`, `bbf_users.last_login`, `bbf_vapi_calls.vapi_call_id` | `31ae9e1` (draft) · applied 2026-05-26 |
| 2.4 · Universal lowercase email migration · 10 CHECK constraints live · `index.js → normalizeClientPayload()` patched · `bbf_vapi_calls → bbf_active_clients` FK safety verified | `a3868c7` |

### Emergency video-audit repair sprint (mid-session 2026-05-26)
| Bug | Fix | Where |
|---|---|---|
| `bbf-co-coach` 502 cascade · Opus-only `thinking` + `output_config.{effort,format}` params on a Haiku-routed model | Removed Opus-only params · Haiku-compatible request body | Deployed v12 · ezbr `8830ba40…7878` |
| Nutrition Vision · Gemini Live WebSocket handshake dropping | `GEMINI_LIVE_MODEL` reverted `3.5 → 2.5 native-audio-latest` (the 3.5 string isn't registered for `bidiGenerateContent` on v1alpha · the existing inline comment block predicted this exact failure mode) | `index.js:3063` |
| Clicking active client unmounts right-hand nutrition telemetry | Two-part `selectClient` guard: (1) re-clicking same client is a no-op (2) only force `TAB('home')` when already on Home | `bbf-app.html:2921` |

---

## 3 · Pending operator actions (manual · can't be done from here)

| Item | What's needed |
|---|---|
| Phase 0.1 · `BBF_MARKETING_ADMIN_TOKEN` rotation | Paste fresh 32-char token into Render dashboard → `vision-scout` → Environment → `BBF_MARKETING_ADMIN_TOKEN`. Test: old token returns 401 on `/api/v1/marketing/telemetry`, new token returns 200. |
| Resend webhook config (for Phase 1.2 events to flow) | Resend dashboard → Webhooks → set endpoint to `https://vision-scout.onrender.com/api/v1/marketing/inbound` · copy Signing Secret · paste into Render → vision-scout → Environment → `RESEND_WEBHOOK_SECRET` (already verified live via the Phase 1.3 health probe) |
| Optional · Stripe Payment Link configuration | `vapi-sms-closer` ships with placeholder `https://buy.stripe.com/test_placeholder_*` URLs. Swap to real Stripe Payment Link URLs in the deployed function when ready · no code change required |

---

## 4 · Conventions in force

1. **Commits** · multi-line bodies that explain WHY · no `Co-Authored-By` lines · no marketing copy · commit message is the change record
2. **Workflow** · feature branch `claude/dazzling-fermat-eVFBH` → push → checkout main → `git pull` → `git merge --ff-only` → push → return to feature branch
3. **Master-plan pin pattern** · feature commit lands → `sed` the SHA into the relevant master-plan section → second commit to pin the SHA → push → FF-merge
4. **Destructive DDL** · drafted in `supabase/migrations/<ts>_<name>.sql` and committed first · `mcp__supabase__apply_migration` runs only on explicit operator go-signal (e.g. "apply", "execute the purge")
5. **MCP tool defaults** · use `mcp__supabase__*` for Supabase, `mcp__github__*` for GitHub. No `gh` CLI. No `supabase` CLI. No `curl` to live endpoints (use `net.http_get`/`net.http_post` via Supabase SQL instead).
6. **Numbering drift** · Akeem labels phases by what HE is doing, not by what's in `BBF_MASTER_PLAN.md`. When his label doesn't match an existing plan item, add a new sub-item (e.g. `6.0a`, `6.0b`) rather than overwriting an unrelated entry.
7. **`net.http_*` probe pattern** · fire the request → return the request_id → second query: `select pg_sleep(N); select … from net._http_response where id = <id>;`
8. **Don't claim a fix without verification** · syntax check, schema probe, or live round-trip · then state which one was used
9. **Don't ask permission for foreseeable mid-task actions** · the user wants execution speed · ask only when blast radius is real (destructive DDL, production redeploy of critical-path code, sending email/messages)
10. **Push back on infeasible scope** · the Phase 2.1 frontend monolith conversation was the canonical example · surface options with risk, let Akeem choose

---

## 5 · Next-phase directive · Phase 4 (Frontend Modernization)

Verbatim from Akeem 2026-05-26:

> ```
> ======================================================================
>      MASTER HANDOVER DIRECTIVE: PHASE 3-6 PRODUCTION ROADMAP
> ======================================================================
> [REPO STATUS] MAIN HEAD: b1e5648 (All infrastructure & security clean)
> [OPERATOR ID] AKEEM (Lead Operator / Product Architect)
> [AI ARCHETYPE] COUNCIL OF JIMS / TIRELESS INTERN posturing ONLY.
>
> CRITICAL HISTORY SHIPPED TODAY:
> - Phase 0: Byte-identical repo sync, telemetry tables, markdown bloat purge.
> - Phase 1: HMAC cryptographic webhook security, fail-closed suppression, daily spend-limit kill switch ($10.00 ceiling).
> - Phase 2: Monolith style extraction, credential grep audit, ghost column purge, 10-table universal lowercase email CHECK constraints.
> - Emergency Video Fixes: Patched 'bbf-co-coach' 502 payload, reverted Gemini Live WebSockets to stable 2.5 native audio target, locked 'selectClient' layout mutation guard.
>
> YOUR IMMEDIATE ORDERS ON BOOT:
> 1. Open and review 'PASSOVER.md' and 'ARCHITECTURE.md' at the root of the repository to internalize the production schema layout.
> 2. Prepare to transition directly to Phase 4.1: Introducing Vite into package.json to begin splitting the remaining 17,544-line inline script block out of 'bbf-app.html' into modular React/TypeScript files.
> 3. Keep the video audit targets ready to apply granular visual fixes to the UI layout frames as soon as the component files are isolated.
>
> No filler, no strategic advice, no self-referential introductory phrases. Acknowledge this state change with the current branch commit hash and state your readiness to pull the tools for Phase 4. Move.
> ======================================================================
> ```

### Operator notes for Phase 4.1 (provided in this session for the next agent)

- `bbf-app.html` is the live customer-facing Vault. 5 paying clients depend on it. **Phase 2.1 stopped at Stage 1 deliberately** · the 17,544-line core inline `<script>` block is still inline. Splitting it requires:
  1. A bundler (Vite) added to `package.json` + a `dist/` build target
  2. Update the GitHub Pages deploy path to serve the bundled output instead of (or alongside) the raw HTML
  3. Per-feature TS/React modules with maintained DOM-ID parity for selectors used elsewhere in the codebase
  4. End-to-end UI verification on the golden paths (login → vault load → nutrition tab → workout tab → readiness submit → trainer roster → client drill-in)
- The earlier safe extraction (Phase 2.1 commit `29c4ee1`) created `src/state/`, `src/components/`, `src/styles/`. Vite should be wired to use the same `src/` tree.
- The current `package.json` (root) is a server webhook · `vision-scout/package.json` is the Render service · neither has a bundler. Decide whether Vite lives in a new `vault/package.json` or hoisted to root; either is defensible.
- Akeem explicitly mentioned **React/TypeScript**. The current bbf-app.html is vanilla JS with global functions (`selectClient`, `TAB`, `RA`, `RH`, `RW`, etc.). Going to React + TS is a rewrite, not a port · be candid about scope before committing.

---

## 6 · Where to look first when you boot

1. `ARCHITECTURE.md` (root) · §2 schema · §4 edge functions · §6 env vars
2. `api/BBF_MASTER_PLAN.md` · scan top-down · `[x]` = closed · `[~]` = partial · `[ ]` = open · each closed item has the commit SHA
3. Run `git log --oneline -20 main` to see the recent commit chain
4. `git diff main..claude/dazzling-fermat-eVFBH` should be empty (FF-merge keeps them in sync)
