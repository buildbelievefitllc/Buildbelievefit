# BBF Play Store Asset Pipeline — Terminal 6 (Mobile Distribution)

Headless, deterministic generator for the **Google Play Console** visual assets
of the Build Believe Fit companion app (TWA package `fitness.buildbelievefit.twa`).

It replaces the brittle, loop-prone "browser drone" Console workflow with a
single non-interactive command that **sizes, crops, pads, validates, and
packages** every required store asset — then exits `0` (Play-ready) or `1`
(a required asset failed validation). No prompts. No UI. CI-safe.

> Isolated by design: this folder has its **own** `package.json`. It never
> touches the repo-root Express/webhook service. Generated binaries are
> `.gitignore`d — regenerate on demand, don't commit them.

## Install

```bash
cd scripts/playstore
npm install        # pulls sharp only
```

## Generate

```bash
npm run generate            # → ./dist + manifest.json
node generate-assets.js --fastlane --zip
```

## What it produces

| Asset | Spec | Source (default) |
|---|---|---|
| App icon | 512×512 PNG (alpha ok, ≤1 MB) | `bbf-icon-512.png` |
| Feature graphic | 1024×500 PNG, **no alpha** | brand gradient + logo + wordmark |
| Phone screenshots | 1080×1920 PNG, no alpha, 2–8 | configured marketing images |
| 7"/10" tablet | optional, 2–8 each | configured (empty by default) |

All dimensions, format, alpha, file-size, and aspect-ratio rules live in
[`playstore.spec.js`](./playstore.spec.js) — the single source of truth. If
Google changes a requirement, edit that file only.

## Configure sources

Edit [`assets.config.json`](./assets.config.json). Paths resolve relative to the
**repo root** so brand assets stay canonical. Swap sources, add screenshots, or
change the feature-graphic headline there — never hardcode paths in the script.

## Options

```
--config <path>   source map           (default ./assets.config.json)
--root <path>     repo root for sources (default ../../)
--out <path>      output dir            (default ./dist)
--locale <code>   listing locale        (default en-US)
--only <list>     icon,feature,phone,tablet7,tablet10
--no-text         skip feature-graphic text overlay
--fastlane        emit fastlane `supply` metadata tree
--zip             package dist/ into bbf-playstore-assets.zip
--check           validate-only audit of an existing dist/
```

## fastlane handoff

With `--fastlane`, assets are mirrored into a `supply`-compatible tree:

```
dist/fastlane/metadata/android/en-US/images/
  icon.png
  featureGraphic.png
  phoneScreenshots/01_01.png …
```

Point `fastlane supply` at that directory to push the listing — credentials
(the Play service-account JSON) are supplied by the operator at deploy time and
are **never** stored in this repo.

## Brand compliance

Colors are pinned to the LOCKED palette (`CLAUDE.md` §2): BBF Purple `#6a0dad`
is the load-bearing identity color; matte black `#090909` is used **only** as a
surface/letterbox fill, never as a CTA or brand mark; BBF Gold `#f5c800` is the
accent baseline. Header font targets Bebas Neue / Barlow Condensed (falls back
gracefully if the font isn't installed on the render host).
