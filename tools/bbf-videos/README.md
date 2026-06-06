# BBF Videos — Remotion

Animated BBF marketing videos. **1080×1350 vertical (4:5)**, LOCKED brand
(CLAUDE.md §2): BBF Purple `#6a0dad` + Victory Gold `#f5c800`, **Bebas Neue**
headers, **Barlow Condensed** body.

## Compositions

| id        | spec                       | output                       |
|-----------|----------------------------|------------------------------|
| `CtaCard` | 6.0s · 30fps · 180 frames  | `out/bbf-cta-awaken-v2.mp4`  |

### `CtaCard` — premium motion (v2)

Overlapping choreography (no phase ever fully settles):

| frames | (s)        | motion |
|--------|------------|--------|
| 0–20   | 0.0–0.67   | top bar wipes in left→right (`#6a0dad`→`#f5c800`) |
| 0–35   | 0.0–1.17   | eyebrow fades up, letter-spacing settles 14px→7px |
| 25–90  | 0.83–3.0   | headline punches in word by word (overdamped spring, no overshoot) — each word translates up + 4px blur→sharp; **BORROWED** lands gold with a 1.08→1.0 settle + glow pulse |
| 80–116 | 2.67–3.87  | gold rule draws; body fades up line by line (6-frame stagger) |
| 110–150| 3.67–5.0   | AWAKEN pill springs in, then idles with a slow glow pulse |
| 150–180| 5.0–6.0    | hold — background keeps breathing, glows keep pulsing |

**Background:** vertical gradient `#0d0118`→`#060606`; purple appears **only** as
a large blurred radial bloom (~35%) in the lower third that breathes
(scale 1.0→1.06→1.0) and drifts across the whole clip; vignette + animated
SVG-turbulence film grain (~6%).

**Easing:** springs for entrances; `cubic-bezier(0.16, 1, 0.3, 1)` for every fade.
No linear easing.

**Audio** (`public/sfx/`, synthesized by `scripts/gen-sfx.mjs` — royalty-free):
- `whoosh.wav` — headline entrance, begins **frame 17** (~0.57s)
- `sub-bass-hit.wav` — "BORROWED" landing, hits **frame 78** (~2.60s)

> Frames recompute from `timing` props, so the cues stay synced for variants.
> To swap in your own SFX in DaVinci, drop them at those timestamps.

All copy, colors, timing, audio, and background are **props** in `src/Root.tsx` —
edit `defaultProps` to render variants without touching the composition.

## Develop / render

```sh
npm install
npm run gen:sfx   # writes public/sfx/*.wav (run once; committed)
npm run studio    # interactive preview
npm run render    # -> out/bbf-cta-awaken-v2.mp4 (h264)
npm run still      # single-frame PNG QA
```

Fonts (OFL) are bundled in `public/fonts/`. Remotion 4.x bundles its own ffmpeg.
`remotion.config.ts` auto-detects an on-box Playwright `chrome-headless-shell`
(this sandbox blocks Remotion's Chrome CDN); elsewhere Remotion uses its own.
