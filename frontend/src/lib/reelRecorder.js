// src/lib/reelRecorder.js
// ─────────────────────────────────────────────────────────────────────────────
// FRONT 5 — Reel MediaRecorder pipeline (ports V3 recordReel to the V4 DOM reel).
// V3 hand-drew the overlay to canvas; V4's overlay is DOM, so we snapshot it ONCE
// via html2canvas (video hidden → transparent PNG) and composite it over the live
// video frames each requestAnimationFrame. Audio = the cached voiceover (voUrl),
// mixed in via WebAudio when CORS allows. Captures canvas.captureStream → MP4 when
// the browser supports it (Safari/HW-h264), else WebM (IG/FB reject WebM — the
// caller surfaces that). Returns { blob, ext, mime } or throws a slug Error.

// Prefer real MP4 (h264) → real WebM codecs → bare containers last (V3 parity).
export function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const tries = [
    'video/mp4;codecs=h264', 'video/mp4;codecs=avc1.42E01E',
    'video/webm;codecs=vp9', 'video/webm;codecs=vp8',
    'video/mp4', 'video/webm',
  ];
  for (const m of tries) { if (MediaRecorder.isTypeSupported(m)) return m; }
  return '';
}

// True only when the browser can record a real MP4 (what IG/FB accept).
export function canRecordMp4() {
  const m = pickRecorderMime();
  return !!m && m.indexOf('mp4') >= 0;
}

// Snapshot the reel overlay (everything except the video + interactive controls)
// to a transparent canvas, at full 1080×1920 (scaler transform neutralized).
async function captureOverlay(stageNode) {
  const HIDE = ['.reel-video-v4', '.reel-placeholder-v4', '.reel-play-v4', '.reel-vo-v4', '.reel-progress-v4'];
  const hidden = [];
  HIDE.forEach((sel) => stageNode.querySelectorAll(sel).forEach((el) => {
    hidden.push([el, el.style.visibility]);
    el.style.visibility = 'hidden';
  }));
  const scaler = stageNode.closest('.stage-scaler-inner');
  const prevT = scaler ? scaler.style.transform : null;
  if (scaler) scaler.style.transform = 'none';
  try {
    const { default: html2canvas } = await import('html2canvas');
    return await html2canvas(stageNode, {
      backgroundColor: null, scale: 1, useCORS: true, imageTimeout: 4000, width: 1080, height: 1920,
    });
  } finally {
    if (scaler) scaler.style.transform = prevT || '';
    hidden.forEach(([el, v]) => { el.style.visibility = v || ''; });
  }
}

// cover-fit the video into W×H (matches the preview's object-fit: cover).
function drawCover(ctx, video, W, H) {
  const vw = video.videoWidth || W;
  const vh = video.videoHeight || H;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Build a WebAudio mix stream from the voiceover URL (best-effort; null on CORS/err).
async function buildVoAudio(voUrl) {
  if (!voUrl) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    const ac = new AC();
    const dest = ac.createMediaStreamDestination();
    const arr = await (await fetch(voUrl)).arrayBuffer();
    const buf = await ac.decodeAudioData(arr);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = 1.0;
    src.connect(g).connect(dest);
    return {
      stream: dest.stream,
      start: () => { try { ac.resume(); } catch { /* noop */ } try { src.start(ac.currentTime + 0.05); } catch { /* noop */ } },
      stop: () => { try { src.stop(); } catch { /* noop */ } try { ac.close(); } catch { /* noop */ } },
    };
  } catch {
    return null; // CORS-tainted or undecodable → record video-only
  }
}

// Record the reel: live footage (cover) + baked overlay + voiceover audio →
// { blob, ext, mime }. durationCap: seconds (post=90 / export=1200). onProgress(0..1).
export async function recordReel({ stageNode, voUrl, durationCap = 90, onProgress }) {
  if (!stageNode) throw new Error('no_stage');
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('no_recorder');
  const video = stageNode.querySelector('.reel-video-v4');
  if (!video || !video.src) throw new Error('no_footage');

  if (video.readyState < 1) {
    await new Promise((r) => { video.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 3000); });
  }

  const overlay = await captureOverlay(stageNode);
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  // KEEP THE CANVAS IN THE LIVE DOM. Mobile browsers (and some desktops) throttle or
  // skip compositing a DETACHED canvas, which starves canvas.captureStream to a single
  // frame — the frozen-video bug. Park it on-screen but effectively invisible so the
  // engine keeps honoring its paint cycle.
  canvas.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const cleanupCanvas = () => { try { canvas.remove(); } catch { /* noop */ } };

  const mime = pickRecorderMime();
  // MANUAL PUSH MODEL: captureStream(0) emits a frame ONLY when we call
  // track.requestFrame(), so the stream can never be starved by paint-loop throttling
  // on a hidden canvas. Fall back to timed auto-capture where requestFrame is absent
  // (e.g. Safari), where the DOM-attached canvas above keeps auto-capture alive.
  let stream = canvas.captureStream(0);
  let vTrack = stream.getVideoTracks()[0];
  let manualPush = !!(vTrack && typeof vTrack.requestFrame === 'function');
  if (!manualPush) {
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    stream = canvas.captureStream(30);
    vTrack = stream.getVideoTracks()[0];
  }

  const audio = await buildVoAudio(voUrl);
  if (audio && audio.stream) { try { audio.stream.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch { /* noop */ } }

  let rec;
  try { rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000 }) : new MediaRecorder(stream); }
  catch (e) { cleanupCanvas(); throw new Error('recorder_init', { cause: e }); }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  let d = video.duration;
  d = (Number.isFinite(d) && d > 0) ? Math.min(d, durationCap) : durationCap;
  video.pause(); video.loop = false; video.currentTime = 0;

  return new Promise((resolve, reject) => {
    let stopped = false; let killTimer = 0; let drawTimer = 0;
    const stopLoops = () => {
      if (drawTimer) { clearInterval(drawTimer); drawTimer = 0; }
      if (killTimer) { clearTimeout(killTimer); killTimer = 0; }
    };
    const finish = () => { if (stopped) return; stopped = true; stopLoops(); try { rec.stop(); } catch { /* noop */ } };
    rec.onstop = () => {
      stopLoops();
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      if (audio && audio.stop) audio.stop();
      cleanupCanvas();
      try { video.loop = true; video.play().catch(() => {}); } catch { /* noop */ }
      const ext = (mime && mime.indexOf('mp4') >= 0) ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mime || `video/${ext}` });
      if (!blob.size) { reject(new Error('empty_recording')); return; }
      resolve({ blob, ext, mime });
    };
    video.onended = finish;

    // THE IRONCLAD LOOP — a strict 33ms (~30fps) timer, NOT requestAnimationFrame.
    // rAF is paused/throttled for hidden or offscreen surfaces on mobile; a setInterval
    // keeps firing while the recording state is active. Every tick paints the live video
    // frame + the baked overlay and explicitly pushes that frame into the stream.
    const paint = () => {
      if (stopped) return;
      try {
        drawCover(ctx, video, W, H);
        ctx.drawImage(overlay, 0, 0, W, H);
        if (manualPush) { try { vTrack.requestFrame(); } catch { /* noop */ } }
      } catch { /* keep the loop alive even if a single frame fails */ }
      const t = video.currentTime || 0;
      if (onProgress) onProgress(Math.min(1, t / d));
      if (video.ended || t >= d) finish();
    };

    video.play().then(() => {
      paint();                              // seed a real frame so the stream has correct dims
      rec.start();
      if (audio && audio.start) audio.start();
      drawTimer = setInterval(paint, 33);   // ~30fps, bound to the active recording state
      killTimer = setTimeout(finish, (d + 1.5) * 1000);
    }).catch(() => { stopLoops(); cleanupCanvas(); reject(new Error('play_failed')); });
  });
}
