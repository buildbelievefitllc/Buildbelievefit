// src/lib/videoTranscode.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side FAST remux → a standard, universally-playable MP4 via ffmpeg.wasm.
// Runs ENTIRELY in the browser: no server, no API, no recurring cost.
//
// WHY: Chrome/Android MediaRecorder writes a FRAGMENTED MP4 with OPUS audio. The
// captured H.264 frames are real and correctly timed, but the fragmented container +
// Opus-in-MP4 don't decode in Samsung Gallery / Windows Photos / QuickTime (frozen
// frame, no sound) and IG/FB reject them. We DE-FRAGMENT to a standard faststart MP4
// and transcode Opus→AAC — but we COPY the video stream (no re-encode), so it's fast
// even on a phone: only the audio is re-encoded.
//
// ffmpeg.wasm is loaded at RUNTIME from CDN (single-threaded core — no SharedArrayBuffer
// / COOP-COEP needed). Intentionally NOT an npm dependency, so the build needs no extra
// install and the ~30MB wasm only loads the first time a reel is finalized.

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
  ff.on('progress', ({ progress }) => { if (_onProgress) _onProgress(Math.max(0, Math.min(1, progress || 0))); });
  await ff.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  _ffmpeg = ff;
  return ff;
}

// Recorded blob → standard MP4 Blob (faststart). The recorded H.264 video is already
// real motion with correct timing, so we COPY it (fast) and only transcode Opus→AAC +
// de-fragment. A WebM source (no copyable H.264) re-encodes video to H.264. onProgress(0..1).
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
