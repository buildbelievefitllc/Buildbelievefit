// ═══════════════════════════════════════════════════════════════════════
// supabase/functions/_shared/locale.ts
// Opus Max Sprint · Brief 4 · Trilingual Cloud Plans — the locale contract
// ───────────────────────────────────────────────────────────────────────
// Single source of truth for trilingual (EN / ES / PT) CLOUD generation.
// Every plan-generating edge function imports this so that:
//
//   1. a `locale` hint is normalized identically everywhere (normalizeLocale),
//   2. athlete-facing text is generated NATIVELY in the requested locale —
//      composed directly in the language, never English-then-translated
//      (localeDirective), and
//   3. terminology stays consistent with the frontend i18n string table
//      (frontend/src/context/langs.js + LangContext DICT) while BBF's
//      proprietary system names stay VERBATIM in every language.
//
// COORDINATION WITH bbf-agentic-linguist: the linguist and every generator
// share ONE proprietary-name locklist + ONE glossary (this file). That is the
// "coordination" — a shared contract rather than N runtime round-trips. The
// linguist imports PROPRIETARY_TERMS so a translated cue never mangles a
// system name; the generators import the full directive.
//
// PURE TypeScript — no Deno globals at module scope — so it is unit-testable
// under Node type-stripping and importable by any edge function.
// ═══════════════════════════════════════════════════════════════════════

export type LocaleCode = 'en' | 'es' | 'pt';

export interface Locale {
  code: LocaleCode;
  label: string;       // English label, for logs ("Spanish")
  nativeName: string;  // endonym the prompt addresses the model in
}

export const SUPPORTED_LOCALES: LocaleCode[] = ['en', 'es', 'pt'];
export const DEFAULT_LOCALE: LocaleCode = 'en';

const LOCALES: Record<LocaleCode, Locale> = {
  en: { code: 'en', label: 'English',               nativeName: 'English' },
  es: { code: 'es', label: 'Spanish',               nativeName: 'Español (neutral Latin-American Spanish)' },
  pt: { code: 'pt', label: 'Portuguese (Brazilian)', nativeName: 'Português (Brazilian Portuguese)' },
};

// Normalize ANY client locale hint → one of the three supported locales.
// Accepts 'en'/'es'/'pt', region tags ('es-MX', 'pt-BR'), endonyms
// ('español', 'português'), and English names ('Spanish'). Unknown → default.
export function normalizeLocale(input?: string | null): Locale {
  const t = String(input ?? '').trim().toLowerCase();
  if (!t) return LOCALES[DEFAULT_LOCALE];
  if (t === 'es' || t.startsWith('es-') || t.startsWith('es_') || t.startsWith('span') || t.startsWith('esp')) return LOCALES.es;
  if (t === 'pt' || t.startsWith('pt-') || t.startsWith('pt_') || t.startsWith('port') || t.startsWith('por') || t.includes('brasil') || t.includes('brazil') || t === 'br') return LOCALES.pt;
  if (t === 'en' || t.startsWith('en-') || t.startsWith('en_') || t.startsWith('eng') || t.startsWith('ing')) return LOCALES.en;
  return LOCALES[DEFAULT_LOCALE];
}

// Convenience: the bare normalized code (handy for response echoes + logs).
export function localeCode(input?: string | null): LocaleCode {
  return normalizeLocale(input).code;
}

// ── Proprietary BBF system names — LOCKED, never translated/transliterated/
// restyled. Verbatim in every locale. Sourced from CLAUDE.md §1–§2 and the
// frontend i18n table. Order: multi-word names before their substrings so a
// model reading the list locks the full name first.
export const PROPRIETARY_TERMS: string[] = [
  'Build Believe Fit',
  'BBF Athlete Portal',
  'Sovereign Vault',
  'Sovereign Client Portal',
  'Sovereign Sentinel',
  'Sovereign Toast',
  'Sovereign Gold Standard',
  'Sovereign Standard',
  'Kinematic Form HUD',
  'Smart Cardio',
  'Metabolic Pacer',
  'Prehab Matrix',
  'Prehab Architect',
  'Mindset Engine',
  'The Vault',
  'Pre-Hab',
  'Pathfinder',
  'BBF',
];

// ── Approved domain terminology — consistent with the frontend i18n string
// table so a cloud-generated plan reads the same as the app chrome. The
// proprietary names above OUTRANK these (they always stay verbatim).
export interface GlossaryEntry { en: string; es: string; pt: string; }
export const GLOSSARY: GlossaryEntry[] = [
  { en: 'Fasting Window', es: 'Ventana de Ayuno',        pt: 'Janela de Jejum' },
  { en: 'Eating Window',  es: 'Ventana de Alimentación', pt: 'Janela de Alimentação' },
  { en: 'Workout',        es: 'Entrenamiento',           pt: 'Treino' },
  { en: 'Warm-Up',        es: 'Calentamiento',           pt: 'Aquecimento' },
  { en: 'Cool-Down',      es: 'Enfriamiento',            pt: 'Desaquecimento' },
  { en: 'Set',            es: 'Serie',                   pt: 'Série' },
  { en: 'Rep',            es: 'Repetición',              pt: 'Repetição' },
  { en: 'Rest',           es: 'Descanso',                pt: 'Descanso' },
  { en: 'Recovery',       es: 'Recuperación',            pt: 'Recuperação' },
  { en: 'Strength',       es: 'Fuerza',                  pt: 'Força' },
  { en: 'Mobility',       es: 'Movilidad',               pt: 'Mobilidade' },
  { en: 'Meal Plan',      es: 'Plan de Comidas',         pt: 'Plano de Refeições' },
  { en: 'Coaching Cue',   es: 'Indicación de Coaching',  pt: 'Comando de Treino' },
];

function lockListBlock(): string {
  return PROPRIETARY_TERMS.map((t) => `"${t}"`).join(', ');
}

function glossaryBlock(code: LocaleCode): string {
  if (code === 'en') return '';
  return GLOSSARY
    .map((g) => `  • "${g.en}" → "${code === 'es' ? g.es : g.pt}"`)
    .join('\n');
}

// ── localeDirective — the system-prompt block appended to EVERY generator.
// `kind` names what the function produces ("the cardio protocol", "the meal
// plan", "all coaching cues") so the instruction is concrete; defaults to a
// general phrasing. EN still emits the proprietary locklist (always verbatim).
export function localeDirective(input?: string | null, kind = 'all athlete-facing text'): string {
  const loc = normalizeLocale(input);
  const lines: string[] = [];

  lines.push('# OUTPUT LANGUAGE — TRILINGUAL NATIVE GENERATION (MANDATORY)');
  if (loc.code === 'en') {
    lines.push(`Write ${kind} in natural, native English (locale: en).`);
  } else {
    lines.push(`Write ${kind} NATIVELY in ${loc.nativeName} (locale: ${loc.code}).`);
    lines.push(
      `Compose DIRECTLY in ${loc.nativeName}. Do NOT draft in English and translate — think and write in ` +
      `${loc.nativeName} from the start, using the authentic idiom a strength coach actually uses on the gym ` +
      `floor (imperative, motivational), not textbook or machine-translated phrasing. Use correct diacritics.`,
    );
  }

  lines.push('');
  lines.push('## PROPRIETARY NAMES — keep VERBATIM in every language (never translate, transliterate, pluralize, or restyle):');
  lines.push(lockListBlock());

  if (loc.code !== 'en') {
    const gloss = glossaryBlock(loc.code);
    if (gloss) {
      lines.push('');
      lines.push('## APPROVED TERMINOLOGY — use these exact renderings for consistency with the BBF app UI:');
      lines.push(gloss);
    }
    lines.push('');
    lines.push(
      `Numbers, units (kg/lb, min, kcal, %), and canonical exercise names from the authorized catalog stay ` +
      `as provided. Only the prose — cues, notes, rationale, descriptions — is composed in ${loc.nativeName}.`,
    );
  }

  return lines.join('\n');
}
