# Video Pipeline Handoff — v3 → v4

**Last update:** v3 shipped (commit `930611a` on `claude/build-believe-fit-dev-dcQw6`).
**Pivoting to:** app feature relocation work. Resume video work from this doc.

---

## Current state — what's in the can

**Output:** `bbf_demo_enhanced_v1.mp4` (1080×1920, 30fps, H.264, AAC 192k, **85.98s**, in 82–88s target).

| Element | Status | Source |
|---|---|---|
| Cold open card | 0.8s with 0.2s fades — snap-fast | v2 |
| 7 lower-third callouts (per beat) | Working, BBF Purple/Gold | v2 |
| CPT credential mask | Single phase, final 8.10–9.60, y=540 | v3 (re-tuned) |
| 1.15× body+audio speedup | setpts on body, atempo on master audio | v2 |
| 7 Ken Burns zooms | crop+scale (NOT zoompan), max 1.12× | **v3** |
| 6 section cross-fades | per-segment fade in/out, fade-through-black | **v3** |
| Closing card fade-in | 0.25s at start of EN1 flash | **v3** |
| Trilingual closing flash | EN → ES → PT → EN, all 4 play | v2 |
| Audio tail silence pad | Sized so closing card fits within audio | v2 |

---

## Known caveats (v4 candidates)

1. **CPT mask "CPT" leak.** The mask is 320px wide; "CERTIFIED CPT" text is slightly wider, so the rightmost ~15px of "CPT" peeks past the mask edge in some frames. Widening to 340–360px should clear it without bleeding into the "100% / CUSTOM PLANS" right column. Test point: `build/qa_frames/v3o_t8.5_zoom.png`.

2. **Mask is single-phase only.** v3 dropped the v2 two-phase animated mask because the zoom+fade chain shifted strip pixel positions and re-deriving the y trajectory empirically was eating runway. The strip moves over the visible window (final 8.1–9.6). A two-phase or animated y would be tighter — see "Strip motion data" below.

3. **66MB MP4 over GitHub's 50MB recommendation.** Git LFS migration would be cleaner long-term. Push still succeeds.

4. **Founder-zoom timing slightly off-beat.** Beat-2 zoom (founder reveal) fires at final t≈11.6 per current `ZOOMS[1]` config (`z_start=4.5`); user's brief said founder reveal should zoom around final 9–11. To shift earlier, change `ZOOMS[1]["z_start"]` from 4.5 to ~2.7.

---

## How to resume

```sh
cd /home/user/Buildbelievefit
git checkout claude/build-believe-fit-dev-dcQw6
python3 enhance_demo.py    # idempotent; ~30-60s on this sandbox
```

Output appears at `bbf_demo_enhanced_v1.mp4`. Stage outputs in `build/intermediate/`.

For QA: extract a frame at any time `T` with
```sh
ffmpeg -y -i bbf_demo_enhanced_v1.mp4 -ss T -frames:v 1 /tmp/qa.png
```

Use `-ss BEFORE -i` for fast (keyframe-snapped) seek, `-ss AFTER -i` for accurate seek — accurate is what you usually want for verification.

---

## Architecture cheat sheet

`enhance_demo.py` pipeline stages (in order):

1. Generate overlay PNGs (CPT mask, 7 callouts, language pill, opening card)
2. Build sped body video — for each beat: ffmpeg `crop → setpts → optional zoom → optional fade → fps → format`, then concat
3. Build master audio — concat 7 VOs with 0.2s pads → atempo speedup → append tail silence
4. Render opening + closing card clips (closing has fade-in/out, 4 trilingual flashes)
5. Concat opening + body + closing → silent full video
6. Single ffmpeg `filter_complex`: layer overlays (CPT mask + 7 callouts + EN/ES/PT pill) + mux audio + encode final

**Key constants** (top of `enhance_demo.py`):
- `OPEN_CARD_DUR = 0.8`
- `BODY_SPEEDUP = 1.15`
- `CLOSE_CARD_DUR = 3.0`
- `GAP_BETWEEN_VO = 0.2`
- `FADE_HALF = 0.25` (half of section fade-through-black)

**Key data structures:**
- `BEATS` — beat → VO file + source seek window + callout text
- `ZOOMS` — beat index → zoom config dict (z_start, z_dur, z_max, x_pct, y_pct)
- `SECTION_FADES` — list of (out_beat_idx, in_beat_idx) tuples
- `BEATS_WITH_FADE_OUT` / `BEATS_WITH_FADE_IN` — derived sets

---

## Strip motion data (for v4 mask refinement)

Visually measured strip y-positions in v3 body.mp4 (post-speedup, post-zoom, post-fade):

| body_t | strip y (big text + subtitle) |
|---|---|
| 7.3–7.5 | 490–605 (lower stable) |
| 7.7 | 350–450 (mid-scroll) |
| 8.0 | 170–280 |
| 8.3 | 110–210 |
| 8.6 | 110–210 (upper stable) |
| 8.7+ | scrolled off top |

Strip x positions (approx, from `clean_t9.0.png` shield-row brightness scan):
- Left "2021" big text: x = 90–180
- Middle shield icon: x = 390–420
- Right "100%" big text: x = 660–780
- "CERTIFIED CPT" subtitle: ~ x = 360–520 (estimated, wider than shield)

Mask is centered at x=405 via `cpt_x = "(W-w)/2-135"` (offset −135 from frame center 540). For wider mask, increase `W` in `make_cpt_mask` (currently 320) but check both side columns stay clear.

---

## What v4 should consider (priority order)

1. **Widen CPT mask to ~340px** to absorb the "CPT" leak. Verify "100" and "CUSTOM" still readable.
2. **Two-phase or animated mask** if a single phase doesn't visually satisfy. Use the strip motion data above as starting points; sample frames at the boundary times.
3. **Adjust beat-2 zoom timing** so founder reveal zoom lands at final 9–11s (currently ~11.6).
4. **Git LFS migration** for the 66MB output if it stays in version control.
5. **README update** — `README_VIDEO_PIPELINE.md` documents v1 architecture; refresh to mention v3 zooms + fades + speedup.

---

## What NOT to do

- **Do NOT regenerate the voiceover MP3s.** They live in `voiceover/` and are pre-rendered ElevenLabs takes. Sandbox network can't reach ElevenLabs anyway.
- **Do NOT use `zoompan` filter.** It killed v1's render (~75× slower than crop+scale). Stick with the `_zoom_filter_str` helper.
- **Do NOT put `-t` after `-i` in body segment trim.** It defeats setpts compression by frame-duplicating to fill output. Always `-ss SRC_IN -t VO_DUR -i SRC -vf ...`.
- **Do NOT add fade-in to beat 1 or fade-out to beat 7-without-closing.** v3's fade scheme is balanced — adding more fades shortens body and breaks audio sync.
- **Do NOT touch the founder photo.** Mask y bottom must stay above the founder card top edge in every frame the photo is on screen.

---

## Branch state

- **Active branch:** `claude/build-believe-fit-dev-dcQw6`
- **Last commit:** `930611a` (v3)
- **Behind main by:** ~10 commits (mostly storefront / brand / handoff doc updates — not pipeline-related; rebase optional)
- **Voiceovers + source MP4:** committed on this branch as of `9f5a6f7`

When you come back, just check out the branch and run the script — no setup needed.
