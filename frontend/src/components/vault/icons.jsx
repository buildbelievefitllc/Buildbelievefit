// src/components/vault/icons.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Glyph Purge — minimalist inline SVG marks for the Vault chrome,
// replacing native OS emojis (⚡ 🏆 🔒). Clinical / brutalist: sharp geometry, no
// playful or colorful vectors. Each glyph paints in `currentColor`, so the
// CONSUMING class sets the token (--yel / --gold-soft / --mut / the #0c0a02 ink
// that sits on a gold pill). aria-hidden — decorative only; the text beside them
// carries the meaning.

// Sharp angular lightning bolt (streak). Single filled polygon — recognizable,
// no rounded corners.
export function BoltIcon({ className = '', size = 14 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
    </svg>
  );
}

// Sovereign crest — an angular shield silhouette (stroke only, no badge fill).
// Reads as "the Vault" without the trophy emoji's playfulness.
export function CrestIcon({ className = '', size = 16 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5 4.5 5.2v6.1c0 4.5 3.2 7.8 7.5 9.2 4.3-1.4 7.5-4.7 7.5-9.2V5.2L12 2.5z" />
    </svg>
  );
}

// Padlock (locked-tab indicator). Stroke geometry, square shackle base.
export function LockIcon({ className = '', size = 12 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="5" y="11" width="14" height="9" rx="1" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// ── Concierge tool glyphs (Glyph Purge, follow-up) ───────────────────────────
// Stroke-only line marks, currentColor, sharp/geometric. Shared SVG props keep
// the set visually uniform.
function svgProps(size) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinejoin: 'miter',
    strokeLinecap: 'square',
    'aria-hidden': true,
    focusable: 'false',
  };
}

// Microphone (voice coach) — capsule body, cradle arc, stand.
export function MicIcon({ className = '', size = 16 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <rect x="9" y="2.5" width="6" height="10" rx="0.5" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.5" />
      <path d="M8.5 21.5h7" />
    </svg>
  );
}

// Camera (advanced nutrition / meal capture) — body, viewfinder notch, lens.
export function CameraIcon({ className = '', size = 16 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <rect x="3" y="6.5" width="18" height="12.5" rx="1" />
      <path d="M8 6.5 9.5 4h5L16 6.5" />
      <circle cx="12" cy="12.7" r="3.1" />
    </svg>
  );
}

// Signal array (Sovereign Comlink) — emitter node + two broadcast waves.
export function SignalIcon({ className = '', size = 16 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <circle cx="12" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M8.3 13.2a5.2 5.2 0 0 1 7.4 0" />
      <path d="M5.6 10.5a9 9 0 0 1 12.8 0" />
    </svg>
  );
}

// Pennant flag (Sports Hub) — pole + notched team pennant.
export function FlagIcon({ className = '', size = 16 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <path d="M6 2.5v19" />
      <path d="M6 4h11l-3 3.6 3 3.6H6" />
    </svg>
  );
}

// Roster (two figures) — heads + shoulders, geometric.
export function UsersIcon({ className = '', size = 16 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" />
      <circle cx="16.6" cy="8.6" r="2.3" />
      <path d="M15.2 13.8A5.2 5.2 0 0 1 20.4 19" />
    </svg>
  );
}

// Check (logged set). Sharp two-segment tick.
export function CheckIcon({ className = '', size = 16 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

// Close (dismiss blackout). Square-cut X.
export function CloseIcon({ className = '', size = 18 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <path d="M5 5l14 14" />
      <path d="M19 5 5 19" />
    </svg>
  );
}

// Play — solid brand-gold triangle (filled, not stroked, so it reads as a button).
export function PlayIcon({ className = '', size = 22 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24"
      fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  );
}

// Chevron — sharp disclosure caret (accordions). Rotated via CSS when open.
export function ChevronIcon({ className = '', size = 16 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Crosshair (Kinematic Form HUD / target) — ringed sight with axis ticks.
export function CrosshairIcon({ className = '', size = 16 }) {
  return (
    <svg className={className} {...svgProps(size)}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 1.8v3.4" />
      <path d="M12 18.8v3.4" />
      <path d="M1.8 12h3.4" />
      <path d="M18.8 12h3.4" />
    </svg>
  );
}
