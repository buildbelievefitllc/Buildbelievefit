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
   * Snapshot the branded overlay → a TRUE 1080×1920 canvas. DOM-coupled but React-free.
   *
   * We DO NOT html2canvas the live stage: it lives inside StageScaler's
   * `transform: scale()`, and `await import('html2canvas')` yields to the event loop
   * long enough for a pending React re-render to re-apply that scale — html2canvas then
   * reads the shrunk getBoundingClientRect and stamps a mini render into the top-left
   * (the "PIP glitch"). Instead we CLONE the stage into an off-DOM, un-scaled, full-size
   * host that React never reconciles, strip the video/controls (overlay = brand only),
   * and rasterize the clone. Nothing can shrink it mid-capture.
   */
  static async captureOverlay(stageNode) {
    if (!stageNode) return null;
    let host = null;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const clone = stageNode.cloneNode(true);
      clone.querySelectorAll('.reel-video-v4, .reel-placeholder-v4, .reel-play-v4, .reel-vo-v4, .reel-progress-v4')
        .forEach((el) => el.remove());
      clone.style.transform = 'none';
      clone.style.width = TARGET_W + 'px';
      clone.style.height = TARGET_H + 'px';
      host = document.createElement('div');
      host.style.cssText = `position:fixed;left:-99999px;top:0;width:${TARGET_W}px;height:${TARGET_H}px;transform:none;pointer-events:none;z-index:-1;`;
      host.appendChild(clone);
      document.body.appendChild(host);
      return await html2canvas(clone, { backgroundColor: null, scale: 1, useCORS: true, imageTimeout: 4000, width: TARGET_W, height: TARGET_H });
    } catch { return null; }
    finally { if (host) { try { host.remove(); } catch { /* noop */ } } }
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

      // Decode + resample the voiceover FIRST so its real length drives the duration.
      // Any failure is captured as a REASON (never swallowed) and surfaced to the UI.
      let audioBuffer = null, audioError = null;
      if (voUrl) {
        const dec = await this._decodeVo(voUrl);
        if (dec.error) audioError = dec.error; else audioBuffer = dec.buffer;
      }
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
      if (audioBuffer && !apick) audioError = 'No AAC/Opus encoder in this browser';

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

      // ── FRAME CAPTURE ──
      // Composite one canvas frame (cover-fit footage + branded overlay) and push it
      // to the encoder. `frames` is shared so keyframe cadence + counts stay correct
      // across whichever capture path runs.
      const { VideoFrame } = window;
      const frameDurUs = Math.round(1e6 / fps);
      let frames = 0;
      const encodeAt = (tSec) => {
        this._drawCover(ctx, video, W, H);
        if (overlay) { try { ctx.drawImage(overlay, 0, 0, W, H); } catch { /* overlay optional */ } }
        const frame = new VideoFrame(canvas, { timestamp: Math.max(0, Math.round(tSec * 1e6)), duration: frameDurUs });
        venc.encode(frame, { keyFrame: frames % (fps * 2) === 0 });
        frame.close();
        frames += 1;
      };

      // PRIMARY: REAL-TIME capture. Play the muted clone and grab the frames the
      // browser actually PAINTS (requestVideoFrameCallback), looping the footage under
      // a longer voiceover. Wall-clock = reel length (~60–90s), not one decode per
      // frame (seeking was thousands of decodes → minutes). Falls back to the seek
      // loop only if playback never starts (no real frame arrives) or rVFC is absent.
      const getErr = () => encErr;
      if (typeof video.requestVideoFrameCallback === 'function') {
        try {
          await this._captureRealtime({ video, d, fps, footageDur, encodeAt, venc, onProgress, getErr });
        } catch (e) {
          if (e && e.message === 'play_failed') {
            frames = 0;
            await this._captureSeek({ video, d, fps, footageDur, encodeAt, venc, onProgress, getErr });
          } else { throw e; }
        }
      } else {
        await this._captureSeek({ video, d, fps, footageDur, encodeAt, venc, onProgress, getErr });
      }
      if (frames < 1) throw new Error('empty_recording');

      await venc.flush();
      if (aenc) await aenc.flush();
      if (encErr) throw encErr;
      muxer.finalize();

      const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
      try { venc.close(); } catch { /* noop */ }
      if (aenc) { try { aenc.close(); } catch { /* noop */ } }
      if (!blob.size) throw new Error('empty_recording');
      if (onProgress) onProgress(1);
      return { blob, ext: 'mp4', mime: 'video/mp4', audio: !!aenc, audioError, frames, durationSec: Math.round(d * 10) / 10 };
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

  // REAL-TIME capture: play the muted clone, encode the frames the browser paints.
  // Throttled to ~`fps` (so a 120 Hz display doesn't bloat the file), looped under a
  // longer voiceover, wall-clock timestamps (monotonic across loops). Resolves with
  // the frame count; rejects 'play_failed' ONLY if no frame ever arrives (→ seek path).
  _captureRealtime({ video, d, fps, footageDur, encodeAt, venc, onProgress, getErr }) {
    return new Promise((resolve, reject) => {
      video.loop = footageDur > 0 && d > footageDur + 0.05;
      const minDelta = (1 / fps) * 0.85; // throttle gate to target fps
      let t0 = null, lastEnc = -1, count = 0, finished = false, sawFrame = false;
      const finish = () => { if (finished) return; finished = true; try { video.pause(); } catch { /* noop */ } resolve(count); };
      const onFrame = (now) => {
        if (finished) return;
        if (getErr()) { finish(); return; }
        sawFrame = true;
        if (t0 === null) t0 = now;
        const tSec = (now - t0) / 1000;
        if (tSec >= d) { finish(); return; }
        // Encode at most ~fps frames/s; drop a frame if the encoder is backed up so
        // memory can't balloon (rare on hardware H.264).
        if ((lastEnc < 0 || tSec - lastEnc >= minDelta) && venc.encodeQueueSize < 60) {
          encodeAt(tSec); lastEnc = tSec; count += 1;
          if (onProgress) onProgress(Math.min(0.95, (tSec / d) * 0.95));
        }
        video.requestVideoFrameCallback(onFrame);
      };
      video.addEventListener('ended', () => finish(), { once: true }); // fires only when not looping
      video.requestVideoFrameCallback(onFrame);
      try { video.currentTime = 0; } catch { /* noop */ }
      video.play().catch(() => { /* muted autoplay; rVFC is the real signal */ });
      setTimeout(() => { if (!sawFrame && !finished) { finished = true; try { video.pause(); } catch { /* noop */ } reject(new Error('play_failed')); } }, 5000);
    });
  }

  // FALLBACK: frame-exact seek loop (used when rVFC is unavailable or playback never
  // starts). Slower — one decode per frame — but deterministic.
  async _captureSeek({ video, d, fps, footageDur, encodeAt, venc, onProgress, getErr }) {
    const totalFrames = Math.max(1, Math.round(d * fps));
    for (let i = 0; i < totalFrames; i++) {
      if (getErr()) throw getErr();
      const tSec = i / fps;
      const seekT = footageDur > 0 ? Math.min(tSec % footageDur, footageDur - 1e-3) : tSec;
      await this._seekReady(video, Math.max(0, seekT));
      encodeAt(tSec);
      if (onProgress) onProgress(Math.min(0.95, (i / totalFrames) * 0.95));
      if (venc.encodeQueueSize > 16) await this._drain(venc);
    }
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

  // Fetch + decode + RESAMPLE the voiceover to a fixed 48 kHz. A sample-rate mismatch
  // between the AudioBuffer and the AudioEncoder makes WebCodecs silently drop data
  // (the "audio drop"); pinning everything to 48 kHz removes that whole class of bug.
  // Returns { buffer } on success or { error: '<reason>' } — NEVER a silent null —
  // so the UI can state exactly why audio failed (CORS / Decode / etc.).
  async _decodeVo(voUrl) {
    const TARGET_SR = 48_000;
    // ── CORS fetch ──
    let arr;
    try {
      const res = await fetch(voUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
      if (!res.ok) return { error: `Fetch ${res.status}` };
      arr = await res.arrayBuffer();
    } catch { return { error: 'CORS / network' }; }
    if (!arr || arr.byteLength < 16) return { error: 'Empty file' };

    // ── Decode (MP3/WAV/etc.) ──
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return { error: 'No AudioContext' };
    let decoded;
    try {
      const ac = new AC();
      decoded = await ac.decodeAudioData(arr.slice(0));
      try { ac.close(); } catch { /* noop */ }
    } catch { return { error: 'Decode' }; }
    if (!decoded || !decoded.length) return { error: 'Decode (empty)' };

    // ── Resample to TARGET_SR so the encoder rate always matches the data ──
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || decoded.sampleRate === TARGET_SR) return { buffer: decoded };
    try {
      const ch = Math.min(decoded.numberOfChannels, 2);
      const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_SR));
      const oac = new OAC(ch, frames, TARGET_SR);
      const node = oac.createBufferSource();
      node.buffer = decoded;
      node.connect(oac.destination);
      node.start();
      const resampled = await oac.startRendering();
      return { buffer: resampled };
    } catch { return { buffer: decoded }; } // resample failed → still ship audio at native rate
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
