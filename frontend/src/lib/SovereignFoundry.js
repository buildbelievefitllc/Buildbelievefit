// src/lib/SovereignFoundry.js
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN FOUNDRY — pure Vanilla ES6 reel-export engine. ZERO React.
//
// CEO order ("The Isolation Protocol"): the export engine must NOT live inside a
// React hook/component. React's render lifecycle is hostile to continuous
// frame-extraction (re-renders re-create closures, StrictMode double-invokes,
// effects tear down mid-encode). So this is a plain class that owns its own
// off-DOM <video>, runs start-to-finish in one async method, and never touches
// the virtual DOM. The React UI instantiates it, hands it { videoUrl, voUrl,
// overlay, container }, and steps out of the way.
//
// PIPELINE (Seek-and-Mux):
//   1. Load the footage into a private, MUTED <video> inside a hidden container.
//   2. SEEK frame-by-frame (currentTime = i/fps). Chromium/Edge do an ACCURATE
//      (frame-exact) seek on a currentTime assignment — the keyframe "snap" only
//      happens with fastSeek(). We additionally wait for 'seeked' AND one
//      requestVideoFrameCallback so the decoded frame is GUARANTEED painted before
//      we sample it (this was the real bug: drawing before the frame was ready →
//      the previous/first frame repeated → a frozen export).
//   3. Composite each frame cover-fit onto a 1080×1920 canvas + the branded
//      overlay, push it through a WebCodecs VideoEncoder (H.264, CFR).
//   4. Decode the Sovereign Voiceover (voUrl) → AAC via AudioEncoder and INTERLEAVE
//      it into the same MP4. The VO is the gold: reel duration runs the FULL length
//      of the voiceover, LOOPING the footage beneath it so audio is never cut.
//   5. Mux everything with mp4-muxer into a clean, UNFRAGMENTED, faststart MP4 with
//      consistent mvhd/tkhd/mdhd timescales — plays locally on Windows & Android
//      without depending on a social-platform re-encode.
//
// Constant-frame-rate seeking (fixed i/fps timestamps) yields a perfectly regular
// stts table — the most player-compatible timing there is.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const TARGET_W = 1080;
const TARGET_H = 1920;

export class SovereignFoundry {
  /**
   * @param {HTMLElement} [container] hidden DOM node to host the private <video>.
   *   Defaults to document.body. The element is never shown to the user.
   */
  constructor(container) {
    this.container = container || (typeof document !== 'undefined' ? document.body : null);
    this._video = null;
  }

  /** WebCodecs availability (requires a SECURE CONTEXT — https or localhost). */
  static isSupported() {
    return typeof window !== 'undefined'
      && typeof window.VideoEncoder === 'function'
      && typeof window.VideoFrame === 'function';
  }

  /**
   * Snapshot the branded overlay (DOM → 1080×1920 canvas), once. DOM-coupled but
   * React-free. The live video / placeholder / controls are hidden so only the
   * burned-in brand typography is captured. Returns a canvas, or null on failure.
   */
  static async captureOverlay(stageNode) {
    if (!stageNode) return null;
    const HIDE = ['.reel-video-v4', '.reel-placeholder-v4', '.reel-play-v4', '.reel-vo-v4', '.reel-progress-v4'];
    const hidden = [];
    HIDE.forEach((sel) => stageNode.querySelectorAll(sel).forEach((el) => { hidden.push([el, el.style.visibility]); el.style.visibility = 'hidden'; }));
    const scaler = stageNode.closest('.stage-scaler-inner');
    const prevT = scaler ? scaler.style.transform : null;
    if (scaler) scaler.style.transform = 'none';
    try {
      const { default: html2canvas } = await import('html2canvas');
      return await html2canvas(stageNode, { backgroundColor: null, scale: 1, useCORS: true, imageTimeout: 4000, width: TARGET_W, height: TARGET_H });
    } catch { return null; }
    finally {
      if (scaler) scaler.style.transform = prevT || '';
      hidden.forEach(([el, v]) => { el.style.visibility = v || ''; });
    }
  }

  /**
   * Render the reel.
   * @returns {Promise<{blob:Blob, ext:'mp4', mime:'video/mp4', audio:boolean, frames:number, durationSec:number}>}
   */
  async render({ videoUrl, voUrl = null, overlay = null, width = TARGET_W, height = TARGET_H, fps = 30, durationCap = 90, onProgress } = {}) {
    if (!SovereignFoundry.isSupported()) throw new Error('no_webcodecs');
    if (!videoUrl) throw new Error('no_footage');

    const W = width, H = height;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });

    const video = this._makeVideo(videoUrl);
    let encErr = null;
    const setErr = (e) => { if (!encErr) encErr = e; };

    try {
      await this._whenReady(video);
      const footageDur = (Number.isFinite(video.duration) && video.duration > 0) ? video.duration : 0;

      // Decode the voiceover FIRST so its real length can drive the reel duration.
      const audioBuffer = await this._decodeVo(voUrl);
      const voDur = audioBuffer ? (audioBuffer.length / audioBuffer.sampleRate) : 0;

      const naturalDur = Math.max(footageDur, voDur) || footageDur || voDur || durationCap;
      const d = Math.max(0.1, Math.min(naturalDur, durationCap));

      // ── Codec selection (decided BEFORE the muxer, since the muxer is told the
      //    container codec up front). Prefer H.264 + AAC — the most universally
      //    compatible pairing and what the CEO's desktop browser provides — and
      //    gracefully fall back to VP9 + Opus so the export still succeeds on
      //    browsers/builds without proprietary encoders (Linux/headless/older).
      const vpick = await this._pickVideo(W, H, fps);
      const apick = audioBuffer ? await this._pickAudio(audioBuffer.sampleRate, Math.min(audioBuffer.numberOfChannels, 2)) : null;

      // ── MUXER ── clean, unfragmented, faststart MP4 with consistent timescales.
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: vpick.muxer, width: W, height: H },
        ...(apick ? { audio: { codec: apick.muxer, numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2), sampleRate: audioBuffer.sampleRate } } : {}),
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });

      // ── VIDEO ENCODER (CFR) ──
      const venc = new window.VideoEncoder({
        output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { setErr(e); } },
        error: (e) => setErr(e),
      });
      const vconf = { codec: vpick.codec, width: W, height: H, bitrate: 8_000_000, framerate: fps };
      if (vpick.isAvc) vconf.avc = { format: 'avc' };
      venc.configure(vconf);

      // ── AUDIO ENCODER — encode the whole VO up front; muxer interleaves ──
      const aenc = apick ? this._encodeVoiceover(muxer, audioBuffer, d, apick, setErr) : null;

      // ── SEEK-AND-SAMPLE LOOP ── real, frame-exact stills; footage loops under VO.
      const { VideoFrame } = window;
      const totalFrames = Math.max(1, Math.round(d * fps));
      const frameDurUs = Math.round(1e6 / fps);
      let frames = 0;
      for (let i = 0; i < totalFrames; i++) {
        if (encErr) throw encErr;
        const tSec = i / fps;
        // Footage loops beneath a longer VO. When the duration is unknown (0 — some
        // streams), seek linearly and let the browser clamp at the real end; NEVER
        // collapse every frame to t=0 (that would freeze the export).
        const seekT = footageDur > 0 ? Math.min(tSec % footageDur, footageDur - 1e-3) : tSec;
        await this._seekReady(video, Math.max(0, seekT));
        this._drawCover(ctx, video, W, H);
        if (overlay) { try { ctx.drawImage(overlay, 0, 0, W, H); } catch { /* overlay optional */ } }
        const frame = new VideoFrame(canvas, { timestamp: Math.round(tSec * 1e6), duration: frameDurUs });
        venc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        frames += 1;
        if (onProgress) onProgress(Math.min(0.95, (i / totalFrames) * 0.95));
        if (venc.encodeQueueSize > 16) await this._drain(venc);
      }

      await venc.flush();
      if (aenc) await aenc.flush();
      if (encErr) throw encErr;
      muxer.finalize();

      const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
      try { venc.close(); } catch { /* noop */ }
      if (aenc) { try { aenc.close(); } catch { /* noop */ } }
      if (!blob.size) throw new Error('empty_recording');
      if (onProgress) onProgress(1);
      return { blob, ext: 'mp4', mime: 'video/mp4', audio: !!aenc, frames, durationSec: Math.round(d * 10) / 10 };
    } finally {
      this._destroyVideo();
    }
  }

  // ── internals ────────────────────────────────────────────────────────────────

  _makeVideo(url) {
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
    v.playsInline = true; v.setAttribute('playsinline', '');
    v.preload = 'auto';
    try { v.crossOrigin = 'anonymous'; } catch { /* noop */ }
    v.src = url;
    v.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;';
    (this.container || document.body).appendChild(v);
    this._video = v;
    return v;
  }

  _destroyVideo() {
    const v = this._video;
    if (!v) return;
    try { v.pause(); } catch { /* noop */ }
    try { v.removeAttribute('src'); v.load(); } catch { /* noop */ }
    try { v.remove(); } catch { /* noop */ }
    this._video = null;
  }

  // Wait until the footage has metadata AND a first decoded frame is available.
  _whenReady(video) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; cleanup(); resolve(); };
      const check = () => { if (video.readyState >= 2 && video.videoWidth > 0) finish(); };
      const onMeta = () => check();
      const onData = () => check();
      function cleanup() {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('loadeddata', onData);
        video.removeEventListener('canplay', onData);
      }
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('loadeddata', onData);
      video.addEventListener('canplay', onData);
      check();
      setTimeout(finish, 8000); // hard safety net
    });
  }

  // Seek to t and resolve only once the EXACT decoded frame is painted/presentable.
  // 'seeked' = decode done; one requestVideoFrameCallback = frame propagated to the
  // compositor (so drawImage samples the real target frame, never a stale one).
  _seekReady(video, t) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; cleanup(); resolve(); };
      // After 'seeked' the decoded frame for `t` is the element's current frame.
      // Confirm it is painted before we sample, RACING two signals so we are fast in
      // every environment: requestVideoFrameCallback (real GPU compositor, ~16ms) vs
      // a double requestAnimationFrame (fires even under headless swiftshader, where
      // rVFC may never fire). First one wins → no per-frame 500ms stall.
      const confirmPaint = () => {
        if (typeof video.requestVideoFrameCallback === 'function') {
          try { video.requestVideoFrameCallback(() => finish()); } catch { /* noop */ }
        }
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(() => finish()));
        } else {
          setTimeout(finish, 16);
        }
        setTimeout(finish, 250); // last-ditch so a fully static frame can't stall
      };
      const onSeeked = () => confirmPaint();
      function cleanup() { video.removeEventListener('seeked', onSeeked); }
      video.addEventListener('seeked', onSeeked);

      const cur = video.currentTime;
      if (Math.abs(cur - t) < 1e-3 && video.readyState >= 2) {
        // No seek will occur (already at t) — just confirm the current frame.
        cleanup();
        confirmPaint();
        return;
      }
      try { video.currentTime = t; } catch { finish(); }
      setTimeout(finish, 3000); // safety net for a dropped 'seeked'
    });
  }

  _drawCover(ctx, video, W, H) {
    ctx.fillStyle = '#08060a'; ctx.fillRect(0, 0, W, H);
    const vw = video.videoWidth || W, vh = video.videoHeight || H;
    const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  // Pick the best AVAILABLE video codec → { codec (encoder string), muxer (mp4-muxer
  // codec), isAvc }. H.264 first (most compatible), then VP9, then AV1.
  async _pickVideo(W, H, fps) {
    const candidates = [
      { codec: 'avc1.640028', muxer: 'avc', isAvc: true },
      { codec: 'avc1.4d0028', muxer: 'avc', isAvc: true },
      { codec: 'avc1.42e028', muxer: 'avc', isAvc: true },
      { codec: 'avc1.640020', muxer: 'avc', isAvc: true },
      { codec: 'vp09.00.10.08', muxer: 'vp9', isAvc: false },
      { codec: 'av01.0.08M.08', muxer: 'av1', isAvc: false },
    ];
    for (const c of candidates) {
      try { const r = await window.VideoEncoder.isConfigSupported({ codec: c.codec, width: W, height: H, bitrate: 8_000_000, framerate: fps }); if (r && r.supported) return c; } catch { /* next */ }
    }
    return { codec: 'avc1.42e028', muxer: 'avc', isAvc: true }; // last-ditch; will throw on configure if truly absent
  }

  // Pick the best AVAILABLE audio codec → { codec, muxer } or null. AAC first, Opus fallback.
  async _pickAudio(sampleRate, channels) {
    const candidates = [
      { codec: 'mp4a.40.2', muxer: 'aac' },
      { codec: 'opus', muxer: 'opus' },
    ];
    for (const c of candidates) {
      try { const r = await window.AudioEncoder.isConfigSupported({ codec: c.codec, sampleRate, numberOfChannels: channels, bitrate: 128_000 }); if (r && r.supported) return c; } catch { /* next */ }
    }
    return null;
  }

  async _decodeVo(voUrl) {
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

  _encodeVoiceover(muxer, audioBuffer, durationSec, apick, setErr) {
    const AudioEncoder = window.AudioEncoder;
    const AudioData = window.AudioData;
    if (!audioBuffer || !AudioEncoder || !AudioData || !apick) return null;
    const aCh = Math.min(audioBuffer.numberOfChannels, 2);
    const aSr = audioBuffer.sampleRate;
    const aenc = new AudioEncoder({
      output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { setErr(e); } },
      error: (e) => setErr(e),
    });
    aenc.configure({ codec: apick.codec, sampleRate: aSr, numberOfChannels: aCh, bitrate: 128_000 });
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

  // Let the encoder queue drain so memory/backpressure stays bounded.
  _drain(venc) {
    return new Promise((resolve) => {
      const tick = () => { if (venc.encodeQueueSize <= 8) resolve(); else setTimeout(tick, 8); };
      tick();
    });
  }
}

export default SovereignFoundry;
