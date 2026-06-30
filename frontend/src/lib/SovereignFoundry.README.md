# SovereignFoundry — reel export engine (LOCKED, do not regress)

`SovereignFoundry.js` is the Sovereign Studio V4 reel export engine. It is a pure
**Vanilla ES6 class, 100% independent of React** (CEO order — the Isolation Protocol).
React instantiates it, hands it `{ videoUrl, voUrl, overlay, container }`, and steps
away. It produces a clean, unfragmented, faststart **MP4** with **real motion + the
Sovereign Voiceover baked in**, that plays on Windows / Android / Instagram / Facebook
without relying on a platform re-encode.

> This file documents the bugs that cost ~14 build cycles to find. **Each guardrail
> below maps to a real failure the CEO hit in production. Do not undo one without
> re-running the Chromium verification (see bottom) and proving the regression doesn't
> return.** Status: **PASS** (CEO-confirmed working as of the v191 service-worker build).

## Pipeline

1. Load the footage into a private, muted, off-DOM `<video>` (the capture clone).
2. Decode + **resample the voiceover to a fixed 48 kHz** (OfflineAudioContext) and
   encode it to AAC (Opus fallback). The VO is the gold.
3. Capture video frames (see capture strategy) → composite cover-fit footage **then**
   the branded overlay onto a 1080×1920 canvas → WebCodecs `VideoEncoder` (H.264; VP9
   fallback).
4. Mux video + audio with `mp4-muxer` (`fastStart: 'in-memory'`).
   `duration = min(cap, max(footageDuration, voiceoverDuration))` — short footage
   **loops** beneath a longer voiceover so the audio is never truncated.

## The five bugs we killed — and the guardrail for each

1. **Frozen export (seek keyframe-snap).** Early engines pulled frames by seeking; on
   some browsers `currentTime=` snapped to the nearest keyframe → the same frame
   repeated → a still. Guardrail: real-time `requestVideoFrameCallback` capture is the
   primary path; the seek path waits for the decoded frame before sampling.

2. **Truncated reel.** Duration was capped at footage length, cutting off the voiceover
   (the 4.6 s exports). Guardrail: duration is driven by the **longer** of footage/VO,
   footage loops beneath the VO. Never cap the reel to footage length again.

3. **Silent voiceover.** The AudioEncoder was fed at the source sample rate; a mismatch
   makes WebCodecs **silently drop** audio. Guardrail: **always resample the VO to a
   fixed 48 kHz** before encoding, and **bubble** any fetch/decode failure to the UI
   (`audioError`) — never swallow it to a silent null.

4. **Black screen — TWO independent causes (this one hid the longest):**
   - **Opaque overlay burying the video.** `captureOverlay` clones `.stage-reel-v4`,
     whose CSS background is **opaque (`#08060a`)**; rasterizing it produced a solid
     frame that covered the footage. Guardrail: force the clone background
     **transparent** before `html2canvas` — only the intended rgba gradients + text may
     survive. **Never capture the stage's opaque background.**
   - **Decode suspension.** Chrome suspends video decode for an effectively-invisible
     element; during *playback* the hidden clone fed black. Guardrails: the capture
     clone is on-screen, on top, real-sized, at opacity 0.01 (imperceptible); and a
     **pre-flight** requires *sustained* decoded content (a frame ≥6, not just frame 1)
     before trusting real-time — else it falls back to the seek loop (which forces a
     decode and is proven non-black).

5. **16-minute exports.** Pure per-frame seeking is one decode per output frame
     (thousands of decodes). Guardrail: real-time capture (wall-clock ≈ reel length) is
     primary; seek is the reliability fallback only.

## PIP glitch (also fixed)

`captureOverlay` must rasterize an **off-DOM, un-scaled clone**, never the live stage.
The live stage sits inside `StageScaler`'s `transform: scale()`; `await import()` yields
long enough for a React re-render to re-apply that scale, so html2canvas reads a shrunk
box and stamps a mini "picture-in-picture" into the top-left. The clone has no scaled
ancestor and React never reconciles it.

## How to verify a change (the method that finally worked)

Do **not** ship engine changes unverified. The decisive tool was real Chromium via
Playwright (Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), served
over **`http://localhost`** (WebCodecs needs a secure context), using an import map for
`mp4-muxer` + `html2canvas`. Headless Chromium has **no H.264/AAC** encoder/decoder —
verify the logic with VP9 + Opus (codec-independent), then trust the adaptive codec path
for H.264 + AAC on the real browser. Always run the **composite** test (footage **with**
the overlay on top) and probe the output: faststart box order, `stsz` motion, audio
track present, and **decode the output back** to confirm frames advance + footage
luminance is high (≈10 = buried, ≈200+ = visible).
