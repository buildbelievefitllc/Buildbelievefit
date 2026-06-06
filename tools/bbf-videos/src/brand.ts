// LOCKED BBF brand tokens (CLAUDE.md §2). Single source of truth for the video.
// Purple #6a0dad + Gold #f5c800 are the load-bearing identity; matte black is a
// canvas/surface only — never a primary CTA or load-bearing mark.
export const BRAND = {
  purple: '#6a0dad', // BBF Purple — load-bearing (used as the radial bloom only)
  gold: '#f5c800', // Victory Gold — accent + CTA
  ink: '#f9f5ff', // near-white headline ink (matches calling-cards ink.base)
  body: 'rgba(255,255,255,0.82)', // body copy
  black: '#090909', // approved canvas only
  bgTop: '#0d0118', // deep violet-black (gradient top)
  bgBottom: '#060606', // near-black (gradient bottom)
} as const;

// 1080x1350 vertical (4:5), 30fps, 6.0s = 180 frames.
export const VIDEO = {
  fps: 30,
  width: 1080,
  height: 1350,
  durationInFrames: 180,
} as const;
