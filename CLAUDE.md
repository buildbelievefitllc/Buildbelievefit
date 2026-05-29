# CLAUDE.md — Build Believe Fit (BBF)

Authoritative project brain for Claude Code sessions. This file consolidates the
durable architecture, standards, and guardrails previously scattered across the
`PHASE_*`, `*_HANDOFF`, and `*_PASSOVER` documents. Read it first, every session.

> **Source of truth hierarchy:** `AI_DIRECTIVES.md` (brand + operating constitution,
> CEO-owned) → this file (engineering standards) → any active session handoff note.
> If they conflict, stop and surface it before writing code.

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
| Data | Supabase Postgres + RLS | `apply_migration` (never ad-hoc prod SQL) | Canonical schema: `api/supabase-schema-actual.sql` |

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
| OPUS | `claude-opus-4-7` | PAR-Q+, wellbeing/ED escalation, cardiac intercept (**safety-critical only**) |

Rules:
- Add new use-cases to the `UseCase` type + `MODEL_MAP` — never inline a model string.
- `vision: true` auto-upgrades a Haiku target to Sonnet (Haiku image grounding is unreliable).
- `override` exists for emergencies only.
- Every call should emit the `(function, use_case, model)` log triple via `routeAndLog`.

> **⚠️ Open decision — Opus 4.7 → 4.8:** the router and all edge functions currently
> pin **Opus 4.7**. If the team standardizes on Opus 4.8, change the single `MODELS.OPUS`
> constant in `model-router.ts` (and audit the few functions that still inline a model id:
> `bbf-co-coach`, `bbf-agentic-pathfinder`, `bbf-agentic-peaking`). Do not assume 4.8 until
> that change lands.

## 5 · Supabase edge function conventions

Standard structure (see `bbf-co-coach/index.ts` as the reference implementation):

- Deno + `serve` from `deno.land/std@0.168.0/http/server.ts`.
- **CORS** constant + `jsonResponse(body, status)` helper at top; handle `OPTIONS` preflight.
- Auth via `X-BBF-Admin-Token` shared-secret header where admin-gated.
- Success: `{ ok: true, ... , model, usage }`. Errors: non-2xx `{ error: "<slug>", detail?: "..." }`.
- Model selection through the router (§4) — log the routing triple.
- Deploy/inspect via the Supabase MCP tools (`deploy_edge_function`, `get_edge_function`,
  `get_logs`, `get_advisors`); use `apply_migration` for schema, never ad-hoc prod SQL.

## 6 · Git hygiene (ABSOLUTE)

- **🚫 NEVER push or commit directly to `main`.** `main` is branch-protected (push returns HTTP 403) and auto-deploys to Render + GitHub Pages on merge.
- **Workflow:** branch from `main` (`claude/<short-name>` or `ag/<short-name>`) → commit → `git fetch origin main` → `git rebase origin/main` → `git push --force-with-lease` → open PR → **rebase-merge**.
- Every deliverable is one bounded PR: summary, change list, test plan, risk notes. Phase closes only when smoke tests pass.
- Use `mcp__github__*` tools for PR create/merge.

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
