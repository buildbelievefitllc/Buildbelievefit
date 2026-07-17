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

// ── Normalizer — mirrors exerciseVideos.js normalize() token rules ───────────
const EX_ABBR = {
  db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell', ohp: 'overhead press',
  rdl: 'romanian deadlift', rdls: 'romanian deadlift', bw: 'bodyweight',
  ext: 'extension', exts: 'extension', alt: 'alternating', sl: 'single leg',
  tri: 'triceps', tricep: 'triceps', bi: 'biceps', bicep: 'biceps', quad: 'quadriceps', mts: 'machine',
};
const EX_SYN = { rope: 'cable', single: 'one', singlearm: 'one', onearm: 'one', onearmed: 'one', chinup: 'pullup' };
const EX_STOP = { the: 1, a: 1, with: 1, and: 1, or: 1, your: 1, to: 1, of: 1, for: 1 };
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

function bestMatch(phrase, index) {
  const toks = normalize(phrase);
  if (!toks.length) return null;
  const key = toks.join(' ');
  // exact normalized
  for (const e of index) if (e.norm === key) return { name: e.name, via: 'exact', score: 1 };
  // safe token-subset (all phrase tokens present, majority coverage)
  let best = null, bestScore = 0;
  for (const e of index) {
    const inter = toks.filter((t) => e.toks.includes(t)).length;
    const ratio = inter / Math.min(toks.length, e.toks.length);
    const cov = inter / Math.max(toks.length, e.toks.length);
    if (ratio === 1 && cov >= 0.5 && ratio + cov > bestScore) { bestScore = ratio + cov; best = e.name; }
  }
  if (best) return { name: best, via: 'token-subset', score: bestScore / 2 };
  // bounded string distance — accepts only near-identical strings (typos, not guesses)
  let bd = null, bdDist = Infinity;
  for (const e of index) {
    const d = levenshtein(key, e.norm);
    if (d < bdDist) { bdDist = d; bd = e.name; }
  }
  if (bd && bdDist <= Math.max(2, Math.floor(key.length * 0.15))) {
    return { name: bd, via: `levenshtein:${bdDist}`, score: 1 - bdDist / key.length };
  }
  return null;
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

const matched = {};          // "<Exercise Name>" -> "<filename>"
const matchDetail = [];
let opaque = 0, unparsed = 0;

for (const file of files) {
  const stem = file.replace(/\.gif$/i, '');
  const prefix = (stem.match(/^(\d+)/) || [])[1] || null;
  const override = overrides[file] ?? (prefix != null ? overrides[prefix] : undefined);
  if (override) {
    const hit = index.find((e) => e.name === override) || null;
    if (hit && !matched[hit.name]) { matched[hit.name] = file; matchDetail.push({ file, name: hit.name, via: 'override' }); }
    else if (!hit) console.warn(`! override for ${file} names "${override}" — not in the authorized catalog, skipped`);
    continue;
  }
  if (OPAQUE_RE.test(stem)) { opaque++; continue; }
  const phrase = stemToPhrase(stem);
  const hit = phrase ? bestMatch(phrase, index) : null;
  if (hit && !matched[hit.name]) { matched[hit.name] = file; matchDetail.push({ file, name: hit.name, via: hit.via }); }
  else if (!hit) unparsed++;
}

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
