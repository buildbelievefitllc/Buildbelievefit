# Coaching Module — Optimization & Redundancy Audit

**Author:** Lead Systems Architect pass · 2026-07-09
**Scope:** the Command Center **Coaching** domain rail — Founder Five (Client Hub),
BBF Eagle Eye, Comlink, Nutrition Locker, Sports Portal — plus the deprecation of
Risk Telemetry / The Sovereign Panopticon.

> **Prime directive honored:** no destructive deletion on the five active tools; no
> live `DROP TABLE`. This document is the *flag + plan*. Only the Risk Telemetry
> **frontend view** was actually removed (safe, cleanly orphaned).

---

## 1 · Risk Telemetry (The Panopticon) — DEPRECATED (executed, frontend only)

**Removed from the app** (reversible, house-style comment-out with restore notes):

| Surface | File | Change |
|---|---|---|
| Domain rail tab | `pages/CommandCenter.jsx` | `telemetry` removed from `DOMAINS` coaching + `TABS` entry commented |
| Component import | `pages/CommandCenter.jsx` | `RiskTelemetry` import commented |
| Route | `pages/CommandCenter.jsx` | `/command/telemetry` now redirects (`replace`) to `/command` — a retired/unknown tab normalizes to the roster instead of silently rendering the fallback |
| Sidebar nav | `components/MasterLayout.jsx` | `cmd-tab-telemetry` nav item commented out of the Coaching group |
| Component banner | `components/command/RiskTelemetry.jsx` | deprecation header added |

**Orphaned island (kept on disk, reversible, zero live importers):**
`RiskTelemetry.jsx → lib/telemetryApi.js → lib/intelCore.js`. Each is imported by
exactly one now-removed consumer, so the whole chain is dead code with **no dead
imports** (verified: lint clean). The i18n key `cmd-tab-telemetry` is retained
(harmless dictionary entry; keeps restore trivial).

### Backend — FLAGGED, **NOT dropped** (critical finding)

The mandate asked to flag tables built *exclusively* for 28-day ACWR. Live
investigation shows the premise is only half-true:

- `bbf_athlete_load_logs` (2 rows) and `bbf_athlete_load_bouts` (2 rows), from
  `20260504031745_phase5_telemetry_pipeline.sql`, are the ACWR substrate — **but
  they are not frontend-exclusive.** They are also read by the LIVE edge function
  `bbf-workload-sentinel`, fired nightly by the ACTIVE cron
  `bbf-workload-sentinel-nightly` (`0 1 * * *`). Dropping them breaks that job.
- **DB-load benefit ≈ zero:** 4 total rows, frozen since 2026-05-16 (no writes in
  ~2 months). There is nothing to "lighten."
- `bbf_athlete_progression` (also touched by `telemetryApi`) is **heavily shared**
  (Sports Portal, the Referee, `bbf-admin-roster`, `bbf-evaluate-athlete-progress`,
  `bbf-sentinel`) → **explicitly never drop**.

**Deliverable:** `supabase/migrations/DEPRECATION_STAGED_20260711_acwr_load_pipeline.sql`
— a staged, **non-auto-running** file (its `DEPRECATION_STAGED_` prefix is ignored by
the migration runner) containing the ready drop block behind a prerequisite
checklist (decommission the nightly cron first + CEO confirmation the ACWR product
line is fully retired). **Recommendation:** leave the 4-row pipeline in place; the
cost is nil and it's the substrate for any future Panopticon re-enable. Only proceed
to drop if the workload-sentinel automation is also being retired — a separate call.

---

## 2 · Redundancy Audit — the five active siblings

Verdict: the tools are functionally distinct (no duplicate *features* to merge), but
they read the **same client data through fragmented, uncached paths**. Three
consolidation opportunities, ranked by payoff. **None executed** — flagged for a
dedicated, reviewed refactor.

### 🔴 R1 — Duplicate full-roster pulls (highest payoff, lowest risk)

`rosterCall('roster')` — the identical `bbf-admin-roster` service-role fetch of the
whole `bbf_users` roster — is fired **independently, with no shared cache**, by:

- `ClientHub.jsx:63` (Founder Five) — *plus* two more roster-keyed batch calls
  right after: `bbf_admin_roster_calibration` and `getRosterTelemetry()`.
- `NutritionLocker.jsx:83`
- `AccessControl.jsx:55` (currently deprecated/hidden, still in tree)
- and outside Coaching: `Settings.jsx:212`, `Nutrition.jsx:950`.

Open Founder Five then Nutrition Locker → the same roster is pulled twice; Founder
Five alone triggers **three** roster-keyed round-trips on mount.

> **Recommendation:** a single `RosterProvider` (React context) or a lightweight
> request-dedupe/cache (SWR/React-Query-style, keyed by `'roster'`) so every
> Coaching panel shares one in-flight fetch + cached result. Collapses N pulls → 1
> and unifies the loading/error state that's currently re-implemented per panel.

### 🟡 R2 — Per-athlete profile read fan-out

Opening ONE athlete dossier (`ClientDossier.jsx`) fans out to **7 reads across 5 lib
modules** for the same client id:
`rosterCall('detail')` · `getLivePlans()` · `fetchAnalytics()` ·
`adminNutritionHistory()` · `fetchBodyComposition()` · `coachThread()` ·
`useAthleteWearable()`.

> **Recommendation:** a unified `useAthleteProfile(id)` hook (or one aggregate
> `bbf_admin_athlete_dossier` RPC) that returns the profile + plans + analytics +
> comms head in a single batched call, mirroring how `getRosterTelemetry` already
> batched the radar. Cuts dossier-open latency and the request count ~7→1–2.

### 🟡 R3 — Fragmented admin client-data API surface

Client-profile reads/writes are split across four lib modules with overlapping
concerns: `rosterApi.js`, `protocolOverrideApi.js`, `coachMessagesApi.js`,
`coachAnalyticsApi.js`. No single "coaching data gateway" — a new panel has to know
which of four files owns which field.

> **Recommendation:** consolidate into one `lib/coachingData.js` facade (re-exporting
> the existing functions first, then migrating callers) so the surface is
> discoverable and the auth-token attachment lives in one place. Non-behavioral,
> incremental, low-risk.

### Distinct-by-design (no merge warranted)

- **Eagle Eye** (`eagleEyeApi.js`) — cue-bucket *alignment verification*; explicitly
  non-overlapping with Comlink (compliance) and the sentinels (per its own header).
- **Comlink** (`comlinkApi.js`) — leads + concierge SOS queue; a distinct data domain
  (`bbf_leads` / `bbf_lead_actions`), no client-profile overlap.
- **Sports Portal** (`listSportsAthletes`) — reads the *sports_protocol* roster
  (youth athletes), a different population than the `bbf_users` coaching roster.

---

## 3 · System Health

- `eslint` — clean (0 errors), including the deprecated island (no dead imports).
- `vite build` — green; no orphaned references, no broken route mappings; the
  Coaching rail renders with `telemetry` gone and the four sibling tabs intact.
- Sidebar nav (`MasterLayout`) — the Coaching group now lists Founder Five ·
  Eagle Eye · Comlink · Nutrition Locker · Sports Portal (Risk Telemetry removed);
  no layout regression.

**Net this pass:** one view retired cleanly; the DB left untouched (correctly — the
"lightweight" win wasn't there and a live cron depended on the tables); three
concrete, un-executed consolidation targets documented for a future reviewed refactor.
