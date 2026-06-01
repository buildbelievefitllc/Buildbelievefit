/**
 * playstore.spec.js — Canonical Google Play Console asset constraints.
 *
 * Single source of truth for every dimension / format / alpha / size rule the
 * pipeline targets and validates against. If Google changes a requirement,
 * change it HERE only — generate-assets.js reads everything from this map.
 *
 * Refs (Google Play Console, current as of 2026):
 *   - App icon:        512x512, 32-bit PNG (alpha allowed), <= 1024 KB
 *   - Feature graphic: 1024x500, JPEG or 24-bit PNG (NO alpha)
 *   - Phone shots:     2-8, JPEG/24-bit PNG, 320-3840 px/side, aspect 16:9..9:16
 *   - 7"/10" tablet:   optional, same format rules, up to 8 each
 */

// Brand palette — LOCKED per CLAUDE.md §2. Matte black is an approved
// surface/canvas only (used here for letterbox/background fill), never a CTA.
export const BRAND = {
  purple: '#6a0dad',
  gold: '#f5c800',
  matteBlack: '#090909',
};

/** @typedef {'png'|'jpeg'} OutFormat */

/**
 * Each asset type defines its target geometry + the Play Console rules used
 * for post-generation validation. `count` describes how many the store
 * accepts (used to warn, never to crash).
 */
export const ASSET_SPECS = {
  icon: {
    label: 'App icon',
    out: 'icon.png',
    width: 512,
    height: 512,
    format: 'png',
    alpha: true, // icon may keep transparency
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    maxBytes: 1024 * 1024,
    fastlane: 'icon.png',
    required: true,
  },
  feature: {
    label: 'Feature graphic',
    out: 'feature-graphic.png',
    width: 1024,
    height: 500,
    format: 'png',
    alpha: false, // Play rejects alpha on the feature graphic
    fit: 'cover',
    background: BRAND.matteBlack,
    maxBytes: 15 * 1024 * 1024,
    fastlane: 'featureGraphic.png',
    required: true,
  },
  phone: {
    label: 'Phone screenshot',
    outDir: 'phone',
    width: 1080,
    height: 1920,
    format: 'png',
    alpha: false,
    fit: 'contain', // letterbox source onto brand bg; never distort
    background: BRAND.matteBlack,
    minSide: 320,
    maxSide: 3840,
    minAspect: 9 / 16, // 0.5625 (portrait limit)
    maxAspect: 16 / 9, // 1.7777 (landscape limit)
    count: { min: 2, max: 8 },
    fastlane: 'phoneScreenshots',
    required: true,
  },
  tablet7: {
    label: '7-inch tablet screenshot',
    outDir: 'tablet7',
    width: 1200,
    height: 1920,
    format: 'png',
    alpha: false,
    fit: 'contain',
    background: BRAND.matteBlack,
    minSide: 320,
    maxSide: 3840,
    count: { min: 0, max: 8 },
    fastlane: 'sevenInchScreenshots',
    required: false,
  },
  tablet10: {
    label: '10-inch tablet screenshot',
    outDir: 'tablet10',
    width: 1600,
    height: 2560,
    format: 'png',
    alpha: false,
    fit: 'contain',
    background: BRAND.matteBlack,
    minSide: 320,
    maxSide: 3840,
    count: { min: 0, max: 8 },
    fastlane: 'tenInchScreenshots',
    required: false,
  },
};

export default { BRAND, ASSET_SPECS };
