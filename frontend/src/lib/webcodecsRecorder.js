// src/lib/webcodecsRecorder.js
// ─────────────────────────────────────────────────────────────────────────────
// WebCodecs reel capture engine — REPLACES MediaRecorder + ffmpeg.wasm entirely.
//
// Why: MediaRecorder on Chromium/Samsung emits a FRAGMENTED MP4 with OPUS audio
// (frozen/silent in Windows/Edge/Samsung players, rejected by IG/FB), and the
// ffmpeg.wasm remux won't load behind mobile CSP / SharedArrayBuffer limits.
//
// This engine takes absolute frame control: it paints each footage frame + the
// baked overlay onto a canvas, hands the canvas straight to a VideoEncoder (H.264),
// encodes the voiceover through an AudioEncoder (AAC), and muxes both into a clean,
// UNFRAGMENTED, faststart MP4 with mp4-muxer (pure JS, bundled — no WASM, no
// SharedArrayBuffer, no CDN). Output plays in Windows/Edge/Samsung/VLC and posts to IG/FB.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export function webcodecsSupported() {
  return typeof window !== 'undefined'
    && typeof window.VideoEncoder === 'function'
    && typeof window.VideoFrame === 'function'
    && typeof window.AudioEncoder === 'function'
    && typeof window.AudioData === 'function';
}

// Snapshot the reel overlay (DOM) to a transparent 1080×1920 canvas, once.
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
  } finally {
    if (scaler) scaler.style.transform = prevT || '';
    hidden.forEach(([el, v]) => { el.style.visibility = v || ''; });
  }
}

// cover-fit the footage into W×H (matches the preview's object-fit: cover).
function drawCover(ctx, video, W, H) {
  ctx.fillStyle = '#08060a'; ctx.fillRect(0, 0, W, H);
  const vw = video.videoWidth || W, vh = video.videoHeight || H;
  const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Pick a hardware-supported H.264 config for 1080×1920 (level 4.0 covers the 8160 MBs).
async function pickVideoCodec(W, H, fps) {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640020']) {
    try {
      const r = await window.VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: 8_000_000, framerate: fps });
      if (r && r.supported) return codec;
    } catch { /* try next */ }
  }
  return 'avc1.42e028';
}

// Decode the voiceover URL → AudioBuffer (best-effort; null on CORS/decode failure).
async function decodeVo(voUrl) {
  if (!voUrl) return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const arr = await (await fetch(voUrl)).arrayBuffer();
    const buf = await ac.decodeAudioData(arr);
    try { ac.close(); } catch { /* noop */ }
    return buf;
  } catch { return null; }
}

// Record the reel → { blob, ext:'mp4', mime, audio }. durationCap seconds. onProgress(0..1).
export async function recordReel({ stageNode, voUrl, durationCap = 90, fps = 30, onProgress }) {
  if (!stageNode) throw new Error('no_stage');
  if (!webcodecsSupported()) throw new Error('no_webcodecs');
  const { VideoEncoder, AudioEncoder, VideoFrame, AudioData } = window;
  const video = stageNode.querySelector('.reel-video-v4');
  if (!video || !video.src) throw new Error('no_footage');
  if (video.readyState < 1) {
    await new Promise((r) => { video.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 3000); });
  }

  const W = 1080, H = 1920;
  const overlay = await captureOverlay(stageNode);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });

  const audioBuffer = await decodeVo(voUrl);
  const aCh = audioBuffer ? Math.min(audioBuffer.numberOfChannels, 2) : 0;
  const aSr = audioBuffer ? audioBuffer.sampleRate : 0;

  let d = video.duration;
  d = (Number.isFinite(d) && d > 0) ? Math.min(d, durationCap) : durationCap;

  let encErr = null;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H },
    ...(audioBuffer ? { audio: { codec: 'aac', numberOfChannels: aCh, sampleRate: aSr } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  const vcodec = await pickVideoCodec(W, H, fps);
  const venc = new VideoEncoder({
    output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { encErr = e; } },
    error: (e) => { encErr = e; },
  });
  venc.configure({ codec: vcodec, width: W, height: H, bitrate: 8_000_000, framerate: fps, avc: { format: 'avc' } });

  // ── AUDIO: encode the whole voiceover up front (muxer interleaves by timestamp) ──
  let aenc = null;
  if (audioBuffer) {
    let aacOk;
    try { const r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: aSr, numberOfChannels: aCh, bitrate: 128_000 }); aacOk = !!(r && r.supported); } catch { aacOk = false; }
    if (aacOk) {
      aenc = new AudioEncoder({ output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { encErr = e; } }, error: (e) => { encErr = e; } });
      aenc.configure({ codec: 'mp4a.40.2', sampleRate: aSr, numberOfChannels: aCh, bitrate: 128_000 });
      const total = Math.min(audioBuffer.length, Math.ceil(d * aSr));
      const BLOCK = aSr; // 1s blocks
      for (let off = 0; off < total && !encErr; off += BLOCK) {
        const n = Math.min(BLOCK, total - off);
        const planar = new Float32Array(n * aCh);
        for (let c = 0; c < aCh; c++) planar.set(audioBuffer.getChannelData(c).subarray(off, off + n), c * n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: aSr, numberOfFrames: n, numberOfChannels: aCh, timestamp: Math.round((off / aSr) * 1e6), data: planar });
        aenc.encode(ad); ad.close();
      }
    }
  }

  // ── VIDEO: encode from a DEDICATED, OFF-SCREEN CLONE of the footage, fully decoupled
  // from the UI preview's play/pause/seek state. The previous engine sampled the shared
  // preview <video>, so a paused/short preview produced a frozen or truncated export.
  // Here we own a private element, play it from t=0, and encode every frame it presents.
  const enc = document.createElement('video');
  enc.src = video.currentSrc || video.src;
  enc.muted = true; enc.playsInline = true; enc.preload = 'auto';
  try { enc.crossOrigin = video.crossOrigin || 'anonymous'; } catch { /* noop */ }
  // Parked on-screen but invisible so the browser keeps decoding/presenting frames
  // (a display:none video may not fire requestVideoFrameCallback).
  enc.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;';
  document.body.appendChild(enc);
  const cleanupEnc = () => { try { enc.pause(); } catch { /* noop */ } try { enc.remove(); } catch { /* noop */ } };
  await new Promise((r) => { if (enc.readyState >= 1) { r(); return; } enc.addEventListener('loadedmetadata', () => r(), { once: true }); setTimeout(r, 5000); });

  const encDur = (Number.isFinite(enc.duration) && enc.duration > 0) ? enc.duration : d;
  const maxTs = Math.min(encDur, durationCap);
  try { enc.currentTime = 0; } catch { /* noop */ }

  let frameN = 0; let lastTs = -1;
  const encodeOne = (mtSec) => {
    drawCover(ctx, enc, W, H);
    ctx.drawImage(overlay, 0, 0, W, H);
    let ts = Math.max(0, Math.round(mtSec * 1e6));
    if (ts <= lastTs) ts = lastTs + 1; // strictly increasing for the encoder
    lastTs = ts;
    const vf = new VideoFrame(canvas, { timestamp: ts, duration: Math.round(1e6 / fps) });
    venc.encode(vf, { keyFrame: frameN % (fps * 2) === 0 });
    vf.close();
    frameN++;
    if (onProgress) onProgress(Math.min(0.9, (mtSec / maxTs) * 0.9));
  };

  try {
    await new Promise((resolve, reject) => {
      let killer = 0; let iv = 0;
      const done = () => { clearTimeout(killer); if (iv) clearInterval(iv); resolve(); };
      const useRVFC = typeof enc.requestVideoFrameCallback === 'function';
      const onFrame = (_now, meta) => {
        if (encErr) { clearTimeout(killer); reject(encErr); return; }
        const mt = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : (enc.currentTime || frameN / fps);
        if (enc.ended || mt >= maxTs) { done(); return; }
        try { encodeOne(mt); } catch (e) { clearTimeout(killer); reject(e); return; }
        enc.requestVideoFrameCallback(onFrame);
      };
      // EXPLICIT programmatic playback from the start — never relies on the UI state.
      enc.play().then(() => {
        killer = setTimeout(done, (maxTs + 8) * 1000);
        if (useRVFC) { enc.requestVideoFrameCallback(onFrame); return; }
        iv = setInterval(() => {
          if (encErr) { clearInterval(iv); reject(encErr); return; }
          const mt = enc.currentTime || 0;
          if (enc.ended || mt >= maxTs) { done(); return; }
          try { encodeOne(mt); } catch (e) { clearInterval(iv); reject(e); }
        }, 1000 / fps);
      }).catch(() => reject(new Error('play_failed')));
    });
  } finally {
    cleanupEnc();
  }

  if (onProgress) onProgress(0.95);
  await venc.flush();
  if (aenc) await aenc.flush();
  if (encErr) throw encErr;
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  try { venc.close(); } catch { /* noop */ }
  if (aenc) { try { aenc.close(); } catch { /* noop */ } }
  if (onProgress) onProgress(1);
  if (!blob.size) throw new Error('empty_recording');
  return { blob, ext: 'mp4', mime: 'video/mp4', audio: !!aenc };
}
