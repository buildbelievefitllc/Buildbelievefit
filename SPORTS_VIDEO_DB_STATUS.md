# Sports Hub — Core Engine Expansion · Data Status & Ingestion Report

_Build Believe Fit · Athlete Portal. Status of the v4.1 Core Engine Expansion._

This report records exactly what was ingested from the two CEO-supplied payloads,
the engineering decisions taken (including one **Immutable-Law substitution**), and
the **one outstanding data dependency** needed to light the engine to 100%.

---

## 1 · Avatar server persistence (Phase 1) — ✅ COMPLETE

- Migration `20260621150000_avatar_server_persistence.sql`:
  - `bbf_set_avatar(session_token, avatar)` + `bbf_get_avatar(session_token)` —
    SECURITY DEFINER, gated on a live `bbf_vault_sessions` token, ~700KB size guard,
    write/read `bbf_users.avatar`. Granted to `anon` / `authenticated`.
  - `bbf_admin_list_sports_athletes` now returns `avatar` so the Command Center
    Sports Portal roster shows athlete faces.
- Frontend: `lib/avatarApi.js` (`fetchAvatar` / `pushAvatar`); `SportsHub` hydrates
  from the server on mount and syncs on upload (localStorage stays the instant
  cache, **DB is source of truth → cross-device**). Verified end-to-end via a
  temporary session smoke test (set → get round-trip), test data cleaned up.

## 2 · Expanded Logic ingestion (Phase 2) — ✅ COMPLETE

Source: **"BBF Sports Hub Expanded Logic"** (delivered as a `.docx`). Fully ingested
into `frontend/src/data/sportsExpandedLogic.js`, schematized to the requested taxonomy:

- **Tiers:** `youth` / `middle` / `high` (source gender split preserved in `tierLabel`).
- **Categories:** Technical / Physical / Mental.
- **Seasonal focus:** `regimens.inSeason` / `regimens.offSeason` per sport.
- **Trilingual:** title/detail are `{ en, es?, pt? }`. Volleyball milestones carry the
  native ES/PT from source; the other four are EN-authored pending the trilingual
  scrape the CEO's agents are sourcing (consumers fall back to EN — no blank UI).
- **Target sports:** Volleyball, Softball, Track and Field, Boxing, MMA.

Wired into the **locked** Drills tab (no layout change): each discipline now renders
its REAL Training Drills + skill milestones via `hubData.buildHubModel` /
`expandedDrillCards`. `buildWeek` hardened to skip empty drill/film slots so a sport
with fewer drills never paints a blank card. Softball / Boxing / MMA gained
`SPORT_CONTENT` entries (were falling back to the generic default).

### ⚠ Immutable-Law substitution (audited)

The source **Volleyball → Off-Season** block listed **"Barbell Back Squats: 4×6"** —
a **banned** movement under the BBF Immutable Laws. It was substituted at ingestion:

| Source (banned) | Shipped (compliant) | Rationale |
|---|---|---|
| Barbell Back Squats 4×6 (3-1-1-0) | **Trap-Bar Squats** 4×6 (3-1-1-0) | Same stimulus (max lower-body power + structural density) on a spine-safe load path. |

Flagged in data as `substituted: true` with `original` + `reason` so the swap is
auditable. **No barbell back squat ships to any athlete.** (All other sports' regimens
were already compliant — power cleans, trap-bar deadlifts, Zercher squats, etc.)

## 3 · Infinite Video Database (Phase 3) — 🟡 PIPELINE READY, DATA PENDING

Source: **"BBF Sports Hub V5 Infinite Video Database Load"** (delivered as a `.docx`).

**What the document actually contains:** the production **schema/metadata** (540
records: en/es/pt × volleyball/combat_sports/tennis × tutorial/match_highlights/
championship_mindset) **+ exactly 6 structural sample records.** The document states
verbatim: _"The full 195KB production file iterates through all 540 specific IDs …
following the exact mapping specified in the requirements."_ — i.e. **the 540 real
records are not in this file.**

**Critical:** all 6 samples use **placeholder URLs** (`stream.bbfsports.com` /
`assets.bbfsports.com`) that do **not** resolve to a playable video. They are **not**
YouTube links.

**Engineering decision (honest, non-breaking):** I built the full ingestion +
mapping pipeline in `frontend/src/data/sportsHubVideoDB.js` — metadata, the 6 real
samples, an `isPlayable()` guard, and the mapping API (`queryVideos`,
`championshipMindsetVideos`, `tutorialVideos`, `videoSportKey`, `videoDbStatus`). The
Champion Mindset tab now pulls `championship_mindset` records for the athlete's
sport, **filtered to real, playable YouTube embeds**. Because the samples are
placeholders, **nothing changes in the live UI today** (the existing verified-YouTube
mindset clips keep rendering, zero broken players). The moment the production file
with real URLs replaces `VIDEO_DB_RECORDS`, every mapped surface lights up — **no
code change required.**

I deliberately did **not** fabricate 540 records or wire non-playable placeholder
URLs into the locked Drills/Exercises tabs — that would have shown broken players and
violated the strict 1:1 "exact movement-specific clip" order (`sportsVideos.js`).

### ✅ To complete Phase 3 — one input needed

Drop the **real production `bbf_sports_hub_unlimited_db.json`** (540 records with real,
playable URLs — YouTube ids preferred to match the existing player) into the repo and
point `VIDEO_DB_RECORDS` at it. The mindset deck + tutorial cards populate
automatically. `videoDbStatus()` reports loaded-vs-expected and playable counts for QA.

## 4 · Intake dropdown (Phase 4) — ✅ COMPLETE

Boxing added to the youth intake taxonomy: `YOUTH_SPORTS`, `POSITION_GROUPS.boxing`
(Orthodox / Southpaw / Pressure / Out-Boxer), trilingual `yi-sport-boxing` label,
`sportsEngine` label map, and the Champion Mindset sport→category map (→ Combat
Sports). Volleyball, Softball, Track & Field, Tennis, MMA were already selectable;
all five expansion sports now flow intake → engine → Command Center with their true
discipline label.

---

_SW cache bumped (React SPA v119). `npm run lint` + `npm run build` green._
