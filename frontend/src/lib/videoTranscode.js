// src/lib/videoTranscode.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side remux/transcode → a standard, universally-playable MP4
// (H.264 + AAC, faststart moov) via ffmpeg.wasm. Runs ENTIRELY in the browser:
// no server, no API, no recurring cost. Fixes Chrome's MediaRecorder output,
// which is a FRAGMENTED MP4 with OPUS audio — a combo that shows as a still frame
// in basic players (Windows Photos / QuickTime) and is rejected by IG/FB.
//
// ffmpeg.wasm is loaded at RUNTIME from a CDN (single-threaded core — no
// SharedArrayBuffer / COOP-COEP headers required, so no server config change).
// It is intentionally NOT an npm dependency, so the Vite build needs no extra
// install and the ~30MB wasm only loads the first time a reel is finalized.

// Pinned versions (single-threaded core; mt-core would need cross-origin isolation).
const FFMPEG_ESM = 'https://esm.sh/@ffmpeg/ffmpeg@0.12.10';
const UTIL_ESM = 'https://esm.sh/@ffmpeg/util@0.12.1';
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

let _ffmpeg = null;
let _onProgress = null;

export function transcodeSupported() {
  return typeof WebAssembly === 'object' && typeof Blob !== 'undefined' && typeof window !== 'undefined';
}

async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import(/* @vite-ignore */ FFMPEG_ESM),
    import(/* @vite-ignore */ UTIL_ESM),
  ]);
  const ff = new FFmpeg();
  // One progress listener for the instance; routes to whoever is transcoding now.
  ff.on('progress', ({ progress }) => {
    if (_onProgress) _onProgress(Math.max(0, Math.min(1, progress || 0)));
  });
  // toBlobURL fetches the core cross-origin and hands ffmpeg a same-origin blob URL
  // (its worker can't load a bare cross-origin URL otherwise).
  await ff.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  _ffmpeg = ff;
  return ff;
}

// Recorded blob → standard MP4 Blob. sourceIsMp4 → the recorder already produced
// H.264 (Chrome's fragmented MP4), so we COPY the video (fast) and only re-encode
// the Opus audio to AAC + rewrite the container with a faststart moov. Otherwise
// (WebM/VP8/VP9) we re-encode the video to H.264. onProgress(0..1).
export async function toStandardMp4(blob, { sourceIsMp4 = true, onProgress } = {}) {
  const { fetchFile } = await import(/* @vite-ignore */ UTIL_ESM);
  const ff = await getFFmpeg();
  _onProgress = typeof onProgress === 'function' ? onProgress : null;
  const inName = sourceIsMp4 ? 'reel-in.mp4' : 'reel-in.webm';
  const outName = 'reel-out.mp4';
  try {
    await ff.writeFile(inName, await fetchFile(blob));
    const args = sourceIsMp4
      ? ['-i', inName, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outName]
      : ['-i', inName, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outName];
    await ff.exec(args);
    const data = await ff.readFile(outName);
    const out = new Blob([data.buffer], { type: 'video/mp4' });
    if (!out.size) throw new Error('empty_transcode');
    return out;
  } finally {
    _onProgress = null;
    try { await ff.deleteFile(inName); } catch { /* noop */ }
    try { await ff.deleteFile(outName); } catch { /* noop */ }
  }
}
