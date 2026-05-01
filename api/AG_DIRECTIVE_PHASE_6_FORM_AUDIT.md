# AG DIRECTIVE — PHASE 6: FORM AUDIT DATA ROUTING

**Issued:** 2026-05-01
**Author:** Akeem Brown (Big Jim, Google) — directive body
**Operational scope:** Claude
**Owner branch:** `ag/form-audit-routing`

---

## 0. Operational scope (Claude-added — non-negotiable)

These are the guardrails. Big Jim's task body is in §1. Do the task there; respect the guardrails here.

- **Branch:** create `ag/form-audit-routing` from `main`. All work lives there.
- **No live code.** Big Jim's directive ends with "Do not write any live code yet." Honor it strictly. Specifically:
  - No edits to `bbf-app.html`, `bbf-sync.js`, `auditor-engine.js`, `prehab-auditor.js`, `admin.html`, `coach-lab.html`, `index.html`, `index.js`.
  - No new files in `supabase/migrations/`. SQL DDL goes inside the plan markdown as a fenced block, not as an applied migration.
  - No new files in `supabase/functions/`.
- **No deploy / no apply.** Do not run `supabase db push`, `supabase functions deploy`, or any MCP tool that mutates production. Claude handles migration apply + edge fn deploy after PR merge.
- **No push to main.** Per workflow rule §6 of `api/CLAUDE_SESSION_HANDOFF.md`. Push your branch only.
- **Do NOT modify `api/supabase-schema-actual.sql`.** Claude regenerates it via introspection. AG hand-edits there have caused two prior session timeouts.
- **Do NOT open a PR.** Push the branch. Claude reviews, opens the PR, Akeem merges.

**Output deliverable:** a single markdown file at `api/PHASE_6_FORM_AUDIT_PLAN.md` containing your Implementation Plan. Commit. Push branch. Stop.

**PowerShell tip (you have hit this twice):** use `;` for command chaining, not `&&`. PowerShell rejects `&&` as an invalid statement separator. Example:

- Wrong: `git fetch && git checkout main && git pull`
- Right: `git fetch; git checkout main; git pull`

If you need conditional chaining (only run next on success), wrap in `if ($LASTEXITCODE -eq 0) { ... }` or run each command on its own line.

---

## 1. Big Jim's directive (verbatim — your task)

> ⚙️ SYSTEM DIRECTIVE: HEAVY LIFT - THE BIOMECHANICAL FEEDBACK LOOP
>
> Context: We are executing the most complex internal data pipeline of the Phase 2 UI Reconciliation. We are bypassing all minor UI pruning to focus exclusively on the Form Audit Data Routing.
>
> The Target: The Post-Set "Form Audit" Modal & The Sovereign Sentinel.
>
> The Architecture of the Build:
> Currently, when an athlete logs primary tension (e.g., "Lower Back", "Knees") after a movement, the UI registers the click, but it is a "Ghost UI." The data hits a black hole.
>
> Your Execution Parameters (Analyze -> Decide -> Execute):
>
> Database Schema Verification: Check Supabase for the correct table to house this granular data (e.g., `bbf_audit_logs` or appending to `bbf_logs`). We need columns for `user_id`, `session_id`, `movement_name`, and `tension_zone`. If it doesn't exist, draft the SQL to build it and enforce RLS.
>
> Vanilla JS Routing: Write the strict Vanilla JS fetch payload to take the DOM click event from the "Where is the primary tension?" modal and INSERT it securely into the Supabase table.
>
> The Prehab Query (The Sentinel): Draft the logic for how the "Prehab & Recovery" page will eventually SELECT this data to highlight the user's damaged zones on the Sovereign Sentinel joint map.
>
> Command: Do not write any live code yet. Explore the `/app` directory where the Athlete Portal Form Audit lives. Map the exact files involved, analyze the current Supabase schema, and output your comprehensive Implementation Plan.

---

## 2. Repository orientation (because the directive's `/app` reference is generic)

Build Believe Fit does not have an `/app` directory. The Athlete Portal lives at the repo root as a monolithic single-page app. Relevant files (per `api/CLAUDE_SESSION_HANDOFF.md` §7):

| Path | Purpose |
|---|---|
| `bbf-app.html` | Athlete Portal — PIN login, workout flow, modals, Service Worker. **Large file** — grep before reading; use `Read` with offset/limit. |
| `bbf-sync.js` | Supabase REST sync layer (`supa()` wrapper at top, table-specific helpers below). |
| `auditor-engine.js` | `BBF_AUDITOR` module — Form Audit modal logic. |
| `prehab-auditor.js` | `BBF_PREHAB` module — Pre-Hab Audit modal. |
| `admin.html`, `coach-lab.html`, `index.html` | Other surfaces — likely irrelevant to this task; check before assuming. |
| `supabase/migrations/` | DDL history. **Do not add files here in this directive — DDL goes in the plan as fenced SQL.** |
| `api/supabase-schema-actual.sql` | Production schema snapshot. **Do not modify** — Claude regenerates via introspection. |
| `api/CLAUDE_SESSION_HANDOFF.md` | Living context doc. §6 = workflow rules, §7 = source-of-truth file map, §11 = context discipline. Read it. |

---

## 3. Sync your context first

Before planning, sync `bbf_v2` sandbox to current `main`. Recent merged work you may not have seen:

- PR #77 — Vapi Phase 1.7 (payload fix)
- PR #78 — Vapi Phase 5 (sales recovery loop)
- 2026-05-01 — Phase 5 verified live (edge fn v6, migration applied, 5 smoke tests pass)

These are unrelated to this directive but matter for the schema state of `bbf_vapi_calls` (it has a new `use_case` column).

PowerShell-safe sync:

```powershell
git -C C:\Users\akeem\.gemini\antigravity\scratch\bbf_v2 fetch
git -C C:\Users\akeem\.gemini\antigravity\scratch\bbf_v2 checkout main
git -C C:\Users\akeem\.gemini\antigravity\scratch\bbf_v2 pull
git -C C:\Users\akeem\.gemini\antigravity\scratch\bbf_v2 checkout -b ag/form-audit-routing
```

---

## 4. Output spec for `api/PHASE_6_FORM_AUDIT_PLAN.md`

Big Jim asked for a "comprehensive Implementation Plan." Suggested structure (adapt as you see fit):

1. **Discovery** — What does the Form Audit modal currently do? File:line anchors. Is it actually a Ghost UI, or is something else going on? Verify with the actual code; don't take Big Jim's framing on faith — verify it.
2. **Schema decision** — `bbf_audit_logs` (new table) vs. extending `bbf_logs`. Justify the choice. Show the chosen table's full column list, types, FKs, indexes.
3. **DDL** — fenced SQL block with `CREATE TABLE`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and `CREATE POLICY` statements. Match existing RLS patterns in `bbf_active_clients` / `bbf_vapi_calls` where reasonable.
4. **JS routing** — fenced JS block showing the proposed `BBF_SYNC.logFormAudit()` (or whatever you name it) using the existing `supa()` wrapper. Show the exact payload shape. Identify which existing code paths need to swap to the new function.
5. **Sentinel SELECT** — fenced SQL or JS showing the read query the Prehab/Sentinel page will use to derive "damaged zones" per user. Define the mapping between `tension_zone` IDs (audit side) and the Sentinel UI zones.
6. **Files to modify** — explicit list with file:line ranges. Distinguish "edit" vs. "no change needed."
7. **Risks / open questions** — anything ambiguous in the directive, missing context, or decisions that need Akeem's input.
8. **Out of scope** — bullet list of things you explicitly chose NOT to do (and why) to keep this PR bounded.

Length: aim 250-500 lines. Comprehensive, not bloated.

---

## 5. After you commit + push

Stop. Wait for Claude review. Do not open a PR. Do not start writing live code. If you think you need to deviate from this directive, write it as a "Risks / open questions" item in §7 of your plan, not as a unilateral decision.

---

*Reference: workflow rules in `api/CLAUDE_SESSION_HANDOFF.md` §2 (trust loop), §6 (non-negotiable rules), §11 (context discipline). The Phase 5 directive at `api/AG_DIRECTIVE_VAPI_PHASE_5.md` is a good shape reference for what a comprehensive plan looks like in this codebase.*
