// src/lib/reelPhoneBackdrop.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the Video Engine's "phone backdrop" rect — where the
// phone-frame-v4 mockup sits on the 1080×1920 reel canvas, and where inside it the
// uploaded footage plays. Both the live DOM preview (ReelPreviewEngine, inline
// style) and the SovereignFoundry export (StudioLayout → foundry.render's
// videoRect) import these same numbers, so the exported MP4's footage crop always
// lines up pixel-for-pixel with what was previewed — no hand-copied constants to
// drift out of sync between the two rendering paths.
//
// Inset (14px) and corner radius (64px) intentionally match phone-frame-v4's
// existing CSS (.phone-screen-v4) untouched — a phone bezel doesn't need to scale
// with mockup size, so the frame is just sized directly for this taller canvas
// rather than transform:scale()'d from the Phone section's 1080×1350 version.

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const FRAME_W = 640;
const FRAME_H = 1350;
const INSET = 14;
const RADIUS = 64;

export const REEL_PHONE_FRAME = {
  left: (CANVAS_W - FRAME_W) / 2,
  top: (CANVAS_H - FRAME_H) / 2,
  width: FRAME_W,
  height: FRAME_H,
};

export const REEL_PHONE_SCREEN = {
  x: REEL_PHONE_FRAME.left + INSET,
  y: REEL_PHONE_FRAME.top + INSET,
  width: FRAME_W - INSET * 2,
  height: FRAME_H - INSET * 2,
  radius: RADIUS,
};
