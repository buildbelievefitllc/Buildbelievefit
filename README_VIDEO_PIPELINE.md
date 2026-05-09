# BBF Demo Video Enhancement Pipeline

Pipeline that transforms `bbf_source_v2_compressed.mp4` (1080x2340, 30fps,
~2 min mobile screen recording) into the polished cinematic demo
`bbf_demo_enhanced_v1.mp4` (1080x1920, 30fps, ~97s, H.264 + AAC).

Implements the brief in `CLAUDE_CODE_VIDEO_ENHANCEMENT_PROMPT_v2.md`:
CPT credential mask, branded opening + closing cards, animated trilingual
wordmark micro-flash, surgical lower-third callouts, EN·ES·PT pill, and
a master voiceover track stitched from 7 ElevenLabs MP3s.

## Output

| Spec | Value |
|---|---|
| File | `bbf_demo_enhanced_v1.mp4` |
| Resolution | 1080 × 1920 (vertical 9:16) |
| FPS | 30 |
| Video codec | H.264 (libx264, `crf 20`, `maxrate 8M`) |
| Audio codec | AAC 192 kbps stereo |
| Duration | 97.31 s |
| Mean / max audio | -26.8 dB / -4.8 dB |

## Architecture

Hybrid Pillow + ffmpeg. Pillow generates static overlay PNGs (CPT mask,
8 callouts, opening + closing cards, language pill); a single ffmpeg
`filter_complex` invocation does ALL video work — trim, crop, overlay,
mux, encode. This is roughly 10× faster than driving moviepy's
per-frame Python compositor and runs end-to-end inside a 10-minute
sandbox budget.

Pipeline stages (`enhance_demo.py`):

1. **Generate overlay PNGs** — CPT mask (`build/cpt_overlay.png`),
   per-beat lower-third callouts, gold EN·ES·PT pill, opening card.
2. **Build master audio** — concat 7 voiceovers with 0.2 s silence
   pads → AAC m4a (`build/intermediate/master_audio.m4a`).
3. **Build body video** — for each beat, trim source to the matching
   voiceover duration, center-crop 1080×2340 → 1080×1920 (drop 210 px
   from top), concat → `build/intermediate/body.mp4` (no audio,
   no overlays).
4. **Render opening + closing card clips** — opening fades in/out;
   closing is a 4-step trilingual wordmark micro-flash (EN 1.0 s →
   ES 0.5 s → PT 0.5 s → EN 1.0 s) with a 0.5 s tail fade.
5. **Concat opening + body + closing** → silent full video.
6. **Single ffmpeg overlay + mux + encode pass** — applies the CPT
   mask (animated y) + 7 callouts + EN·ES·PT pill, mixes in master
   audio delayed by `OPEN_CARD_DUR`, encodes final MP4.

## CPT credential mask

The mask covers the middle "CERTIFIED CPT" column of the credentials
strip; the "2021 EST FOUNDED" and "100% CUSTOM PLANS" outer columns
remain visible. The source recording has multiple scroll snap-points
during this beat, so the mask is implemented as **two timed overlay
entries** keyed off frame-by-frame brightness analysis of the body
video:

| Segment | Body t window | Mask y | Notes |
|---|---|---|---|
| Stable dwell | 9.00 – 9.10 s | 440 (static) | Strip stable at y=460-590 |
| Smooth scroll | 9.10 – 10.50 s | 390 → 135 (animated) | Linear interp via ffmpeg `y='390-255*(t-...)/(...)'` |

Mask geometry: 380 × 180, centered horizontally at x=405 (offset
−135 px from frame center to align with the actual middle column).
"OT-INFORMED" / "EXERCISE SCIENCE" Bebas Neue text, BBF Gold accent
underline, on a BBF Black panel with a thin BBF Purple border.

The founder photo is always below the mask's bottom edge — verified
by row-brightness scan of `build/qa_frames/clean_t*.png`.

## Voiceover

Seven ElevenLabs MP3s in `voiceover/`:

| File | Beat | Duration |
|---|---|---|
| 01_hook.mp3 | Hero open | 7.05 s |
| 02_credibility.mp3 | OT-informed credibility | 8.39 s |
| 03_sports_playbook.mp3 | Athlete differentiation | 18.94 s |
| 04_vault_transition.mp3 | "This is where the real work begins." | 5.43 s |
| 05_lab_biomechanics.mp3 | Clinical-grade tracking | 23.35 s |
| 06_nutrition.mp3 | TDEE-calibrated plans | 21.58 s |
| 07_trilingual_close.mp3 | EN · ES · PT close | 9.64 s |

The pipeline does not regenerate these — they are pre-rendered
artifacts checked into the repo. To regenerate (e.g. swap voice or
update copy), use ElevenLabs UI / API and re-export to the same
filenames.

## Install

```sh
sudo apt-get install -y ffmpeg
pip install Pillow
```

Fonts (already in `build/fonts/`):
- BebasNeue.ttf (headers / wordmark / mask / callouts)
- BarlowCondensed-Regular.ttf (taglines / body)
- BarlowCondensed-Bold.ttf (reserved)

## Run

```sh
python3 enhance_demo.py
```

Optional flags:

```sh
python3 enhance_demo.py \
  --source bbf_source_v2_compressed.mp4 \
  --output bbf_demo_enhanced_v1.mp4
```

Idempotent — overwrites prior output and intermediates.

## QA artifacts

`build/qa_frames/` contains stage-by-stage frame extracts used during
mask placement verification (CPT mask, founder photo, opening,
closing card flashes, EN·ES·PT pill). Useful as a regression
reference if the source recording is re-shot.

## Regenerating after a re-record

If `bbf_source_v2_compressed.mp4` is replaced:

1. Re-extract `build/qa_frames/clean_t9.0.png` ... `clean_t10.5.png`
   from the new body via the brightness scan utility (see code
   comments in `main()`).
2. Verify shield-row y-position at body t=9.0, 9.5, 10.5; if the
   strip's motion model has changed, update the two overlay segments
   in `enhance_demo.py` (search for `# Segment 1` / `# Segment 2`).
3. Re-run `python3 enhance_demo.py` and visually verify
   `build/qa_frames/v15_t10.65_close.png`-equivalent frames.
