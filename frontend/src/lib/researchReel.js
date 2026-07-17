// src/lib/researchReel.js
// ─────────────────────────────────────────────────────────────────────────────
// THE RESEARCH REEL FOUNDRY — Coach Lab's client-side branded-video renderer.
//
// Turns one research study + its Coach-Akeem narration into a shareable 9:16
// MP4/WebM: a branded motion card (BBF wordmark, category chip, title, key
// takeaway) with karaoke captions synced to the voice, exported to a blob the
// founder previews and downloads.
//
// WHY NOT SovereignFoundry: the Studio's WebCodecs foundry composites over
// UPLOADED footage (it throws `no_footage` without a clip). A research reel has
// no footage — it's a generated brand card — so this is a separate, self-
// contained renderer that never touches the Studio path. It captures a canvas
// stream + the narration audio via MediaRecorder (realtime, one pass) rather
// than an offline encode: simpler, safe, and perfect for preview+download
// (no social-post faststart requirement here).
//
// REUSE: karaoke timing comes from the SAME captionState() the Studio + Language
// Lab use (captionTiming.js), so captions read consistently across the app.
//
// GRACEFUL FLOOR: browsers without MediaRecorder / captureStream / AudioContext
// throw 'unsupported_browser' — the caller shows a "use Chrome to render" notice
// and the narration audio is still available on its own.

import { captionState } from './captionTiming.js';

// LOCKED brand (§2). Matte black canvas is an approved surface here.
const BRAND = {
  purple: '#6a0dad',
  gold: '#f5c800',
  goldSoft: '#f5cf60',
  ink: '#090909',
  white: '#ffffff',
  mute: 'rgba(249,245,255,0.62)',
};

// 9:16 at 720×1280 — realtime canvas capture stays smooth here; 1080p drops
// frames on mid-tier laptops during a live MediaRecorder pass.
const W = 720;
const H = 1280;
const FPS = 30;

export function reelRenderSupported() {
  return typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && (typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined');
}

// Pick the best container/codec the browser will actually record. MP4 first
// (Safari / newer Chrome), then VP9/Opus WebM, then a bare WebM fallback —
// mirrors the Studio's codec-preference philosophy.
function pickMime() {
  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const m of candidates) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* keep trying */ }
  }
  return 'video/webm';
}

// Greedy word-wrap for a given font, returns an array of lines.
function wrapLines(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(trial).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = trial;
  }
  if (cur) lines.push(cur);
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

// One composited frame at voice-time t (seconds), progress p (0..1).
function drawFrame(ctx, { title, takeaway, category, words, t, p }) {
  // ── ground: matte black with a slow purple→gold diagonal breathe ──
  ctx.fillStyle = BRAND.ink;
  ctx.fillRect(0, 0, W, H);
  const shift = (Math.sin(t * 0.35) + 1) / 2; // 0..1 slow oscillation
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `rgba(106,13,173,${0.42 + shift * 0.18})`);
  g.addColorStop(0.55, 'rgba(9,9,9,0.15)');
  g.addColorStop(1, `rgba(245,200,0,${0.06 + (1 - shift) * 0.06})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // top gold hairline
  ctx.fillStyle = BRAND.gold;
  ctx.fillRect(0, 0, W, 6);

  // ── wordmark ──
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = "700 34px 'Bebas Neue','Barlow Condensed',sans-serif";
  ctx.fillStyle = BRAND.white;
  ctx.fillText('BUILD', 54, 92);
  const bw = ctx.measureText('BUILD ').width;
  ctx.fillStyle = BRAND.goldSoft;
  ctx.fillText('BELIEVE', 54 + bw, 92);
  const bbw = bw + ctx.measureText('BELIEVE ').width;
  ctx.fillStyle = BRAND.white;
  ctx.fillText('FIT', 54 + bbw, 92);
  ctx.font = "600 15px 'Barlow Condensed',sans-serif";
  ctx.fillStyle = BRAND.mute;
  ctx.fillText('COACH LAB · RESEARCH BROADCAST', 54, 118);

  // ── category chip ──
  const catText = String(category || 'research').replace(/-/g, ' ').toUpperCase();
  ctx.font = "700 20px 'Barlow Condensed',sans-serif";
  const cw = ctx.measureText(catText).width;
  ctx.fillStyle = 'rgba(106,13,173,0.55)';
  roundRect(ctx, 54, 168, cw + 36, 44, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,200,0,0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 54, 168, cw + 36, 44, 22);
  ctx.stroke();
  ctx.fillStyle = BRAND.goldSoft;
  ctx.fillText(catText, 72, 197);

  // ── title (Bebas, wrapped) ──
  ctx.font = "400 66px 'Bebas Neue','Barlow Condensed',sans-serif";
  ctx.fillStyle = BRAND.white;
  const titleLines = wrapLines(ctx, title, W - 108).slice(0, 5);
  let y = 300;
  for (const line of titleLines) { ctx.fillText(line, 54, y); y += 68; }

  // ── takeaway (Barlow, muted) ──
  ctx.font = "600 27px 'Barlow Condensed',sans-serif";
  ctx.fillStyle = 'rgba(244,238,251,0.9)';
  const takeLines = wrapLines(ctx, takeaway, W - 116).slice(0, 6);
  y += 18;
  for (const line of takeLines) { ctx.fillText(line, 54, y); y += 38; }

  // ── karaoke captions (bottom third), synced to the voice ──
  const cap = captionState(words, t, 4);
  if (cap && cap.chunk.length) {
    ctx.textAlign = 'center';
    ctx.font = "800 44px 'Barlow Condensed',sans-serif";
    ctx.lineJoin = 'round';
    const capY = H - 300;
    // measure to lay words on wrapped lines within 84% width
    const gap = 12;
    const items = cap.chunk.map((w, i) => ({ text: w.text, active: i === cap.active, w: ctx.measureText(w.text).width }));
    const maxW = W * 0.84;
    const lines = [];
    let curLine = [];
    let curW = 0;
    for (const it of items) {
      const add = (curLine.length ? gap : 0) + it.w;
      if (curLine.length && curW + add > maxW) { lines.push({ items: curLine, w: curW }); curLine = []; curW = 0; }
      curW += (curLine.length ? gap : 0) + it.w;
      curLine.push(it);
    }
    if (curLine.length) lines.push({ items: curLine, w: curW });
    let ly = capY;
    for (const line of lines) {
      let x = (W - line.w) / 2;
      for (const it of line.items) {
        if (it.active) {
          ctx.fillStyle = BRAND.gold;
          roundRect(ctx, x - 7, ly - 40, it.w + 14, 52, 9);
          ctx.fill();
        }
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#000';
        ctx.textAlign = 'left';
        ctx.strokeText(it.text, x, ly);
        ctx.fillStyle = it.active ? '#ffffff' : BRAND.white;
        ctx.fillText(it.text, x, ly);
        x += it.w + gap;
      }
      ly += 56;
    }
    ctx.textAlign = 'center';
  }

  // ── footer + progress ──
  ctx.textAlign = 'center';
  ctx.font = "700 20px 'Barlow Condensed',sans-serif";
  ctx.fillStyle = BRAND.mute;
  ctx.fillText('buildbelievefit.fitness', W / 2, H - 60);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(54, H - 40, W - 108, 6);
  ctx.fillStyle = BRAND.gold;
  ctx.fillRect(54, H - 40, (W - 108) * Math.max(0, Math.min(1, p)), 6);
}

// Render the reel. Returns { blob, mime, duration }. Rejects with a coded Error
// ('unsupported_browser' | 'audio_load_failed' | 'record_failed') on failure.
export async function renderResearchReel({ title, takeaway, category, audioUrl, words = [], onProgress }) {
  if (!reelRenderSupported()) throw new Error('unsupported_browser');

  // Make sure the brand faces are ready before the first paint (they load via
  // the page's Google Fonts link; on a cold panel they may not be parsed yet).
  try { await Promise.all([
    document.fonts?.load?.("400 66px 'Bebas Neue'"),
    document.fonts?.load?.("800 44px 'Barlow Condensed'"),
  ]); } catch { /* fall back to the system sans */ }

  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';
  audio.src = audioUrl;
  await new Promise((resolve, reject) => {
    audio.onloadedmetadata = resolve;
    audio.onerror = () => reject(new Error('audio_load_failed'));
    // safety: don't hang forever on a stalled fetch
    setTimeout(() => (audio.readyState >= 1 ? resolve() : reject(new Error('audio_load_failed'))), 15000);
  });
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 20;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Audio graph: route the element through a MediaStreamDestination so the
  // recorder captures the narration. NOT connected to AC.destination → the
  // one-pass capture is silent live; the founder hears it in the preview.
  const AC = new (window.AudioContext || window.webkitAudioContext)();
  const srcNode = AC.createMediaElementSource(audio);
  const dest = AC.createMediaStreamDestination();
  srcNode.connect(dest);

  const canvasStream = canvas.captureStream(FPS);
  const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

  const mime = pickMime();
  let rec;
  try {
    rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  } catch {
    try { AC.close(); } catch { /* noop */ }
    throw new Error('record_failed');
  }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { rec.onstop = resolve; });

  let raf = 0;
  const loop = () => {
    const t = audio.currentTime || 0;
    try { drawFrame(ctx, { title, takeaway, category, words, t, p: t / duration }); } catch { /* one bad frame never aborts */ }
    onProgress?.(Math.min(t / duration, 1));
    if (!audio.ended) raf = requestAnimationFrame(loop);
  };

  rec.start(120);
  try { await AC.resume(); } catch { /* already running */ }
  drawFrame(ctx, { title, takeaway, category, words, t: 0, p: 0 }); // paint frame 0 before audio
  await audio.play();
  loop();

  await new Promise((resolve) => {
    audio.onended = resolve;
    // hard cap so a runaway element can't record forever
    setTimeout(resolve, (duration + 4) * 1000);
  });

  cancelAnimationFrame(raf);
  try { rec.stop(); } catch { /* already stopped */ }
  await stopped;
  try { AC.close(); } catch { /* noop */ }

  if (!chunks.length) throw new Error('record_failed');
  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  return { blob, mime: mime.split(';')[0], duration };
}

// Lightweight title classifier → the on-screen category chip. Same honest
// training taxonomy the corpus splits into (periodization / training-density /
// hypertrophy-science / sports-psychology). Title-only, deterministic.
const CLASSIFY = [
  ['sports-psychology', ['motivat', 'psycholog', 'coaching', 'self-efficacy', 'self-determination', 'autonomy', 'autonomous', 'competence', 'relatedness', 'adherence', 'amotivation', 'cognitive evaluation', 'organismic', 'psychological needs', 'goal contents', 'relationship motivation', 'leadership', 'trans-contextual', 'motivational interviewing', 'peer support', 'attribution', 'goal orientation', 'pygmalion', 'breq', 'mindfulness', 'self-fulfilling', 'feedback', 're-engagement', 'alliance', 'group personal', 'anxiety']],
  ['training-density', ['rest interval', 'rest-pause', 'density', 'superset', 'cluster set', 'drop set', 'giant set', 'mechanical drop', 'antagonist', 'agonist paired', 'emom', 'every minute', 'amrap', 'tabata', 'circuit', 'german volume', 'escalating density', 'intra-set', 'sled', 'active recovery', 'paired set', 'heart rate', 'pre-exhaust']],
  ['periodization', ['periodization', 'linear', 'block', 'undulating', 'conjugate', 'macrocycle', 'taper', 'peaking', 'deload', 'gpp', 'spp', 'general physical', 'specific physical', 'triphasic', 'accumulation', 'transmutation', 'wave loading', 'step loading', 'autoregulat', 'rpe', 'velocity-based', 'apre', 'vertical integration', 'cybernetic', 'inverted', 'progressive resistance']],
];
export function classifyStudy(title) {
  const t = String(title || '').toLowerCase();
  for (const [slug, kws] of CLASSIFY) if (kws.some((kw) => t.includes(kw))) return slug;
  return 'hypertrophy-science';
}

// Filesystem-friendly slug for the download name.
export function reelFileName(title, ext) {
  const slug = String(title || 'research-reel')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'research-reel';
  return `bbf-${slug}.${ext}`;
}
