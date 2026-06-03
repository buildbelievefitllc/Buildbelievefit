// frontend/scripts/bump-sw-cache.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Automates the React SPA service-worker cache-bump (CLAUDE.md §3 convention).
// Reads frontend/public/sw.js, finds `var CACHE = 'bbf-react-v<N>'`, increments
// <N>, and writes it back — so a deploy gets a clean cache break and clients
// load the freshest shell, without anyone hand-editing the version (and risking
// a typo or a forgotten bump).
//
// Usage:  npm run bump-sw            (from frontend/)
//         node scripts/bump-sw-cache.mjs
//
// Exits non-zero (and changes nothing) if the CACHE marker can't be found, so a
// silent no-op can never let a stale cache ship.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SW_PATH = resolve(here, '../public/sw.js');

// Matches:  var CACHE = 'bbf-react-v12';   (single or double quotes)
const CACHE_RE = /(var\s+CACHE\s*=\s*['"]bbf-react-v)(\d+)(['"])/;

function main() {
  let src;
  try {
    src = readFileSync(SW_PATH, 'utf8');
  } catch (e) {
    console.error(`[bump-sw] cannot read ${SW_PATH}: ${e.message}`);
    process.exit(1);
  }

  const m = src.match(CACHE_RE);
  if (!m) {
    console.error(`[bump-sw] could not find \`var CACHE = 'bbf-react-v<N>'\` in ${SW_PATH} — aborting (no change).`);
    process.exit(1);
  }

  const current = Number(m[2]);
  const next = current + 1;
  const updated = src.replace(CACHE_RE, `$1${next}$3`);
  writeFileSync(SW_PATH, updated);

  console.log(`[bump-sw] React SPA cache bumped: bbf-react-v${current} → bbf-react-v${next}`);
}

main();
