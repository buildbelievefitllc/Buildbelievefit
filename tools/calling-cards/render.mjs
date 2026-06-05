// tools/calling-cards/render.mjs
// ─────────────────────────────────────────────────────────────────────────────
// BBF Calling-Card renderer — headless 4:5 (1080×1350) PNG generator.
//
// Faithfully reproduces the visual architecture of bbf-100-card-admap.html
// (the CEO-supplied blueprint): per-palette accents over the LOCKED brand
// foundation — BBF Purple #6a0dad + Victory Gold #f5c800, Bebas Neue headers,
// Barlow Condensed body (CLAUDE.md §2). Matte black stays a canvas only.
//
// Pure-Skia render via @napi-rs/canvas (no Chromium). Reads ./rows.json (an array
// of bbf_calling_cards_batch_v1 rows) → writes ./out/<id>.png for each.
// Headline markup: <br> = line break; <span class='yl|pl|gl|bl|or|cy|tl'>…</span>
// = colored run (mapped to the blueprint's accent palette).

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const F = (p) => join(__dir, p);

const W = 1080, H = 1350;            // 4:5 — matches blueprint .card aspect-ratio
const PAD = 76;

GlobalFonts.registerFromPath(F('fonts/BebasNeue-Regular.ttf'), 'Bebas Neue');
GlobalFonts.registerFromPath(F('fonts/BarlowCondensed-Medium.ttf'), 'BC Medium');
GlobalFonts.registerFromPath(F('fonts/BarlowCondensed-SemiBold.ttf'), 'BC SemiBold');
GlobalFonts.registerFromPath(F('fonts/BarlowCondensed-Bold.ttf'), 'BC Bold');

// ── palette map (verbatim from blueprint PAL) ────────────────────────────────
const PAL = {
  purDeep: { bg: [['#0d0118', 0], ['#12001e', .55], ['#000000', 1]], tbar: ['#6a0dad', '#f5c800'], eye: '#8b1abf', glow: 'rgba(106,13,173,0.32)', rule: '#f5c800' },
  purMid:  { bg: [['#0d0020', 0], ['#000000', 1]], tbar: ['#6a0dad'], eye: '#8b1abf', glow: 'rgba(106,13,173,0.25)', rule: '#f5c800' },
  blue:    { bg: [['#001020', 0], ['#000000', 1]], tbar: ['#38bdf8', '#6a0dad'], eye: '#38bdf8', glow: 'rgba(56,189,248,0.12)', rule: '#38bdf8' },
  cyan:    { bg: [['#001518', 0], ['#000000', 1]], tbar: ['#00e5ff', '#6a0dad'], eye: '#00e5ff', glow: 'rgba(0,229,255,0.10)', rule: '#00e5ff' },
  teal:    { bg: [['#00201c', 0], ['#000000', 1]], tbar: ['#2dd4bf', '#6a0dad'], eye: '#2dd4bf', glow: 'rgba(45,212,191,0.12)', rule: '#2dd4bf' },
  green:   { bg: [['#001a08', 0], ['#000000', 1]], tbar: ['#4ade80', '#f5c800'], eye: '#4ade80', glow: 'rgba(74,222,128,0.12)', rule: '#4ade80' },
  orange:  { bg: [['#1a0800', 0], ['#000000', 1]], tbar: ['#fb923c', '#f5c800'], eye: '#fb923c', glow: 'rgba(251,146,60,0.10)', rule: '#fb923c' },
  yellow:  { solid: '#f5c800', yl: true, rule: '#6a0dad', eye: 'rgba(0,0,0,0.5)' },
  border:  { solid: '#000000', border: true, tbar: ['#6a0dad', '#f5c800'], eye: '#f5c800', glow: 'rgba(245,200,0,0.06)', rule: '#f5c800' },
};
const SPAN = { yl: '#f5c800', pl: '#8b1abf', gl: '#4ade80', bl: '#38bdf8', or: '#fb923c', cy: '#00e5ff', tl: '#2dd4bf' };

const ENT = { '&bull;': '•', '&amp;': '&', '&nbsp;': ' ', '&#39;': '’', '&apos;': '’', '&quot;': '"', '&lt;': '<', '&gt;': '>' };
const decode = (s) => String(s).replace(/&bull;|&amp;|&nbsp;|&#39;|&apos;|&quot;|&lt;|&gt;/g, (m) => ENT[m]);

// Parse markup into lines of colored runs. `cls→color` resolves a span class.
function parseRuns(html, baseColor, resolve) {
  const src = decode(String(html)).replace(/<br\s*\/?>/gi, '\n');
  const re = /(<span[^>]*class=['"]?(\w+)['"]?[^>]*>)|(<strong>)|(<\/span>|<\/strong>)|([^<]+)/gi;
  const lines = [[]]; let color = baseColor, m;
  while ((m = re.exec(src))) {
    if (m[1]) color = resolve(m[2]) || baseColor;
    else if (m[3]) color = resolve('__strong') || baseColor;
    else if (m[4]) color = baseColor;
    else {
      const parts = m[5].split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) lines.push([]);
        if (parts[i] !== '') lines[lines.length - 1].push({ text: parts[i], color });
      }
    }
  }
  return lines.filter((ln) => ln.length);
}

function spaced(ctx, text, x, y, sp, align = 'left') {
  const chars = [...text]; let total = 0;
  for (const c of chars) total += ctx.measureText(c).width + sp;
  total = Math.max(0, total - sp);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (const c of chars) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp; }
  return total;
}
const runWidth = (ctx, runs) => runs.reduce((s, r) => s + ctx.measureText(r.text).width, 0);

function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderCard(row, idx) {
  const p = PAL[row.color_palette] || PAL.purDeep;
  const yl = !!p.yl;
  const ink = {
    base:   yl ? '#0a0a0a' : '#f9f5ff',
    body:   yl ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.62)',
    strong: yl ? '#000000' : '#ffffff',
    brand:  yl ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.26)',
    accent: yl ? '#6a0dad' : '#f5c800',          // BELIEVE + highlight foundation
    num:    yl ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.18)',
    cta:    yl ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.34)',
  };
  const spanResolve = (cls) => cls === '__strong' ? ink.base : (yl ? '#6a0dad' : SPAN[cls]);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // background
  if (p.solid) { ctx.fillStyle = p.solid; ctx.fillRect(0, 0, W, H); }
  else {
    const g = ctx.createLinearGradient(W * 0.18, 0, W * 0.82, H);
    for (const [c, s] of p.bg) g.addColorStop(s, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // glow (bottom-right)
  if (p.glow) {
    const gl = ctx.createRadialGradient(W * 0.86, H * 0.84, 0, W * 0.86, H * 0.84, W * 0.72);
    gl.addColorStop(0, p.glow); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  }
  // top bar
  if (p.tbar) {
    let tb;
    if (p.tbar.length > 1) { tb = ctx.createLinearGradient(0, 0, W, 0); tb.addColorStop(0, p.tbar[0]); tb.addColorStop(1, p.tbar[1]); }
    else tb = p.tbar[0];
    ctx.fillStyle = tb; ctx.fillRect(0, 0, W, 9);
  }

  // number (top-right)
  ctx.font = "40px 'Bebas Neue'"; ctx.fillStyle = ink.num; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right'; ctx.fillText(String(idx + 1).padStart(2, '0'), W - PAD, PAD + 16); ctx.textAlign = 'left';

  // eye label  →  BBF • {eye_label}
  ctx.font = "30px 'BC Bold'"; ctx.fillStyle = p.eye || ink.accent;
  const eyeY = PAD + 14;
  spaced(ctx, ('BBF • ' + decode(row.eye_label || '')).toUpperCase(), PAD, eyeY + 14, 2);

  // foot lockup (bottom): BUILD BELIEVE FIT  +  cta
  const footY = H - PAD;
  ctx.font = "34px 'Bebas Neue'"; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink.brand; let bx = PAD;
  bx += spaced(ctx, 'BUILD ', bx, footY, 2);
  ctx.fillStyle = ink.accent; bx += spaced(ctx, 'BELIEVE ', bx, footY, 2);
  ctx.fillStyle = ink.brand; spaced(ctx, 'FIT', bx, footY, 2);
  ctx.font = "30px 'BC Bold'"; ctx.fillStyle = ink.cta; ctx.textAlign = 'right';
  ctx.fillText(decode(row.cta || 'Link in bio').toUpperCase(), W - PAD, footY); ctx.textAlign = 'left';

  // ── middle block: headline + rule + body, vertically centered in the gap ──
  const maxW = W - PAD * 2;
  const BODY_PX = 38, BODY_LH = 50;
  const hlines = parseRuns(row.headline, ink.base, spanResolve);
  const bodyText = decode(String(row.body || '')).replace(/<\/?strong>/gi, '');
  let size = 150; const minSize = 70, lh = 0.92;
  const regionTop = eyeY + 64, regionBot = footY - 70;

  const wrapBody = () => { ctx.font = `${BODY_PX}px 'BC Medium'`; return wrapText(ctx, bodyText, maxW); };
  let body = wrapBody();
  const fits = () => {
    ctx.font = `${size}px 'Bebas Neue'`;
    const widest = Math.max(...hlines.map((ln) => runWidth(ctx, ln)));
    const headH = hlines.length * size * lh;
    return widest <= maxW && (headH + 34 + body.length * BODY_LH) <= (regionBot - regionTop);
  };
  while (size > minSize && !fits()) size -= 2;

  const headH = hlines.length * size * lh;
  const blockH = headH + 34 + body.length * BODY_LH;
  let y = regionTop + Math.max(0, (regionBot - regionTop - blockH) / 2);

  // headline
  ctx.font = `${size}px 'Bebas Neue'`; ctx.textBaseline = 'top';
  for (const ln of hlines) {
    let lx = PAD;
    for (const run of ln) { ctx.fillStyle = run.color; ctx.fillText(run.text, lx, y); lx += ctx.measureText(run.text).width; }
    y += size * lh;
  }
  ctx.textBaseline = 'alphabetic';

  // rule
  y += 22; ctx.fillStyle = p.rule || ink.accent; ctx.fillRect(PAD, y, 70, 6); y += 36;

  // body
  ctx.font = `${BODY_PX}px 'BC Medium'`; ctx.fillStyle = ink.body; ctx.textBaseline = 'top';
  for (const ln of body) { ctx.fillText(ln, PAD, y); y += BODY_LH; }
  ctx.textBaseline = 'alphabetic';

  // border palette → gold edge
  if (p.border) { ctx.strokeStyle = '#f5c800'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, W - 4, H - 4); }

  return canvas;
}

// ── batch driver ──────────────────────────────────────────────────────────────
const rows = JSON.parse(readFileSync(F('rows.json'), 'utf8'));
mkdirSync(F('out'), { recursive: true });
let n = 0;
for (const row of rows) {
  const png = renderCard(row, n).toBuffer('image/png');
  writeFileSync(F(join('out', `${row.id || 'card-' + n}.png`)), png);
  n++;
}
console.log(`✅ ${n} card(s) rendered → tools/calling-cards/out/  (4:5, 1080×1350)`);
