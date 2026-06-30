// src/lib/webcodecsRecorder.js
// ─────────────────────────────────────────────────────────────────────────────
// SEEK-BASED WebCodecs reel engine — 100% client-side, zero backend, zero play().
//
// Every prior approach broke on something STATEFUL: MediaRecorder → fragmented
// MP4 + Opus (frozen in Windows/IG); WebCodecs-via-playback → autoplay policy froze
// the clone; captureStream → starved. This engine removes the moving part entirely:
// it SEEKS the footage frame-by-frame (currentTime = i/fps → 'seeked'), paints each
// frame + the branded overlay onto a canvas, and feeds it to a VideoEncoder. No
// play(), so no autoplay policy, no React render cycle, no "is it playing" — each
// frame is a deterministic still that is guaranteed to differ. The voiceover is
// encoded through an AudioEncoder (AAC) and everything is muxed into a clean,
// UNFRAGMENTED, faststart MP4 with mp4-muxer (pure JS, bundled). Plays everywhere.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function webcodecsSupported() {
  return typeof window !== 'undefined'
    && typeof window.VideoEncoder === 'function'
    && typeof window.VideoFrame === 'function';
}

// Snapshot the branded overlay (DOM) → opaque-aware 1080×1920 canvas, once.
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

// Seek `v` to t seconds and resolve once the frame is presentable.
function seekTo(v, t) {
  return new Promise((resolve) => {
    let done = false;
    const go = () => { if (done) return; done = true; v.removeEventListener('seeked', go); resolve(); };
    v.addEventListener('seeked', go, { once: true });
    try { v.currentTime = t; } catch { go(); }
    setTimeout(go, 600); // hard fallback so a missed 'seeked' can't hang the loop
  });
}

// Record the reel → { blob, ext:'mp4', mime, audio }. onProgress(0..1).
export async function recordReel({ stageNode, voUrl, durationCap = 90, fps = 30, onProgress }) {
  if (!stageNode) throw new Error('no_stage');
  if (!webcodecsSupported()) throw new Error('no_webcodecs');
  const { VideoEncoder, VideoFrame } = window;
  const AudioEncoder = window.AudioEncoder;
  const AudioData = window.AudioData;
  const src = stageNode.querySelector('.reel-video-v4');
  if (!src || !src.src) throw new Error('no_footage');

  const W = 1080, H = 1920;
  const overlay = await captureOverlay(stageNode);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });

  // Private, off-screen, MUTED clone purely for seeking (no UI interference, no play()).
  const enc = document.createElement('video');
  enc.muted = true; enc.defaultMuted = true; enc.setAttribute('muted', '');
  enc.playsInline = true; enc.preload = 'auto';
  try { enc.crossOrigin = src.crossOrigin || 'anonymous'; } catch { /* noop */ }
  enc.src = src.currentSrc || src.src;
  enc.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;';
  document.body.appendChild(enc);
  const cleanup = () => { try { enc.remove(); } catch { /* noop */ } };

  try {
    await new Promise((r) => { if (enc.readyState >= 1) { r(); return; } enc.addEventListener('loadedmetadata', () => r(), { once: true }); setTimeout(r, 6000); });
    let d = enc.duration;
    d = (Number.isFinite(d) && d > 0) ? Math.min(d, durationCap) : durationCap;

    const audioBuffer = await decodeVo(voUrl);
    const aCh = audioBuffer ? Math.min(audioBuffer.numberOfChannels, 2) : 0;
    const aSr = audioBuffer ? audioBuffer.sampleRate : 0;

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

    // ── AUDIO (AAC) — encode the whole voiceover; muxer interleaves by timestamp ──
    let aenc = null;
    if (audioBuffer && AudioEncoder && AudioData) {
      let aacOk;
      try { const r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: aSr, numberOfChannels: aCh, bitrate: 128_000 }); aacOk = !!(r && r.supported); } catch { aacOk = false; }
      if (aacOk) {
        aenc = new AudioEncoder({ output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { encErr = e; } }, error: (e) => { encErr = e; } });
        aenc.configure({ codec: 'mp4a.40.2', sampleRate: aSr, numberOfChannels: aCh, bitrate: 128_000 });
        const total = Math.min(audioBuffer.length, Math.ceil(d * aSr));
        for (let off = 0; off < total && !encErr; off += aSr) {
          const n = Math.min(aSr, total - off);
          const planar = new Float32Array(n * aCh);
          for (let c = 0; c < aCh; c++) planar.set(audioBuffer.getChannelData(c).subarray(off, off + n), c * n);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: aSr, numberOfFrames: n, numberOfChannels: aCh, timestamp: Math.round((off / aSr) * 1e6), data: planar });
          aenc.encode(ad); ad.close();
        }
      }
    }

    // ── VIDEO (H.264) — SEEK each frame, paint, encode. No play(), deterministic. ──
    const totalFrames = Math.max(1, Math.round(d * fps));
    for (let i = 0; i < totalFrames; i++) {
      if (encErr) throw encErr;
      await seekTo(enc, Math.min(i / fps, Math.max(0, d - 0.001)));
      drawCover(ctx, enc, W, H);
      if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
      const vf = new VideoFrame(canvas, { timestamp: Math.round((i / fps) * 1e6), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      if (onProgress) onProgress(Math.min(0.92, (i / totalFrames) * 0.92));
      if (venc.encodeQueueSize > 24) await sleep(8); // backpressure
    }

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
  } finally {
    cleanup();
  }
}
