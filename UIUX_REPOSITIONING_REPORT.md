# BBF Lab — UI/UX Repositioning Report

**Auditor:** Fable · Principal UI/UX Architect
**Method:** Playwright traversal of the live app (local vite build) — 38 views captured at
1440×900 desktop + 390×844 mobile, standard + `fullPage` screenshots, plus a DOM
occupancy scan per view (page height in viewport-screens, dead-band detection,
used-content-width vs viewport).
**Constraints honored:** ZERO deletion — every fix below repositions, consolidates, or
collapses; nothing is removed. All prescriptions honor the LOCKED brand (§2) and the
tab-deck standard (§10).

---

## Scroll-fatigue scoreboard (measured)

| View | Screens tall (1440×900) | Verdict |
|---|---|---|
| Marketing Landing | **6.66** (11.54 on mobile) | Bloated — funnel tail is stacked |
| Vault · Prehab | **5.45** | Worst athlete surface |
| Vault · Mindset | 4.07 | Banner stack + already-good decks |
| Command · Content Manager | 4.05 | Cards render fully expanded |
| Vault · Nutrition | 3.94 | Dead hole in 2-col grid |
| Command · Nutrition Locker | 3.60 | Same expanded-card pattern |
| Vault · Program | 3.31 | 1.5 screens of preamble before set 1 |
| Vault · Smart Cardio | 2.77 | Single-column chain |
| Vault · Check-In | 2.41 | Unbalanced 2-col form |
| Vault · Hub | 2.05 | Header stack is the tax |
| Sports Hub | **1.00** | ✅ The internal gold standard |

Two structural defects surfaced by the occupancy scan:

- **Command Center**: used content width ≈ **2600px at a 1440px viewport** — the 17-tab
  strip runs off-canvas with 10 tabs invisible and no scroll affordance.
- **Vault (mobile)**: used content width ≈ 786px at a 390px viewport — the `cv-tabs`
  rail scrolls (intended), but the top bar wraps to 3 rows and the header stack pushes
  the athlete's protocol 2+ screens down.

**The Sports Hub proves the pattern:** compact identity band → pill tab rail → one
panel, everything above the fold. The prescriptions below propagate that DNA to the
Vault and Command Center.

---

# PART 1 — GLOBAL SYSTEMS (fix once, win everywhere)

## S-01 · The Sovereign Vault header stack

**The Target:** `VaultHeader.jsx` — the three stacked cards (`cv-portal`,
`cv-identity`, `cv-blueprint`) above the tab rail; `vault.css:738`.

**The Observation:** ~640px of header renders before the tab nav on **every one of the
10 Vault tabs**. Cards 1 and 2 carry redundant framing: the pill "Sovereign Vault Admin
Portal" appears in *both*, and two competing italic display headlines ("MY CLIENT
PROFILE HUB" + "WELCOME, AKEEM BROWN") fight for hero status. On Prehab this header tax
turns a long page into a 5.45-screen page.

**The Upgrade:** Merge Portal + Identity into ONE command strip — avatar + welcome
headline on the left, a single 6-cell readout rail (Sessions · Hydration · Calories ·
Protein · Carbs · Fats) on the right. The Portal's descriptive sub-line moves under the
welcome as the strip's subtitle; the pill renders once. ACTIVE DIRECTIVE stays as row 2
untouched (it is the action card — it earns its height). Net: 3 cards → 2, ~220px
recovered on every tab, one hero instead of two.

**The Code:**

```jsx
// VaultHeader.jsx — replace the two sections with one merged strip.
// Every data point survives: pill, title copy (as subtitle), sessions, hydration,
// avatar, name, access tier, slug, phase, all four macros.
<section className="cv-head" aria-label={t('vh-head-aria')}>
  <div className="cv-identity cv-identity--merged">
    <div className="cv-identity-l">
      <div className="cv-avatar">{/* unchanged */}</div>
      <div className="cv-identity-meta">
        <span className="cv-pill">◇ {accessLabel}</span>
        <h1 className="cv-identity-name">{t('vh-welcome').toUpperCase()} {displayName.toUpperCase()}</h1>
        <p className="cv-portal-sub">{t('vh-portal-sub')}</p>{/* Portal copy, repositioned */}
        <div className="cv-identity-focus">{/* @slug • PHASE — unchanged */}</div>
      </div>
    </div>
    <div className="cv-readout-rail">
      <div className="cv-readout">{/* Sessions */}</div>
      <div className="cv-readout">{/* Hydration */}</div>
      {macros.map((m) => <div key={m.key} className="cv-macro">{/* unchanged */}</div>)}
    </div>
  </div>
  {/* ── ACTIVE DIRECTIVE — unchanged ── */}
</section>
```

```css
/* vault.css */
.cv-identity--merged { align-items: center; }
.cv-readout-rail {
  display: grid;
  grid-template-columns: repeat(6, minmax(72px, 1fr));
  gap: .55rem;
  flex-shrink: 0;
}
@media (max-width: 900px) { .cv-readout-rail { grid-template-columns: repeat(3, 1fr); } }
```

## S-02 · Coach's Voice banners (`ContextualVoiceover.jsx`)

**The Target:** The "★ COACH'S VOICE · WHY THIS MATTERS" hero card rendered at the top
of Check-In, Program, Cardio, Nutrition, Prehab (and inside Recovery Prescription).

**The Observation:** Each instance costs ~200–230px: kicker + headline + sub-line +
CTA button + an **always-mounted native `<audio controls>` bar** — visible even at
0:00/0:00 before any playback. Across a Vault session the athlete scrolls past this
banner five times.

**The Upgrade:** Collapse to a single-row voice strip (~64px): play glyph, kicker +
title inline, sub-line as the second line. Mount the native audio bar **only after
first play**. The component already ships a `compact` prop and `WRAP_COMPACT` style —
finish the pattern and default all tab-level instances to it. Nothing is deleted; the
full card is simply the *expanded* state.

**The Code:**

```jsx
// ContextualVoiceover.jsx — audio bar mounts on demand:
const [engaged, setEngaged] = useState(false);
function toggle() {
  setEngaged(true);
  const el = audioRef.current; /* …existing logic… */
}
{engaged ? (
  <audio ref={audioRef} src={url} controls preload="auto" style={{ width: '100%', marginTop: '.7rem' }} />
) : (
  /* keep the element for the ref but hidden until first engagement */
  <audio ref={audioRef} src={url} preload="none" style={{ display: 'none' }} />
)}
```

```js
// Compact-by-default row layout for tab surfaces:
const WRAP_COMPACT = {
  padding: '.65rem .9rem', margin: '0 0 .85rem',
  display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '.8rem',
};
```

Estimated recovery: **~150px × 5 tabs**.

## S-03 · Sticky tab rail (context while deep-scrolling)

**The Target:** `ClientVault.jsx` `nav.cv-tabs`; `vault.css:690`.

**The Observation:** `cv-topbar` is already sticky (`vault.css:617`) — but the tab rail
scrolls away. Three screens deep in Prehab, the athlete has no orientation and no
one-tap escape to another surface.

**The Upgrade:** Stick the tab rail directly beneath the top bar, on the same frosted
surface. Premium apps keep navigation persistent; this alone cures most of the
*perceived* scroll fatigue on long tabs.

**The Code:**

```css
/* vault.css — .cv-tabs additions */
.cv-tabs {
  position: sticky;
  top: calc(56px + var(--st, 0px)); /* measured cv-topbar height + safe-area */
  z-index: 15;
  background: linear-gradient(180deg, rgba(10, 6, 18, .96), rgba(9, 9, 9, .88));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
```

## S-04 · Overflowing tab rails need an affordance

**The Target:** `vault.css` `.cv-tabs` and `CommandCenter.jsx` `styles.tabs`.

**The Observation:** Both rails clip mid-word ("NUTRIT…", "GENERATOR…") with scrollbars
hidden — nothing signals that more surfaces exist to the right. In the Command Center,
**10 of 17 tabs are invisible** at 1440px.

**The Upgrade:** Add a right-edge fade mask (the universal "more content" cue) +
scroll-snap so tabs land cleanly. The Command Center needs the bigger fix in C-01.

**The Code:**

```css
.cv-tabs {
  scroll-snap-type: x proximity;
  mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 48px), transparent);
  -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 48px), transparent);
}
.cv-tab { scroll-snap-align: start; }
```

## S-05 · Mobile top bar wraps to three rows

**The Target:** `vault.css` `.cv-topbar` (`flex-wrap: wrap`) + `.cv-command` /
`.cv-signout` in `ClientVault.jsx`.

**The Observation:** At 390px the brand block, language toggle, COMMAND CENTER and SIGN
OUT buttons wrap into ~150px of chrome — the first mobile screen is almost entirely
navigation.

**The Upgrade:** On ≤640px, compress the two session buttons to icon chips (⌘ / ⎋
glyphs with `aria-label`s) so the bar stays one row. Same actions, same reachability.

**The Code:**

```css
@media (max-width: 640px) {
  .cv-topbar { flex-wrap: nowrap; }
  .cv-kicker { display: none; }             /* brand stays, kicker yields the row */
  .cv-command, .cv-signout { padding: .5rem .6rem; font-size: .62rem; letter-spacing: 1px; }
}
```

---

# PART 2 — SOVEREIGN VAULT, TAB BY TAB

## V-01 · Hub — "Breaking the Loop" + Weekly Brief

**The Target:** `SovereignSequence.jsx` panel + `WeeklyBriefCard.jsx` on the Hub tab.

**The Observation:** The Sovereign Sequence panel stacks its 4 homework steps
vertically inside a ~420px card, followed by a full-width step CTA, followed by a
~150px solid-gold Weekly Brief band that currently carries one sentence. Today's
Protocol (the 3-column grid above) is already correct — the Prehab Queue card just
rides taller than its content.

**The Upgrade:**
1. Lay the 4 steps out as a horizontal rail — 4 numbered columns, CTA inline at the
   right end. ~420px → ~180px.
2. Weekly Brief becomes a slim gold strip (icon + status line + chevron) that expands
   when a brief exists — the gold keeps its punch *because* it stops being wallpaper.

**The Code:**

```css
/* sovereign-sequence steps: vertical list → 4-up rail */
.sq-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: .8rem;
}
@media (max-width: 860px) { .sq-steps { grid-template-columns: repeat(2, 1fr); } }
```

```jsx
// WeeklyBriefCard.jsx — empty/pending state renders the strip, not the band:
<button type="button" className="wb-strip" onClick={() => setOpen(o => !o)} aria-expanded={open}>
  <span className="wb-ic">🎙</span>
  <span className="wb-line">{t('wb-title')} — {status}</span>
  <span className="wb-chev" aria-hidden="true">{open ? '▴' : '▾'}</span>
</button>
{open ? <div className="wb-body">{/* existing full card content */}</div> : null}
```

## V-02 · Prehab — the 5.45-screen wall (highest-impact fix in the app)

**The Target:** `Prehab.jsx:830` — the `exercises.map` rendering 10 stacked `.pde-ex`
articles; `prehab.css:377`.

**The Observation:** Ten near-identical cards (index, name, chips, description, cues,
video slot) each ~430px tall render fully expanded. The athlete performs these
*sequentially* — movement 7 doesn't need its cues on screen while movement 1 is being
performed. The video slot column also reserves height for unloaded placeholders.

**The Upgrade:** Convert to a **protocol accordion** — the same interaction the Program
tab already uses for its exercise list (Dumbbell Chest Press expanded, the rest
collapsed), so the Vault gains consistency, not a new pattern. Collapsed row = index +
name + chips + MARK DONE (~72px). Marking a movement done auto-collapses it and opens
the next — the accordion becomes a coaching rail. 10 × 430px → ~72px × 9 + 1 open card
≈ **2,600px recovered (~3 screens)**. Every cue, description, and video stays —
revealed at the moment of use.

**The Code:**

```jsx
// Prehab.jsx — accordion state beside the existing `done` set:
const [openKey, setOpenKey] = useState(exercises[0]?.key ?? null);
const toggleDone = (ex, i) => {
  toggle(ex.key);
  if (!done.has(ex.key)) setOpenKey(exercises[i + 1]?.key ?? null); // advance the rail
};

{exercises.map((ex, i) => {
  const isDone = done.has(ex.key);
  const isOpen = ex.key === openKey;
  return (
    <article key={ex.key} className={`pde-ex${isDone ? ' is-done' : ''}${isOpen ? ' is-open' : ''}`}>
      <button type="button" className="pde-ex-row" aria-expanded={isOpen}
              onClick={() => setOpenKey(isOpen ? null : ex.key)}>
        <span className="pde-ex-idx">{i + 1}</span>
        <span className="pde-ex-name">{ex.name}</span>
        <span className="pde-chips">{/* existing chips */}</span>
        <span className="pde-chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
      </button>
      {isOpen ? (
        <div className="pde-ex-body">
          <div className="pde-ex-main">{/* desc + cues — unchanged */}</div>
          <VideoSlot ex={ex} s={s} />   {/* video mounts only when open — perf win */}
        </div>
      ) : null}
    </article>
  );
})}
```

```css
/* prehab.css */
.pde-ex { display: block; padding: 0; }             /* grid moves into the body */
.pde-ex-row {
  display: grid; grid-template-columns: auto 1fr auto auto;
  align-items: center; gap: .8rem; width: 100%;
  padding: .85rem 1.15rem; background: none; border: none; cursor: pointer; text-align: left;
}
.pde-ex-body {
  display: grid; grid-template-columns: 1.5fr 1fr;   /* the original card layout */
  gap: 1.1rem; padding: 0 1.15rem 1.1rem;
}
.pde-ex.is-open { border-color: rgba(245, 200, 0, .4); }  /* gold ignition on the active movement */
@media (max-width: 760px) { .pde-ex-body { grid-template-columns: 1fr; } }
```

## V-03 · Nutrition — the dead hole beside Today's Fuel

**The Target:** `Nutrition.jsx:1458` `.nl-fastfuel`; `nutrition.css:608`.

**The Observation:** `.nl-fastfuel` is a `1fr 1fr` grid with `align-items: start`. The
Fasting Pace card is ~280px; the Today's Fuel wheel card is ~700px — leaving a **~400px
void** under Fasting Pace, immediately followed by two full-width single-line bands
(Daily Fueling Status, Periodized Fuel Timing) that stack *below* the grid. The scan
flags this as the largest dead zone in the athlete app.

**The Upgrade:** Make the left cell a column and move Daily Fueling Status + Periodized
Fuel Timing **into it**, under Fasting Pace. The hole fills with content that already
exists, and two full-width bands leave the vertical flow. ~350px recovered and the
composition balances.

**The Code:**

```jsx
// Nutrition.jsx — restructure the grid children:
<div className="nl-fastfuel">
  <div className="nl-fastfuel-left">
    <FastingPace /* existing card */ />
    <FuelingStatus /* the "DAILY FUELING STATUS" bars — moved, unchanged */ />
    <PeriodizedTiming /* the "PERIODIZED FUEL TIMING" note — moved, unchanged */ />
  </div>
  <TodaysFuel /* wheel card — unchanged */ />
</div>
```

```css
/* nutrition.css */
.nl-fastfuel-left { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
```

**Bonus (meal list):** the five meal cards are correct as a list (they log
sequentially), but tighten their vertical rhythm — reduce card padding to
`.85rem 1rem` and let PREP INSTRUCTIONS keep its existing collapsed accordion. Keep
COMPLETE & SYNC PROTOCOL as-is; it's the tab's terminal action and earns its weight.

## V-04 · Program — 1.5 screens of preamble before the first set

**The Target:** The Program tab's pre-exercise chain: RPE explainer row → Coach's Voice
card → Weekly Analytics row → day selector → Day-1 banner → ENTER FLOOR MODE.

**The Observation:** Six stacked full-width elements (~1,350px) separate the tab click
from Dumbbell Chest Press. Separately, the expanded exercise card wastes its right
half: the FORM DEMO thumbnail (~185px wide) sits alone on a full-width row with ~900px
of void beside it.

**The Upgrade:**
1. S-02 already shrinks the Coach's Voice card. Pair the survivors: put **WHAT IS
   RPE?** (already an accordion strip) and **VIEW WEEKLY ANALYTICS** on one shared row —
   two half-width strips.
2. Merge the day *selector* row and the Day-1 *banner* — the banner repeats the
   selector's exact text. Render the banner styling on the selector row itself
   (dropdown left, "6 exercises" + TODAY chip right).
3. Inside the expanded exercise card, seat FORM DEMO to the right of the coach-cue +
   history block in a two-column row so the demo's height is absorbed by content beside
   it.

**The Code:**

```css
/* program strips share a row */
.pv-utility-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: .8rem;
}
@media (max-width: 760px) { .pv-utility-row { grid-template-columns: 1fr; } }

/* expanded exercise card: media sits beside meta, not below it */
.pv-ex-media-row {
  display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: start;
}
.pv-ex-media-row .form-demo { width: 220px; }
```

## V-05 · Smart Cardio — the idle audio shelf

**The Target:** The SOVEREIGN AUDIO LINK panel + the HIIT/TEMPO/ZONE 2 footer cards.

**The Observation:** The audio link renders a ~260px empty inset panel before any
soundtrack is cued — pure reserved void between the protocol builder and its COMPLETE &
SYNC action. The three protocol-mode reference cards (HIIT / TEMPO / ZONE 2) sit below
the terminal CTA where they're read *after* every decision they inform.

**The Upgrade:** Collapse the audio link to a slim strip (icon + "Cue the soundtrack"
+ chevron) that expands on engagement — identical pattern to V-01's Weekly Brief strip.
Move the three mode cards **up**, as a 3-chip explainer row directly under the PACING
STRATEGY TARGET select — they annotate that exact choice. The page tightens from 2.77
to ~2 screens and the decision flow reads top-down: tune → understand → reconstruct →
sync.

**The Code:**

```css
.sc-modes {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: .7rem; margin-top: .7rem;
}
.sc-modes .sc-mode-card { padding: .6rem .8rem; }   /* chip density, full copy retained */
```

## V-06 · Check-In — unbalanced manual baseline form

**The Target:** The Manual Health Input two-column field grid.

**The Observation:** The left column (Sleep Duration, Steps, CNS Stress slider, SAVE
BASELINE) runs ~5 rows; the right column (Active Burn, Sleep Quality) runs 2 —
top-right and bottom-right are void. SAVE BASELINE renders half-width and
left-anchored, reading as a secondary action when it's the tab's primary commit.

**The Upgrade:** Order the fields as a strict 2×2 grid (Sleep Duration · Active Burn /
Steps · Sleep Quality), give each slider a column, and promote SAVE BASELINE to a
full-width gold-bordered commit bar under the grid (the same terminal-action grammar as
COMPLETE & SYNC on Nutrition/Cardio — one consistent "commit" idiom across the Vault).

**The Code:**

```css
.ci-baseline-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: .9rem 1.4rem; align-items: end;
}
.ci-baseline-save { grid-column: 1 / -1; width: 100%; }
```

## V-07 · Mindset — three heroes before the films

**The Target:** The Champion's Mindset intro card, TODAY'S AFFIRMATION card, and the
DAILY VAULT AFFIRMATION banner (~620px combined).

**The Observation:** Three full-width purple statement blocks stack before the first
actual content deck. The two affirmation units carry sibling content (spoken
affirmation / written affirmation) yet each takes a full row. The film decks below are
already model citizens (§10 tab decks).

**The Upgrade:** Keep the intro card as the tab's single hero. Pair the two
affirmations side-by-side in one 2-column band beneath it — audio affirmation left,
daily written affirmation right. ~620px → ~380px with zero copy loss.

**The Code:**

```css
.cm-affirm-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: stretch;
}
@media (max-width: 860px) { .cm-affirm-row { grid-template-columns: 1fr; } }
```

---

# PART 3 — COMMAND CENTER

## C-01 · The 17-tab strip (10 tabs are invisible)

**The Target:** `CommandCenter.jsx:187` `styles.tabs` + the `MasterLayout` sidebar.

**The Observation:** The horizontal strip holds 17 tabs; at 1440px only 7 fit. With
scrollbars suppressed and no fade cue, the strip *looks complete* — Studio, Batch,
Coach Lab, Coach's Cave, Content Manager et al. are effectively hidden features. The
sidebar meanwhile lists only 10 surfaces, so neither nav is authoritative — a duplicate,
desynced navigation system.

**The Upgrade:** Two moves, no removals:
1. **Group the strip** into the executive domains that already exist implicitly —
   `COACHING` (roster · telemetry · eagle-eye · comlink · nutrition-locker · sports),
   `CONTENT` (content · content-manager · studio · studio-v4 · studio-batch),
   `KNOWLEDGE` (coach-lab · coach-cave · language · language-lab),
   `SYSTEM` (generator · settings) — rendered as a two-tier rail: domain pills on top,
   the active domain's tabs beneath. Both tiers always fit at 1440px; deep links
   (`/command/:tab`) keep working since the tab id resolves its domain.
2. **Complete the sidebar** so all 17 surfaces appear there, grouped under the same
   four domain headings — one authoritative nav, the strip becomes the in-page
   switcher.

**The Code:**

```jsx
// CommandCenter.jsx
const DOMAINS = [
  { id: 'coaching',  labelKey: 'cmd-dom-coaching',  tabs: ['roster','telemetry','eagle-eye','comlink','nutrition-locker','sports'] },
  { id: 'content',   labelKey: 'cmd-dom-content',   tabs: ['content','content-manager','studio','studio-v4','studio-batch'] },
  { id: 'knowledge', labelKey: 'cmd-dom-knowledge', tabs: ['coach-lab','coach-cave','language','language-lab'] },
  { id: 'system',    labelKey: 'cmd-dom-system',    tabs: ['generator','settings'] },
];
const activeDomain = DOMAINS.find(d => d.tabs.includes(activeTab)) ?? DOMAINS[0];

<nav role="tablist" aria-label="Command domains" style={styles.domainRail}>
  {DOMAINS.map(d => (
    <button key={d.id} role="tab" aria-selected={d.id === activeDomain.id}
            style={{ ...styles.domainPill, ...(d.id === activeDomain.id ? styles.domainPillActive : null) }}
            onClick={() => selectTab(d.tabs[0])}>
      {t(d.labelKey)}
    </button>
  ))}
</nav>
<nav style={styles.tabs} role="tablist" aria-label="Command Center surfaces">
  {TABS.filter(item => activeDomain.tabs.includes(item.id)).map(/* existing button render */)}
</nav>
```

```js
domainRail: { display: 'flex', gap: '.5rem', marginBottom: '.7rem', flexWrap: 'wrap' },
domainPill: {
  fontFamily: 'var(--hb)', fontSize: '.68rem', letterSpacing: '2px', textTransform: 'uppercase',
  color: 'rgba(249,245,255,.55)', background: 'rgba(106,13,173,.14)',
  border: '1px solid var(--line)', borderRadius: 999, padding: '.45rem .95rem', cursor: 'pointer',
},
domainPillActive: { color: '#090909', background: 'var(--yel)', borderColor: 'var(--yel)' },
```

## C-02 · Digital Content Manager (4.05 screens) & Nutrition Locker (3.6)

**The Target:** `DigitalContentManager.jsx` draft cards; the same expanded-detail
pattern in `NutritionLocker.jsx`.

**The Observation:** The 3-column card grid is right — but every card renders its FULL
CAPTION + HASHTAGS + STUDIO RECIPE + CUT SHEET + VOICEOVER SCRIPT fully expanded,
making each card ~450–600px. The operator's approve/schedule decision needs the hook,
the mode chips, and the schedule row; the rest is verification detail.

**The Upgrade:** Inside each card, keep kicker + hook + target-angle + schedule +
actions always visible; collapse FULL CAPTION, CUT SHEET · VISUALS, and VOICEOVER
SCRIPT behind per-section disclosure rows (they already have labeled headers — make the
headers the toggles). Cards drop to ~240px; the review bucket becomes a scannable wall
instead of a scroll marathon. Same treatment in Nutrition Locker's generated-plan
sections.

**The Code:**

```jsx
// DigitalContentManager.jsx — reusable in-card disclosure:
function CardSection({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="dcm-sec">
      <button type="button" className="dcm-sec-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {label} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open ? <div className="dcm-sec-body">{children}</div> : null}
    </div>
  );
}
```

---

# PART 4 — PUBLIC FUNNEL

## P-01 · Marketing Landing (6.66 desktop / 11.54 mobile screens)

**The Target:** `MarketingLanding.jsx` — the post-deck tail: LOCAL WEEKLY ONGOING
TRAINING block, the Knowledge deck's Science Hub panel, TAKE THE VAULT WITH YOU, and
DIRECT WEB APP INSTALL.

**The Observation:** The Brand Engine deck and Knowledge deck honor §10. The tail does
not: "Take the Vault With You" (Google Play) and "Direct Web App Install"
(iPhone/Android columns) are two stacked full sections describing the *same intent* —
get the app. The Science Hub panel renders its full reader inline (~1,500px of the
landing's height). Mobile pays double: 11.5 screens.

**The Upgrade (all §10-conformant — deck consolidation, not deletion):**
1. Fold the two install sections into one **"Get The App" tab-deck** (`01 GOOGLE PLAY ·
   02 INSTALL FROM BROWSER`), reusing the exact `s.tab`/`s.tabActive`/`s.tabIdx` style
   set the Brand Engine deck established. Saves ~1.2 screens on desktop, more on
   mobile.
2. Cap the Science Hub panel's inline height on the landing:
   `maxHeight: 'min(72vh, 760px)', overflowY: 'auto'` on the reader column — it's a
   browse surface; let it scroll *inside* its frame instead of inflating the page.
3. The LOCAL WEEKLY ONGOING TRAINING block and Financial Integrity quote currently
   stack inside the deck panel — set them side-by-side ≥1024px
   (`display: grid; grid-template-columns: 1.2fr 1fr`).

**The Code:**

```jsx
// MarketingLanding.jsx — Get The App deck (same grammar as the Knowledge deck):
const [appTab, setAppTab] = useState('play');
<section id="get-app" style={s.deckSection}>
  <div role="tablist" aria-label="Get the app" style={s.tabBar}>
    {[['play', '01', t('app-tab-play')], ['pwa', '02', t('app-tab-pwa')]].map(([id, idx, label]) => (
      <button key={id} role="tab" aria-selected={appTab === id}
              style={appTab === id ? { ...s.tab, ...s.tabActive } : s.tab}
              onClick={() => setAppTab(id)}>
        <span style={appTab === id ? s.tabIdxActive : s.tabIdx}>{idx}</span>
        <span style={s.tabLabel}>{label}</span>
      </button>
    ))}
  </div>
  {appTab === 'play' ? /* existing TAKE THE VAULT WITH YOU content */ : /* existing DIRECT WEB APP INSTALL content */}
</section>
```

## P-02 · Sports Hub — no findings

**The Target:** `/sports-hub`.

**The Observation:** Identity band + pill rail + gameplan card + next-step CTA, all in
1.0 screens, brand-perfect. This is the reference spatial grammar for S-01/S-03.

**The Upgrade:** None. Protect it.

---

# PART 5 — STRATEGIC ENHANCEMENTS (the premium layer, zero lag)

All CSS-only; no new dependencies, no layout thrash (transform/opacity/border-color
transitions only).

1. **Card ignition on hover** — one rule covers every `--panel` surface:
   ```css
   .cv-portal, .cv-identity, .cv-blueprint, .pde-ex, .pg-card {
     transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
   }
   .cv-blueprint:hover, .pde-ex:hover, .pg-card:hover {
     transform: translateY(-2px);
     border-color: rgba(245, 200, 0, .35);
     box-shadow: 0 10px 28px -18px rgba(106, 13, 173, .8);
   }
   @media (prefers-reduced-motion: reduce) { .pde-ex:hover, .pg-card:hover { transform: none; } }
   ```
2. **One terminal-action grammar** — SAVE BASELINE, COMPLETE & SYNC PROTOCOL, COMPLETE
   & SYNC DAY, RECONSTRUCT PROTOCOL: standardize on the full-width gold commit bar
   (V-06). The athlete learns one shape for "commit this tab."
3. **Anchor headroom under sticky rails** — with S-03 live:
   `.cv-container section[id] { scroll-margin-top: 118px; }`
4. **Typographic ladder** — after S-01 each surface has exactly one italic display hero
   (`--display`), section heads in Bebas (`--hb`) at `.72rem/3px` tracking, body in
   Barlow Condensed. The current double-hero (Portal + Welcome) is the only violation;
   S-01 resolves it.
5. **Focus parity** — `.cv-command:focus-visible` has the gold ring; extend the same
   two rules to `.cv-tab`, `.pde-ex-row`, and the Command Center tab buttons for
   keyboard-premium feel.

---

# EXECUTION ORDER (impact ÷ effort)

| # | Item | Recovery | Effort |
|---|---|---|---|
| 1 | V-02 Prehab accordion | ~3 screens on the worst tab | M |
| 2 | S-01 Vault header merge | ~220px × 10 tabs | M |
| 3 | S-02 Coach's Voice compact | ~150px × 5 tabs | S |
| 4 | C-01 Command domain rail | 10 hidden tabs surfaced | M |
| 5 | V-03 Nutrition dead hole | ~350px + balance | S |
| 6 | S-03/S-04 sticky rail + fade | perceived-scroll cure | S |
| 7 | P-01 Get-The-App deck + Science Hub cap | ~1.5 screens public | M |
| 8 | V-04/V-05/V-06/V-07 tab tighteners | ~0.5–1 screen each | S each |
| 9 | C-02 Content Manager card disclosures | ~2 screens admin | S |
| 10 | S-05 mobile top bar + Part 5 polish | mobile first-screen | S |

Ship each with the §6 discipline: `npm run lint && npm run build` green, `sw.js` cache
bump for any legacy-PWA-served file, one bounded commit per item.
