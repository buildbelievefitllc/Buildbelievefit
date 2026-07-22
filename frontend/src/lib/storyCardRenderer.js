// src/lib/storyCardRenderer.js
// ─────────────────────────────────────────────────────────────────────────────
// GROUPED MEDIA PASS — render a Review Bucket draft into a branded 1080×1920 Meta
// Story image (Blob). Meta Stories are 9:16 image/video only; a Digital Content
// Manager draft carries copy (hook + caption) but no baked visual, so the "Dispatch
// to Meta Stories" quick-trigger composes this on-brand story card client-side and
// hands the Blob to the bbf-studio-queue surface='story' pipeline.
//
// Brand-LOCKED (§2): BBF Purple #6a0dad, BBF Gold #f5c800; matte black #090909 is
// canvas-only (used here as the background surface, never as a brand mark); headers
// in Bebas Neue, body in Barlow Condensed (both already loaded by index.html).
// Pure canvas — no network, no dependencies, fails soft to system fonts.

const W = 1080;
const H = 1920;
const PURPLE = '#6a0dad';
const GOLD = '#f5c800';
const INK = '#090909';
const WHITE = '#f9f5ff';

// Best-effort: make sure the brand faces are ready before we paint text onto the
// canvas (an unloaded face silently falls back to the system sans, which is legible
// but off-brand). Never blocks longer than the fonts take, never throws.
async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts?.load?.('700 120px "Bebas Neue"'),
      document.fonts?.load?.('600 44px "Barlow Condensed"'),
    ]);
  } catch { /* fall back to the default sans — legible, just not on-brand */ }
}

// Greedy word-wrap for a canvas context → array of lines within maxWidth.
function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Compose the branded story card and resolve a JPEG Blob (Meta-friendly). Rejects
// only if the canvas cannot encode (no 2D context / toBlob unsupported).
export async function renderDraftStoryImage(draft = {}, { seriesColor = GOLD } = {}) {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas_2d');

  // Matte-black canvas surface (approved) + a soft purple glow up top for depth.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.16, 60, W / 2, H * 0.16, W * 0.9);
  glow.addColorStop(0, 'rgba(106,13,173,0.55)');
  glow.addColorStop(1, 'rgba(106,13,173,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const PAD = 96;
  const contentW = W - PAD * 2;

  // Top gold accent rule (brand energy without a black brand mark).
  ctx.fillStyle = GOLD;
  ctx.fillRect(PAD, 150, 190, 10);

  // BBF wordmark — Bebas, gold-accented middle word.
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 58px "Bebas Neue", sans-serif';
  ctx.textAlign = 'left';
  let x = PAD;
  const wm = [['BUILD', WHITE], ['BELIEVE', GOLD], ['FIT', WHITE]];
  for (const [word, color] of wm) {
    ctx.fillStyle = color;
    ctx.fillText(word, x, 232);
    x += ctx.measureText(word).width + 10;
  }

  // Series pill (visual theme cue) — series accent color, ink text for contrast.
  const series = String(draft.series || '').trim();
  if (series) {
    ctx.font = '600 34px "Barlow Condensed", sans-serif';
    const label = series.toUpperCase();
    const tw = ctx.measureText(label).width;
    const pillW = tw + 56;
    const pillH = 62;
    const py = 300;
    ctx.fillStyle = seriesColor || GOLD;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(PAD, py, pillW, pillH, 31); ctx.fill(); }
    else ctx.fillRect(PAD, py, pillW, pillH);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, PAD + 28, py + pillH / 2 + 2);
    ctx.textBaseline = 'alphabetic';
  }

  // Hook headline — big Bebas, word-wrapped, centered block in the mid canvas.
  const hookSize = 132;
  ctx.font = `700 ${hookSize}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  const hookLines = wrapLines(ctx, draft.hook || draft.target_angle || 'BUILD · BELIEVE · FIT', contentW).slice(0, 5);
  const hookLH = hookSize * 1.02;
  let hy = 560;
  for (const line of hookLines) {
    ctx.fillText(line, PAD, hy);
    hy += hookLH;
  }

  // Gold divider under the hook.
  ctx.fillStyle = GOLD;
  ctx.fillRect(PAD, hy + 6, 120, 8);

  // Caption body — Barlow, soft white, wrapped, trimmed to fit the lower third.
  ctx.font = '500 46px "Barlow Condensed", sans-serif';
  ctx.fillStyle = 'rgba(249,245,255,0.86)';
  const capLines = wrapLines(ctx, draft.caption || '', contentW).slice(0, 8);
  let cy = hy + 92;
  const capLH = 60;
  for (const line of capLines) {
    ctx.fillText(line, PAD, cy);
    cy += capLH;
  }

  // Footer band — purple bar with a gold CTA line + the site.
  const barH = 132;
  ctx.fillStyle = PURPLE;
  ctx.fillRect(0, H - barH, W, barH);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, H - barH, W, 8);
  ctx.font = '700 52px "Bebas Neue", sans-serif';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  ctx.fillText('BUILDBELIEVEFIT.FITNESS', PAD, H - barH / 2 + 18);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))),
        'image/jpeg',
        0.92,
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error('encode_failed'));
    }
  });
}
