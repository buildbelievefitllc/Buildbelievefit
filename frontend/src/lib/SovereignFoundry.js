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
import { captionState } from './captionTiming.js';

const TARGET_W = 1080;
const TARGET_H = 1920;

// Video codec preference — H.264 (AVC) first (most social-compatible), then VP9,
// then AV1. SHARED by the encoder's _pickVideo AND the pre-export codec probe
// (probeVideoCodec) so the Studio's fallback warning can NEVER disagree with what
// the encoder actually selects at render time.
const VIDEO_CODEC_CANDIDATES = [
  { codec: 'avc1.640028', muxer: 'avc', isAvc: true },
  { codec: 'avc1.4d0028', muxer: 'avc', isAvc: true },
  { codec: 'avc1.42e028', muxer: 'avc', isAvc: true },
  { codec: 'avc1.640020', muxer: 'avc', isAvc: true },
  { codec: 'vp09.00.10.08', muxer: 'vp9', isAvc: false },
  { codec: 'av01.0.08M.08', muxer: 'av1', isAvc: false },
];

// Phone-backdrop frame skins — mirrors phone-frame-v4's CSS gradients
// (sovereignStudioV4.css). Drawn natively on canvas (see _drawPhoneFrame) rather
// than rasterized via html2canvas, which doesn't reliably capture a rounded,
// box-shadowed element forced transparent for a video hole — the frame is instead
// stripped from the html2canvas overlay clone entirely (captureOverlay) and
// reconstructed here with plain, deterministic Canvas 2D drawing.
const PHONE_FRAME_SKINS = {
  sleek: ['#3a3744', '#232029', '#17151c'],
  gold: ['#6a5a16', '#4a3e0c', '#241d06'],
  carbon: ['#1c1c20', '#101013', '#070708'],
};

// Builds (but does not begin/stroke/fill) a rounded-rect subpath on the CURRENT
// path — callers control beginPath()/fill()/stroke()/clip() so multiple calls can
// accumulate into one compound path (e.g. an evenodd "donut" clip).
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
   *
   * CRITICAL: the stage's own CSS background (.stage-reel-v4 { background:#08060a }) is
   * OPAQUE. If we capture it, the overlay becomes a solid frame that, drawn over the
   * footage, BURIES the video → a black reel with only the brand text/gradients showing.
   * So we force the clone (and its background-bearing sub-layers) TRANSPARENT — only the
   * intended gradients (rgba) and text survive, and the video shows through everywhere else.
   */
  static async captureOverlay(stageNode) {
    if (!stageNode) return null;
    let host = null;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const clone = stageNode.cloneNode(true);
      // Phone-backdrop mode: the whole mock-up (bezel + notch + screen) is stripped
      // here and redrawn natively on canvas by render()/_drawPhoneFrame instead —
      // html2canvas doesn't reliably rasterize phone-frame-v4's rounded, box-shadowed
      // bezel with a punched-transparent screen hole (this WAS attempted via a
      // forced-transparent .phone-screen-v4 background; in practice it produced a
      // solid, undercut bezel shape and an opaque hole that buried the footage).
      // CRITICAL — strip the LIVE karaoke caption layer (.reel-caption-v4) too. The
      // export bakes captions PER FRAME via _drawCaptions (they move with the voice),
      // so if we ALSO rasterize the live caption element into this one-shot overlay we
      // get a second, FROZEN copy of whatever phrase was on screen at capture time —
      // baked motionless behind the moving text (the "still shot behind the captions"
      // reported on IG/FB posts). The dynamic baker is the single source of captions.
      clone.querySelectorAll('.reel-video-v4, .reel-placeholder-v4, .reel-play-v4, .reel-vo-v4, .reel-progress-v4, .phone-frame-v4, .reel-caption-v4, .spot-video-v4, .spot-vid-ph-v4, .spot-play-v4, .spot-progress-v4, .spot-vo-v4')
        .forEach((el) => el.remove());
      // Kill the opaque stage background so the footage isn't buried by the overlay.
      clone.style.transform = 'none';
      clone.style.width = TARGET_W + 'px';
      clone.style.height = TARGET_H + 'px';
      clone.style.background = 'transparent';
      clone.style.backgroundColor = 'transparent';
      host = document.createElement('div');
      host.style.cssText = `position:fixed;left:-99999px;top:0;width:${TARGET_W}px;height:${TARGET_H}px;transform:none;pointer-events:none;z-index:-1;background:transparent;`;
      host.appendChild(clone);
      document.body.appendChild(host);
      return await html2canvas(clone, { backgroundColor: null, scale: 1, useCORS: true, imageTimeout: 4000, width: TARGET_W, height: TARGET_H });
    } catch { return null; }
    finally { if (host) { try { host.remove(); } catch { /* noop */ } } }
  }

  /**
   * Render the reel.
   * Audio contract (the REAL Audio Mix Console): `voUrl` is the voice/content
   * track (its length can drive the reel duration); `musicUrl` is the backing
   * track — looped to fill, DUCKED under the voice, and never allowed to extend
   * the reel. `footageUrl` is the uploaded clip's OWN baked-in audio (e.g. music
   * already inside the video) — mixed as a THIRD channel, looped + ducked exactly
   * like the music track. `voGain`/`musicGain`/`footageGain` (0–1) are the console
   * sliders — the exported mix is the same mix the preview plays, not a
   * single-track approximation.
   * @returns {Promise<{blob:Blob, ext:'mp4', mime:'video/mp4', audio:boolean, frames:number, durationSec:number}>}
   */
  async render({ videoUrl, voUrl = null, musicUrl = null, footageUrl = null, voGain = 1, musicGain = 1, footageGain = 1, overlay = null, videoRect = null, frameRect = null, phoneFrame = 'sleek', captions = null, captionsEnabled = false, captionPos = 62, captionStyle = null, width = TARGET_W, height = TARGET_H, fps = 30, durationCap = 90, audioIsDurationMaster = false, onProgress } = {}) {
    if (!SovereignFoundry.isSupported()) throw new Error('no_webcodecs');
    if (!videoUrl) throw new Error('no_footage');

    const W = width, H = height;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });

    // Dynamic karaoke captions bake PER FRAME (they change with the voice time), so
    // they can't ride the static captured overlay. Resolve the transcript once and
    // ensure the caption face is loaded before the frame loop paints it on canvas.
    // captionStyle (Caption Style Studio) carries { font, sizePx, color, highlight,
    // chunk } — same values the DOM preview applied, so the bake matches 1:1.
    const captionWords = (captionsEnabled && Array.isArray(captions?.words) && captions.words.length) ? captions.words : null;
    const capStyle = this._normalizeCaptionStyle(captionStyle);
    if (captionWords) {
      try { await document.fonts?.load?.(`800 ${capStyle.sizePx}px ${capStyle.family}`); } catch { /* fall back to the default sans */ }
    }

    const video = this._makeVideo(videoUrl);
    let encErr = null;
    const setErr = (e) => { if (!encErr) encErr = e; };

    try {
      await this._whenReady(video);
      // FAIL FAST, NEVER GRIND: if the footage did not produce a decodable frame
      // (dead/revoked blob URL after a tab reclaim, unsupported codec, media error,
      // the browser refusing a second decoder), abort with a clear reason NOW.
      // Before this guard, a broken video slid past the readiness wait and fell
      // into the seek loop, where every frame burned the full seek safety timeout —
      // hours of silent black-frame encoding that the UI showed as "stuck at 0%".
      if (video.error || !(video.videoWidth > 0) || video.readyState < 2) {
        throw new Error('footage_load_failed');
      }
      if (onProgress) onProgress(0.02); // footage decoded — the engine is alive
      const footageDur = (Number.isFinite(video.duration) && video.duration > 0) ? video.duration : 0;

      // Decode + resample the voiceover FIRST so its real length drives the duration.
      // Any failure is captured as a REASON (never swallowed) and surfaced to the UI.
      // The music track decodes alongside it but NEVER influences duration — backing
      // music is looped/trimmed to the reel, not the other way round.
      let audioBuffer = null, audioError = null;
      let voBuffer = null, musicBuffer = null, footageBuffer = null;
      if (voUrl) {
        const dec = await this._decodeVo(voUrl);
        if (dec.error) audioError = `Voice: ${dec.error}`; else voBuffer = dec.buffer;
      }
      if (musicUrl) {
        const dec = await this._decodeVo(musicUrl);
        if (dec.error) audioError = [audioError, `Music: ${dec.error}`].filter(Boolean).join(' · ');
        else musicBuffer = dec.buffer;
      }
      if (footageUrl) {
        // The clip's OWN audio track. A footage file may legitimately have NO audio
        // (silent b-roll) — so a decode miss here is BENIGN and never joins
        // `audioError`, keeping the "audio failed" warning honest (it fires only when
        // a track the user actually chose to hear couldn't be baked).
        const dec = await this._decodeVo(footageUrl);
        if (!dec.error) footageBuffer = dec.buffer;
      }
      const voDur = voBuffer ? (voBuffer.length / voBuffer.sampleRate) : 0;
      if (onProgress) onProgress(0.04); // audio fetched + decoded

      // Ad Compiler contract (audioIsDurationMaster): the final MP4 runs EXACTLY
      // the audio track's length — shorter footage loops beneath it (unchanged),
      // LONGER footage is simply cut short, rather than the default reel-export
      // behavior of always running the max of the two. Falls back to the default
      // max-based duration when no audio was supplied (there's nothing to master to).
      const naturalDur = (audioIsDurationMaster && voDur > 0)
        ? voDur
        : (Math.max(footageDur, voDur) || footageDur || voDur || durationCap);
      const d = Math.max(0.1, Math.min(naturalDur, durationCap));

      // ── THE REAL MIXDOWN ── voice + looped/ducked music + looped/ducked clip audio
      // at the console's slider levels, rendered offline to one buffer of exactly
      // `d` seconds. Falls back to the first available raw buffer if the mix itself
      // fails (audio still ships).
      if (voBuffer || musicBuffer || footageBuffer) {
        const mix = await this._buildAudioMix({ voBuffer, musicBuffer, footageBuffer, voGain, musicGain, footageGain, durationSec: d });
        if (mix.buffer) audioBuffer = mix.buffer;
        else {
          audioBuffer = voBuffer || musicBuffer || footageBuffer;
          const raw = voBuffer ? 'voice' : musicBuffer ? 'music' : 'clip';
          audioError = [audioError, `Mixdown: ${mix.error || 'failed'} — shipped the raw ${raw} track instead`].filter(Boolean).join(' · ');
        }
      }

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
      // MAX-QUALITY FLOOR (CEO mandate): 12 Mbps 1080x1920 H.264 — the WebCodecs
      // equivalent of MediaRecorder videoBitsPerSecond:12_000_000. 8 Mbps was ~30-45%
      // under IG/TikTok/YouTube ingest spec for 1080x1920@30, so their re-encoder was
      // starting from a soft source. 12 Mbps survives the platform transcode.
      const vconf = { codec: vpick.codec, width: W, height: H, bitrate: 12_000_000, framerate: fps };
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
        this._drawCover(ctx, video, W, H, videoRect);
        // Phone-backdrop mock-up — drawn AFTER the footage (so its bezel donut-clip
        // never covers the just-drawn video) and BEFORE the overlay (so brand/hook/
        // watch-button text still paints on top of the bezel, same stacking as the
        // live DOM preview's z-index).
        if (videoRect && frameRect) this._drawPhoneFrame(ctx, frameRect, videoRect, phoneFrame);
        if (overlay) { try { ctx.drawImage(overlay, 0, 0, W, H); } catch { /* overlay optional */ } }
        // Karaoke captions — drawn LAST (on top of everything) at this frame's voice
        // time. Wrapped so a caption glitch can never abort the encode.
        if (captionWords) { try { this._drawCaptions(ctx, tSec, W, H, captionWords, captionPos, capStyle); } catch { /* captions optional */ } }
        const frame = new VideoFrame(canvas, { timestamp: Math.max(0, Math.round(tSec * 1e6)), duration: frameDurUs });
        venc.encode(frame, { keyFrame: frames % (fps * 2) === 0 });
        frame.close();
        frames += 1;
      };

      // PRIMARY: REAL-TIME capture (wall-clock ≈ reel length, not one decode per frame).
      // But FIRST pre-flight that playback actually yields non-black pixels on THIS
      // browser — some suspend decode for a backgrounded video. If the probe is black
      // (or rVFC is absent), use the slower-but-bulletproof seek loop so the export is
      // NEVER black. This decision is made WITHOUT polluting the encoder stream.
      const getErr = () => encErr;
      let useRealtime = false;
      if (typeof video.requestVideoFrameCallback === 'function') {
        useRealtime = await this._probePlaybackDecodes(video, ctx, W, H);
      }
      if (useRealtime) {
        try {
          await this._captureRealtime({ video, d, fps, footageDur, encodeAt, venc, onProgress, getErr });
          if (frames < 1) { await this._captureSeek({ video, d, fps, footageDur, encodeAt, venc, onProgress, getErr }); }
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
    // CRITICAL: a real, on-screen, ON-TOP size. Chrome SUSPENDS video decode for an
    // element that is effectively invisible (2px / behind opaque content / off-screen)
    // — during PLAYBACK that means drawImage samples black. So we keep the clone in the
    // viewport, on top, at a real size, but at opacity 0.01 (imperceptible, and the
    // recording overlay covers it). Seeking forced a decode regardless; real-time does not.
    v.style.cssText = 'position:fixed;left:0;top:0;width:160px;height:284px;opacity:0.01;pointer-events:none;z-index:2147483647;';
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

  // Pre-flight: does PLAYBACK actually decode visible pixels on this browser? Plays
  // briefly, samples a grid of the painted frames for any non-black pixel, then rewinds.
  // Returns true → real-time is safe; false → fall back to seek (so output is never black).
  _probePlaybackDecodes(video, ctx, W, H) {
    return new Promise((resolve) => {
      let done = false, checks = 0;
      const finish = (v) => {
        if (done) return; done = true;
        try { video.pause(); } catch { /* noop */ }
        try { video.currentTime = 0; } catch { /* noop */ }
        resolve(v);
      };
      const hasContent = () => {
        // Deliberately NOT passed videoRect here: this probe samples a grid across the
        // FULL canvas, and phone-backdrop footage only fills a smaller centered rect —
        // most probe points would land on the (dark) surrounding background and read as
        // "no content" even with a perfectly healthy decode. That just means backdrop
        // reels fall back to the slower-but-bulletproof seek-capture path more often;
        // correctness is unaffected either way, so it's not worth a rect-aware probe.
        this._drawCover(ctx, video, W, H);
        try {
          for (let gx = 1; gx < 5; gx++) {
            for (let gy = 1; gy < 5; gy++) {
              const px = Math.floor((gx * W) / 5), py = Math.floor((gy * H) / 5);
              const d = ctx.getImageData(px, py, 1, 1).data;
              if (d[0] + d[1] + d[2] > 48) return true;
            }
          }
        } catch { return true; } // tainted canvas → can't sample; prefer real-time
        return false;
      };
      // Decide on SUSTAINED decode: require content in a LATER frame (≥6), not just the
      // first — some browsers decode the initial frame then suspend a backgrounded video.
      let laterContent = false;
      const onFrame = () => {
        if (done) return;
        checks += 1;
        if (checks >= 6 && hasContent()) laterContent = true;
        if (checks >= 12) { finish(laterContent); return; }
        video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
      video.play().catch(() => { /* muted autoplay; rVFC is the signal */ });
      setTimeout(() => finish(laterContent), 3000); // ran out of time → use what we saw
    });
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
        // Encode at most ~fps frames/s. The backpressure watermark is raised to 120
        // (from 60) so transient memory/CPU pressure in a long-lived tab lets the
        // hardware H.264 queue drain rather than SILENTLY DROPPING FRAMES — dropped
        // frames were the one in-code mechanism that made exports progressively
        // choppier the longer a studio session ran. Frame rate / resolution are never
        // sacrificed for memory; the queue still bounds runaway growth on slow encoders.
        if ((lastEnc < 0 || tSec - lastEnc >= minDelta) && venc.encodeQueueSize < 120) {
          encodeAt(tSec); lastEnc = tSec; count += 1;
          if (onProgress) onProgress(Math.min(0.95, 0.05 + (tSec / d) * 0.9));
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
    // STALL GUARD: _seekReady tells us whether each seek confirmed via a real
    // 'seeked' signal or only via its 3s safety net. A video that stops seeking
    // (media error mid-render, evicted blob, hung decoder) burns that net on EVERY
    // frame — 3s × thousands of frames of black output while the UI reads "0%".
    // Five consecutive dead seeks ≈ 15s of zero real signals → abort with a reason.
    let deadSeeks = 0;
    for (let i = 0; i < totalFrames; i++) {
      if (getErr()) throw getErr();
      const tSec = i / fps;
      const seekT = footageDur > 0 ? Math.min(tSec % footageDur, footageDur - 1e-3) : tSec;
      const live = await this._seekReady(video, Math.max(0, seekT));
      deadSeeks = live ? 0 : deadSeeks + 1;
      if (deadSeeks >= 5) throw new Error('seek_stalled');
      encodeAt(tSec);
      if (onProgress) onProgress(Math.min(0.95, 0.05 + (i / totalFrames) * 0.9));
      if (venc.encodeQueueSize > 16) await this._drain(venc);
    }
  }

  // Wait until the footage has metadata AND a first decoded frame is available.
  // Resolves on ready, on a MEDIA ERROR (dead/revoked URL, unsupported codec —
  // the 'error' event, previously unheard, which left a broken video to slide
  // into the frame loop), or after the hard safety net. The caller inspects
  // video.error / videoWidth / readyState and fails fast on a broken element.
  _whenReady(video) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; cleanup(); resolve(); };
      const check = () => { if (video.readyState >= 2 && video.videoWidth > 0) finish(); };
      const onMeta = () => check();
      const onData = () => check();
      const onError = () => finish(); // media error — resolve NOW, caller sees video.error
      function cleanup() {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('loadeddata', onData);
        video.removeEventListener('canplay', onData);
        video.removeEventListener('error', onError);
      }
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('loadeddata', onData);
      video.addEventListener('canplay', onData);
      video.addEventListener('error', onError);
      check();
      setTimeout(finish, 8000); // hard safety net
    });
  }

  // Seek to t and resolve only once the EXACT decoded frame is painted/presentable.
  // 'seeked' = decode done; one requestVideoFrameCallback = frame propagated to the
  // compositor (so drawImage samples the real target frame, never a stale one).
  // Resolves `true` when a REAL signal confirmed the frame ('seeked' fired), `false`
  // when only the 3s last-resort net fired — the caller's stall guard counts those.
  _seekReady(video, t) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (live = true) => { if (settled) return; settled = true; cleanup(); resolve(live); };
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
      try { video.currentTime = t; } catch { finish(false); } // can't even seek — dead
      setTimeout(() => finish(false), 3000); // safety net for a dropped 'seeked' — a dead signal
    });
  }

  // videoRect (phone-backdrop mode, see reelPhoneBackdrop.js): cover-fit the footage
  // into that smaller rect only, clipped to its rounded corners, over the same
  // gradient the DOM's .has-phone-backdrop uses — instead of full-bleeding the whole
  // canvas. The phone-frame bezel/notch is drawn afterward by the caller (_drawPhoneFrame).
  _drawCover(ctx, video, W, H, videoRect) {
    if (videoRect) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0d0118'); g.addColorStop(1, '#08060a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const { x, y, width: w, height: h, radius = 0 } = videoRect;
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, x, y, w, h, radius);
      ctx.clip();
      const vw = video.videoWidth || w, vh = video.videoHeight || h;
      const s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s;
      ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#08060a'; ctx.fillRect(0, 0, W, H);
    const vw = video.videoWidth || W, vh = video.videoHeight || H;
    const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  // Caption Style Studio → normalized canvas style. Defaults reproduce the
  // historical baked-in look (Barlow Condensed 800 · 58px · white fill · BBF-gold
  // active box · 4-word phrases) so an untouched editor exports byte-identically.
  _normalizeCaptionStyle(style) {
    const FAMILIES = {
      barlow: '"Barlow Condensed", sans-serif',
      bebas:  '"Bebas Neue", sans-serif',
      anton:  '"Anton", sans-serif',
    };
    const family = FAMILIES[style?.font] || FAMILIES.barlow;
    const sizePx = Math.max(32, Math.min(110, Math.round(Number(style?.sizePx) || 58)));
    const color = /^#[0-9a-fA-F]{6}$/.test(String(style?.color || '')) ? style.color : '#ffffff';
    const highlight = /^#[0-9a-fA-F]{6}$/.test(String(style?.highlight || '')) ? style.highlight : '#f5c800';
    const chunk = Math.max(2, Math.min(6, Math.round(Number(style?.chunk) || 4)));
    return { family, sizePx, color, highlight, chunk };
  }

  // Karaoke captions, baked onto the frame — the canvas twin of the DOM preview's
  // .reel-caption-v4 / .cap-word-v4 styling. Same captionState() timing (and the
  // same Caption Style Studio values) the preview uses, so the exported words,
  // face, colors and highlight match frame-for-frame.
  // `posPct` is the vertical center (% of H) from the Caption Position slider.
  _drawCaptions(ctx, tSec, W, H, words, posPct, style) {
    const st = style || this._normalizeCaptionStyle(null);
    const state = captionState(words, tSec, st.chunk);
    if (!state || !state.chunk.length) return;
    const FS = st.sizePx, GAP = 14, LGAP = 12, PADX = 12, PADY = 6, RAD = 8;
    ctx.save();
    ctx.font = `800 ${FS}px ${st.family}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';

    // Measure each word, then greedily wrap into lines within 84% of the width.
    const maxW = W * 0.84;
    const items = state.chunk.map((w, i) => ({ text: w.text, active: i === state.active, w: ctx.measureText(w.text).width }));
    const lines = [];
    let cur = [], curW = 0;
    for (const it of items) {
      const addW = (cur.length ? GAP : 0) + it.w;
      if (cur.length && curW + addW > maxW) { lines.push({ items: cur, width: curW }); cur = []; curW = 0; }
      curW += (cur.length ? GAP : 0) + it.w;
      cur.push(it);
    }
    if (cur.length) lines.push({ items: cur, width: curW });

    const lineH = FS + LGAP;
    const totalH = lines.length * lineH - LGAP;
    const centerY = H * (Math.max(0, Math.min(100, Number(posPct) || 62)) / 100);
    let baseline = centerY - totalH / 2 + FS; // baseline of the first line
    for (const line of lines) {
      let x = (W - line.width) / 2;
      for (const it of line.items) {
        if (it.active) {
          ctx.fillStyle = st.highlight;
          ctx.beginPath();
          roundRectPath(ctx, x - PADX / 2, baseline - FS + 4, it.w + PADX, FS + PADY, RAD);
          ctx.fill();
        }
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#000';
        ctx.strokeText(it.text, x, baseline);
        ctx.fillStyle = st.color;
        ctx.fillText(it.text, x, baseline);
        x += it.w + GAP;
      }
      baseline += lineH;
    }
    ctx.restore();
  }

  // Phone-backdrop bezel + notch, drawn NATIVELY on canvas (not via html2canvas — see
  // captureOverlay's comment for why). frameRect is the outer mock-up box, screenRect
  // the inner cutout the footage was just cover-fit into by _drawCover.
  //
  // The bezel is filled through an EVEN-ODD "donut" clip (outer rounded-rect minus the
  // inner screen rounded-rect), so its fill can never paint over the footage that's
  // already sitting in the screen rect — no destination-out/alpha trickery needed,
  // which also means this works fine on the alpha:false compositing canvas.
  _drawPhoneFrame(ctx, frameRect, screenRect, skin) {
    const stops = PHONE_FRAME_SKINS[skin] || PHONE_FRAME_SKINS.sleek;
    const { left: fx, top: fy, width: fw, height: fh, radius: fr = 78, notch } = frameRect;

    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, fx, fy, fw, fh, fr);
    roundRectPath(ctx, screenRect.x, screenRect.y, screenRect.width, screenRect.height, screenRect.radius);
    ctx.clip('evenodd');
    const g = ctx.createLinearGradient(fx, fy, fx, fy + fh);
    g.addColorStop(0, stops[0]); g.addColorStop(0.45, stops[1]); g.addColorStop(1, stops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.restore();

    // Rim highlight tracing the screen cutout — mirrors the CSS frame's inset box-shadow bezel line.
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, screenRect.x - 1.5, screenRect.y - 1.5, screenRect.width + 3, screenRect.height + 3, screenRect.radius + 1.5);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(130, 122, 148, 0.55)';
    ctx.stroke();
    ctx.restore();

    // Notch (camera dot), same fixed size/offset as .phone-notch-v4.
    if (notch) {
      const r = notch.diameter / 2;
      ctx.save();
      ctx.fillStyle = '#06060a';
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + notch.top + r, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Pick the best AVAILABLE video codec → { codec (encoder string), muxer (mp4-muxer
  // codec), isAvc }. H.264 first (most compatible), then VP9, then AV1.
  async _pickVideo(W, H, fps) {
    for (const c of VIDEO_CODEC_CANDIDATES) {
      try { const r = await window.VideoEncoder.isConfigSupported({ codec: c.codec, width: W, height: H, bitrate: 12_000_000, framerate: fps }); if (r && r.supported) return c; } catch { /* next */ }
    }
    return { codec: 'avc1.42e028', muxer: 'avc', isAvc: true }; // last-ditch; will throw on configure if truly absent
  }

  // PRE-EXPORT CODEC PROBE — runs the SAME isConfigSupported checks _pickVideo uses,
  // WITHOUT rendering, so the Studio can warn BEFORE a job that would fall off H.264.
  //   • { supported:false }            → WebCodecs absent entirely (export unavailable).
  //   • { willFallback:true }          → no H.264/AVC encoder; export uses VP9/AV1
  //                                      (a container/codec social platforms recompress
  //                                      hard → softer posted quality).
  //   • { willFallback:false, isAvc }  → H.264 available; maximum-quality path.
  static async probeVideoCodec({ width = TARGET_W, height = TARGET_H, fps = 30 } = {}) {
    if (!SovereignFoundry.isSupported()) return { supported: false, codec: null, isAvc: false, willFallback: false };
    for (const c of VIDEO_CODEC_CANDIDATES) {
      try {
        const r = await window.VideoEncoder.isConfigSupported({ codec: c.codec, width, height, bitrate: 12_000_000, framerate: fps });
        if (r && r.supported) return { supported: true, codec: c.codec, isAvc: c.isAvc, willFallback: !c.isAvc };
      } catch { /* next */ }
    }
    // WebCodecs present but nothing config-supported → warn (the render's last-ditch
    // AVC would likely fail too); treat as a fallback-risk state.
    return { supported: true, codec: null, isAvc: false, willFallback: true };
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
    // ── CORS fetch — bounded at 30s. This fetch runs BEFORE any frame is captured
    // (0% on the progress bar); untimed, a stalled-but-open connection froze the
    // whole render there indefinitely. A timeout surfaces as a normal audio-decode
    // failure ('Timeout'), which the render treats as audio-missing, never fatal. ──
    let arr;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 30_000);
    try {
      const res = await fetch(voUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: abort.signal });
      if (!res.ok) return { error: `Fetch ${res.status}` };
      arr = await res.arrayBuffer();
    } catch (e) {
      return { error: e?.name === 'AbortError' ? 'Timeout' : 'CORS / network' };
    } finally { clearTimeout(timer); }
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

  // Compose the FINAL soundtrack the export bakes: voice + backing music with the
  // Audio Mix Console's per-track gains, the music looped to fill the whole reel
  // and DUCKED to 25% under the voice (easing back up over 0.4s once the voice
  // ends — broadcast-style sidechain feel via gain automation), all rendered
  // offline to one buffer of exactly `durationSec`. This is what makes the mix
  // console REAL: the preview mix and the shipped MP4 are the same mix.
  async _buildAudioMix({ voBuffer = null, musicBuffer = null, footageBuffer = null, voGain = 1, musicGain = 1, footageGain = 1, durationSec }) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const clamp01 = (g) => { const n = Number(g); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1; };
    const vg = clamp01(voGain), mg = clamp01(musicGain), fg = clamp01(footageGain);
    if (!voBuffer && !musicBuffer && !footageBuffer) return { error: 'No audio' };
    // Single-track passthrough at unity gain → nothing to mix; ship the decoded
    // buffer as-is (the Ad Compiler / legacy single-track path, byte-identical
    // output). Applies to voice-only, or clip-audio-only, when no other channel is
    // present and its own slider sits at 100%.
    if (!musicBuffer && !footageBuffer && voBuffer && vg === 1) return { buffer: voBuffer };
    if (!voBuffer && !musicBuffer && footageBuffer && fg === 1) return { buffer: footageBuffer };
    if (!OAC) return { error: 'No OfflineAudioContext' };
    try {
      const sr = 48_000;
      const frames = Math.max(1, Math.ceil(durationSec * sr));
      const oac = new OAC(2, frames, sr);
      const voDur = voBuffer ? voBuffer.length / voBuffer.sampleRate : 0;

      // A BACKING source (music or the clip's own audio): looped to fill the reel,
      // and — when a voice track is present — DUCKED to 25% under the voice, easing
      // back up over 0.4s once the voice ends (broadcast-style sidechain). Shared by
      // both backing channels so music and clip audio behave identically.
      const addBackingSource = (buf, gain) => {
        const g = clamp01(gain);
        if (!buf || g <= 0) return;
        const gainNode = oac.createGain();
        if (voBuffer && voDur > 0.05) {
          const ducked = g * 0.25;
          const rampAt = Math.min(voDur, durationSec);
          gainNode.gain.setValueAtTime(ducked, 0);
          gainNode.gain.setValueAtTime(ducked, Math.max(0, rampAt - 0.01));
          gainNode.gain.linearRampToValueAtTime(g, Math.min(rampAt + 0.4, durationSec));
        } else {
          gainNode.gain.value = g;
        }
        const src = oac.createBufferSource();
        src.buffer = buf;
        src.loop = true; // a short track fills the whole reel; a long one is trimmed
        src.connect(gainNode);
        gainNode.connect(oac.destination);
        src.start(0);
        src.stop(durationSec);
      };

      if (voBuffer) {
        const vGainNode = oac.createGain();
        vGainNode.gain.value = vg;
        const vs = oac.createBufferSource();
        vs.buffer = voBuffer;
        vs.connect(vGainNode);
        vGainNode.connect(oac.destination);
        vs.start(0);
      }
      addBackingSource(musicBuffer, mg);
      addBackingSource(footageBuffer, fg);

      const buffer = await oac.startRendering();
      return { buffer };
    } catch (e) {
      return { error: (e && e.message) || 'render' };
    }
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
    // 192 kbps AAC — matches the upgraded 192 kbps voiceover source and survives the
    // platform re-transcode cleanly (the file-size cost is trivial).
    aenc.configure({ codec: apick.codec, sampleRate: aSr, numberOfChannels: aCh, bitrate: 192_000 });
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
