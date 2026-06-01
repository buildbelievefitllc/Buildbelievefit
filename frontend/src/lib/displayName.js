// src/lib/displayName.js
// ─────────────────────────────────────────────────────────────────────────────
// Formatted display names for the Vault greeting. The PIN-RPC session carries
// only a login slug (username) — no human display name — so we resolve a
// presentable full name here. Known accounts get an explicit name; everyone else
// falls back to a title-cased slug (with the `_bbf` persona suffix stripped).
//
// Client Zero (akeem) is the CEO / first athlete — his greeting reads
// "Welcome, Akeem Brown" on the Vault Hub blueprint hero.

const NAME_MAP = {
  akeem: 'Akeem Brown',
};

// slug → presentable name. Pure; safe on null/empty (→ 'Athlete').
export function formatDisplayName(username) {
  const slug = String(username || '').trim().toLowerCase();
  if (!slug) return 'Athlete';
  if (NAME_MAP[slug]) return NAME_MAP[slug];
  return slug
    .replace(/_bbf$/, '')        // drop the persona suffix
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Athlete';
}
