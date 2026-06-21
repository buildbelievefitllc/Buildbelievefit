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

### Genuine video library (`bbf_sports_hub_unlimited_db_genuine.json`, schema 5.1) — ✅ WIRED

The earlier `bbf_sports_hub_unlimited_db.json` was templated padding (540 entries → 4
distinct clips via `&index=N`), so it was **not** wired. The CEO then supplied the
**genuine** file: **35 distinct, verified YouTube tutorials**, no padding, unique within
each language list — covering Volleyball, Tennis, and Boxing/MMA (`boxing_multi`) across
EN/ES/PT. It is tracked in-repo at `bbfSportsHubVideoLibrary.json` and ingested by
`sportsVideoLibrary.js`.

Wired into the **locked** Drills tab: `buildHubModel` attaches one library clip per
drill card as a trilingual `{ en, es, pt }` id map; `VideoSlot` resolves it to the
athlete's active language at render (EN fallback). Each language cycles its own list, so
every card gets a distinct, real, language-correct demonstration video. Card order stays
index-stable, so drill check-off persistence is unaffected. Coverage:
`boxing_multi` → both `boxing` and `mma`; `tennis` (no Logic milestones) overlays its
clips onto the default drill cards. Softball / Track keep their production tutorials.

## 4 · Intake dropdown (Phase 4) — ✅ COMPLETE

Boxing added to the youth intake taxonomy: `YOUTH_SPORTS`, `POSITION_GROUPS.boxing`
(Orthodox / Southpaw / Pressure / Out-Boxer), trilingual `yi-sport-boxing` label,
`sportsEngine` label map, and the Champion Mindset sport→category map (→ Combat
Sports). Volleyball, Softball, Track & Field, Tennis, MMA were already selectable;
all five expansion sports now flow intake → engine → Command Center with their true
discipline label.

---

## 5 · Champion Mindset video DB upgrade (V5) — ✅ COMPLETE (Sports Portal)

Source: **`BBS_Sports_Champion_Mindset_Videos_V5.json`** (CEO-supplied "Final"). The
Sports Portal mindset deck (`YouthChampionMindset.jsx`) was already wired to
`src/data/mindset_videos.json` (sport → language → `[{title,url}]`); this swaps that
payload for the richer V5 content, so trilingual routing (active-language array) and
sport-filtering (sport → category, → General fallback) keep working untouched.

**Padding finding (audited, be-critical):** V5 declares 1350 entries (50 / lang / sport
× 9 sports × 3 langs) but they collapse to **176 distinct YouTube ids** — every
50-entry list repeats ~17–38 real clips. V3 (810) and the 540-file carry the **identical**
176 videos, just padded less; so dedup yields the same genuine set regardless of file.
Storing the padding would render duplicate cards.

**Decision:** ingest V5 **deduped per sport × language by YouTube id** (order-preserving,
first-wins) → **686 genuine entries**, every card distinct. Per category the distinct
roster jumps from the old **10/10/10** to ~**30 / 22 / 20** (EN/ES/PT). Localization is
**real** — Spanish/Portuguese lists carry native-language titles (e.g. CR7
_"La MENTALIDAD"_ / _"EU SOU O MELHOR"_), near-zero cross-language id overlap. A defensive
first-wins dedup was also added to the component's `films` memo, so duplicate cards can
never render regardless of payload.

## 6 · General client-side psychology DB (Task 1) — ✅ COMPLETE (Vault)

The CEO then supplied the real **`bbf_champions_mindset_videos.json`** — the
**3-topic** psychology schema (distinct from the 9-sport files): **90 verified,
distinct trilingual videos** (10 / lang / topic, 90/90 distinct, 0 unparseable,
genuine native ES/PT titles):

- Self-Determination & Intrinsic Motivation
- Mind-Muscle Connection & Flow State
- Overcoming Subconscious Resistance & Mental Fatigue

Tracked in-repo at `frontend/src/data/championsPsychology.json` (normalized to canonical
`https` watch URLs, deduped defensively). Mounted on the **general client-side Vault**,
inside the **Champion's Mindset** tab (`ClientVault` → `ChampionMindset`, ungated for
every authenticated client), as a new section **`SovereignPsychologyDeck`** placed
between the champion Cinema and the Cognitive Protocols.

- **UI:** the LOCKED §10 modular tab-deck — numbered 01/02/03 topic tabs over a SINGLE
  active panel (only the active topic's grid mounts → no scroll bloat), purple→gold
  active state, Bebas labels. Distinct from the curated champion Cinema (which is a
  rich named-champion roster); this deck is the science layer.
- **Trilingual routing (Task 2 parity):** active `LanguageContext` drives both the topic
  labels and the video list (`en/es/pt` → English/Spanish/Portuguese, English fallback).
- A YouTube lightbox (embedded iframe + deep-link fallback) mirrors the proven
  `YouthChampionMindset` modal. Defensive first-wins dedup in the films memo.

---

_SW cache bumped (React SPA v123). `npm run lint` + `npm run build` green._
