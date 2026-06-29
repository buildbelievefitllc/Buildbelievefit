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

// V3-PROVEN repair: Samsung Internet / Android Chrome write the video track's
// mdhd.duration with the WRONG timescale (e.g. 13880 @ ts=30000 → 0.46s instead of
// 13.88s), and sometimes tkhd.duration=0 — so players/IG read the track as ~0s and
// render a FROZEN STILL with truncated audio, even though every frame is in the moof
// fragments. We rewrite tkhd + mdhd durations from the correct mvhd total: an IN-PLACE
// value patch (no box resized → can't corrupt the file). Returns a fixed Blob, or the
// ORIGINAL on any parse miss / non-mp4 (zero-risk fallback).
export async function fixMp4TrackDuration(blob) {
  try {
    if (!blob || !/mp4/i.test(blob.type || '')) return blob;
    const ab = await blob.arrayBuffer();
    const u8 = new Uint8Array(ab);
    const dv = new DataView(ab);
    const u32 = (o) => dv.getUint32(o);
    const typ = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
    let mvhdTs = 0, realSec = 0;
    (function findMvhd(s, e) {
      let p = s;
      while (p + 8 <= e) {
        let sz = u32(p); const t = typ(p + 4); let hdr = 8;
        if (sz === 1) { sz = Number(dv.getBigUint64(p + 8)); hdr = 16; } else if (sz === 0) { sz = e - p; }
        if (sz < 8 || p + sz > e) break;
        if (t === 'mvhd') {
          const ver = u8[p + hdr], cs = p + hdr + 4;
          if (ver === 1) { mvhdTs = u32(cs + 16); realSec = Number(dv.getBigUint64(cs + 20)) / mvhdTs; }
          else { mvhdTs = u32(cs + 8); realSec = u32(cs + 12) / mvhdTs; }
        }
        if (t === 'moov') findMvhd(p + hdr, p + sz);
        p += sz;
      }
    })(0, u8.length);
    if (!(realSec > 0) || !(mvhdTs > 0)) return blob;
    let changed = false;
    (function walk(s, e) {
      let p = s;
      while (p + 8 <= e) {
        let sz = u32(p); const t = typ(p + 4); let hdr = 8;
        if (sz === 1) { sz = Number(dv.getBigUint64(p + 8)); hdr = 16; } else if (sz === 0) { sz = e - p; }
        if (sz < 8 || p + sz > e) break;
        if (t === 'tkhd') {
          const ver = u8[p + hdr], cs = p + hdr + 4, off = cs + (ver === 1 ? 24 : 16), nd = Math.round(realSec * mvhdTs);
          const old = ver === 1 ? Number(dv.getBigUint64(off)) : u32(off);
          if (old !== nd) { if (ver === 1) dv.setBigUint64(off, BigInt(nd)); else dv.setUint32(off, nd); changed = true; }
        }
        if (t === 'mdhd') {
          const ver = u8[p + hdr], cs = p + hdr + 4, ts = u32(cs + (ver === 1 ? 16 : 8)), off = cs + (ver === 1 ? 20 : 12), nd = Math.round(realSec * ts);
          const old = ver === 1 ? Number(dv.getBigUint64(off)) : u32(off);
          if (ts > 0 && old !== nd) { if (ver === 1) dv.setBigUint64(off, BigInt(nd)); else dv.setUint32(off, nd); changed = true; }
        }
        if (t === 'moov' || t === 'trak' || t === 'mdia') walk(p + hdr, p + sz);
        p += sz;
      }
    })(0, u8.length);
    return changed ? new Blob([ab], { type: blob.type }) : blob;
  } catch { return blob; }
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
      // V3-proven: patch the fragmented-MP4 track duration so the clip isn't a frozen
      // ~0s still on Samsung/Android. No-op for webm or a clean file.
      fixMp4TrackDuration(blob)
        .then((fixed) => resolve({ blob: fixed, ext, mime }))
        .catch(() => resolve({ blob, ext, mime }));
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

    video.play().then(async () => {
      // V3 parity: wait for the first DECODED frame before recording so capture never
      // opens on the dark placeholder / a stale frame. requestVideoFrameCallback is the
      // accurate signal; poll currentTime>0 where it's absent; 800ms hard fallback.
      await new Promise((res) => {
        let done = false; const go = () => { if (!done) { done = true; res(); } };
        if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(() => go());
        else { const iv = setInterval(() => { if (video.videoWidth > 0 && video.currentTime > 0) { clearInterval(iv); go(); } }, 16); }
        setTimeout(go, 800);
      });
      if (stopped) return;
      paint();                              // seed a real frame so the stream has correct dims
      rec.start();
      if (audio && audio.start) audio.start();
      drawTimer = setInterval(paint, 33);   // ~30fps, bound to the active recording state
      killTimer = setTimeout(finish, (d + 1.5) * 1000);
    }).catch(() => { stopLoops(); cleanupCanvas(); reject(new Error('play_failed')); });
  });
}
