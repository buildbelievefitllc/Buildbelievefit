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

## 2 · Expanded Logic ingestion (Phase 2) — ✅ COMPLETE (production data)

Source: **`bbf_sports_hub_production.json`** (schema 4.1) — the real, raw JSON, tracked
in-repo at `frontend/src/data/bbfSportsHubProduction.json` and ingested by
`frontend/src/data/sportsExpandedLogic.js` (raw stays pristine; normalization +
law-substitution happen in code, auditable):

- **Tiers:** `youth` / `middle` / `high` (source gender split kept in `tierLabel`).
- **Categories:** Technical / Physical / Mental.
- **Seasonal focus:** `regimens.inSeason` / `regimens.offSeason` per sport.
- **Trilingual:** title/detail are `{ en, es, pt }` — **fully populated for all five
  sports** from source (the production file carries native ES + PT). The loader also
  tolerates the source's one `description_en_es` typo (treated as ES).
- **Target sports:** Volleyball, Softball, Track and Field, Boxing, MMA.

Wired into the **locked** Drills tab (no layout change): each discipline renders its
REAL Training Drills + skill milestones via `hubData.buildHubModel` /
`expandedDrillCards`, and the drills now carry their **real demonstration tutorial
video** (DayProtocol prefers an ingested `videoId`, else the verified movement map).
`buildWeek` skips empty drill/film slots so a sport with fewer drills never paints a
blank card. Softball / Boxing / MMA gained `SPORT_CONTENT` entries.

### ⚠ Immutable-Law substitution (audited)

The source **Volleyball → Off-Season** block still lists **"Barbell Back Squats: 4×6"**
— a **banned** movement. `normalizeRegimen` substitutes it at ingestion:

| Source (banned) | Shipped (compliant) | Rationale |
|---|---|---|
| Barbell Back Squats 4×6 (3-1-1-0) | **Trap-Bar Squats** 4×6 (3-1-1-0) | Same stimulus (max lower-body power + structural density) on a spine-safe load path. |

Flagged in data as `substituted: true` with `original` + `reason`. **No barbell back
squat ships to any athlete.** All other sports' regimens were already compliant.

## 3 · Video wiring (Phase 3) — ✅ COMPLETE (real videos live)

Production source (`bbf_sports_hub_production.json`) carries **real, distinct YouTube
URLs** per sport — tutorials + championship-mindset films. These are wired live:

- **Champion Mindset tab** → `expandedMindsetVideos(sport, lang)` appends each sport's
  real mindset film to the "Your Sport" deck (de-duped by id). Volleyball
  `gDT8QlfyfAw`, Softball `tI71jfg5q2A`, Track/Boxing/MMA `qmXjA_Prsr0` — they render
  now, in-language.
- **Drills tab** → each sport's tutorial (Volleyball `LCg0ASv3fQg` + `4Diq7HgjjQw`,
  Softball `jddeGmeVtHY`, Track `kEopBuUhClk`, Boxing/MMA `xDoik0qjdLE`) attaches to
  its drill cards as the demonstration clip.

### ⚠ On `bbf_sports_hub_unlimited_db.json` (the "540-record" file) — NOT wired, by design

I analyzed it in full. It declares 540 video records but they collapse to **only 4
distinct YouTube videos**: `LCg0ASv3fQg` ×150, `4Diq7HgjjQw` ×150, `xDoik0qjdLE` ×150,
`qmXjA_Prsr0` ×90. Every "EN volleyball tutorial" points to the *same* clip (a cosmetic
`&index=N` is appended, which YouTube ignores outside a playlist), and some titles leak
the raw key (e.g. _"Boxing_multi Cognitive Resilience Part 1"_). Wiring it would show an
athlete 50 identical-playing cards — a worse, misleading experience.

**Per the "be critical, no yes-men" directive, I did not wire it.** To make it real, the
file needs **distinct `v=` YouTube ids per record** (the `&index=` trick doesn't create
distinct videos). Once each record carries a unique real URL, the same ingestion shape
drops straight in. The 50 distinct *titles* per sport are a fine content roadmap — they
just need matching real videos.

## 4 · Intake dropdown (Phase 4) — ✅ COMPLETE

Boxing added to the youth intake taxonomy: `YOUTH_SPORTS`, `POSITION_GROUPS.boxing`
(Orthodox / Southpaw / Pressure / Out-Boxer), trilingual `yi-sport-boxing` label,
`sportsEngine` label map, and the Champion Mindset sport→category map (→ Combat
Sports). Volleyball, Softball, Track & Field, Tennis, MMA were already selectable;
all five expansion sports now flow intake → engine → Command Center with their true
discipline label.

---

_SW cache bumped (React SPA v120). `npm run lint` + `npm run build` green._
