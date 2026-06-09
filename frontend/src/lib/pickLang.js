// src/lib/pickLang.js
// ─────────────────────────────────────────────────────────────────────────────
// Priority Delta — Multi-Lingual Video Architecture · the single fallback rule.
//
// One tiny pure helper that resolves a "maybe-localized" value to the active
// language, with a bulletproof fallback so a missing translation NEVER yields
// undefined (which would render a broken iframe / blank slot).
//
// It accepts either shape, so the codebase can migrate incrementally:
//   • a bare string  → returned as-is. This IS the structural fallback: a flat
//     id means "same value for every language" (the legacy/EN-for-all form), so
//     legacy maps keep working untouched and an entry is promoted to the object
//     form only once a localized clip actually exists.
//   • a { en, es, pt } object → active lang → en → first defined value → null.
//
// Used for video ids AND for short localized captions/labels alike.
//
//   pickLang('abc123', 'es')                       → 'abc123'
//   pickLang({ en:'a', es:'b' }, 'es')             → 'b'
//   pickLang({ en:'a' }, 'pt')                     → 'a'   (pt missing → en)
//   pickLang({ es:'b' }, 'en')                     → 'b'   (en missing → first)
//   pickLang(null, 'es') / pickLang(undefined,…)   → null

export function pickLang(value, lang) {
  if (value == null) return null;
  if (typeof value === 'string') return value || null;
  return value[lang] ?? value.en ?? Object.values(value).find((v) => v != null) ?? null;
}
