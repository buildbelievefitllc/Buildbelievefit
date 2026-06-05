# BBF Calling-Card Render Pipeline

Renders the 100 BBF "calling card" marketing images (4:5, **1080×1350**) from the
`bbf_calling_cards_batch_v1` table into the Supabase Storage bucket
`calling-cards-v1`, using the **LOCKED** brand template — Bebas Neue / Barlow
Condensed, BBF Purple `#6a0dad` + Victory Gold `#f5c800` as the load-bearing
identity, with the blueprint's per-palette accents (`purDeep`, `purMid`, `blue`,
`cyan`, `teal`, `green`, `orange`, `yellow`, `border`) on the top-bar, eye, glow
and rule. Faithful to `bbf-100-card-admap.html`.

## Files
- `render.mjs` — **local** renderer (`@napi-rs/canvas`) for fast visual QA. Reads
  `rows.json` → writes `out/<id>.png`.
- `edge/bbf-cards-render/` — **server-side** renderer (SVG→PNG via `@resvg/resvg-wasm`,
  text metrics via `opentype.js`), deployed as the Supabase edge function
  `bbf-cards-render`. Reads rows + uploads PNGs using the injected service-role key.
  Actions: `?action=preview&i=N&w=150`, `?action=run&offset=O&limit=L`, `?action=count`.
- `edge/bbf-cards-pipeline/` — helper function: `export` rows / `ensure_bucket` /
  `upload` / `count`.
- `extract-metrics.mjs` + `metrics.json` — font advance-width table (reference; the
  edge function parses the fonts with opentype at runtime instead).

## Why the render runs server-side
The build sandbox can reach GitHub / Google Fonts but **not** `*.supabase.co`, so
rendered bytes can't be pushed to Storage from the sandbox. Rendering therefore runs
inside the edge function (triggered from SQL via `pg_net`), where `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase and never leave the function.

## Local QA
```sh
npm install
./fetch-fonts.sh
node render.mjs        # reads rows.json, writes out/<id>.png
```

## Batch (server-side) — run from SQL via pg_net, in slices, then verify:
`?action=run&offset=0&limit=10` … `offset=90&limit=10`, then `?action=count` → 100.
