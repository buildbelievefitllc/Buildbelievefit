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
