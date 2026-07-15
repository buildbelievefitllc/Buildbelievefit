# CLAUDE.md — Build Believe Fit (BBF)

> # ⛔ STOP — DATABASE GUARDRAIL (read before ANY database action)
>
> **This repository's local migration history has diverged from the production
> ledger and CANNOT be reconciled by timestamp repair.** Before running any
> database command, reading `supabase/migrations/`, or reasoning about schema
> state, **read [`DATABASE_SAFETY.md`](./DATABASE_SAFETY.md) in full.**
>
> Two rules are **binding on every human and every agent session**:
>
> 1. **`supabase db push` is STRICTLY FORBIDDEN on this repository.** It compares by
>    version string only, would misread **~148 of 201 local files as unapplied**, and
>    would replay them against live production — **silently reopening the
>    `bbf_compute_acwr` IDOR closed on 2026-07-15.** Also forbidden: `supabase db
>    reset` against a linked remote, `supabase migration repair`, and `supabase db
>    remote commit`. *(The CLI is not installed on the primary workstation, so this
>    cannot fire from there today — that is luck, not a control. It is live on any CI
>    runner or machine with the CLI linked.)*
> 2. **`apply_migration` is the ONLY authorized pathway** for schema changes
>    (reaffirms §3 — now mandatory, not preferred). `execute_sql` is for reads and
>    verification only, never DDL. Always verify against the live catalog
>    (`pg_proc.proacl`, `pg_policies`, `has_function_privilege()`) — never trust a
>    `{"success": true}` flag.
>
> **~33 migrations exist in production but were never committed to git — the repo
> cannot rebuild the database.** Any tooling that reports "in sync" is wrong by
> construction. Full drift report, the rejected-repair rationale, and the baseline-squash
> remedy are all in `DATABASE_SAFETY.md`.

Authoritative project brain for Claude Code sessions. This file consolidates the
durable architecture, standards, and guardrails previously scattered across the
`PHASE_*`, `*_HANDOFF`, and `*_PASSOVER` documents. Read it first, every session.

> **Source of truth hierarchy:** `AI_DIRECTIVES.md` (brand + operating constitution,
> CEO-owned) → this file (engineering standards) → `DATABASE_SAFETY.md` (binding for
> all database operations) → any active session handoff note.
> If they conflict, stop and surface it before writing code.

---

## ⛔ EXECUTIVE BOUNDARY: ZERO MANUAL LABOR

> **Standing CEO order (Akeem). Highest operating precedence within this file — read before acting.**

The CEO (Akeem) does not execute manual labor. Do not bounce unfinished tasks back to the executive desk.

If you encounter an environmental blocker (e.g., expired tokens, missing binaries, port conflicts), you must exhaust every programmatic bypass, CLI workaround, and script injection available to you to fix it yourself.

Never ask the CEO to leave the terminal, click web links, authorize external platforms manually, or copy-paste code unless there is absolutely zero programmatic path forward.

**You are the machine. You do the lifting.**

> *Scope:* this doctrine governs **who does the work** — it eliminates manual hand-offs to the executive desk; it does **not** suspend the LOCKED brand guardrails (§2), the security & data boundaries (§7), or the source-of-truth hierarchy above. "Zero manual labor" means the machine carries the load **inside** that constraint envelope, never by crossing it.

---

## 1 · What BBF is

Build Believe Fit is a universal human-optimization fitness platform (PWA + AI
coaching backend). Two primary product surfaces:

- **Sovereign Vault** — adults/professionals: 16/8 intermittent fasting + clinical hypertrophy.
- **BBF Athlete Portal** — youth athletes: periodized sport training + the **Kinematic Form HUD** (biomechanics/injury-prevention scanner).

Mission: transform bodies and lives through joint health, strength, and cardio.
Trilingual (EN / ES / PT) is **structural, not optional**.

## 2 · Brand non-negotiables (LOCKED — do not move without CEO order)

- **Colors:** BBF Purple `#6a0dad`, BBF Gold `#f5c800` (permanent identity). Matte Black `#090909` is an *approved surface/canvas only* — never for primary CTAs, brand marks, headers, or load-bearing identity.
- **Typography:** Bebas Neue (headers), Barlow Condensed (body). No substitutions without explicit order.
- **Founder assets:** CEO photography, logo, brand marks are protected — never remove, reposition, or restyle without directive.

## 3 · Architecture & deploy topology

| Surface | File / location | Deploys via | Notes |
|---|---|---|---|
| PWA frontend | `bbf-app.html`, `admin.html`, `index.html`, `sw.js` | Merge to `main` → **GitHub Pages** (~1–2 min) | Live: `buildbelievefit.fitness` |
| Express/WS proxy | `index.js`, `api/` | Merge to `main` → **Render** auto-deploy (~1–2 min) | Health: `https://buildbelievefit.onrender.com/health` |
| AI agents | `supabase/functions/*` (Deno edge functions) | `mcp__<supabase>__deploy_edge_function` | Project `ihclbceghxpuawymlvgi`, Postgres 17.6 |
| Data | Supabase Postgres + RLS | `apply_migration` **only** — see `DATABASE_SAFETY.md`; `db push` is FORBIDDEN | Canonical schema: `api/supabase-schema-actual.sql` |

> **`sw.js` cache bump:** any change to frontend files **must** bump the `CACHE`
> version in `sw.js`, or users won't receive the update.

## 4 · Central model router (REQUIRED for every Claude call)

All Claude-calling edge functions route through `supabase/functions/_shared/model-router.ts`.
**Never hardcode a model string in a caller.** Cost/quality decisions live in one file.

```ts
import { routeAndLog } from '../_shared/model-router.ts';
const model = routeAndLog('bbf-co-coach', 'parq_assessment');     // → Opus tier
const model = routeAndLog('bbf-comlink', 'kinematic_form_score'); // → Sonnet (vision)
```

**Tiering (by use-case tag, not by guesswork):**

| Tier | Current model | Use for |
|---|---|---|
| HAIKU | `claude-haiku-4-5` | retries, narration, i18n, snapshots, forecasts (low-stakes) |
| SONNET | `claude-sonnet-4-6` | vision/biomechanics, onboarding dialog, prehab (mid-complexity) |
| OPUS | `claude-opus-4-8` | PAR-Q+, wellbeing/ED escalation, cardiac intercept (**safety-critical only**) |

Rules:
- Add new use-cases to the `UseCase` type + `MODEL_MAP` — never inline a model string.
- `vision: true` auto-upgrades a Haiku target to Sonnet (Haiku image grounding is unreliable).
- `override` exists for emergencies only.
- Every call should emit the `(function, use_case, model)` log triple via `routeAndLog`.

> **✅ LOCKED — Opus 4.8 (CEO order, Full Fleet Sync):** the Opus tier is standardized on
> **`claude-opus-4-8`**. `MODELS.OPUS` in `model-router.ts` is the single source of truth and
> is pinned to 4.8 — never inline a model string in a caller. The remaining `claude-opus-4-7`
> strings in a few function header comments (`bbf-co-coach`, `bbf-agentic-pathfinder`,
> `bbf-agentic-peaking`, `bbf-agentic-cardio`) are stale **doc examples only** (response-shape
> illustrations), not live pins — refresh opportunistically. Production deploy carries this
> 4.8 router to the live environment on the next edge push.

## 5 · Supabase edge function conventions

Standard structure (see `bbf-co-coach/index.ts` as the reference implementation):

- Deno + `serve` from `deno.land/std@0.168.0/http/server.ts`.
- **CORS** constant + `jsonResponse(body, status)` helper at top; handle `OPTIONS` preflight.
- Auth via `X-BBF-Admin-Token` shared-secret header where admin-gated.
- Success: `{ ok: true, ... , model, usage }`. Errors: non-2xx `{ error: "<slug>", detail?: "..." }`.
- Model selection through the router (§4) — log the routing triple.
- Deploy/inspect via the Supabase MCP tools (`deploy_edge_function`, `get_edge_function`,
  `get_logs`, `get_advisors`); use `apply_migration` for schema, never ad-hoc prod SQL.

## 6 · Git hygiene (Trunk-Based Deployment)

> **Rule change (CEO order, 2026-06):** branch protection on `main` has been
> **lifted** to accelerate the build. The previous "never push to `main` / HTTP 403"
> constraint no longer applies and this supersedes any earlier handoff note.

- **✅ Direct-to-`main` is authorized.** Commit and push UI/UX **and** backend-function
  work **directly to `main`**. **PRs are not required.** `main` auto-deploys:
  the **Render static site** (`bbf-command-center`) serves the React frontend from
  `frontend/dist`; the **Render web service** (`bbf-vault-webhook`) serves the
  Express/WS proxy; **GitHub Pages** serves the legacy root PWA.
- **Discipline still applies — a red `main` ships a broken deploy:**
  - Verify locally before every push — for frontend changes, `cd frontend && npm run lint && npm run build` must be green.
  - Stay fast-forward: `git fetch origin main && git rebase origin/main` before pushing.
  - One bounded, self-described commit per change (clear message: what + why).
- **PRs remain available, optional.** For genuinely risky or cross-cutting work where
  review is wanted, open one via `mcp__github__*` — a choice, not a gate.
- **Unchanged guardrails:** never commit secrets; honor LOCKED brand (§2) and RLS (§7);
  the `sw.js` cache-bump rule (§3) still holds for legacy PWA files.

## 7 · Security & data boundaries

- No exposed credentials in code or client bundles; secrets via env only.
- Respect Postgres **RLS** — see `api/RLS_HARDENING_AUDIT.md`.
- Don't discuss backend/AI internals in customer-facing agent copy (see `AI_DIRECTIVES.md` §7).

## 8 · Operating posture (Constraint-First Protocol)

Execution-based, not permission-based, **inside** the constraint envelope (this file +
`AI_DIRECTIVES.md` + active handoff). Permission-gate only when: a LOCKED constraint would
be touched, scope is genuinely ambiguous after MD review, or the CEO flagged the task.
Be critical — no yes-men. If something breaks the architecture, say so before coding.

## 9 · Reference docs (kept, not legacy)

- `AI_DIRECTIVES.md` — brand + AI command-structure constitution (CEO-owned).
- `AG_INTEGRATION_NOTES.md` — multi-agent workflow, deploy topology, active backlog.
- `api/SCHEMA_DRIFT_REPORT.md`, `api/RLS_HARDENING_AUDIT.md` — current DB audits (referenced by `supabase/config.toml`).

## 10 · Landing / marketing UI standard (LOCKED — modular tab decks)

> **✅ LOCKED — CEO order (Akeem):** the **tab-deck is the standard design system** for the
> public marketing surface, and the **vertical-funnel layout is officially deprecated.** We
> ruthlessly optimize against **scroll bloat** — modular tab structures are the permanent
> architectural standard going forward. Do **not** re-introduce long vertical section stacks
> without an explicit CEO order. (This supersedes the earlier "brand-first vertical funnel"
> reorder, which was tried and reverted — don't resurrect it.)

- **Pattern:** group related sections into a **tabbed deck** (one panel visible at a time),
  never a tall vertical scroll. Reference implementation: the **Brand Engine deck** in
  `frontend/src/pages/MarketingLanding.jsx` (`#deck`) — a numbered tab bar (`01`, `02`, …)
  over a single active panel.
- **Reuse the deck tab design system** for any new tabbed module — the `s.tab` / `s.tabActive`
  / `s.tabIdx` / `s.tabIdxActive` / `s.tabLabel` style set (numbered index, Bebas label,
  purple→gold active state). The **Knowledge deck** (`#knowledge` — `01 Science Hub` /
  `02 Routine Interrogator`) is the canonical two-tab example.
- **Default + a11y:** a sensible default tab is active on load; tabs are real
  `<button role="tab">` with `aria-selected`; **only the active panel mounts** (kills scroll
  weight). In-page nav links flip the relevant tab and scroll the deck into view — never rely
  on anchors pointing at an unmounted panel.
- **Still honors:** LOCKED brand (§2); the `sw.js` / React-SPA `CACHE` bump on any frontend
  change (§3); green `lint` + `build` before every push (§6).
