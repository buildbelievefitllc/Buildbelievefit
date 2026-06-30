// src/lib/webcodecsRecorder.js
// ─────────────────────────────────────────────────────────────────────────────
// REAL-FRAME WebCodecs reel engine — 100% client-side, zero backend.
//
// FULL REBUILD (CEO order: "whole different tactic"). Every prior approach pulled
// pixels through a <video> element in a way that could stall:
//   • MediaRecorder → fragmented MP4 + Opus (frozen in Windows / IG).
//   • ffmpeg.wasm → blocked by CSP / SharedArrayBuffer.
//   • SEEK-based extraction → currentTime snaps to the nearest keyframe on Edge,
//     so an entire GOP returns the SAME decoded frame → a frozen export.
//
// This engine captures the frames the browser ACTUALLY PAINTS, via
// requestVideoFrameCallback (rVFC). Each callback hands us a genuinely-new,
// already-decoded frame at real playback cadence — there is nothing to "freeze".
// The clone is MUTED (autoplay-allowed) and we trust the FIRST real frame, never
// play()'s promise. Timestamps come from the wall clock (rVFC `now`), so they stay
// monotonic even when the footage LOOPS to cover a longer voiceover.
//
// Duration = min(cap, max(footageDuration, voiceoverDuration)). The voiceover is
// the gold: the reel runs the FULL length of the VO, looping the b-roll beneath it,
// so the audio is never truncated to a short clip. Video → H.264, voiceover → AAC,
// muxed into one clean, UNFRAGMENTED, faststart MP4 (mp4-muxer, pure JS). Plays
// everywhere: Edge desktop, Galaxy, Instagram, Facebook, TikTok.
//
// If rVFC is unavailable (very old engines) we fall back to a seek loop so export
// still produces SOMETHING; the rVFC path is the real one and is always preferred.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasRVFC = () => typeof HTMLVideoElement !== 'undefined'
  && typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function';

export function webcodecsSupported() {
  return typeof window !== 'undefined'
    && typeof window.VideoEncoder === 'function'
    && typeof window.VideoFrame === 'function';
}

// Snapshot the branded overlay (DOM) → 1080×1920 canvas, once. The live video,
// placeholder, play glyph, VO button and progress bar are hidden so only the
// burned-in brand typography is captured.
async function captureOverlay(stageNode) {
  const HIDE = ['.reel-video-v4', '.reel-placeholder-v4', '.reel-play-v4', '.reel-vo-v4', '.reel-progress-v4'];
  const hidden = [];
  HIDE.forEach((sel) => stageNode.querySelectorAll(sel).forEach((el) => { hidden.push([el, el.style.visibility]); el.style.visibility = 'hidden'; }));
  const scaler = stageNode.closest('.stage-scaler-inner');
  const prevT = scaler ? scaler.style.transform : null;
  if (scaler) scaler.style.transform = 'none';
  try {
    const { default: html2canvas } = await import('html2canvas');
    return await html2canvas(stageNode, { backgroundColor: null, scale: 1, useCORS: true, imageTimeout: 4000, width: 1080, height: 1920 });
  } catch { return null; }
  finally {
    if (scaler) scaler.style.transform = prevT || '';
    hidden.forEach(([el, v]) => { el.style.visibility = v || ''; });
  }
}

// Cover-fit the video into W×H (fills the 9:16 frame, center-cropped).
function drawCover(ctx, video, W, H) {
  ctx.fillStyle = '#08060a'; ctx.fillRect(0, 0, W, H);
  const vw = video.videoWidth || W, vh = video.videoHeight || H;
  const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

async function pickVideoCodec(W, H, fps) {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640020']) {
    try { const r = await window.VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: 8_000_000, framerate: fps }); if (r && r.supported) return codec; } catch { /* next */ }
  }
  return 'avc1.42e028';
}

// Decode the voiceover MP3 → AudioBuffer (the gold). Returns null if absent/blocked.
async function decodeVo(voUrl) {
  if (!voUrl) return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const arr = await (await fetch(voUrl, { mode: 'cors' })).arrayBuffer();
    const buf = await ac.decodeAudioData(arr);
    try { ac.close(); } catch { /* noop */ }
    return buf;
  } catch { return null; }
}

// Build a private, off-screen, MUTED clone of the footage purely for capture.
// Muted ⇒ autoplay-allowed; the clone never touches the visible UI.
function makeCaptureClone(srcEl) {
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
  v.playsInline = true; v.setAttribute('playsinline', '');
  v.preload = 'auto';
  try { v.crossOrigin = srcEl.crossOrigin || 'anonymous'; } catch { /* noop */ }
  v.src = srcEl.currentSrc || srcEl.src;
  v.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;';
  document.body.appendChild(v);
  return v;
}

function waitForMeta(v) {
  return new Promise((resolve) => {
    if (v.readyState >= 1 && v.videoWidth) { resolve(); return; }
    const go = () => { v.removeEventListener('loadedmetadata', go); v.removeEventListener('loadeddata', go); resolve(); };
    v.addEventListener('loadedmetadata', go, { once: true });
    v.addEventListener('loadeddata', go, { once: true });
    setTimeout(resolve, 6000);
  });
}

// Encode the whole voiceover as AAC; muxer interleaves by timestamp. Returns the
// AudioEncoder (already fed + awaiting flush by the caller) or null if no audio.
async function encodeVoiceover(muxer, audioBuffer, durationSec, setErr) {
  const AudioEncoder = window.AudioEncoder;
  const AudioData = window.AudioData;
  if (!audioBuffer || !AudioEncoder || !AudioData) return null;
  const aCh = Math.min(audioBuffer.numberOfChannels, 2);
  const aSr = audioBuffer.sampleRate;
  let ok;
  try { const r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: aSr, numberOfChannels: aCh, bitrate: 128_000 }); ok = !!(r && r.supported); } catch { ok = false; }
  if (!ok) return null;
  const aenc = new AudioEncoder({
    output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { setErr(e); } },
    error: (e) => setErr(e),
  });
  aenc.configure({ codec: 'mp4a.40.2', sampleRate: aSr, numberOfChannels: aCh, bitrate: 128_000 });
  const total = Math.min(audioBuffer.length, Math.ceil(durationSec * aSr));
  for (let off = 0; off < total; off += aSr) {
    const n = Math.min(aSr, total - off);
    const planar = new Float32Array(n * aCh);
    for (let c = 0; c < aCh; c++) planar.set(audioBuffer.getChannelData(c).subarray(off, off + n), c * n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: aSr, numberOfFrames: n, numberOfChannels: aCh, timestamp: Math.round((off / aSr) * 1e6), data: planar });
    aenc.encode(ad); ad.close();
  }
  return aenc;
}

// ── PRIMARY: real-frame capture via requestVideoFrameCallback ──────────────────
// Plays the muted clone and grabs every frame the browser actually paints. Loops
// the footage when the voiceover outlasts it. Wall-clock timestamps stay monotonic.
function captureViaRVFC({ clone, ctx, canvas, overlay, venc, VideoFrame, W, H, fps, d, loop, onProgress, getErr }) {
  return new Promise((resolve, reject) => {
    clone.loop = loop;
    let t0 = null;
    let lastTsUs = -1;
    let frames = 0;
    let finished = false;
    let firstFrameSeen = false;

    const finish = () => {
      if (finished) return; finished = true;
      try { clone.pause(); } catch { /* noop */ }
      resolve(frames);
    };

    const onFrame = (now /* DOMHighResTimeStamp */) => {
      if (finished) return;
      if (getErr()) { finish(); return; }
      firstFrameSeen = true;
      if (t0 === null) t0 = now;
      const tSec = (now - t0) / 1000;
      if (tSec >= d) { finish(); return; }
      const tsUs = Math.round(tSec * 1e6);
      if (tsUs > lastTsUs) {
        drawCover(ctx, clone, W, H);
        if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
        const vf = new VideoFrame(canvas, { timestamp: tsUs, duration: Math.round(1e6 / fps) });
        venc.encode(vf, { keyFrame: frames % (fps * 2) === 0 });
        vf.close();
        lastTsUs = tsUs;
        frames += 1;
        if (onProgress) onProgress(Math.min(0.92, (tSec / d) * 0.92));
      }
      // Backpressure: let the encoder drain before requesting the next paint.
      if (venc.encodeQueueSize > 24) { sleep(8).then(() => clone.requestVideoFrameCallback(onFrame)); }
      else clone.requestVideoFrameCallback(onFrame);
    };

    // 'ended' only fires when NOT looping; covers footage-shorter-than-cap.
    clone.addEventListener('ended', () => finish(), { once: true });

    clone.requestVideoFrameCallback(onFrame);
    clone.play().catch(() => { /* muted autoplay should be fine; rVFC is the real signal */ });

    // If no real frame ever arrives, the clip can't be captured this way — bail so
    // the UI shows an actionable error instead of hanging forever.
    setTimeout(() => { if (!firstFrameSeen && !finished) { finished = true; try { clone.pause(); } catch { /* noop */ } reject(new Error('play_failed')); } }, 5000);
  });
}

// ── FALLBACK: seek loop (only when rVFC is unavailable) ───────────────────────
function seekTo(v, t) {
  return new Promise((resolve) => {
    let done = false;
    const go = () => { if (done) return; done = true; v.removeEventListener('seeked', go); resolve(); };
    v.addEventListener('seeked', go, { once: true });
    try { v.currentTime = t; } catch { go(); }
    setTimeout(go, 600);
  });
}

async function captureViaSeek({ clone, ctx, canvas, overlay, venc, VideoFrame, W, H, fps, d, footageDur, onProgress, getErr }) {
  const totalFrames = Math.max(1, Math.round(d * fps));
  for (let i = 0; i < totalFrames; i++) {
    if (getErr()) throw getErr();
    const tSec = i / fps;
    const seekT = footageDur > 0 ? (tSec % footageDur) : tSec; // loop the footage
    await seekTo(clone, Math.min(seekT, Math.max(0, footageDur - 0.001)));
    drawCover(ctx, clone, W, H);
    if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
    const vf = new VideoFrame(canvas, { timestamp: Math.round(tSec * 1e6), duration: Math.round(1e6 / fps) });
    venc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
    vf.close();
    if (onProgress) onProgress(Math.min(0.92, (i / totalFrames) * 0.92));
    if (venc.encodeQueueSize > 24) await sleep(8);
  }
  return totalFrames;
}

// Record the reel → { blob, ext:'mp4', mime, audio, frames, durationSec }. onProgress(0..1).
export async function recordReel({ stageNode, voUrl, durationCap = 90, fps = 30, onProgress }) {
  if (!stageNode) throw new Error('no_stage');
  if (!webcodecsSupported()) throw new Error('no_webcodecs');
  const { VideoEncoder, VideoFrame } = window;
  const srcEl = stageNode.querySelector('.reel-video-v4');
  if (!srcEl || !srcEl.src) throw new Error('no_footage');

  const W = 1080, H = 1920;
  const overlay = await captureOverlay(stageNode);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });

  const clone = makeCaptureClone(srcEl);
  const cleanup = () => { try { clone.pause(); } catch { /* noop */ } try { clone.removeAttribute('src'); clone.load(); } catch { /* noop */ } try { clone.remove(); } catch { /* noop */ } };

  try {
    await waitForMeta(clone);
    const footageDur = (Number.isFinite(clone.duration) && clone.duration > 0) ? clone.duration : 0;

    // Decode the voiceover FIRST so its true length drives the reel duration.
    const audioBuffer = await decodeVo(voUrl);
    const voDur = audioBuffer ? (audioBuffer.length / audioBuffer.sampleRate) : 0;

    // The reel runs the full length of whichever is longer (gold = the voiceover),
    // capped. Footage loops beneath a longer VO so the audio is never cut short.
    const naturalDur = Math.max(footageDur, voDur) || footageDur || voDur || durationCap;
    const d = Math.min(naturalDur, durationCap) || 1;
    const loop = footageDur > 0 && d > footageDur + 0.05;

    let encErr = null;
    const setErr = (e) => { if (!encErr) encErr = e; };
    const getErr = () => encErr;

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      ...(audioBuffer ? { audio: { codec: 'aac', numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2), sampleRate: audioBuffer.sampleRate } } : {}),
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    const vcodec = await pickVideoCodec(W, H, fps);
    const venc = new VideoEncoder({
      output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { setErr(e); } },
      error: (e) => setErr(e),
    });
    venc.configure({ codec: vcodec, width: W, height: H, bitrate: 8_000_000, framerate: fps, avc: { format: 'avc' } });

    // Voiceover (AAC) — encode the whole thing up front; muxer interleaves.
    const aenc = await encodeVoiceover(muxer, audioBuffer, d, setErr);

    // Video — REAL FRAMES via rVFC (preferred), else seek fallback.
    const capArgs = { clone, ctx, canvas, overlay, venc, VideoFrame, W, H, fps, d, loop, footageDur, onProgress, getErr };
    let frames = 0;
    if (hasRVFC()) {
      try { frames = await captureViaRVFC(capArgs); }
      catch (e) { if (e && e.message === 'play_failed') frames = await captureViaSeek(capArgs); else throw e; }
    } else {
      frames = await captureViaSeek(capArgs);
    }
    if (encErr) throw encErr;
    if (frames < 1) throw new Error('empty_recording');

    await venc.flush();
    if (aenc) await aenc.flush();
    if (encErr) throw encErr;
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    try { venc.close(); } catch { /* noop */ }
    if (aenc) { try { aenc.close(); } catch { /* noop */ } }
    if (onProgress) onProgress(1);
    if (!blob.size) throw new Error('empty_recording');
    return { blob, ext: 'mp4', mime: 'video/mp4', audio: !!aenc, frames, durationSec: Math.round(d * 10) / 10 };
  } finally {
    cleanup();
  }
}
