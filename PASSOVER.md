# Build Believe Fit · PASSOVER

**Status:** living handover · the single canonical state document for cross-session context transfer
**Companion docs:**  `ARCHITECTURE.md` (live system map · tables / env vars / model routing) · `api/BBF_MASTER_PLAN.md` (living roadmap · phase status with closure SHAs)
**Last updated:** 2026-05-27 (session 3 · marketing-site redesign Phase 1 + 2 live on main)

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
| `main` HEAD | **`4b5630b`** (Phase 2 marketing redesign · index.html structurally complete with new design across all surfaces) |
| Tip of last session's work | `0340379` (Phase 4.3h pin · Vault SPA Friction Scanner + Linguistics) · everything since is Phase 6.0k agentic sweep + this session's marketing redesign |
| Feature branch (this session) | `claude/exciting-dirac-e4mME` (in sync with main · zero divergence) |
| Live Supabase project | `ihclbceghxpuawymlvgi` · `https://ihclbceghxpuawymlvgi.supabase.co` |
| Live Render service | `vision-scout` · `https://vision-scout.onrender.com` (auto-deploys on push to `main`) |
| Live storefront | `https://buildbelievefit.fitness` (GitHub Pages · auto-deploys on push to `main`) · **NEW design now live across hero / nav / marquee / manifesto / pillars / tiers / who / app / arc / seal / compare / nutrition / story / playbooks / week / numbers / results / vault-preview / faq / credentials / news / closing / footer** |
| Live Vault SPA (legacy) | `https://buildbelievefit.fitness/bbf-app.html` (5 paying clients · 19,754 lines · UNTOUCHED this session) |
| New Vault SPA (compiled) | `https://buildbelievefit.fitness/vault/` (Vite + React + TS · 6 tabs live · awaits operator GitHub Pages source toggle) |

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

### Phase 6 · Maximum-Tier Remediation Triple (session 2)
| Item | Closure |
|---|---|
| 6.0h · React Bootstrapper · `hydrateSessionFromStorage()` synchronous boot · `storage` event listener forces `window.location.reload()` on cross-tab drift | `aec4da2` |
| 6.0i · Soft-Delete Foundation · migration `20260526030000_bbf_user_soft_delete_foundation.sql` APPLIED · `bbf_users.deleted_at` + `bbf_users_active` view + RLS RESTRICTIVE policy + `bbf_soft_delete_user(uid, reason, actor)` SP + `bbf_verify_user_pin` patched (3 explicit `deleted_at IS NULL` filters) · bbf-agentic-orchestrator v8 + index.js admin endpoints updated | `510e6c4` |
| 6.0j · Claude proxy infrastructure · 3 shared Deno helpers (`_shared/anthropic-armor.ts` + `_shared/anthropic-resilience.ts` + `_shared/anthropic-call.ts`) · per-use-case `FALLBACK_POLICY` (Haiku→Sonnet · Sonnet→Opus · Opus→null) · `callClaude(args)` canonical entrypoint · tool_use schema enforcement · bbf-co-coach v13 converted end-to-end | `951941f` |

### Vault React SPA Phase 4.3 chain (session 2 → 3 · 6 tabs live + functional gauntlet + reliability fixes)
| Item | Closure |
|---|---|
| 4.3b · Auth gate + `VaultShell.tsx` (6 pre-mounted tab panels · same-tab no-op fast path) + NutritionVision visual purge | `f2a5405` |
| 4.3c · `PrehabReadiness.tsx` Somatic Readiness sliders (5-dim composite · containment-by-grid) + `WorkoutTracker.tsx` Today's Program (table-to-card responsive flip) | `89ef9a6` |
| 4.3d · Live-wire data layer · `insertSomaticReadiness` + `insertWorkoutSession` (two-step `bbf_logs` + `bbf_sets` with orphan-cleanup fallback) + double-submit shield primitives | `e3918dc` |
| 4.3e · `CardioTracker.tsx` (Foster sRPE-load → `bbf_athlete_load_logs`) + `ProfileSettings.tsx` (local BBFPayload write · cloud RPC pending) + `NutritionVision.tsx` rewrite (live wire to `bbf-meal-image` + `bbf-meal-macros` edge functions · X-BBF-Admin-Token forwarding) | `391e0bb` |
| 4.3f · Playwright E2E smoke suite (3 tests · Router Lock · Double-Submit Shield · Data Layer Intercept) | `dd87c15` |
| 4.3g · Red-team patch · synchronous `useRef`-backed shield across all 5 action surfaces + `_ensureUidMap` clear-on-failure + lowercase-at-store + retry-on-miss | `34e572d` |
| 4.3h · Friction Scanner card in `PrehabReadiness` (wires to `bbf-agentic-prehab`) + Sovereign Linguistics card in `ProfileSettings` (wires to `bbf-agentic-linguist`) + `_agentHeaders()` helper forwards `X-BBF-Admin-Token` to all `bbf-agentic-*` POSTs | `08b6524` |

### Phase 6.0k · Anthropic Proxy Lockdown (session 2 · drains the §6.0j 12-agent debt)
| Item | Closure |
|---|---|
| 6.0k · 12 remaining agents converted to canonical `callClaude` (helper extended with `userImages` param for vision · cardio explicit `fallbackOverride: null` · 11 agentic-* + bbf-midnight-haiku) · `bbf-agentic-cardio` (cardiac_intercept Opus) · `bbf-agentic-comlink` (3 intents) · `bbf-agentic-forecasting` · `bbf-agentic-immersion` · `bbf-agentic-interrogator` · `bbf-agentic-kinematics` (vision) · `bbf-agentic-linguist` · `bbf-agentic-orchestrator` · `bbf-agentic-pathfinder` · `bbf-agentic-peaking` · `bbf-agentic-prehab` · `bbf-midnight-haiku` · §6.0j status flipped to [x] | `4d826e5` |

### Phase 1 + 2 · Marketing-site redesign (session 3 · current · LIVE)
| Item | Closure |
|---|---|
| Marketing P1 · Hero + Pricing Tiers replaced from new design handoff bundle (`0c586912-Build_Believe_Fit__standalone_.html`) · Stripe map gains `architect_hybrid` alias · "Enter The Vault" portal-cards → `/vault/` (was `bbf-app.html`) · 4 tier cards live (Gateway $67/mo · Youth Athlete $97/mo · Architect Hybrid $697 flat · Sovereign $1,197 flat) · old `#hero` + `#programs` CSS rules commented out · ~80K of design CSS scrubbed (globals stripped) injected into the main `<style>` block | `0b81453` |
| Marketing P1 polish · `selectTier()` querySelector `.prog-c` → `.tier` + `.tier.sel/.tier.dim` highlight CSS using `--gold` token | `903668b` |
| Marketing P2 · Replaced 10 legacy sections (services/founder/nutrition/testimonials/explorer/specialized/transformation/playbooks/app-download/contact + legacy nav + legacy mobile drawer + legacy marquee + legacy footer) with 22 new design sections (marquee + new nav + trusted + press + manifesto + pillars-block · who · app-block · arc · seal · compare · nutrition · story · playbooks · week · numbers-block · results · vault-preview · faq · credentials · news · closing + new footer) · KEPT `#interrogator` + `#pathfinder` + all bottom-of-body scripts (FAB chat panel · Turnstile · Nutrition Lite modal · BBF_LANG · selectTier · BBF_STRIPE_BY_TIER) · Operator directive 1 · Access The Vault button pinned to new nav on desktop (`.bbf-vault-nav-btn` calls `#bbf-pf-fab.click()` · FAB hidden on ≥641px · nav button hidden on ≤640px) · Operator directive 2 · `bbf-photo.jpg` reinstated in `#story` origin slot 3 ("The Architecture Lives") + `akeem-before.png` slot 1 + `akeem-nasm.jpg` slot 2 | `4b5630b` |

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

## 5 · Next-phase directive · Apply marketing design language to the APP side

The marketing landing page is live in the new design (commits `0b81453` + `903668b` + `4b5630b`). The operator's next sprint is to **mirror that same flow, aesthetic, and design system on the APP side** — meaning the customer-facing client portal experience, which today exists in two places:

| Surface | Where | State |
|---|---|---|
| Legacy client portal | `bbf-app.html` (root · 19,754 lines · 17,544-line inline `<script>` core) | 5 paying clients depend on it · **untouched this session** · serves at `https://buildbelievefit.fitness/bbf-app.html` |
| New React Vault | `vault/src/components/*.tsx` · `VaultShell.tsx` with 6 tabs (Home / Nutrition / Workout / Cardio / Prehab / Profile) | All 6 tabs LIVE with real edge-function wires (Phase 4.3a→h chain · §2 above) · serves at `https://buildbelievefit.fitness/vault/` once operator toggles Pages source to "GitHub Actions" |

The operator will **re-attach the same standalone design HTML** at the start of the next session as the visual reference (it's the file at `/root/.claude/uploads/.../0c586912-Build_Believe_Fit__standalone_.html` from this session). The standalone has all 25 sections — Phase 1 + 2 of the marketing redesign consumed those — and the same tokens / patterns apply to the app side. Mimic the flow, not the literal content.

### Design system established in `index.html` (the patterns to mirror)

| Layer | What |
|---|---|
| **Color tokens** | `--bg: #0B0418` (deep eggplant base) · `--bg-2: #16092B` · `--gold: #E5B83A` (primary action) · `--gold-soft: #F2C94C` · `--gold-deep: #B58A18` · `--purple: #6A2DAB` · `--purple-bright: #8E4FD4` · `--purple-deep: #3D1A6B` · `--purple-glow: rgba(142,79,212,0.45)` · `--text: #F5EFE2` · `--surface: rgba(255,255,255,0.035)` · `--hairline: rgba(255,255,255,0.08)` · all defined in the injected design CSS at the top of `index.html`'s `<style>` block. |
| **Type** | Display: Oswald 400-700 · Body: Geist 300-700 · Mono: JetBrains Mono. Loaded via the Google Fonts `<link>` at line 11 of `index.html`. The vault React side currently uses Anton + Bebas + Barlow Condensed (legacy) — typography port is part of the app-side reskin. |
| **Spacing scale** | `--pad-page: clamp(20px, 4vw, 64px)` |
| **Section pattern** | `<section class="block" id="X">` wraps `<div class="section-head">` with `.section-eyebrow` + `.section-title` (with optional `<span class="gold">accent</span>`) + `.section-sub` lede. |
| **Card pattern** | Tier-style cards use `<article class="tier">` with `.tier-tag` / `.tier-name` / `.tier-meta` / `.tier-price` / `.tier-protocol` / `.tier-flag green\|blue\|gold\|purple` / `.tier-feats` ul with `.check` icons / `.tier-cta` button. Origin-story cards use `.origin-card` with `.origin-img` (containing `<image-slot>` or `<img>`) + `.origin-caption` (`.origin-cap-label` + `.origin-quote`). |
| **Hero ornamentation** | Faint Ω SVG (`.hero-omega`) · HUD coordinates (`.hud > .ln`) · horizontal scrolling tickers (`.hero-ticker.t-left/.t-right`) · portrait frame with corner accents (`.portrait-wrap > .portrait-corner + .portrait-frame > image-slot + .pulse`) + badge below. |
| **CTA pattern** | Primary: `.btn-primary` (gold bg with status `.dot`) · Ghost: `.btn-ghost` (outline) · Portal cards: `.portal-card` (with `.portal-tag` / `.portal-title` / `.portal-sub`). |
| **Backdrop** | Each section sits on the `--bg` eggplant with subtle radial gradients. Some sections use seal/arc decorative blocks (`.seal`, `.arc-svg`) for visual rhythm. |
| **Responsive** | All grids use intrinsic `grid-template-columns: repeat(auto-fit, minmax(min(100%, Nrem), 1fr))` patterns · clamp() typography on every text scale · `@media (max-width: 1100px)` collapses nav-links and reduces grid columns · `@media (max-width: 640px)` further compacts. NO hardcoded pixel sizes for typography or layout. |
| **Custom element** | `<image-slot id="X" placeholder="...">` for drag-drop photo placeholders · falls back to its `<img>` child when `image-slot.js` isn't loaded. Used in hero portrait (line 4307) + 3 origin slots in `#story` (lines ~5083, 5094, 5106). The operator will likely ship `image-slot.js` later; the fallback keeps photos visible today. |

### Surfaces to consider for the next sprint

The operator's voice transcript said "we're gonna work on the app side ... mimic the same flow and style of what we just added into the index dot HTML." Two interpretations · ask which (or both) is in scope:

1. **`vault/` React SPA reskin** — the 7 components (`VaultShell.tsx`, `ClientDashboard.tsx`, `NutritionVision.tsx`, `WorkoutTracker.tsx`, `CardioTracker.tsx`, `PrehabReadiness.tsx`, `ProfileSettings.tsx`) + their CSS modules currently use the LEGACY token system (`--pur` / `--yel` / Bebas Neue / Barlow Condensed). Reskin = update CSS modules to the new design tokens (`--gold` / `--purple` / Geist / Oswald), apply `.tier`/`.section-head`/`.portal-card` patterns to the equivalent vault surfaces. The COMPONENT LOGIC and BACKEND WIRES stay verbatim (every component is fully wired post Phase 4.3a→h).
2. **Legacy `bbf-app.html` reskin** — much larger surface (19,754 lines · most logic is in the inline `<script>`) and much higher risk (5 paying clients). Surgical approach matching the Phase 1+2 pattern on index.html (section-by-section visual replacement; backend wires untouchable). This is a multi-session sprint, not a single one.

**Recommended starting point**: option 1 (`vault/` React reskin) — the components are already split, the data wires are stable, and `npm run typecheck && npm run build` provides a tight verification loop after each component is restyled. Once the React vault is wearing the new design, the operator can decide whether to also reskin the legacy or just route traffic to the new vault and sunset `bbf-app.html`.

### Operational reality the next session must respect

- The legacy `bbf-app.html` is still THE customer surface for 5 paying clients · do not break it. If touching it, hold the FF-merge until the operator confirms.
- The `index.html` marketing redesign is LIVE on `main` (`4b5630b`) · the design system tokens and the design CSS block live in `index.html`'s inline `<style>`. To extract those tokens for the vault React side, copy the `:root { --bg / --gold / --purple / ... }` block from the top of the injected design CSS (the banner comment that says "PHASE 1 redesign · injected from Build Believe Fit design handoff bundle" marks the start).
- All vault React code must continue importing the data layer from `services/supabaseClient.ts` (no direct `createClient` calls) · the Phase 4.3a→h wires depend on it.
- The Pathfinder Comlink FAB (`#bbf-pf-fab`) is currently desktop-hidden / mobile-only in `index.html` (per Phase 2 directive). If the new app-side has its own FAB equivalent, mirror the same responsive pattern.
- The operator's pattern · MAP FIRST (list keep/replace/wire-in), then surgical strikes (each phase commits its own SHA), hold FF-merge until they review. Mixed typography intermediate states are OK during a multi-phase sprint.

### Deferred work streams (parallel · NOT blocking the app-side reskin)

- **Phase 2.5 marketing polish** — the closing CTA buttons in `index.html`'s `#start` section currently have `href="#"` (inert). Wire them when ready. Also: provision a dedicated Stripe Payment Link for `architect_hybrid` (currently aliased to the `architect` URL · `BBF_STRIPE_BY_TIER` map at line ~5594 of index.html post-Phase-2). Also: re-add Privacy/Terms/phone/TDEE-calc links to the minimal new footer if the legal anchors are required.
- **Phase 2.5 marketing language pack** — the new Phase 2 sections have NO `data-lang-key` attributes · the EN/ES/PT toggle only translates Phase 1 hero strings and the nav lang buttons. Add keys to `bbf-lang.js` and the new markup in a sweep when the operator prioritizes it.
- **`BBF-App-Ascendant.html`** — the file the operator named in Phase 2 but didn't upload. The operator confirmed it's "for a future sprint" — keep an eye out for it.
- **5.2 · GitHub Actions CI runner** for the `vision-scout/test/*.test.js` suite (54 tests passing).
- **6.0i-followup · ~10 lower-risk readers of raw `bbf_users`** — convert to `bbf_users_active` view or add `WHERE deleted_at IS NULL` filter when touched.

### Where to look first when you boot the next session

1. This file (`PASSOVER.md`) · §0 → §5
2. `git log --oneline -30 main` · the full recent commit chain (Phase 4.3 vault chain + 6.0k agentic sweep + Phase 1+2 marketing redesign)
3. `index.html` · search for "PHASE 1 redesign · injected from Build Believe Fit design handoff bundle" to find the design token block at the top of the inline `<style>` (the `:root { --bg / --gold / --purple / ... }` definitions live there)
4. `vault/src/components/*.module.css` · the 6 component CSS modules using the LEGACY token system · these are what need restyling for option 1
5. `vault/src/components/VaultShell.tsx` · the tab shell · its `<header>` is the most-visible component to reskin first (analogous to the new `<header class="nav">` in `index.html`)
6. The standalone design HTML the operator re-attaches · cross-reference visual patterns against the index.html implementation

---

## 6 · Quick orientation cheatsheet

| Question | Answer |
|---|---|
| Current main HEAD | `4b5630b` · Phase 2 marketing redesign live |
| What's deployed live but pending operator UI toggle | GitHub Pages source · Settings → Pages → Source → "GitHub Actions" (unblocks `/vault/` from serving the React build) |
| Last applied SQL migration | `20260526030000_bbf_user_soft_delete_foundation.sql` (Phase 6.0i) |
| Last edge-function deploys | 13/13 Anthropic agents converted to canonical `callClaude` (Phase 6.0j shipped `bbf-co-coach` v13 · Phase 6.0k shipped the 12 remaining agents to repo with all conversions applied; redeploys land on Supabase when push triggers) |
| Test suite status (vision-scout) | 54/54 Node tests pass at `vision-scout/test/*.test.js` (`cd vision-scout && npm test`) |
| Test suite status (vault E2E) | Playwright suite scaffolded (Phase 4.3f · 3 tests · Router Lock / Double-Submit Shield / Data Layer Intercept) · `cd vault && npm run test:e2e` after `npx playwright install chromium` |
| Vault build status | `cd vault && npm run typecheck && npm run build` · zero errors · 85 modules · `dist/assets/index-*.js` 196.29 kB / 62.14 kB gzip · 6 tabs fully wired |
| Soft-delete posture | `bbf_users.deleted_at` live · `bbf_users_active` view · RLS RESTRICTIVE policy · `bbf_soft_delete_user(uid, reason, actor)` SP available to service_role · auth RPC gated |
| Anthropic-armor adoption | **13/13** · all in-vault agents on canonical `callClaude` (Phase 6.0j seeded the helper trio + bbf-co-coach · Phase 6.0k drained the 12-agent debt · §6.0j flipped to [x]) |
| Marketing redesign status | LIVE on `main` · Phase 1 (hero + tiers) + Phase 1 polish + Phase 2 (all remaining sections) · `index.html` 4,953 → 8,343 lines · backend wires (env.js · Pathfinder · Stripe map · Comlink FAB · Interrogator · Nutrition Lite · Turnstile · BBF_LANG · selectTier) all preserved |
| Phase 2 ops directives delivered | Vault button pinned to nav on desktop (`.bbf-vault-nav-btn`) / FAB-only on mobile via `@media (min-width:641px){.bbf-pf-fab{display:none}}` + reverse for nav button · founder portrait `bbf-photo.jpg` reinstated in `#story` origin slot 3 |
