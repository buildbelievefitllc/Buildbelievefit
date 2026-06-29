// src/lib/sovereignManifest.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Sovereign Vault audio manifest resolver.
//
// The 31-scenario BBF Loop Breaker biometric matrix is compiled to permanent
// PUBLIC URLs in src/data/sovereignVaultManifest.json (see scripts/compile-voice-
// vault.js). The DB's calendar_overrides.brief_script_reference stores ONLY a
// manifest id (e.g. 'audio_62a878f8') — enforced by a CHECK constraint — so the
// frontend resolves that id to its permanent URL here.

import manifest from '../data/sovereignVaultManifest.json';

// id → entry (id, category, subjectLine, scenario, duration, url)
const BY_ID = new Map(manifest.map((m) => [m.id, m]));

/** Resolve a manifest id (or a full URL passed through) to a playable public URL. */
export function manifestUrlById(ref) {
  if (!ref) return null;
  // Defensive: if a full URL was ever stored, accept it verbatim.
  if (/^https?:\/\//i.test(ref)) return ref;
  return BY_ID.get(ref)?.url || null;
}

/** The full manifest entry for an id, or null. */
export function manifestEntry(ref) {
  return ref ? BY_ID.get(ref) || null : null;
}

export { manifest };
