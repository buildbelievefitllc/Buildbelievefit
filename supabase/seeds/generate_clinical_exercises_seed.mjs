// supabase/seeds/generate_clinical_exercises_seed.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic seed generator for the Dynamic Prescription Engine.
// Reads the proprietary clinical library (hingelick.json) and emits an
// idempotent SQL migration that populates public.clinical_exercises.
//
//   body_part = the library category key (shoulder, lower_body, knee, neck,
//               upper_body, full_body, breathing_and_meditation)
//   type      = the per-movement type, EXCEPT every breathing_and_meditation
//               row is tagged type='mental_wellness' (CEO PHASE 2 directive:
//               "the breathing_and_meditation category is tagged explicitly as
//               mental_wellness").
//
// Usage:  node supabase/seeds/generate_clinical_exercises_seed.mjs > <migration>.sql
// Source of truth: supabase/seeds/hingelick.json
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const lib = JSON.parse(readFileSync(join(here, 'hingelick.json'), 'utf8'));

const MENTAL_WELLNESS_CATEGORY = 'breathing_and_meditation';
const sq = (s) => `'${String(s).replace(/'/g, "''")}'`;

const rows = [];
for (const [category, items] of Object.entries(lib.exercise_library)) {
  for (const ex of items) {
    const type = category === MENTAL_WELLNESS_CATEGORY ? 'mental_wellness' : ex.type;
    rows.push({ id: ex.id, name: ex.name, body_part: category, type });
  }
}

const values = rows
  .map((r) => `  (${sq(r.id)}, ${sq(r.name)}, ${sq(r.body_part)}, ${sq(r.type)})`)
  .join(',\n');

const byType = rows.reduce((acc, r) => ((acc[r.type] = (acc[r.type] || 0) + 1), acc), {});
const byPart = rows.reduce((acc, r) => ((acc[r.body_part] = (acc[r.body_part] || 0) + 1), acc), {});

const out = `-- ═══════════════════════════════════════════════════════════════════════════
-- SEED · public.clinical_exercises · Dynamic Prescription Engine library
-- ───────────────────────────────────────────────────────────────────────────
-- AUTO-GENERATED from supabase/seeds/hingelick.json by
-- supabase/seeds/generate_clinical_exercises_seed.mjs — do not hand-edit; rerun
-- the generator if the source library changes.
--
-- ${rows.length} movements across ${Object.keys(byPart).length} regions.
-- breathing_and_meditation rows are tagged type='mental_wellness' (PHASE 2).
-- Idempotent: ON CONFLICT (id) re-syncs name/body_part/type and re-activates.
--
-- Counts by type:      ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}
-- Counts by body_part: ${Object.entries(byPart).map(([k, v]) => `${k}=${v}`).join(', ')}
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.clinical_exercises (id, name, body_part, type) values
${values}
on conflict (id) do update
  set name      = excluded.name,
      body_part = excluded.body_part,
      type      = excluded.type,
      active    = true;
`;

process.stdout.write(out);
