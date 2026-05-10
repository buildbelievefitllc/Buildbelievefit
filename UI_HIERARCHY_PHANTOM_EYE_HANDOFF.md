# WAR ROOM DIRECTIVE — UI Hierarchy & Phantom Eye Relocation

**Status:** Blueprint for next conversation. This thread is compacted; the new brain picks up from this doc.
**Branch:** `claude/build-believe-fit-dev-dcQw6` (already checked out; clean working tree)
**File in play:** `bbf-app.html` (single-file HTML/CSS/JS, ~10k lines)
**Sibling work parked:** Video pipeline (`VIDEO_PIPELINE_HANDOFF.md`) — do not touch.

---

## The directive (verbatim)

We are reorganizing the client view in `bbf-app.html` to clean up the dashboard and place tools where they logically belong. Strict phases. **Do not touch Phase 2 until Phase 1 is locked and audited.**

### PHASE 1 (execute)

1. **Global Client Header (hierarchy shift)**
   - Extract the client name / welcome block ("Welcome Back, [Name]") from its current nested position.
   - Pin it to the absolute top of the client dashboard container so it is the very first piece of data the user sees — setting the hierarchy before the stat blocks (Total Sessions, This Week, etc.).

2. **Relocate "BBF Phantom Eye" (heavy lift)**
   - **Remove** the Phantom Eye Viewport (real-time form audit + nutrition vision) from the main client dashboard.
   - **Relocate** the entire Phantom Eye module into the "Program" section.
   - **Target zone:** embed it into the blank space area currently occupied by the **Clinical Protocol: Laboratory Reference** block.

**Technical constraint (Big Jim's audit):** moving Phantom Eye must NOT break:
- camera initialization logic (`getUserMedia`, `MediaStream`)
- video streaming elements
- CSS layout
- camera permission prompt flow

### PHASE 2 (awareness only — DO NOT touch yet)

After Phase 1 is locked, we'll inject "more life and dynamic styling" into the Nutrition side (currently too bland). **Keep CSS variables clean** for that pass.

---

## Codebase map — file:line refs

### Phase 1 Move 1: Welcome block

| Element | File:Line | Notes |
|---|---|---|
| Welcome block (`.hero`) | `bbf-app.html:5074-5083` | Contains "Welcome back" text + `#hname` |
| Name id | `bbf-app.html:5075` | `<div class="hn" id="hname">` |
| JS populates name | `bbf-app.html:7271` | `document.getElementById('hname').textContent = ...` |
| Stat block container (`.sg`) | `bbf-app.html:5085-5090` | 4 cards: `#qtot`, `#qwk`, `#qwt`, `#qfoc` |
| Dashboard container | `bbf-app.html:4859` | `<div class="tp on" id="tp-home">` |

**Current order inside `#tp-home`** (top → bottom):
1. `#trswitch` (client switcher, hidden default)
2. `#cns-heatmap` (CNS heatmap, hidden default)
3. Various heatmap / readiness blocks
4. `#phantom-eye` widget
5. `#pe-init-voice-btn` (Virtual Coach button — see ambiguity #2)
6. `#player-card` (hidden default)
7. **`.hero` (welcome) ← currently here, 7th-ish**
8. **`.sg` (stat blocks) ← currently here, right after welcome**
9. `#levelup-wrap`, Gold Seeker search, etc.

So `.hero` IS already before `.sg`, but it's buried ~6-7 elements deep inside `#tp-home`. The directive wants `.hero` to be the **first** child of `#tp-home` (or its first **visible** child — see ambiguity #1).

### Phase 1 Move 2: Phantom Eye

| Element | File:Line | Notes |
|---|---|---|
| Phantom Eye widget | `bbf-app.html:5021-5049` | `<div id="phantom-eye" class="pe-widget">` |
| Init button (vision) | `bbf-app.html:5042` | `onclick="initLiveCoach('vision')"` |
| Virtual Coach button | `bbf-app.html:5055-5059` | `#pe-init-voice-btn` — **separate** from Phantom Eye widget |
| CSS rules | `bbf-app.html:1425-1596` | `.pe-widget`, `.pe-frame`, `.pe-hero`, `.pe-init-btn` |
| `initLiveCoach()` | `bbf-app.html:9061-9118` | Contains `navigator.mediaDevices.getUserMedia` at L9118 |
| `videoEl.srcObject = stream` | `bbf-app.html:9130` | Streams into modal, NOT the widget itself |
| Modal target | `#stream-modal` (search file) | Modal is independent of widget DOM position |

### Relocation target — "Clinical Protocol: Laboratory Reference"

**⚠ Exact phrase doesn't exist in the codebase.** Closest matches in the Program section (`#tp-workout` at L5141):

| Candidate | File:Line | Why it might be the target |
|---|---|---|
| `#ap-protocol` | `bbf-app.html:5899-5942` | Client-facing Clinical Protocol block in `tp-workout` (live-binds sport × position × phase) |
| `#pf-protocol` | `bbf-app.html:6233-6266` | "Clinical Protocol · Audit View" — admin Pathfinder view, **NOT** client Program |

**Best guess:** target is `#ap-protocol` (L5899) — the client-facing Clinical Protocol block. "Laboratory Reference" is likely a verbal label the user uses for it; the rendered title is "Clinical Protocol" with sport/position/phase metadata. **The user should confirm before the new brain commits.**

The directive says "**blank space area currently occupied by**" — could mean:
- (a) Replace the block entirely with Phantom Eye, OR
- (b) Embed Phantom Eye adjacent to / inside the same column gap, OR
- (c) Use the area visually empty when the block is in its "Awaiting Selection" empty state.

**Recommend asking the user before destructive replacement.**

---

## Ambiguities to resolve before coding

1. **"Absolute top of the dashboard container"** — does this mean:
   - First child of `#tp-home` (would force welcome above hidden elements like `#trswitch`, `#cns-heatmap`), OR
   - First **visible** child (skip the `display:none` elements)?

   Recommendation: pin `.hero` as first child of `#tp-home`. Hidden elements stay hidden — they only ever show in specific modes (admin viewing a client, CNS data available). When they DO show, having welcome at the very top is still correct.

2. **Does "Phantom Eye" include the Virtual Coach button (`#pe-init-voice-btn`)?**
   The Virtual Coach button at L5055-5059 is a SEPARATE sibling element that was split out from Phantom Eye in Phase 15 Slice 9 (per the HTML comments). Directive says "the entire Phantom Eye module" — strictly that's just `#phantom-eye` (L5021-5049). The Virtual Coach is a sibling, not a child.

   Recommendation: move ONLY `#phantom-eye`. Leave Virtual Coach (audio-only) on the home dashboard. Audio-only AI is a different UX use case (eyes-busy) than the vision Phantom Eye and may belong on the home view. **Confirm with user.**

3. **Clinical Protocol target** — confirm `#ap-protocol` (client) vs `#pf-protocol` (admin). See above.

4. **Replace vs adjacent embed** — see above.

---

## Phase 1 execution plan (once ambiguities resolved)

### Move 1: Welcome block to top

```html
<!-- Inside <div class="tp on" id="tp-home"> at L4859 -->
<!-- FIRST CHILD: -->
<div class="hero">  <!-- move from L5074-5083 to here -->
  <div class="hg" data-lang-key="app-welcome">Welcome back</div>
  <div class="hn" id="hname">&#8212;</div>
  <!-- ... rest of hero block unchanged ... -->
</div>
<!-- THEN existing first children continue: #trswitch, #cns-heatmap, etc. -->
```

**Risk:** none. The block has no positional dependencies — `#hname` is populated via `getElementById` (L7271) which is DOM-position-agnostic. CSS class `.hero` is also position-agnostic. Tests: load app, confirm name renders.

### Move 2: Phantom Eye to Program section

**Step A.** Cut `#phantom-eye` block (L5021-5049, 29 lines) from `#tp-home`.

**Step B.** Determine target inside `#tp-workout` (L5141). Paste the block at the resolved target zone (see ambiguity #3). If replacing `#ap-protocol`, comment out the existing block first (don't delete — Phase 2/3 may want it back) and paste Phantom Eye in the same vertical slot.

**Step C.** No JS changes needed. `initLiveCoach('vision')` only looks up `#stream-modal` and friends — not the widget container. Verify by:
- Click Phantom Eye button in new location
- Confirm camera permission prompt fires
- Confirm video preview renders inside the modal (NOT inside `#phantom-eye`)

**Step D.** CSS check. `.pe-widget`, `.pe-frame` etc. are class-based (L1425-1596). They don't reference `#tp-home` or `#tp-workout` in any selector. But verify visual rendering — the widget may have been sized assuming the dashboard's narrower column or different surrounding spacing. Side-by-side with `#ap-protocol` in the Program section, the widget may need a `margin-top` or width tweak.

**Risk:** medium. Class-based styling should port cleanly. Watch for:
- `#phantom-eye` parent selectors anywhere in CSS (grep before/after move)
- The Phantom Eye widget's scroll-into-view behavior (if any) — would fail silently if widget is on a non-active tab
- `data-lang-key` translation lookups — should still resolve regardless of location

### Verification checklist (Phase 3 self-audit)

- [ ] `.hero` is the first child of `#tp-home`
- [ ] Welcome name renders ("Welcome Back, [Name]") on dashboard load
- [ ] `.sg` stat blocks appear immediately below welcome
- [ ] `#phantom-eye` no longer in `#tp-home`
- [ ] `#phantom-eye` present in `#tp-workout` (Program tab)
- [ ] Phantom Eye button → camera permission prompt fires
- [ ] Camera stream renders correctly in modal
- [ ] No console errors on tab switch or button click
- [ ] CSS layout: Phantom Eye doesn't visually break in its new container
- [ ] Visual regression check on both `#tp-home` and `#tp-workout`
- [ ] Hard refresh + service worker bump (bump `CACHE` version in `sw.js` line 9)

---

## Phase 2 awareness (DO NOT execute yet)

After Phase 1 lockdown, Nutrition needs styling injection. **Don't touch yet**, but when planning Phase 1 patches:

- Keep CSS variables clean (`--purp`, `--yel`, etc.) — don't introduce ad-hoc colors
- If new BBF Phantom Eye styling lands in the Program section, reuse existing `--purp` / `--yel` so Phase 2 nutrition restyle has a consistent base
- Don't add `!important` rules — leave the cascade clean for Phase 2 overrides

---

## What NOT to do

- **Do NOT** delete `#ap-protocol` (Clinical Protocol block) outright. Comment out if replacement is confirmed; preserve in case the user wants it back.
- **Do NOT** rewrite `initLiveCoach()` JS unless the move actually breaks it. The function is DOM-position-agnostic.
- **Do NOT** touch `#pf-protocol` (admin audit view) — different tab.
- **Do NOT** assume "Phantom Eye" includes Virtual Coach button — confirm first.
- **Do NOT** start Phase 2 styling work until Phase 1 audit is locked.
- **Do NOT** bump the service worker cache version until the HTML changes are committed (otherwise users get stale assets for two reloads).

---

## Resume protocol for the new brain

1. **Read this doc first.**
2. **Read** `bbf-app.html:4859-5095` to see the current `#tp-home` structure.
3. **Read** `bbf-app.html:5141-5942` to see `#tp-workout` and the Clinical Protocol block.
4. **Ask the user** to resolve the 4 ambiguities above before writing any patches.
5. **Make the edits** with `Edit` tool (single-file edits, not Write — preserve everything else).
6. **Test in browser** (or report that you cannot, and ask the user to load + verify).
7. **Commit + push** to `claude/build-believe-fit-dev-dcQw6` with message like:
   `feat(app): Phase 1 — hierarchy shift + Phantom Eye relocation`
8. **Bump** `sw.js` CACHE version after HTML changes are committed.

---

## Repo context

- **Working dir:** `/home/user/Buildbelievefit`
- **Branch:** `claude/build-believe-fit-dev-dcQw6` (10 commits ahead of main on video pipeline; behind main on storefront/brand commits — rebase optional)
- **Last commit on this branch:** `7d70235` (video pipeline handoff doc)
- **`bbf-app.html` last touched:** in main branch, not on this dev branch — current dev work is video-only
- **Sibling docs:** `VIDEO_PIPELINE_HANDOFF.md` (video work — do not touch), `README_VIDEO_PIPELINE.md`, `CLAUDE_CODE_VIDEO_ENHANCEMENT_PROMPT_v2.md`
