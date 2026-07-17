#!/usr/bin/env node
// scripts/map-exercise-gifs.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Exercise-GIF ingestion mapper (NON-DESTRUCTIVE — read-only over ./videos).
//
// Scans the repo-root ./videos folder and maps GIF filenames onto the
// authorized exercise catalog (VIDEO_MAP keys in exerciseVideos.js + every
// exercise name in programData.js), then emits the runtime manifest the
// Dual-Media UI consumes: frontend/src/data/exerciseGifManifest.json.
//
// Matching pipeline per file (strongest first):
//   1. videos/manifest.json override — a hand-authored { "<filename>": "<Exercise
//      Name>" } map (also accepts the bare numeric prefix, e.g. "0001", as key).
//   2. Semantic filename parse — snake_case / kebab-case / spaced names are
//      normalized (same token rules as exerciseVideos.js) and matched exact →
//      token-subset → Levenshtein distance (bounded, never a blind guess).
//   3. Opaque filenames (the `NNNN-hash.gif` export pattern) carry ZERO semantic
//      tokens; they are reported as unmappable, NEVER force-matched.
//
// The script only ever WRITES the manifest JSON (and only without --dry). It
// never renames, moves, or deletes anything in ./videos. Exercises with no
// match simply stay absent from the manifest — the UI renders the branded
// placeholder for them (the fall-back is structural, not an error state).
//
// Usage:  node scripts/map-exercise-gifs.mjs [--dry]

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEOS_DIR = join(ROOT, 'videos');
const OUT_PATH = join(ROOT, 'frontend', 'src', 'data', 'exerciseGifManifest.json');
const OVERRIDE_PATH = join(VIDEOS_DIR, 'manifest.json');
const DRY = process.argv.includes('--dry');

// ── Catalog extraction (text-parse; the frontend sources stay untouched) ─────
function catalogNames() {
  const names = new Set();
  const videoMapSrc = readFileSync(join(ROOT, 'frontend/src/components/vault/exerciseVideos.js'), 'utf8');
  // VIDEO_MAP keys: 'Name': { … }  or  'Name': 'ytid'
  const mapBlock = videoMapSrc.split('VIDEO_MAP = {')[1].split('\n};')[0];
  for (const m of mapBlock.matchAll(/'([^']+)':\s*(?:\{|')/g)) names.add(m[1]);
  const programSrc = readFileSync(join(ROOT, 'frontend/src/components/vault/programData.js'), 'utf8');
  for (const m of programSrc.matchAll(/name:\s*'([^']+)'/g)) names.add(m[1]);
  return [...names];
}

// ── Normalizer — mirrors exerciseVideos.js normalize() token rules, PLUS
// mapper-only extensions for matching the external ExerciseDB vocabulary
// (safe: the runtime resolver exact-matches manifest keys, which are verbatim
// catalog names — normalizer divergence never reaches the athlete-facing path):
//   • lat → lateral        ("Lat Pulldown" vs ExerciseDB "cable bar lateral pulldown")
//   • stop heavy/bent/over ("Heavy Leg Press" ≙ leg press; "bent over row" ≙ row —
//     keeps the honest variant from losing to a wrong movement like UPRIGHT row)
const EX_ABBR = {
  db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell', ohp: 'overhead press',
  rdl: 'romanian deadlift', rdls: 'romanian deadlift', bw: 'bodyweight',
  ext: 'extension', exts: 'extension', alt: 'alternating', sl: 'single leg',
  tri: 'triceps', tricep: 'triceps', bi: 'biceps', bicep: 'biceps', quad: 'quadriceps', mts: 'machine',
  lat: 'lateral',
};
const EX_SYN = { rope: 'cable', single: 'one', singlearm: 'one', onearm: 'one', onearmed: 'one', chinup: 'pullup' };
const EX_STOP = { the: 1, a: 1, with: 1, and: 1, or: 1, your: 1, to: 1, of: 1, for: 1, heavy: 1, bent: 1, over: 1 };
function singular(w) {
  if (w === 'press' || w === 'triceps' || w === 'biceps' || w === 'abs') return w;
  if (/(ches|shes|sses|xes)$/.test(w)) return w.replace(/es$/, '');
  if (/ies$/.test(w)) return w.replace(/ies$/, 'y');
  if (/(flyes|flye)$/.test(w)) return 'fly';
  if (/s$/.test(w) && !/(us|ss|is)$/.test(w)) return w.replace(/s$/, '');
  return w;
}
function normalize(name) {
  let s = String(name ?? '').toLowerCase();
  s = s.replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const out = [];
  for (const tok of s.split(' ')) {
    for (const raw of (EX_ABBR[tok] || tok).split(' ')) {
      if (!raw || EX_STOP[raw]) continue;
      let p = singular(raw);
      p = EX_SYN[p] || p;
      if (p && !EX_STOP[p]) out.push(p);
    }
  }
  return out.filter((t, i) => t !== out[i - 1]);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// A filename stem is OPAQUE when it is a numeric export index + random hash
// (e.g. "0001-2gPfomN") — it carries no exercise semantics at all.
const OPAQUE_RE = /^\d{1,6}[-_][A-Za-z0-9]{4,12}$/;

// Filename stem → candidate exercise phrase ("barbell_bench-press" → "barbell bench press").
function stemToPhrase(stem) {
  return stem
    .replace(/^\d+[-_]?/, '')            // leading export index
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\d{2,}\b/g, ' ')         // stray numeric ids
    .replace(/\s+/g, ' ')
    .trim();
}

// External-vocabulary synonyms (mapper-side ONLY — the runtime resolver keeps
// the canonical normalizer): ExerciseDB names machine movements "lever …" and
// "sled …"; our catalog says "Machine". Applied after the shared token rules.
const SRC_SYN = { lever: 'machine', sled: 'machine' };
function srcTokens(phrase) {
  // Keep parenthetical content as TOKENS for source names — in ExerciseDB the
  // parens carry the variant ("push-up (bosu ball)", "(v-bar)"), and dropping
  // them would let a variant tie the plain movement on exact score.
  return normalize(String(phrase).replace(/[()]/g, ' ')).map((t) => SRC_SYN[t] || t);
}

// Score one candidate source phrase against one catalog entry.
//   3.0        exact normalized-name equality
//   1.5 – 2.0  token-subset over UNIQUE tokens (every token of the shorter side
//              present in the longer, ≥50% coverage; score = 1 + coverage).
//              Unique-set intersection kills duplicate-token inflation ("sled
//              calf press on leg press" must NOT satisfy "heavy leg press").
//   <1.0       bounded Levenshtein (typos only, never a guess)
//   0          no admissible match
function scorePair(srcToks, e) {
  if (!srcToks.length || !e.toks.length) return 0;
  const srcNorm = srcToks.join(' ');
  if (srcNorm === e.norm) return 3;
  const a = [...new Set(srcToks)], b = [...new Set(e.toks)];
  const inter = a.filter((t) => b.includes(t)).length;
  const ratio = inter / Math.min(a.length, b.length);
  const cov = inter / Math.max(a.length, b.length);
  if (ratio === 1 && cov >= 0.5) return 1 + cov;
  const d = levenshtein(srcNorm, e.norm);
  if (d <= Math.max(2, Math.floor(srcNorm.length * 0.15))) return 1 - d / srcNorm.length;
  return 0;
}

// ── Run ──────────────────────────────────────────────────────────────────────
if (!existsSync(VIDEOS_DIR)) {
  console.error(`✗ ./videos not found at ${VIDEOS_DIR}`);
  process.exit(1);
}
const files = readdirSync(VIDEOS_DIR).filter((f) => /\.gif$/i.test(f)).sort();
const overrides = existsSync(OVERRIDE_PATH) ? JSON.parse(readFileSync(OVERRIDE_PATH, 'utf8')) : {};
const names = catalogNames();
const index = names.map((name) => { const toks = normalize(name); return { name, toks, norm: toks.join(' ') }; });

// ── Candidate pool: every file contributes ONE source phrase ─────────────────
// (override name from videos/manifest.json — e.g. the ExerciseDB index — or a
// semantic filename parse). Opaque NNNN-hash stems with no override contribute
// nothing and are counted, never force-matched.
const sources = []; // { file, phrase, kind, toks }
let opaque = 0, unparsed = 0;
for (const file of files) {
  const stem = file.replace(/\.gif$/i, '');
  const prefix = (stem.match(/^(\d+)/) || [])[1] || null;
  const override = overrides[file] ?? (prefix != null ? overrides[prefix] : undefined);
  if (override) {
    sources.push({ file, phrase: String(override), kind: 'override', toks: srcTokens(override) });
    continue;
  }
  if (OPAQUE_RE.test(stem)) { opaque++; continue; }
  const phrase = stemToPhrase(stem);
  if (!phrase) { unparsed++; continue; }
  sources.push({ file, phrase, kind: 'filename', toks: srcTokens(phrase) });
}

// ── Global best-score assignment ─────────────────────────────────────────────
// For each catalog exercise pick the SINGLE best-scoring source across the
// whole pool (not first-file-wins): the plain movement beats its "assisted /
// one-arm / with-twist" variants because exact equality (3.0) and higher
// coverage outrank them. Two catalog names may share one file (e.g. `Leg
// Press` and `Heavy Leg Press` → the same sled-press loop) — that is correct.
const matched = {};          // "<Exercise Name>" -> "<filename>"
const matchDetail = [];
const sourceUsed = new Set();
for (const e of index) {
  let best = null, bestScore = 0;
  for (const s of sources) {
    const sc = scorePair(s.toks, e);
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  if (best) {
    matched[e.name] = best.file;
    sourceUsed.add(best.file);
    matchDetail.push({ file: best.file, name: e.name, from: best.phrase, score: bestScore.toFixed(2) });
  }
}
const overrideMisses = sources.filter((s) => s.kind === 'override' && !sourceUsed.has(s.file)).length;

const unmatchedExercises = names.filter((n) => !matched[n]).sort();
const manifest = {
  _generated_by: 'scripts/map-exercise-gifs.mjs — do not hand-edit; add overrides in videos/manifest.json and re-run',
  source_dir: 'videos',
  total_files: files.length,
  matched,                                   // Exercise Name -> gif filename
  matched_count: Object.keys(matched).length,
  opaque_files: opaque,                      // NNNN-hash exports: no semantic name to parse
  unparsed_files: unparsed,
  unmatched_exercises: unmatchedExercises,   // render the branded placeholder
};

console.log(`— exercise-GIF ingestion report ————————————————`);
console.log(`  gif files scanned      : ${files.length}`);
console.log(`  catalog exercises      : ${names.length}`);
console.log(`  matched                : ${manifest.matched_count}`);
console.log(`  opaque filenames       : ${opaque}  (NNNN-hash pattern — need videos/manifest.json overrides)`);
console.log(`  override misses        : ${overrideMisses}  (named movements outside the authorized catalog)`);
console.log(`  unparsed / no match    : ${unparsed}`);
console.log(`  exercises w/o gif      : ${unmatchedExercises.length}  → branded placeholder`);
for (const d of matchDetail.slice(0, 25)) console.log(`    ✓ ${d.file} → ${d.name} [${d.via}]`);
if (matchDetail.length > 25) console.log(`    … +${matchDetail.length - 25} more`);

if (DRY) {
  console.log(`\n(dry run — ${OUT_PATH} not written)`);
} else {
  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n✓ wrote ${OUT_PATH}`);
}
