// src/lib/trainingI18n.js
// ─────────────────────────────────────────────────────────────────────────────
// Training-Protocol catalog localization (Terminal India).
//
// The Program grid, the Generator output, and the Hypertrophy Balance Analyzer
// render two classes of hardcoded English token that bleed through the localized
// shell: DAY labels ("Monday", "Day 1") and MUSCLE-GROUP labels ("CHEST",
// "BACK"). These are DISPLAY maps only — the underlying plan data and the LLM
// `day` enum stay English (the model is instructed to keep them stable), so the
// parse/sync pipeline and the default-EN e2e selectors are untouched: every
// EN lookup is the identity.
//
// Pure functions (no hook) so any component can localize with its active `lang`.

const WEEKDAYS = {
  en: { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' },
  es: { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo' },
  pt: { monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo' },
};

// The word "Day" in "Day 1".."Day 7" generated/catalog plans.
const DAY_WORD = { en: 'Day', es: 'Día', pt: 'Dia' };

// Localize a plan's day label for DISPLAY. Handles weekday names ("Monday"),
// "Day N" sequences, and passes anything else (already-localized or custom)
// through untouched. EN is the identity, keeping the 'Day 1' e2e assertion green.
export function localizeDay(label, lang) {
  const raw = String(label ?? '').trim();
  if (!raw) return raw;
  const L = WEEKDAYS[lang] ? lang : 'en';
  // "Day N" → localized word + number.
  const dn = raw.match(/^day\s+(\d+)$/i);
  if (dn) return `${DAY_WORD[L]} ${dn[1]}`;
  // Weekday name (case-insensitive).
  const hit = WEEKDAYS[L][raw.toLowerCase()];
  return hit || raw;
}

// Muscle-group tokens — covers the Generator engine `g` values + the Analyzer
// rows + a few common compound labels. Keys are lowercased for case-insensitive
// lookup; the caller decides casing (the Generator chip uppercases the result).
const MUSCLES = {
  en: {
    back: 'Back', biceps: 'Biceps', calves: 'Calves', chest: 'Chest', core: 'Core',
    glutes: 'Glutes', hamstrings: 'Hamstrings', quads: 'Quads', shoulders: 'Shoulders',
    triceps: 'Triceps', arms: 'Arms', 'hamstrings / glutes': 'Hamstrings / Glutes',
  },
  es: {
    back: 'Espalda', biceps: 'Bíceps', calves: 'Pantorrillas', chest: 'Pecho', core: 'Core',
    glutes: 'Glúteos', hamstrings: 'Isquiotibiales', quads: 'Cuádriceps', shoulders: 'Hombros',
    triceps: 'Tríceps', arms: 'Brazos', 'hamstrings / glutes': 'Isquiotibiales / Glúteos',
  },
  pt: {
    back: 'Costas', biceps: 'Bíceps', calves: 'Panturrilhas', chest: 'Peito', core: 'Core',
    glutes: 'Glúteos', hamstrings: 'Posteriores de Coxa', quads: 'Quadríceps', shoulders: 'Ombros',
    triceps: 'Tríceps', arms: 'Braços', 'hamstrings / glutes': 'Posteriores / Glúteos',
  },
};

// Localize a single muscle-group token. Unknown tokens pass through unchanged.
export function localizeMuscle(name, lang) {
  const key = String(name ?? '').trim().toLowerCase();
  if (!key) return name;
  const L = MUSCLES[lang] ? lang : 'en';
  return MUSCLES[L][key] || name;
}
