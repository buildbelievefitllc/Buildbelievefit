// src/lib/videoTranscode.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side reel finalizer via ffmpeg.wasm — runs ENTIRELY in the browser
// (no server, no API, no recurring cost).
//
// WHY: the recorder now captures VIDEO-ONLY (Chrome/Edge MediaRecorder would
// otherwise mux OPUS audio, and Opus-in-MP4 renders frozen + silent in Samsung
// Gallery / Windows / Edge and is rejected by IG/FB — proven by comparing a
// working IG post (video-only) to a broken export (video + Opus)). Here we:
//   • de-fragment to a standard faststart MP4 (video stream COPIED — no re-encode),
//   • and, when a voiceover URL is given, mux it in as AAC.
// The output is a clean, universally-playable MP4 with the voiceover in a codec
// every player + Meta accepts.
//
// ffmpeg.wasm loads at RUNTIME from CDN (single-threaded core — no COOP/COEP). Not
// an npm dependency, so the build needs no install; the ~30MB wasm loads once.

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

// Video-only recording → standard faststart MP4. If voUrl is provided, the voiceover
// is muxed in as AAC (video COPIED, audio encoded). sourceIsMp4 picks the demux name.
// onProgress(0..1). Throws on failure (caller falls back to the raw video-only blob).
export async function toStandardMp4(blob, { voUrl, sourceIsMp4 = true, onProgress } = {}) {
  const { fetchFile } = await import(/* @vite-ignore */ UTIL_ESM);
  const ff = await getFFmpeg();
  _onProgress = typeof onProgress === 'function' ? onProgress : null;
  const inName = sourceIsMp4 ? 'reel-in.mp4' : 'reel-in.webm';
  const voName = 'reel-vo';
  const outName = 'reel-out.mp4';
  const vCodec = sourceIsMp4 ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p'];
  let haveVo = false;
  try {
    await ff.writeFile(inName, await fetchFile(blob));
    if (voUrl) {
      try { await ff.writeFile(voName, await fetchFile(voUrl)); haveVo = true; } catch { haveVo = false; }
    }
    const args = haveVo
      ? ['-i', inName, '-i', voName, '-map', '0:v:0', '-map', '1:a:0', ...vCodec,
        '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', outName]
      : ['-i', inName, ...vCodec, '-an', '-movflags', '+faststart', outName];
    await ff.exec(args);
    const data = await ff.readFile(outName);
    const out = new Blob([data.buffer], { type: 'video/mp4' });
    if (!out.size) throw new Error('empty_transcode');
    return out;
  } finally {
    _onProgress = null;
    try { await ff.deleteFile(inName); } catch { /* noop */ }
    if (haveVo) { try { await ff.deleteFile(voName); } catch { /* noop */ } }
    try { await ff.deleteFile(outName); } catch { /* noop */ }
  }
}
