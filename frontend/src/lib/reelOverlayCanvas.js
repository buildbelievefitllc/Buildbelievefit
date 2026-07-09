// src/lib/reelOverlayCanvas.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure Canvas 2D text-overlay renderer for the Ad Compiler pipeline. No DOM, no
// html2canvas, no live stage — draws the SAME visual spec ReelPreviewEngine.jsx /
// sovereignStudioV4.css authors in the 1080×1920 design space (brand strip,
// scrim gradient, hook + sub-line typography, bottom/center/top anchors), so a
// URL-driven compile job (no editor open) renders visually identical to what an
// operator would see live in the Video Engine tab.
//
// Output is a transparent-background 1080×1920 canvas — SovereignFoundry composes
// it with ctx.drawImage(overlay, 0, 0, W, H) OVER the footage, so only the
// gradient/strip/text paint; the video shows through everywhere else.

const W = 1080;
const H = 1920;

const HOOK_FONT_STACK = {
  bebas: "'Bebas Neue', sans-serif",
  anton: "'Anton', sans-serif",
  barlow: "'Barlow Condensed', sans-serif",
};

// Word-wrap to fit maxWidth, honoring explicit '\n' line breaks (matches the
// editor's white-space:pre-line — a hand-authored break always wins).
function wrapLines(ctx, text, maxWidth) {
  const out = [];
  for (const paragraph of String(text || '').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${line} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
      else { out.push(line); line = words[i]; }
    }
    out.push(line);
  }
  return out;
}

/**
 * Draw the branded text overlay onto a fresh 1080×1920 canvas.
 * @param {{ hookText?:string, subLineText?:string, hookFont?:'bebas'|'anton'|'barlow',
 *           hookFontSize?:number, textLayout?:'bottom'|'center'|'top', brand?:boolean }} opts
 * @returns {HTMLCanvasElement}
 */
export function renderReelOverlay({
  hookText = '', subLineText = '', hookFont = 'bebas', hookFontSize = 138, textLayout = 'bottom', brand = true,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H); // transparent — footage shows through

  // Top brand strip (purple → gold), 12px — mirrors .reel-strip-v4.
  const strip = ctx.createLinearGradient(0, 0, W, 0);
  strip.addColorStop(0, '#6a0dad'); strip.addColorStop(1, '#f5c800');
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, W, 12);

  // Bottom scrim gradient — mirrors .ovl-scrim .reel-ov-v4 (the default overlay skin).
  const scrim = ctx.createLinearGradient(0, 0, 0, H);
  scrim.addColorStop(0, 'rgba(8,6,10,0.55)');
  scrim.addColorStop(0.35, 'rgba(8,6,10,0.12)');
  scrim.addColorStop(0.55, 'rgba(8,6,10,0.25)');
  scrim.addColorStop(1, 'rgba(8,6,10,0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // Brand mark, top-left — mirrors .reel-brand-v4 (70,70).
  if (brand) {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = "700 34px 'Bebas Neue', sans-serif";
    let x = 70;
    const parts = [['BUILD', '#fff'], ['BELIEVE', '#f5c800'], ['FIT', '#fff']];
    for (const [word, color] of parts) {
      ctx.fillStyle = color;
      ctx.fillText(word, x, 70);
      x += ctx.measureText(word).width + 6;
    }
  }

  // Hook + sub-line text block — mirrors .reel-hl-v4 / .reel-sub-v4.
  const left = 70, right = 70, maxWidth = W - left - right;
  const hookLineHeight = hookFontSize * 0.94;
  const subFontSize = 40, subGap = 22;

  ctx.font = `700 ${hookFontSize}px ${HOOK_FONT_STACK[hookFont] || HOOK_FONT_STACK.bebas}`;
  const hookLines = hookText ? wrapLines(ctx, hookText.toUpperCase(), maxWidth) : [];
  const subLines = subLineText ? [subLineText] : [];

  const blockHeight = (hookLines.length * hookLineHeight)
    + (subLines.length ? subGap + subFontSize : 0);

  let top;
  if (textLayout === 'top') top = 160;
  else if (textLayout === 'center') top = (H - blockHeight) / 2;
  else top = H - 120 - blockHeight; // bottom (default) — anchored 120px off the floor

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;

  let y = top;
  ctx.font = `700 ${hookFontSize}px ${HOOK_FONT_STACK[hookFont] || HOOK_FONT_STACK.bebas}`;
  ctx.fillStyle = '#fff';
  for (const line of hookLines) { ctx.fillText(line, left, y); y += hookLineHeight; }

  if (subLines.length) {
    y += subGap;
    ctx.font = `700 ${subFontSize}px 'Barlow Condensed', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (const line of subLines) { ctx.fillText(line, left, y); y += subFontSize * 1.2; }
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  return canvas;
}

export default renderReelOverlay;
