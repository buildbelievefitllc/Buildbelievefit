// scripts/build-coach-static-manifest.mjs
// ═══════════════════════════════════════════════════════════════════════════
// MARGIN GUARD — Static Coach-Cue Manifest builder (NO API; pure data assembly).
// ───────────────────────────────────────────────────────────────────────────
// Single source of truth for the STATIC EXERCISE LIBRARY (program form cues +
// prehab drills). Run ONCE whenever the program catalog, the prehab matrix, or
// the authored program cues change. Emits two artifacts:
//
//   1. frontend/src/data/coachStaticManifest.json  — LEAN client resolver map
//      (normalized-name → slug for program + prehab, plus the full slug list and
//      per-slug kind). NO script text ships to the browser.
//
//   2. supabase/functions/bbf-bake-coach-static/scripts.json — the BAKER table
//      (slug → { en, es, pt } spoken script). Consumed by the one-time ElevenLabs
//      baker and the repo sync script; never shipped to the client.
//
// Program cue scripts are AUTHORED (Akeem brand voice) in program_cues_draft.json
// / the committed PROGRAM_CUES fallback. Prehab cue scripts are DERIVED from the
// already-trilingual prehabDiagnosticMatrix.json — zero hand-authoring, zero drift.
//
// Usage:  node scripts/build-coach-static-manifest.mjs
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');

// ── helpers ──────────────────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── PROGRAM: canonical movement → the raw catalog names that collapse into it ──
// Every exercise name in programData.js PROGRAM_CATALOG must resolve here (the
// build fails loudly otherwise), guaranteeing the program tab is 100% static.
const PROGRAM_CANON = [
  ['biceps-curl', ['biceps curls', 'bicep curl', 'dumbbell bicep curls']],
  ['hammer-curl', ['hammer curls']],
  ['preacher-curl', ['preacher curls']],
  ['triceps-pushdown', ['triceps pushdowns', 'tricep cable pushdowns', 'rope tricep pushdowns']],
  ['overhead-triceps-extension', ['overhead triceps extension', 'triceps overhead extension', 'triceps extension']],
  ['shoulder-press', ['shoulder press', 'dumbbell overhead press', 'seated db shoulder press', 'shoulder circuit']],
  ['lateral-raise', ['lateral raises']],
  ['face-pull', ['face pulls']],
  ['lat-pulldown', ['lat pulldown', 'lat pulldowns', 'mts pulldown']],
  ['seated-cable-row', ['seated cable rows', 'seated row']],
  ['single-arm-db-row', ['single arm db rows']],
  ['back-extension', ['back extension', 'back extensions']],
  ['chest-press', ['chest press', 'dumbbell chest press', 'db flat bench press']],
  ['incline-press', ['incline press', 'incline db press', 'incline dumbbell press']],
  ['chest-fly', ['dumbbell flyes', 'machine chest flys']],
  ['hip-thrust', ['hip thrust', 'hip thrusts', 'barbell or db hip thrusts']],
  ['romanian-deadlift', ['romanian deadlifts', 'romanian deadlifts rdls']],
  ['cable-pull-through', ['cable pull throughs']],
  ['hip-abduction', ['hip abduction', 'hip abductions', 'hip abductors', 'abductor machine']],
  ['cable-hip-extension', ['cable hip extension', 'reverse kickbacks']],
  ['bulgarian-split-squat', ['bulgarian split squats']],
  ['goblet-squat', ['goblet squats']],
  ['squat-variation', ['squat variations']],
  ['hack-squat', ['hack squats']],
  ['leg-press', ['leg press', 'heavy leg press']],
  ['leg-extension', ['leg extensions']],
  ['leg-curl', ['leg curls', 'hamstring curls', 'seated leg curls']],
  ['calf-raise', ['calf raises', 'seated calf raises']],
  ['walking-lunge', ['walking lunges']],
  ['plank', ['plank', 'planks']],
  ['russian-twist', ['russian twists']],
  ['bird-dog', ['bird-dogs']],
  ['supported-knee-raise', ['supported knee raises']],
  ['heel-tap', ['heel taps']],
  ['abs-crunch', ['abs', 'abdominal crunches', 'abs circuit']],
];

async function loadProgramCatalog() {
  const mod = await import(path.join(FRONTEND, 'src/components/vault/programData.js'));
  return mod.PROGRAM_CATALOG;
}

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Authored program cues: prefer the scratchpad draft if present, else the
// committed fallback that lives next to this script.
function loadProgramCues() {
  const draft = process.env.PROGRAM_CUES_DRAFT
    || path.join(ROOT, 'scripts', 'program_cues.authored.json');
  if (fs.existsSync(draft)) return loadJSON(draft);
  throw new Error(`Authored program cues not found at ${draft}. Provide PROGRAM_CUES_DRAFT or commit scripts/program_cues.authored.json`);
}

// Compose a tight, spoken prehab drill cue from the matrix localization: the
// movement name + its top two cues. Kept short so the synthesized clip stays
// light (repo-static). Strips list semantics into flowing speech.
function prehabScriptFromDrill(L) {
  const name = String(L?.name || '').trim();
  const cues = Array.isArray(L?.cues) ? L.cues.filter(Boolean).slice(0, 2) : [];
  const parts = [name, ...cues].map((s) => String(s).trim().replace(/[.\s]+$/, '')).filter(Boolean);
  return parts.join('. ') + '.';
}

async function main() {
  const PROGRAM_CATALOG = await loadProgramCatalog();
  const MATRIX = loadJSON(path.join(FRONTEND, 'src/data/prehabDiagnosticMatrix.json'));
  const PROGRAM_CUES = loadProgramCues();

  const scripts = {};                 // slug -> { en, es, pt }   (baker)
  const programMap = {};              // normName -> slug         (client resolver)
  const prehabMap = {};               // normName -> slug         (client resolver)
  const kind = {};                    // slug -> 'program' | 'prehab'

  // ── PROGRAM ──────────────────────────────────────────────────────────────
  const alias2slug = new Map();
  for (const [slug, aliases] of PROGRAM_CANON) for (const a of aliases) alias2slug.set(norm(a), slug);

  // Coverage check: every catalog movement must map (Cardio excluded — it is a
  // modality, not a coached lift, and carries no static form cue).
  const unmapped = new Set();
  for (const persona of Object.keys(PROGRAM_CATALOG)) {
    for (const day of PROGRAM_CATALOG[persona]) {
      for (const ex of (day.exercises || [])) {
        const n = norm(ex.name);
        if (n === 'cardio') continue;
        if (!alias2slug.has(n)) unmapped.add(ex.name);
      }
    }
  }
  if (unmapped.size) {
    throw new Error(`PROGRAM_CANON missing coverage for: ${[...unmapped].join(', ')}`);
  }

  for (const [slug, aliases] of PROGRAM_CANON) {
    const cue = PROGRAM_CUES[slug];
    if (!cue || !cue.en || !cue.es || !cue.pt) {
      throw new Error(`Authored program cue missing/incomplete for slug "${slug}"`);
    }
    scripts[slug] = { en: cue.en.trim(), es: cue.es.trim(), pt: cue.pt.trim() };
    kind[slug] = 'program';
    for (const a of aliases) programMap[norm(a)] = slug;
  }

  // ── PREHAB (derived from the trilingual diagnostic matrix) ────────────────
  for (const node of MATRIX) {
    for (const drill of (node.prescription?.drills || [])) {
      const enName = drill.localization?.en?.name || drill.type;
      if (!enName) continue;
      const slug = `prehab-${slugify(enName)}`;
      if (scripts[slug]) { prehabMap[norm(enName)] = slug; continue; } // dedupe across nodes
      const en = prehabScriptFromDrill(drill.localization?.en);
      const es = prehabScriptFromDrill(drill.localization?.es || drill.localization?.en);
      const pt = prehabScriptFromDrill(drill.localization?.pt || drill.localization?.en);
      scripts[slug] = { en, es, pt };
      kind[slug] = 'prehab';
      prehabMap[norm(enName)] = slug;
    }
  }

  const slugs = Object.keys(scripts).sort();

  // ── emit client manifest (lean — no scripts) ─────────────────────────────
  const clientManifest = {
    _comment: 'GENERATED by scripts/build-coach-static-manifest.mjs — do not edit by hand.',
    program: programMap,
    prehab: prehabMap,
    kind,
    slugs,
  };
  const clientPath = path.join(FRONTEND, 'src/data/coachStaticManifest.json');
  fs.writeFileSync(clientPath, JSON.stringify(clientManifest, null, 2) + '\n');

  // ── emit baker scripts (driver-readable JSON) ─────────────────────────────
  // The baker edge fn is a stateless synth-proxy: the LOCAL one-shot driver
  // (scripts/bake-coach-static.mjs) reads this table, batches the cues, and POSTs
  // the text to the baker — so the scripts never have to be bundled into the
  // deployed function. Source text, committed + reproducible.
  const bakerPath = path.join(ROOT, 'scripts', 'coach-static-scripts.json');
  fs.writeFileSync(bakerPath, JSON.stringify(scripts, null, 2) + '\n');

  const nProgram = slugs.filter((s) => kind[s] === 'program').length;
  const nPrehab = slugs.filter((s) => kind[s] === 'prehab').length;
  console.log(`✓ manifest built: ${slugs.length} slugs (${nProgram} program · ${nPrehab} prehab) → ${slugs.length * 3} clips`);
  console.log(`  client → ${path.relative(ROOT, clientPath)}`);
  console.log(`  driver → ${path.relative(ROOT, bakerPath)}`);
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
