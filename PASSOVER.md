# Build Believe Fit · PASSOVER

**Status:** living handover · the single canonical state document for cross-session context transfer
**Companion docs:**  `ARCHITECTURE.md` (live system map · tables / env vars / model routing) · `api/BBF_MASTER_PLAN.md` (living roadmap · phase status with closure SHAs)
**Last updated:** 2026-05-26 (session 2 · post-Maximum-Tier triple)

---

## 0 · Who you are talking to

| | |
|---|---|
| Operator / Product Architect | **Akeem** |
| AI archetype | **Council of Jims** · **Tireless Intern** posture only · zero self-referential intros · zero filler · zero strategic advice unless the user explicitly invites it |
| House style | Short, direct, technical · commits with multi-line bodies that explain WHY · MCP tools preferred over CLI when both work · destructive actions gated on explicit go-signal · push back on infeasible scope with options + risk |

---

## 1 · Current state of the repo

| | |
|---|---|
| `main` HEAD | `819c7a4` (Maximum-Tier remediation triple SHA-pinned · all 6.0h/6.0i/6.0j entries live) |
| Last prior pins | `c2dc6fa` (4.1) · `8225258` (4.1a) · `def045e` (4.3a) · `d3df6ec` (6.0c) · `d8bf71c` (6.0d) · `76d3748` (6.0e) · `227bf2c` (6.0f) · `8c91364` (6.0g · TRIM lock applied) |
| Feature branch (this session) | `claude/keen-bardeen-0SVb1` (in sync with main) |
| Live Supabase project | `ihclbceghxpuawymlvgi` · `https://ihclbceghxpuawymlvgi.supabase.co` |
| Live Render service | `vision-scout` · `https://vision-scout.onrender.com` (auto-deploys on push to `main`) |
| Live storefront | `https://buildbelievefit.fitness` (GitHub Pages · auto-deploys on push to `main`) |
| Live Vault SPA (legacy) | `https://buildbelievefit.fitness/bbf-app.html` (5 paying clients · 19,754 lines · 17,544-line core inline `<script>` still inline) |
| New Vault SPA (compiled) | `https://buildbelievefit.fitness/vault/` (Vite + React + TS placeholder · awaits operator GitHub Pages source toggle) |

---

## 2 · What shipped (Phases 0 → 6.0j · 23 closed phases)

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
| 2.1 (Stage 1) · `bbf-app.html` 26,832 → 19,754 lines · extracted to `src/styles/` + `src/state/` + `src/components/` | `29c4ee1` |
| 2.2 · Credential sweep · 11-pattern grep · zero hardcoded high-privilege creds | `64a90e8` |
| 2.3 · Ghost-column sweep · 5 columns dropped | `31ae9e1` (drafted) · applied 2026-05-26 |
| 2.4 · Universal lowercase email migration · 10 CHECK constraints live | `a3868c7` |

### Phase 4 · Frontend Modernization (session 1)
| Item | Closure |
|---|---|
| 4.1 Stage 1 · Vite workspace at `/vault/` · GitHub Pages deploy gate (`.github/workflows/pages.yml` · `actions/deploy-pages@v4` · rsync-deny artifact) · env.js un-gitignored | `2ae64b0` |
| 4.1a · State engine shred · typed `vault/src/services/supabaseClient.ts` (433 lines · 23 exports · `@supabase/supabase-js@^2.46.1` · STORAGE_KEYS + BBFPayload types + session trackers + auth verification + coach agent token dual-storage) | `ea8c8d7` |
| 4.3a · Layout panel componentization · `ClientDashboard.tsx` (selectClient state guard · port of bbf-app.html:2921 fix) + `NutritionVision.tsx` (flex-wrap mobile responsiveness) · App.tsx twin-panel mount | `431b053` |

### Phase 6 · Security Hardening (Marketing Engine · session 1)
| Item | Closure |
|---|---|
| 6.0 · High-privilege credential sweep | `64a90e8` |
| 6.0a · Ghost column sweep · 5 columns dropped (applied) | `31ae9e1` |
| 6.0b · Universal lowercase email migration · engine-level CHECK constraints | `a3868c7` |
| 6.0c · Prompt-armor + XML delimiters + JSON schema + verification loops (analyst + triage) | `979d49e` |
| 6.0d · Hyperparameter + seed determinism lockdown (marketing temp/topP/topK/seed pinned · ARCHITECTURE.md §5.3 standard) | `5202385` |
| 6.0e · Centralized LLM resilience middleware (`llm-resilience.js`) + Gemini fallback to `gemini-3.5-pro` (`gemini.js → generate()`) · §5.4 standard | `56507be` |
| 6.0f · End-to-end live verification suite · 47/47 Node tests · `vision-scout/test/*.test.js` · live SQL probes for ghost columns + CHECK constraints | `178874a` |
| 6.0g · Calibrated remediations · finishReason-aware `gemini_no_text` classification · email TRIM lock migration drafted (`20260526020000_bbf_email_trim_lock.sql`) | `d781f19` (code) · `8c91364` (TRIM applied · 54/54 tests) |

### Phase 6 · Maximum-Tier Remediation Triple (session 2 · current)
| Item | Closure |
|---|---|
| 6.0h · React Bootstrapper · `hydrateSessionFromStorage()` synchronous boot · `storage` event listener forces `window.location.reload()` on cross-tab drift | `aec4da2` |
| 6.0i · Soft-Delete Foundation · migration `20260526030000_bbf_user_soft_delete_foundation.sql` APPLIED · `bbf_users.deleted_at` + `bbf_users_active` view + RLS RESTRICTIVE policy + `bbf_soft_delete_user(uid, reason, actor)` SP + `bbf_verify_user_pin` patched (3 explicit `deleted_at IS NULL` filters) · bbf-agentic-orchestrator v8 + index.js admin endpoints updated | `510e6c4` |
| 6.0j · Claude proxy infrastructure · 3 shared Deno helpers (`_shared/anthropic-armor.ts` + `_shared/anthropic-resilience.ts` + `_shared/anthropic-call.ts`) · per-use-case `FALLBACK_POLICY` (Haiku→Sonnet · Sonnet→Opus · Opus→null) · `callClaude(args)` canonical entrypoint · tool_use schema enforcement · bbf-co-coach v13 converted end-to-end | `951941f` |

### Emergency video-audit repair sprint (session 1)
| Bug | Fix | Where |
|---|---|---|
| `bbf-co-coach` 502 cascade · Opus-only `thinking` + `output_config.{effort,format}` params on a Haiku-routed model | Removed Opus-only params · later fully rewritten in §6.0j with Anthropic-armor + tool_use + resilience | Deployed v12 → v13 |
| Nutrition Vision · Gemini Live WebSocket handshake dropping | `GEMINI_LIVE_MODEL` reverted `3.5 → 2.5 native-audio-latest` | `index.js:3063` |
| Clicking active client unmounts right-hand nutrition telemetry | Two-part `selectClient` guard · re-clicking same client = no-op · only force `TAB('home')` when already on Home | `bbf-app.html:2921` (legacy) + `vault/src/components/ClientDashboard.tsx` (React port) |

---

## 3 · Pending operator actions (manual · can't be done from here)

| Item | What's needed |
|---|---|
| **Vault deploy activation** (Phase 4.1 closure) | GitHub repo → **Settings → Pages → Source** → toggle from "Deploy from a branch" to **"GitHub Actions"**. Until that flips, `pages.yml` runs but does not publish. After toggle, first run produces `/vault/` build at `https://buildbelievefit.fitness/vault/` confirming "BBF Vault React Architecture Active" · legacy `/bbf-app.html` continues serving byte-identically. |
| Phase 0.1 · `BBF_MARKETING_ADMIN_TOKEN` rotation | Paste fresh 32-char token into Render dashboard → `vision-scout` → Environment → `BBF_MARKETING_ADMIN_TOKEN`. Test: old token returns 401 on `/api/v1/marketing/telemetry`, new token returns 200. |
| Resend webhook config (for Phase 1.2 events to flow) | Resend dashboard → Webhooks → set endpoint to `https://vision-scout.onrender.com/api/v1/marketing/inbound` · copy Signing Secret · paste into Render → vision-scout → Environment → `RESEND_WEBHOOK_SECRET`. |
| Optional · Stripe Payment Link configuration | `vapi-sms-closer` ships with placeholder `https://buy.stripe.com/test_placeholder_*` URLs. Swap to real Stripe Payment Link URLs when ready · no code change required. |

---

## 4 · Conventions in force

1. **Commits** · multi-line bodies that explain WHY · no `Co-Authored-By` lines · no marketing copy · commit message is the change record.
2. **Workflow** · feature branch (this session was `claude/keen-bardeen-0SVb1` · next session's branch will be assigned) → push → checkout main → `git pull origin main --ff-only` → `git merge --ff-only <feature>` → push → return to feature branch. When local `main` diverges from `origin/main` (force-push between sessions), use `git reset --hard origin/main` to align before FF-merging.
3. **Master-plan pin pattern** · feature commit lands → second commit pins its SHA into the relevant master-plan section header → push → FF-merge. Every closed `[x]` / `[~]` phase entry carries its SHA in the header.
4. **Destructive DDL** · drafted in `supabase/migrations/<ts>_<name>.sql` and committed first · `mcp__supabase__apply_migration` runs only on explicit operator go-signal (e.g. "apply", "execute the purge").
5. **MCP tool defaults** · use `mcp__supabase__*` for Supabase, `mcp__github__*` for GitHub. No `gh` CLI. No `supabase` CLI. No `curl` to live endpoints (network sandboxed in this env anyway · use `net.http_get`/`net.http_post` via Supabase SQL or `mcp__supabase__execute_sql` instead).
6. **Numbering drift** · Akeem labels phases by what HE is doing, not by what's in `BBF_MASTER_PLAN.md`. When his label doesn't match an existing plan item, add a new sub-item (e.g. `6.0a` → `6.0j`) rather than overwriting an unrelated entry.
7. **`net.http_*` probe pattern** · fire the request → return the request_id → second query: `select pg_sleep(N); select … from net._http_response where id = <id>;`
8. **Don't claim a fix without verification** · syntax check, schema probe, or live round-trip · then state which one was used.
9. **Don't ask permission for foreseeable mid-task actions** · the user wants execution speed · ask only when blast radius is real (destructive DDL, production redeploy of critical-path code, sending email/messages).
10. **Push back on infeasible scope** · the Phase 2.1 monolith conversation + the Maximum-Tier scope-exposure (this session) are the canonical examples · surface options with risk, let Akeem choose. The operator is receptive to pushback when evidence-backed.
11. **Edge function deploy structure** · the deploy bundle places the entrypoint as `source/index.ts` (Supabase auto-adds `source/`); relative dependencies use `../_shared/<file>.ts` paths which resolve correctly because `_shared/` lands at the function root as a sibling of `source/`. Pass `entrypoint_path: 'index.ts'` (NOT `source/index.ts`) to `mcp__supabase__deploy_edge_function`. Use `mcp__supabase__get_edge_function` to inspect the deployed structure when in doubt.

---

## 5 · Next-phase directive · Phase 4.3 Stage 2 (Frontend Componentization)

The Maximum-Tier remediation triple landed last session (6.0h + 6.0i + 6.0j). The infrastructure backbone is built · the next session resumes **active frontend feature work**: porting more panes out of the 17,544-line bbf-app.html inline `<script>` into React components under `/vault/`.

### What's already in `/vault/`
- `vault/package.json` · React 18.3 + Vite 5.4 + TS 5.6 + `@supabase/supabase-js@^2.46.1` · `npm run dev` / `npm run build` / `npm run typecheck`
- `vault/src/services/supabaseClient.ts` (Phase 4.1a · 433 lines · 23 exports) · the data layer (singleton SupabaseClient, payload sync, session trackers, auth verification, hydration)
- `vault/src/main.tsx` (Phase 6.0h) · synchronous `bootstrapVault()` runs `hydrateSessionFromStorage()` BEFORE `createRoot` · attaches `storage` event listener for cross-tab drift
- `vault/src/App.tsx` (Phase 4.3a) · twin-panel mount of ClientDashboard + NutritionVision
- `vault/src/components/ClientDashboard.tsx` (Phase 4.3a) · trainer/admin roster grid + adjacent client-detail panel · `selectClient` no-op fast path enforced · detail panel renders WITHOUT a key so React reuses the instance across selections (in-place re-render, no unmount)
- `vault/src/components/NutritionVision.tsx` (Phase 4.3a) · live-food-analysis chrome (`pe-frame` with 4 brackets + scanline + hero) + media controls + macro chip strip · 3 horizontal strips use `flexWrap: 'wrap'` + `flex: '1 1 <basis>'` for mobile responsiveness without media queries

### Suggested next per-feature ports (the legacy "golden path" from PASSOVER §5 sessions 1)
1. **Login + PIN entry** · the React equivalent of `src/state/bbf-auth-engine.js` `LOGIN()` · call `verifyUserPin(uid, pin)` from `supabaseClient.ts` (already exported) · on success call `setCurrentUser(uid)` + `setCurrentUserSigil(uid)` so the hydrate path on the next reload finds the explicit uid.
2. **Vault mount sequence** · the post-login splash + tab nav (Home / Nutrition / Workout / Cardio / Prehab / Profile).
3. **Nutrition tab full feature** · wire the existing `NutritionVision.tsx` shell to the live `bbf-meal-macros` + `bbf-meal-image` edge functions · macro chip strip becomes live readback.
4. **Workout tab** · the largest inline-script surface · port `RW()` (render workout) + the set/log/readiness submit flows.
5. **Readiness submit** · `bbf_readiness` insert path · CNS score 0-100.
6. **Trainer roster + client drill-in** · `ClientDashboard.tsx` already has the shell · wire the live `bbf_users_active` view query (Phase 6.0i) for the real roster · `setViewingAsClient(uid)` in `supabaseClient.ts` is the canonical state setter.

### Operational reality the next session must respect
- The legacy `bbf-app.html` is still THE customer surface · 5 paying clients depend on it · do not break it.
- The vault `/vault/` route is a placeholder · operator hasn't toggled GitHub Pages source to "GitHub Actions" yet (pending action in §3) · once toggled, both `/bbf-app.html` (legacy) and `/vault/index.html` (compiled React) serve from the same atomic artifact.
- All vault React code must import the data layer from `services/supabaseClient.ts` (no direct `createClient` calls) so the singleton + soft-delete filters + session state stay coherent.
- Per Phase 4.3a contract · `selectClient`-equivalent state changes must NOT unmount the detail panel · re-render in place.

### Deferred work streams (parallel · NOT blocking frontend)
- **6.0h-followup · 12 in-vault Anthropic agents pending Anthropic-armor conversion** (queued in `MASTER_PLAN.md §6.0j` adoption matrix · each is a single-session conversion using the `bbf-co-coach` v13 template):
  `bbf-agentic-orchestrator` · `bbf-midnight-haiku` · `bbf-agentic-cardio` (Opus · NO fallback) · `bbf-agentic-pathfinder` · `bbf-agentic-interrogator` · `bbf-agentic-prehab` · `bbf-agentic-forecasting` · `bbf-agentic-kinematics` (vision flag) · `bbf-agentic-comlink` · `bbf-agentic-immersion` · `bbf-agentic-peaking` · `bbf-agentic-linguist`.
- **6.0i-followup · ~10 lower-risk readers of raw `bbf_users`** · convert to `bbf_users_active` view or add `WHERE deleted_at IS NULL` filter when touched. RLS gate already hides soft-deleted rows from anon/authenticated; this is UX hygiene, not security.
- **5.2 · GitHub Actions CI runner** · the `node --test` suite at `vision-scout/test/*.test.js` (54 passing) needs the workflow file to fire on PRs.

### Where to look first when you boot the next session
1. This file (`PASSOVER.md`) · §0-§5
2. `ARCHITECTURE.md` (root) · especially §5.3 (Gemini hyperparameter standard), §5.4 (Gemini resilience), §5.5 (Anthropic hardening · Phase 6.0j)
3. `api/BBF_MASTER_PLAN.md` · scan top-down · every `[x]` carries a SHA · §6.0h/§6.0i/§6.0j are the last-touched entries
4. `git log --oneline -25 main` · the recent commit chain
5. `vault/src/` · the live React workspace · this is where the next feature work lands

---

## 6 · Quick orientation cheatsheet

| Question | Answer |
|---|---|
| Current main HEAD | `819c7a4` |
| What's deployed live but pending operator UI toggle | GitHub Pages source · Settings → Pages → Source → "GitHub Actions" |
| Last applied SQL migration | `20260526030000_bbf_user_soft_delete_foundation.sql` (Phase 6.0i) |
| Last applied prior migration | `20260526020000_bbf_email_trim_lock.sql` (Phase 6.0g) |
| Last edge-function deploy | `bbf-co-coach` v13 · ezbr `f4d7cbaa...c2e2770` · Phase 6.0j canonical Anthropic-armor conversion |
| Test suite status | 54/54 Node tests pass at `vision-scout/test/*.test.js` (`cd vision-scout && npm test`) |
| Vault build status | `cd vault && npm run typecheck && npm run build` · zero errors · 74 modules · `dist/assets/index-C0YpTZ_v.js` 154KB / 49.5KB gzip |
| Soft-delete posture | `bbf_users.deleted_at` live · `bbf_users_active` view · RLS RESTRICTIVE policy · `bbf_soft_delete_user(uid, reason, actor)` SP available to service_role · auth RPC gated · 3 high-risk readers patched · 10 low-risk readers queued |
| Anthropic-armor adoption | 1/13 (bbf-co-coach v13) · 12 queued in MASTER_PLAN §6.0j |
