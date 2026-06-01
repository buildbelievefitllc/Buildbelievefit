#!/usr/bin/env node
/**
 * generate-assets.js — Build Believe Fit · Terminal 6 (Mobile Distribution)
 *
 * Headless, deterministic Google Play Store visual-asset generator.
 *
 * WHY THIS EXISTS: a prior browser-drone Play Store rollout looped on the
 * Console UI. This replaces that with a non-interactive, idempotent script:
 * it reads source brand images, sizes / crops / pads them to exact Play
 * Console specs, VALIDATES every output, and exits 0 (all good) or 1 (a
 * required asset failed). No prompts, no retries, no UI — safe to run in CI
 * or pipe into `fastlane supply`.
 *
 * USAGE:
 *   node generate-assets.js [options]
 *
 * OPTIONS:
 *   --config <path>    Asset source map        (default ./assets.config.json)
 *   --root <path>      Repo root for sources    (default ../../ from here)
 *   --out <path>       Output dir               (default ./dist)
 *   --locale <code>    Store listing locale     (default from config / en-US)
 *   --only <list>      Comma list: icon,feature,phone,tablet7,tablet10
 *   --no-text          Skip text overlays on the feature graphic
 *   --fastlane         Also emit a fastlane `supply` metadata tree
 *   --zip              Package dist/ into bbf-playstore-assets.zip
 *   --check            Validate-only: regenerate nothing, just audit dist/
 *   -h, --help         Show this help
 *
 * Pure ESM. Sole runtime dependency: sharp. Isolated from the repo's root
 * package.json by design (this folder has its own).
 */

import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_SPECS, BRAND } from './playstore.spec.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ utils */

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};
const log = (...a) => console.log(...a);
const ok = (m) => log(`${C.green}✓${C.reset} ${m}`);
const warn = (m) => log(`${C.yellow}!${C.reset} ${m}`);
const err = (m) => log(`${C.red}✗${C.reset} ${m}`);
const step = (m) => log(`\n${C.bold}${C.cyan}▸${C.reset} ${C.bold}${m}${C.reset}`);

function parseArgs(argv) {
  const a = {
    config: path.join(__dirname, 'assets.config.json'),
    root: path.resolve(__dirname, '..', '..'),
    out: path.join(__dirname, 'dist'),
    locale: null,
    only: null,
    text: true,
    fastlane: false,
    zip: false,
    check: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    switch (t) {
      case '--config': a.config = path.resolve(argv[++i]); break;
      case '--root': a.root = path.resolve(argv[++i]); break;
      case '--out': a.out = path.resolve(argv[++i]); break;
      case '--locale': a.locale = argv[++i]; break;
      case '--only': a.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--no-text': a.text = false; break;
      case '--fastlane': a.fastlane = true; break;
      case '--zip': a.zip = true; break;
      case '--check': a.check = true; break;
      case '-h': case '--help': printHelp(); process.exit(0); break;
      default: throw new Error(`Unknown option: ${t}`);
    }
  }
  return a;
}

function printHelp() {
  log(readHeaderHelp());
}
function readHeaderHelp() {
  return `BBF Play Store asset generator
  node generate-assets.js [--config p] [--root p] [--out p] [--locale c]
                          [--only icon,feature,phone] [--no-text]
                          [--fastlane] [--zip] [--check]`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    alpha: 1,
  };
}
function bg(spec) {
  return typeof spec.background === 'string' ? hexToRgb(spec.background) : spec.background;
}

async function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex').slice(0, 16)))
      .on('error', reject);
  });
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

/* ----------------------------------------------------------- generators */

/** Resize/pad a source image into an exact target box on a brand background. */
async function renderBox(srcPath, spec, destPath) {
  const background = bg(spec);
  let pipe = sharp(srcPath, { failOn: 'error' })
    .resize({
      width: spec.width,
      height: spec.height,
      fit: spec.fit, // 'contain' letterboxes, 'cover' crops to fill
      background,
      withoutEnlargement: false,
    });

  if (spec.format === 'png') {
    if (!spec.alpha) pipe = pipe.flatten({ background }).removeAlpha();
    pipe = pipe.png({ compressionLevel: 9, palette: false });
  } else {
    pipe = pipe.flatten({ background }).removeAlpha().jpeg({ quality: 92, mozjpeg: true });
  }
  await pipe.toFile(destPath);
}

/** Compose the 1024x500 feature graphic: brand gradient + logo + wordmark. */
async function renderFeatureGraphic(cfg, spec, destPath, withText) {
  const { width, height } = spec;
  const purple = BRAND.purple;
  const black = BRAND.matteBlack;
  const gold = BRAND.gold;

  // Diagonal purple→matte-black gradient canvas with a thin gold baseline.
  // Brand rule: black is a SURFACE here, the CTA-free hero band — purple stays
  // the load-bearing identity color.
  // Type sized to stay inside the 1024px canvas with the logo occupying the
  // left ~360px. Tested against the full "BUILD BELIEVE FIT" wordmark.
  const textBlock = withText && cfg.headline
    ? `
      <text x="392" y="236" font-family="'Bebas Neue','Barlow Condensed',Impact,sans-serif"
            font-size="46" font-weight="700" letter-spacing="1"
            fill="#ffffff">${escapeXml(cfg.headline)}</text>
      ${cfg.subhead ? `<text x="394" y="284" font-family="'Barlow Condensed',Arial,sans-serif"
            font-size="22" letter-spacing="0.5" fill="${gold}">${escapeXml(cfg.subhead)}</text>` : ''}`
    : '';

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${purple}"/>
        <stop offset="62%" stop-color="${black}"/>
        <stop offset="100%" stop-color="${black}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect x="0" y="${height - 6}" width="${width}" height="6" fill="${gold}"/>
    ${textBlock}
  </svg>`;

  const base = sharp(Buffer.from(svg)).png();

  // Logo badge on the left third, vertically centered.
  const logoSize = 280;
  const logo = await sharp(cfg.logoPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await base
    .composite([{ input: logo, left: 56, top: Math.round((height - logoSize) / 2) }])
    .flatten({ background: hexToRgb(black) })
    .removeAlpha() // Play Console rejects alpha on the feature graphic
    .png({ compressionLevel: 9 })
    .toFile(destPath);
}

/* ----------------------------------------------------------- validation */

async function validate(file, spec) {
  const problems = [];
  const meta = await sharp(file).metadata();
  const stat = await fs.stat(file);

  if (spec.width && meta.width !== spec.width) problems.push(`width ${meta.width}≠${spec.width}`);
  if (spec.height && meta.height !== spec.height) problems.push(`height ${meta.height}≠${spec.height}`);

  const fmt = meta.format === 'jpg' ? 'jpeg' : meta.format;
  if (spec.format && fmt !== spec.format) problems.push(`format ${fmt}≠${spec.format}`);

  if (spec.alpha === false && meta.hasAlpha) problems.push('has alpha (Play rejects)');
  if (spec.maxBytes && stat.size > spec.maxBytes) {
    problems.push(`size ${(stat.size / 1024).toFixed(0)}KB > ${(spec.maxBytes / 1024).toFixed(0)}KB`);
  }
  // Screenshot side + aspect limits.
  if (spec.minSide) {
    const minS = Math.min(meta.width, meta.height);
    const maxS = Math.max(meta.width, meta.height);
    if (minS < spec.minSide) problems.push(`short side ${minS} < ${spec.minSide}`);
    if (maxS > spec.maxSide) problems.push(`long side ${maxS} > ${spec.maxSide}`);
  }
  if (spec.minAspect) {
    const ar = meta.width / meta.height;
    if (ar < spec.minAspect - 1e-3 || ar > spec.maxAspect + 1e-3) {
      problems.push(`aspect ${ar.toFixed(3)} outside [${spec.minAspect.toFixed(3)}..${spec.maxAspect.toFixed(3)}]`);
    }
  }
  return { meta, size: stat.size, problems };
}

/* --------------------------------------------------------------- zip/fl */

async function makeZip(dir, zipPath) {
  // Shell out to the system `zip` if present; degrade gracefully otherwise.
  return new Promise((resolve) => {
    const p = spawn('zip', ['-r', '-q', zipPath, '.'], { cwd: dir });
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
}

/** Mirror generated assets into a `fastlane supply` metadata tree. */
async function emitFastlane(outDir, locale, generated) {
  const imgRoot = path.join(outDir, 'fastlane', 'metadata', 'android', locale, 'images');
  await fs.mkdir(imgRoot, { recursive: true });
  for (const g of generated) {
    if (!g.spec.fastlane) continue;
    if (g.spec.outDir) {
      const dir = path.join(imgRoot, g.spec.fastlane);
      await fs.mkdir(dir, { recursive: true });
      const base = `${String(g.index).padStart(2, '0')}_${path.basename(g.file)}`;
      await fs.copyFile(g.file, path.join(dir, base));
    } else {
      await fs.copyFile(g.file, path.join(imgRoot, g.spec.fastlane));
    }
  }
  return imgRoot;
}

/* ----------------------------------------------------------------- main */

async function main() {
  const args = parseArgs(process.argv);
  log(`${C.bold}Build Believe Fit · Play Store asset pipeline${C.reset} ${C.dim}(Terminal 6)${C.reset}`);

  const cfgRaw = await fs.readFile(args.config, 'utf8').catch(() => {
    throw new Error(`Config not found: ${args.config}`);
  });
  const cfg = JSON.parse(cfgRaw);
  const locale = args.locale || cfg.defaultLocale || 'en-US';
  const resolveSrc = (rel) => path.resolve(args.root, rel);

  const want = (k) => !args.only || args.only.includes(k);
  await fs.mkdir(args.out, { recursive: true });

  const generated = [];
  const results = [];

  /* ---- ICON ---- */
  if (want('icon') && cfg.icon?.source) {
    step('App icon · 512×512 PNG');
    const spec = ASSET_SPECS.icon;
    const src = resolveSrc(cfg.icon.source);
    const dest = path.join(args.out, spec.out);
    if (!args.check) {
      if (!(await exists(src))) throw new Error(`icon source missing: ${src}`);
      await renderBox(src, spec, dest);
    }
    generated.push({ key: 'icon', spec, file: dest, index: 0 });
  }

  /* ---- FEATURE GRAPHIC ---- */
  if (want('feature') && cfg.feature?.logo) {
    step('Feature graphic · 1024×500 PNG');
    const spec = ASSET_SPECS.feature;
    const dest = path.join(args.out, spec.out);
    if (!args.check) {
      const logoPath = resolveSrc(cfg.feature.logo);
      if (!(await exists(logoPath))) throw new Error(`feature logo missing: ${logoPath}`);
      await renderFeatureGraphic(
        { ...cfg.feature, logoPath },
        spec,
        dest,
        args.text,
      );
    }
    generated.push({ key: 'feature', spec, file: dest, index: 0 });
  }

  /* ---- SCREENSHOT SETS ---- */
  for (const key of ['phone', 'tablet7', 'tablet10']) {
    if (!want(key)) continue;
    const list = cfg[key] || [];
    if (!list.length) continue;
    const spec = ASSET_SPECS[key];
    step(`${spec.label}s · ${spec.width}×${spec.height} PNG (${list.length})`);
    const dir = path.join(args.out, spec.outDir);
    await fs.mkdir(dir, { recursive: true });
    let i = 0;
    for (const item of list) {
      i += 1;
      const src = resolveSrc(item.source);
      const dest = path.join(dir, `${String(i).padStart(2, '0')}.png`);
      if (!args.check) {
        if (!(await exists(src))) throw new Error(`${key} source missing: ${src}`);
        await renderBox(src, spec, dest);
      }
      generated.push({ key, spec, file: dest, index: i });
    }
    if (list.length < spec.count.min) {
      warn(`${spec.label}: ${list.length} provided, Play requires ≥ ${spec.count.min}`);
    }
    if (list.length > spec.count.max) {
      warn(`${spec.label}: ${list.length} provided, Play accepts ≤ ${spec.count.max} (extras ignored)`);
    }
  }

  /* ---- VALIDATE EVERYTHING ---- */
  step('Validating against Play Console constraints');
  let failed = 0;
  for (const g of generated) {
    if (!(await exists(g.file))) {
      err(`${g.spec.label}: missing output ${path.relative(args.out, g.file)}`);
      if (g.spec.required) failed += 1;
      continue;
    }
    const v = await validate(g.file, g.spec);
    const rel = path.relative(args.out, g.file);
    const dims = `${v.meta.width}×${v.meta.height}`;
    const kb = `${(v.size / 1024).toFixed(0)}KB`;
    if (v.problems.length) {
      err(`${rel} (${dims}, ${kb}) — ${v.problems.join('; ')}`);
      if (g.spec.required) failed += 1;
    } else {
      ok(`${rel} (${dims}, ${kb})`);
    }
    results.push({ key: g.key, file: rel, dims, bytes: v.size, problems: v.problems });
  }

  /* ---- MANIFEST ---- */
  const manifest = {
    generatedAt: new Date().toISOString(),
    packageName: cfg.packageName || null,
    locale,
    brand: BRAND,
    assets: [],
  };
  for (const g of generated) {
    if (!(await exists(g.file))) continue;
    manifest.assets.push({
      key: g.key,
      file: path.relative(args.out, g.file),
      sha256_16: await sha256(g.file),
    });
  }
  await fs.writeFile(
    path.join(args.out, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  ok(`manifest.json (${manifest.assets.length} assets)`);

  /* ---- FASTLANE LAYOUT ---- */
  if (args.fastlane && !args.check) {
    const root = await emitFastlane(args.out, locale, generated);
    ok(`fastlane supply tree → ${path.relative(args.out, root)}`);
  }

  /* ---- ZIP ---- */
  if (args.zip && !args.check) {
    const zipPath = path.join(args.out, '..', 'bbf-playstore-assets.zip');
    await fs.rm(zipPath, { force: true });
    const zipped = await makeZip(args.out, zipPath);
    if (zipped) ok(`packaged → ${path.relative(__dirname, zipPath)}`);
    else warn('`zip` not available on PATH — skipped packaging (assets still in dist/)');
  }

  log('');
  if (failed > 0) {
    err(`${failed} required asset(s) FAILED validation. Not Play-ready.`);
    process.exit(1);
  }
  ok(`${C.bold}All required assets generated & validated. Play-ready.${C.reset}`);
  log(`${C.dim}Output: ${args.out}${C.reset}`);
}

main().catch((e) => {
  err(e.message || String(e));
  process.exit(1);
});
