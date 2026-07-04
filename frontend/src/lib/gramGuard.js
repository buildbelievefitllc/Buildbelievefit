// src/lib/gramGuard.js
// ─────────────────────────────────────────────────────────────────────────────
// THE GRAM STANDARD (§0.1) — client mirror of the database constraint
// bbf_cue_translation_gram_standard on bbf_linguist_cue_ledger: no stored (or
// typed) translation may carry a kilogram/pound lexeme. Mass crosses the language
// module ONLY as the {load_g} integer-gram slot. Keep the lexeme set in exact
// lockstep with the Postgres CHECK regex:
//   \m(kilo\w*|kgs?|lbs?|libras?|quilo\w*|pounds?)\M

const GRAM_BANNED = /(?:^|[^\p{L}])(kilo\p{L}*|kgs?|lbs?|libras?|quilo\p{L}*|pounds?)(?![\p{L}])/iu;

/** True when the text violates the Gram Standard (carries a kg/lb lexeme). */
export function violatesGramStandard(text) {
  return GRAM_BANNED.test(String(text || ''));
}
