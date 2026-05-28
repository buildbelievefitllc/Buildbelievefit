// Phase 7 · trilingual response directive · shared helper
// ──────────────────────────────────────────────────────────────────────
// Returns a system-prompt suffix that instructs Claude (Haiku/Sonnet/Opus)
// to respond in the user's selected language. Imported by every user-facing
// agent that returns natural-language text (clinical insights, coaching
// verdicts, meal interpretations, drill descriptions, etc.).
//
// Usage in an agent's handler:
//   import { langDirective } from '../_shared/lang-directive.ts';
//   const lang = ['en','es','pt'].includes(payload?.lang) ? payload.lang : 'en';
//   const fullPrompt = SYSTEM_PROMPT + langDirective(lang);
//   // ... pass fullPrompt to callClaude / fetch as the system field
//
// Design notes:
// · For 'en' the helper returns the empty string · zero-overhead default.
// · Spanish/Portuguese directives are short and unambiguous to keep token
//   cost minimal while still binding the model to the output language.
// · JSON output keys stay English in every case (programmatic schema);
//   only natural-language fields (verdicts, narrations, cues) translate.
//
// Reference: bbf-meal-macros (Phase 7 ship) was the first integration ·
// see its systemPromptFor() for the inline pattern that motivated this
// helper. Every subsequent agent uses this shared module instead.

export type BbfLang = 'en' | 'es' | 'pt';

const LANG_NAMES: Record<BbfLang, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  pt: 'Portuguese (Português)',
};

export function normalizeLang(raw: unknown): BbfLang {
  return (raw === 'es' || raw === 'pt') ? raw : 'en';
}

export function langDirective(lang: BbfLang | string | undefined): string {
  const L = normalizeLang(lang);
  if (L === 'en') return '';
  const name = LANG_NAMES[L];
  return (
    `\n\nLANGUAGE DIRECTIVE: Respond ENTIRELY in ${name}. ` +
    `All natural-language fields (verdicts, narrations, cues, banners, descriptions, ` +
    `coaching text, recommendations, summaries) MUST be in ${name}. ` +
    `Keep any JSON output keys EXACTLY as specified in the schema (English) · only the ` +
    `VALUES translate. Numeric fields (counts, percentages, kcal, reps, weights) stay ` +
    `numeric. Code identifiers, exercise_keys, slugs, and machine tokens are NOT translated.`
  );
}
