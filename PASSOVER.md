# Build Believe Fit · PASSOVER

**Status:** living handover · the single canonical state document for cross-session context transfer
**Companion docs:**  `ARCHITECTURE.md` (live system map · tables / env vars / model routing) · `api/BBF_MASTER_PLAN.md` (living roadmap · phase status with closure SHAs)
**Last updated:** 2026-05-28 (session 4 · marketing redesign REVERTED · P0 production sprint · trilingual coverage sweep complete · KFH transpiler root-cause fix · main at `6ca9bf3`)

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
| `main` HEAD | **`6ca9bf3`** (Phase 7 zero-backlog i18n closeout · KFH transpiler lang-aware · bbf-meal-macros lang directive · Playbooks dynamic JS i18n) |
| Tip of last session's work | `4b5630b` (Phase 2 marketing redesign · session 3 closing state) · all session 4 work landed in 7 commits between `ad31a86` (revert) and `6ca9bf3` (KFH fix) |
| Feature branch (this session) | `claude/lucid-curie-0xwqK` (in sync with main · zero divergence) |
| Live Supabase project | `ihclbceghxpuawymlvgi` · `https://ihclbceghxpuawymlvgi.supabase.co` |
| Live Render service | `vision-scout` · `https://vision-scout.onrender.com` (auto-deploys on push to `main`) · plus a SECOND Render service `https://buildbelievefit.onrender.com` (BBF VAULT engine · root `index.js` · Phantom Eye WS proxy at `/ws/phantom-eye`) discovered this session · ARCHITECTURE.md §5 says vision-scout is the only Render service · OUTDATED · two services exist |
| Live storefront | `https://buildbelievefit.fitness` (GitHub Pages · auto-deploys on push to `main`) · **LEGACY DESIGN now serving** (Phase 1+2+3 marketing redesign REVERTED in session 4 · operator call · "if it ain't broke, don't fix it") |
| Live Vault SPA (legacy) | `https://buildbelievefit.fitness/bbf-app.html` (5 paying clients · 19,754 lines · received Phantom Eye ttsHealthy latch + sticky-toggle wire-up + defensive SELDAY + trilingual coverage tags this session) |
| New Vault SPA (compiled) | `https://buildbelievefit.fitness/vault/` (Vite + React + TS · 6 tabs live · awaits operator GitHub Pages source toggle · **still untouched by session 4**) |

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

### Session 4 · Marketing redesign REVERT + P0 production sprint + Trilingual coverage sweep
| Item | Closure |
|---|---|
| **Marketing redesign FULL REVERT** · operator call · "Pathfinder hidden by .reveal opacity-0 cascade conflict · mobile layout clunkiness · two-step recovery already in flight · if it ain't broke don't fix it" · `git checkout 0340379 -- index.html` rolled back to pre-Phase-1 legacy state (BBF portrait hero · Start My Path · Enter The Vault → bbf-app.html · #services/#founder/#programs/#interrogator/#nutrition/#testimonials/#explorer/#playbooks/#specialized/#transformation/#pathfinder/#app-download/#contact · legacy detailed footer · 3612 lines deleted / 724 inserted) · env.js / doSubmit / bbf-lead-capture / Pathfinder / Interrogator / BBF_STRIPE_BY_TIER / Turnstile / BBF_LANG / vault/src/* / PASSOVER / api/BBF_MASTER_PLAN.md / supabase/functions/* all UNTOUCHED | `ad31a86` |
| **Phantom Eye dual-voice fix** · operator video audit "did a two voice response and it choked out" → root cause = per-PCM-chunk evaluation of `BBF_TTS.lastFailure()` racing async with `_lastFail` set/cleared on speak() completion (bbf-app.html:12219/12231) · two concurrent speaks last-write-wins on `_lastFail` · gate flips mid-session → Gemini PCM bleeds over draining ElevenLabs · FIX latches `lc.ttsHealthy` ONCE at WS open (`_lcAttachWsHandlers` line 4968 area) · gate now reads `lc.ttsHealthy` per chunk · trade · if ElevenLabs soft-fails mid-session no audio plays for rest of session (acceptable vs dual-voice bug) | `79e5141` |
| **`bbf-tts-eleven` 401 cascade** · ROOT CAUSE = function deployed with `verify_jwt: true` (sole anomaly across all bbf-* edge functions · all others vt:false) · every browser POST gateway-rejected with 401 for 12+ hours · ElevenLabs fully dead in production · FIX redeployed v10 → v11 with `verify_jwt: false` · no source code change · probe via `net.http_post` from Supabase SQL · status_code=200 · 71 KB MP3 from Julius confirmed | function `bbf-tts-eleven` v11 (Supabase) · no git commit |
| **`bbf-meal-image` Imagen 3 sunset** · symptom = POST 502 `{ok:false, error:'imagen_generation_failed'}` · diagnostic via added `?list-models=1` GET ops endpoint with `filter=predict` · Google returned 404 NOT_FOUND on `models/imagen-3.0-generate-002` · current Imagen registry = Imagen 4 family only (`imagen-4.0-generate-001` · `-fast-generate-001` · `-ultra-generate-001`) · FIX bumped `IMAGEN_MODEL` to `imagen-4.0-generate-001` · verified cache hit returns image_url at `https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/meal-images/bbf_imagen_4_probe_bowl.png` · first-call latency 30-50s (vs Imagen 3's 8-12s) · cache layer protects against this for repeats · added `?list-models=1` permanent ops diagnostic (filters: `predict`, `bidi`, `native-audio`) | `8f15ce6` (source) + function `bbf-meal-image` v7 (Supabase) |
| **`bbf-meal-macros` 401 + same verify_jwt bug** + `bbf_vision_scout` same (admin tool · unused · low priority) · FIX redeployed bbf-meal-macros v3 → v4 with `verify_jwt: false` · Anthropic Haiku 4.5 round-trip verified 200 with macros payload · `bbf_vision_scout` left at verify_jwt:true (admin tool · zero recent traffic · ok) | function `bbf-meal-macros` v4 (Supabase) |
| **Full integration audit · Anthropic / Gemini / ElevenLabs** · live probes confirmed: Anthropic API healthy (Sonnet via pathfinder · Haiku via meal-macros · Opus via cardio · all 200) · Gemini Imagen 4 healthy (post fix) · ElevenLabs healthy (post verify_jwt fix) · Gemini Live model `gemini-2.5-flash-native-audio-latest` STILL REGISTERED on bidiGenerateContent (Hypothesis 1 FALSE · model not deprecated) · new Gemini 3.1 Flash Live Preview also available for future upgrade · Voices table verified · Julius (`VlUmeC1Uzj3NnwiVR9K9`) + Kelli LaShae (`Z5JpFCNFIz8Nhe4KEikq`) live | no commit (audit only) |
| **i18n Phase 1+2+3 · Trilingual coverage groundwork** · ENGINE EXTENSION at `bbf-lang.js` apply() · now also handles `data-lang-attr-<NAME>` for `placeholder`/`aria-label`/`title`/`alt`/`value` (was textContent-only) · setLang() now also dispatches `bbf-lang-changed` CustomEvent for JS-rendered UIs · PLUS 54 dict keys (cardio orphan fix · login user/PIN + placeholders · new-client form · intake validation TOASTs · index.html marquee + TDEE form + hamburger aria + skip-to-main) · `data-lang-key` count bbf-app.html 173 → 183 / index.html 125 → 151 / `data-lang-attr-*` 0 → 8 | `81cf5c2` |
| **i18n Phase 4 · Tactical strike** · 68 new dict keys · Athlete Portal (tp-athlete · 38 keys including 3 setup steps + 5 sport options + season phase + Clinical Protocol + Positional Intelligence Comlink + Progression Gate) · Omniscience toggle JS-rendered button text wrapped with `_t()` + listener added inside IIFE for `bbf-lang-changed` → calls `_renderAll()` · Interrogator form (10 keys · multi-line workout placeholder translated · localized day abbreviations LUN-DOM/SEG-DOM) · Playbooks static headers (kicker/title/sub/CTA) · Testimonial metric subtitles · nav Playbooks (desktop + mobile) + Scouting Hub | `7df3bde` |
| **P0 defensive SELDAY + sticky-toggle + Phase 5 deep sweep** · DIAGNOSTIC · operator reported Day-tab unresponsive · 100% evidence-based finding · ZERO overlap between Phase 4 edits (lines 234-258 / 1030-1199 / 3688 / 13414-13530) and Day-tab code (581-595 / 13527+ / 13564+ / 13610+) · no data-lang-key was added to #tp-workout or ancestors · apply() can't reach #dnav · 'bbf-lang-changed' fires only on setLang() not at boot · pushed back on Big Jim's attribution while shipping defensive instrumentation · SELDAY(i) now wraps in try/catch · logs `[SELDAY] PLAN is null` / `[SELDAY] index out of range` / `[SELDAY] threw exception` to console for surfacing actual cause · STICKY-TOGGLE FIX · added module-level listener at bbf-app.html:2669 (post TAB() closing brace) that calls `TAB(activeName)` on `bbf-lang-changed` so dynamic content (Day buttons, exercise rows, nutrition cards) refresh in place without sport-switching workaround · Phase 5 deep sweep · 27 new dict keys · Nutrition tab (Virtual Chef · Nutrition Vision viewport · 10 keys) · Cardio tab (Smart Cardio header · 7 keys) · Prehab tab (Sovereign Prehab Tracker · 10 keys) | `f62ca0f` |
| **i18n Phase 6 · Target Alpha · Playbooks dynamic JS** · 77 new dict keys (5 sports + 65 KPIs slugified `kpi-<slug>` + 7 static renderer labels + 3 generic KPI fallbacks) · index.html `_trSport(id, fallback)` / `_trKpi(label)` / `_trL(key, fallback)` helpers added · `initPlaybookBar()` + `pbRenderPositions()` refactored to flow through them · `_wireMarketingLangChange()` IIFE listens to `bbf-lang-changed` and re-fires `initPlaybookBar()` + `initExplorer()` so marketing site has sticky-toggle behavior (no TAB() to refire) | `b952b42` |
| **i18n Phase 7 · Target Bravo (partial) + Target Charlie (root-cause fix)** · `_shared/lang-directive.ts` NEW shared helper (49 lines · `BbfLang` type · `normalizeLang(raw)` · `langDirective(lang)` returns empty for 'en' · ES/PT directives bind output language while keeping JSON keys English) · `bbf-meal-macros` v5/v6 deployed with `payload.lang` extraction + `systemPromptFor(lang)` injecting LANGUAGE NOTE for regional dish interpretation · v5 attempted composite `onConflict: 'name_normalized,lang'` but rolled back to v6 single-col onConflict because the table's UNIQUE is on `name_normalized` only · cache stays language-agnostic until composite-UNIQUE migration · client-side `bbf-app.html` meal-macros lookup now sends `lang: BBF_LANG.get()` · TARGET CHARLIE = KFH transpiler · OPERATOR/Big Jim flagged "Max Stretch" / "Elbow Securely Anchored" / "Humerus Fixed" as untranslated · INVESTIGATION revealed kfh-blueprints.js (332 KB · 33 blueprints) is ALREADY fully trilingual `{en,es,pt}` per the file header · ACTUAL bug = `var lang = 'en';` HARDCODED at kfh-transpiler.js:436 inside transpile(bp) + 3 more hardcoded `'en'` at lines 295/348/356 inside `_emitCallout` / `_emitSVG` · 9 surgical edits added optional `langArg` to transpile + propagated lang to `_emitSVG(bp, lang)` + `_emitCallout(parts, co, mode, bp, lang)` · all internal pickLang calls now use the lang variable · transpile priority `langArg → window.BBF_LANG.get() → 'en'` · ADDED bbf-lang-changed listener at end of kfh-blueprints.js IIFE that re-iterates BLUEPRINTS array and re-calls registerBlueprint(bp) so the catalog overwrites entries with new-language SVG markup · BLUEPRINT data was always there · pipeline couldn't reach it | `6ca9bf3` |
| **6 remaining agent deploys for langDirective DEFERRED** · local source files in `supabase/functions/bbf-{agentic-*,co-coach}/` have drifted from deployed versions post Phase 6.0k (local pathfinder is 275 lines vs deployed 460+ canonical Anthropic-armor) · mass-redeploying from local would revert 6.0k · each remaining agent needs `mcp__supabase__get_edge_function` → import langDirective → 3-line patch in handler → `mcp__supabase__deploy_edge_function` cycle per agent · pattern documented in `lang-directive.ts` comments | deferred (see §3) |

---

## 3 · Pending operator actions (manual · can't be done from here)

| Item | What's needed |
|---|---|
| **Vault deploy activation** (Phase 4.1 closure) | GitHub repo → **Settings → Pages → Source** → toggle from "Deploy from a branch" to **"GitHub Actions"**. Until that flips, `pages.yml` runs but does not publish. After toggle, first run produces `/vault/` build at `https://buildbelievefit.fitness/vault/` confirming "BBF Vault React Architecture Active" · legacy `/bbf-app.html` continues serving byte-identically. Still pending end of session 4. |
| Phase 0.1 · `BBF_MARKETING_ADMIN_TOKEN` rotation | Paste fresh 32-char token into Render dashboard → `vision-scout` → Environment → `BBF_MARKETING_ADMIN_TOKEN`. Test: old token returns 401 on `/api/v1/marketing/telemetry`, new token returns 200. |
| Resend webhook config (for Phase 1.2 events to flow) | Resend dashboard → Webhooks → set endpoint to `https://vision-scout.onrender.com/api/v1/marketing/inbound` · copy Signing Secret · paste into Render → vision-scout → Environment → `RESEND_WEBHOOK_SECRET`. |
| Optional · Stripe Payment Link configuration | `vapi-sms-closer` ships with placeholder `https://buy.stripe.com/test_placeholder_*` URLs. Swap to real Stripe Payment Link URLs when ready · no code change required. |
| **NEW · 6 agent redeploys for `langDirective`** (Phase 7 Target Bravo finish) | The shared helper `supabase/functions/_shared/lang-directive.ts` is committed. The agents `bbf-co-coach` · `bbf-agentic-cardio` · `bbf-agentic-comlink` · `bbf-agentic-peaking` · `bbf-agentic-prehab` · `bbf-agentic-pathfinder` · `bbf-agentic-interrogator` each need: (1) `mcp__supabase__get_edge_function` to fetch CURRENT deployed source (NOT the drifted local file), (2) add `import { langDirective, normalizeLang } from '../_shared/lang-directive.ts';`, (3) inside handler after payload parse · `const _bbfLang = normalizeLang(payload?.lang);`, (4) at the callClaude invocation change `system: SYSTEM_PROMPT` → `system: SYSTEM_PROMPT + langDirective(_bbfLang)`, (5) `mcp__supabase__deploy_edge_function` to redeploy with `verify_jwt: false` (keep existing). Pattern verbatim per agent · do NOT mass-deploy from local source · Phase 6.0k callClaude conversion lives in deployed source and would be reverted. Plus client-side: every `fetch()` to one of these agents in `bbf-app.html` should include `lang: (typeof BBF_LANG !== 'undefined' && BBF_LANG.get) ? BBF_LANG.get() : 'en'` in the body (see the meal-macros pattern around bbf-app.html:14440). |
| **NEW · `bbf_meal_macros` composite UNIQUE migration** | Currently `UNIQUE (name_normalized)` only · so first-user's language wins the cache slot per meal name (`avena con leche` cached as English oatmeal if EN-user queries first; Spanish user gets that English row). DRAFT migration `ALTER TABLE bbf_meal_macros DROP CONSTRAINT bbf_meal_macros_name_normalized_key; ALTER TABLE bbf_meal_macros ADD CONSTRAINT bbf_meal_macros_name_lang_key UNIQUE (name_normalized, lang);` then re-deploy bbf-meal-macros with `onConflict: 'name_normalized,lang'` (the v5 attempt that got rolled back). Table is currently empty so no data conflicts. Operator go-signal required (destructive DDL). |
| **NEW · Visual verification of session 4 wins** | Operator hard-refresh on iPhone safari (Service Worker caches bbf-app.html aggressively · cache clear required) · then: (1) Open Phantom Eye / Nutrition Vision · expect single voice (Julius or Kelli LaShae) · NO Gemini PCM bleed (2) Open ANY exercise's Kinematic Form HUD · switch language toggle · expect `[KFH_BLUEPRINTS] re-registered 33 blueprints for new language` in console + all anatomical overlays render in ES/PT (3) Open Playbooks section on marketing site · click ES · sport bar + position cards + KPI chips translate in place without sport-switching (4) Type Spanish meal name in nutrition tab when in ES · bbf-meal-macros now interprets natively |

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

## 5 · Next-phase directive · Finish Phase 7 Target Bravo + verify session 4 wins

**Session 3's "apply marketing design language to the app side" directive is MOOT** · the marketing redesign was fully reverted in session 4 (operator call · production fragility). The new design tokens / typography port to the vault React side is no longer the next sprint · re-prioritize when/if a marketing rebuild happens.

### The immediate next sprint is to FINISH Phase 7 Target Bravo (6 agent redeploys) + apply the bbf-meal-macros composite-UNIQUE migration

#### Phase 7 Target Bravo · 6 agent langDirective redeploys

The pattern is now documented in `supabase/functions/_shared/lang-directive.ts`. For each of `bbf-co-coach` · `bbf-agentic-cardio` · `bbf-agentic-comlink` · `bbf-agentic-peaking` · `bbf-agentic-prehab` · `bbf-agentic-pathfinder` · `bbf-agentic-interrogator`:

1. **Fetch current deployed source** · `mcp__supabase__get_edge_function({ project_id: 'ihclbceghxpuawymlvgi', function_slug: '<name>' })` · the returned `files[]` will include both `source/index.ts` AND any `_shared/*.ts` dependencies the function uses. DO NOT skip this step — local repo files are stale post Phase 6.0k.
2. **Add import** near top of `index.ts` (after existing _shared imports):
   ```ts
   import { langDirective, normalizeLang } from '../_shared/lang-directive.ts';
   ```
3. **Extract lang from payload** inside the serve handler, after the existing `payload = await req.json()`:
   ```ts
   const _bbfLang = normalizeLang(payload?.lang);
   ```
4. **Append directive to system prompt** at the callClaude invocation — change:
   ```ts
   system: SYSTEM_PROMPT,
   ```
   to:
   ```ts
   system: SYSTEM_PROMPT + langDirective(_bbfLang),
   ```
   For agents that build the system prompt inline (rare), append `langDirective(_bbfLang)` to the joined string.
5. **Redeploy** · pass the modified `index.ts` plus the unchanged `_shared/*.ts` files (verbatim from step 1's get_edge_function result) PLUS the new `_shared/lang-directive.ts` file:
   ```ts
   mcp__supabase__deploy_edge_function({
     project_id: 'ihclbceghxpuawymlvgi',
     name: '<agent>',
     entrypoint_path: 'index.ts',
     verify_jwt: false,   // KEEP current setting · all are vt:false post Phase 6.0l audit
     files: [
       { name: 'index.ts', content: '<modified source>' },
       { name: '../_shared/anthropic-call.ts', content: '<unchanged from get>' },
       { name: '../_shared/anthropic-armor.ts', content: '<unchanged>' },
       { name: '../_shared/anthropic-resilience.ts', content: '<unchanged>' },
       { name: '../_shared/model-router.ts', content: '<unchanged>' },
       { name: '../_shared/lang-directive.ts', content: '<read from local supabase/functions/_shared/lang-directive.ts>' },
     ],
   })
   ```
6. **Client-side wire-up** · in `bbf-app.html`, find every `fetch()` call to `/functions/v1/<agent>` and add `lang: (typeof BBF_LANG !== 'undefined' && BBF_LANG.get) ? BBF_LANG.get() : 'en'` to the body. Reference call sites (from session 4 grep):
   - bbf-agentic-peaking: 6735, 6751
   - bbf-agentic-forecasting: 6925, 6935, 7496, 9216
   - bbf-agentic-prehab: 7113, 7128
   - bbf-agentic-comlink: 9008, 11208, 11548
   - bbf-agentic-kinematics: 10930, 10939
   - bbf-agentic-immersion: 12667, 12673
   - bbf-agentic-linguist: 12945, 12949
   - bbf-agentic-cardio: 13129
   - bbf-meal-macros: 14374 (ALREADY DONE in session 4)
   - bbf-meal-image: 14527 (lang field useful for system-prompt translation if image-gen ever needs it · low priority)

#### Composite UNIQUE migration for `bbf_meal_macros`

Required for per-language cache (right now first-user's language wins the cache slot per meal name). Draft:

```sql
-- supabase/migrations/<timestamp>_bbf_meal_macros_per_language_cache.sql
ALTER TABLE bbf_meal_macros DROP CONSTRAINT bbf_meal_macros_name_normalized_key;
ALTER TABLE bbf_meal_macros ADD CONSTRAINT bbf_meal_macros_name_lang_key UNIQUE (name_normalized, lang);
```

Then re-deploy `bbf-meal-macros` v7 with `onConflict: 'name_normalized,lang'` in the upsert call AND `.eq('name_normalized', nameKey).eq('lang', lang)` in the cache lookup. Table is empty so no data conflicts. Destructive DDL · OPERATOR GO-SIGNAL required per §4 conv 4.

#### Deferred (from earlier sessions · still on the queue)

### Session 3 deferred · marketing → app-side design language port [STILL DEFERRED]

The marketing landing page WAS live in the new design (commits `0b81453` + `903668b` + `4b5630b`) but was reverted in session 4. The previous "mirror that same flow, aesthetic, and design system on the APP side" directive is MOOT until the design redesign is re-pursued. Original surface map (vault React reskin · option 1) and section/legacy reskin (option 2) below for reference if/when the marketing rebuild happens:

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
| Current main HEAD | `6ca9bf3` · Phase 7 zero-backlog i18n closeout (KFH transpiler lang-aware · bbf-meal-macros lang directive · Playbooks dynamic JS i18n) |
| Marketing site state | **LEGACY DESIGN serving on prod** · Phase 1+2+3 redesign FULLY REVERTED in session 4 (`ad31a86`) · operator call for production fragility |
| Live edge-function deploys | 13/13 Anthropic agents on canonical `callClaude` · PLUS session 4 fixes: `bbf-tts-eleven` v11 (verify_jwt:false) · `bbf-meal-image` v7 (Imagen 4 · imagen-4.0-generate-001 · `?list-models=1` ops diag) · `bbf-meal-macros` v6 (verify_jwt:false + lang directive) |
| What's deployed live but pending operator UI toggle | GitHub Pages source · Settings → Pages → Source → "GitHub Actions" (unblocks `/vault/` from serving the React build · still pending) |
| Last applied SQL migration | `20260526030000_bbf_user_soft_delete_foundation.sql` (Phase 6.0i) · NOTE: pending `bbf_meal_macros` composite-UNIQUE drafted but not applied (operator go-signal required) |
| Test suite status (bbf-lang.test.js) | 5/5 pass · 679 dictionary keys · zero duplicate keys · engine extension verified |
| Test suite status (vision-scout) | 54/54 Node tests pass at `vision-scout/test/*.test.js` (`cd vision-scout && npm test`) |
| Test suite status (vault E2E) | Playwright suite scaffolded (Phase 4.3f · 3 tests · Router Lock / Double-Submit Shield / Data Layer Intercept) · `cd vault && npm run test:e2e` after `npx playwright install chromium` |
| Vault build status | `cd vault && npm run typecheck && npm run build` · zero errors · 85 modules · `dist/assets/index-*.js` 196.29 kB / 62.14 kB gzip · 6 tabs fully wired |
| Soft-delete posture | `bbf_users.deleted_at` live · `bbf_users_active` view · RLS RESTRICTIVE policy · `bbf_soft_delete_user(uid, reason, actor)` SP available to service_role · auth RPC gated |
| Anthropic-armor adoption | **13/13** · all in-vault agents on canonical `callClaude` (Phase 6.0j seeded the helper trio + bbf-co-coach · Phase 6.0k drained the 12-agent debt · §6.0j flipped to [x]) |
| i18n stack state (post session 4) | **679 dict keys** · **250 data-lang-key in bbf-app.html** · **168 in index.html** · **11 data-lang-attr-* bindings** · `bbf-lang-changed` CustomEvent fires on every setLang() · listeners wired in BBF_OMNISCIENCE_TOGGLE (admin toggle re-render) · bbf-app.html module level (TAB(activeName) refire for sticky toggle) · marketing site (initPlaybookBar + initExplorer refire) · kfh-blueprints.js (re-register all 33 blueprints with new lang) · KFH transpiler now flows lang through transpile → _emitSVG → _emitCallout · all blueprint anatomical labels (Max Stretch / Elbow Securely Anchored / Humerus Fixed / Lockout / Max Depth / kineticPath labels / form callouts) reachable in ES/PT |
| Two Render services (NEW finding) | `vision-scout` (marketing engine · starter plan · `https://vision-scout.onrender.com`) + `buildbelievefit` (BBF VAULT engine · root `index.js` · Phantom Eye WS proxy at `https://buildbelievefit.onrender.com/ws/phantom-eye`) · ARCHITECTURE.md §5 says only vision-scout exists · OUTDATED |
| Permanent ops diagnostic | `GET /functions/v1/bbf-meal-image?list-models=1` returns Google's registered models · `?filter=predict` for Imagen · `?filter=bidi` for Gemini Live · `?filter=native-audio` for native-audio variants · use this BEFORE assuming a Gemini model is sunset |
| Operator complained · Day-tab unresponsive | Pre-existing or environmental · session 4 audit proved ZERO overlap between i18n edits and Day-tab code path · added defensive SELDAY console.warn/error for next click to surface real cause |
| Operator complained · sticky toggle "have to change sport before language registers" | FIXED in `f62ca0f` · bbf-app.html module-level listener calls `TAB(activeName)` on bbf-lang-changed |
