// src/lib/tiktokBridge.js
// ─────────────────────────────────────────────────────────────────────────────
// TikTok Manual Bridge — the one-click handoff from a content_vault row to the
// TikTok upload screen. Three operations:
//   1. Fetch the Supabase video_url → Blob → trigger a direct local download.
//   2. Copy caption_body into the system clipboard (Clipboard API).
//   3. Open the TikTok upload interface in a fresh tab.
//
// ORDER NOTE (deliberate, §8): the spec lists open LAST, but browsers block
// window.open() and reject clipboard writes once the user-gesture context is lost
// across an `await`. So the click handler must call this synchronously, and we run
// the gesture-bound steps FIRST — open the tab, then clipboard — before the async
// blob fetch. All three still fire; the reorder is what keeps the window un-blocked.

export const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/creator-center/upload';

const safeName = (title) => `${String(title || 'bbf_clip').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80) || 'bbf_clip'}.mp4`;

// Must be invoked directly from a click handler (do not await before calling it) so
// the popup + clipboard land inside the user gesture. Returns a result summary.
export function runTikTokBridge({ videoUrl, caption, title }) {
  const result = { opened: false, copied: false, downloaded: false, errors: [] };

  // 1) Open TikTok FIRST — synchronous, inside the gesture → not popup-blocked.
  try {
    const w = window.open(TIKTOK_UPLOAD_URL, '_blank', 'noopener,noreferrer');
    result.opened = !!w;
    if (!w) result.errors.push('popup_blocked');
  } catch (e) { result.errors.push(`open:${e?.message || e}`); }

  // 2) Clipboard — still within the gesture.
  const copyPromise = (async () => {
    try {
      await navigator.clipboard.writeText(String(caption || ''));
      result.copied = true;
    } catch (e) { result.errors.push(`clipboard:${e?.message || e}`); }
  })();

  // 3) Blob download — async; gesture no longer required for a programmatic <a> click.
  const downloadPromise = (async () => {
    try {
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`http_${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = safeName(title);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
      result.downloaded = true;
    } catch (e) { result.errors.push(`download:${e?.message || e}`); }
  })();

  // Resolve once the async steps settle (caller may await for a status toast).
  return Promise.allSettled([copyPromise, downloadPromise]).then(() => result);
}
