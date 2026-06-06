# BBF Videos — Remotion

Animated BBF marketing videos. **1080×1350 vertical (4:5)**, LOCKED brand
(CLAUDE.md §2): BBF Purple `#6a0dad` + Victory Gold `#f5c800`, **Bebas Neue**
headers, **Barlow Condensed** body. Mirrors the brand language of
`tools/calling-cards`.

## Compositions

| id        | spec                       | output                      |
|-----------|----------------------------|-----------------------------|
| `CtaCard` | 5.0s · 30fps · 150 frames  | `out/bbf-cta-awaken.mp4`    |

**`CtaCard` timeline**
- `0–2s` — eyebrow (`I AM CAPABLE`) fades in, then holds
- `2–4s` — headline (`Your limits are borrowed`) punches in word by word
- `4–5s` — gold rule draws, body copy + `AWAKEN` CTA fade in

Content is prop-driven (see `defaultProps` in `src/Root.tsx`).

## Develop / render

```sh
npm install
npm run studio    # interactive preview at localhost
npm run render    # -> out/bbf-cta-awaken.mp4 (h264)
npm run still      # single-frame PNG QA
```

Fonts (OFL) are bundled in `public/fonts/` so renders are network-free and
deterministic. Remotion 4.x bundles its own ffmpeg and downloads a Chrome
Headless Shell on first render (`npx remotion browser ensure`).
