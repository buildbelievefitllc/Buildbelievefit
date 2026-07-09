// src/components/language/sequenceMapper.js
// ─────────────────────────────────────────────────────────────────────────────
// THE SEQUENCE MAPPER — deterministic Day-N → Video Vault lesson binding.
//
// Connects the bbf_curriculum_days ledger (the Guided Track's current day) to
// the chronologically structured video payload (languageVideoLibrary.json:
// 50 lessons per language — 20 Beginner · 15 Intermediate · 15 Advanced).
//
// The per-language sequence is Beginner → Intermediate → Advanced, ID-ordered
// within each tier (IDs are zero-padded, so numeric ID order == authored
// chronology). Day N maps straight to index N−1:
//   PT Day 1 → PO-B-01 (index 0) · PT Day 2 → PO-B-02 · … · Day 21 → PO-I-01.
// Days past the 50-lesson sequence (51–90) wrap modulo — the back stretch of
// the 90-day protocol re-runs the ladder as deliberate re-watch reinforcement,
// still fully deterministic per (language, day).
//
// Pure + data-only: no state, no I/O. Both the Guided Track strip (the assigned
// title) and the Video Vault mode (the featured lesson + list order) read the
// SAME functions, so the binding can never drift between surfaces.

import languageVideoLibrary from '../../data/languageVideoLibrary.json';

const LIB_LANG = { es: 'Spanish', pt: 'Portuguese' };
const TIER_ORDER = { Beginner: 1, Intermediate: 2, Advanced: 3 };

// The full chronological lesson sequence for a BBF target code ('es' | 'pt').
export function getVideoSequence(target) {
  const name = LIB_LANG[target === 'pt' ? 'pt' : 'es'];
  return languageVideoLibrary
    .filter((v) => v.language === name)
    .sort((a, b) =>
      ((TIER_ORDER[a.level] || 9) - (TIER_ORDER[b.level] || 9))
      || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
}

// The lesson assigned to a given curriculum day (1-based). Null only when the
// library carries no lessons for the language.
export function getAssignedVideo(target, day) {
  const seq = getVideoSequence(target);
  if (!seq.length) return null;
  const d = Math.max(1, Math.round(Number(day) || 1));
  return seq[(d - 1) % seq.length];
}
