// src/lib/exportDelivery.js
// ─────────────────────────────────────────────────────────────────────────────
// EXPORT DELIVERY — the single owner of "get a rendered Blob (reel MP4 / card
// JPEG) onto the user's device", made PERMANENTLY reliable on mobile.
//
// WHY THIS EXISTS (Galaxy S25 Ultra field failure): the classic programmatic
// `<a download>` click on a blob: URL is unreliable on Android Chrome — above all
// inside the installed PWA (standalone display-mode), where the download manager
// silently drops blob: navigations: the export "succeeds" and no file ever lands.
// Auto-firing navigator.share() instead doesn't work either: share() requires
// TRANSIENT USER ACTIVATION, and a reel render takes 10-60s, so by the time the
// blob exists the original tap's activation has long expired (NotAllowedError).
// The only dependable mobile path is a share/save fired from a FRESH tap AFTER
// the render completes — which is why StudioLayout keeps the finished blob and
// surfaces an explicit "⬇ SAVE TO PHONE" button instead of a dead auto-download.
//
// Delivery ladder (saveBlobToDevice):
//   1. Web Share Level 2 with files → the Android share sheet (Save to Files /
//      Gallery / straight into IG or TikTok). The dependable installed-PWA path.
//   2. `<a download>` anchor — the classic path; fully reliable on desktop.
//   3. window.open(blobUrl) — last resort; the user long-presses to save.

export function isMobileish() {
  try {
    if (navigator.userAgentData?.mobile === true) return true;
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) return true;
    // Installed-PWA standalone mode is exactly where blob anchors die — treat it
    // as mobile-grade even on unusual UAs.
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
  } catch { /* non-browser (test) environment */ }
  return false;
}

function anchorDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Long revoke window: Chrome's download manager reads the blob asynchronously,
  // and a large MP4 on a slow disk needs the URL alive well past the click.
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

// Deliver `blob` to the device as `name`. On mobile-grade environments this MUST
// be called from a user gesture (a fresh tap) or the share sheet is refused and
// we fall down the ladder. Returns how it was delivered:
//   'shared' | 'downloaded' | 'opened' | 'cancelled' | 'failed'
export async function saveBlobToDevice(blob, name, { preferShare = isMobileish() } = {}) {
  const type = blob.type || 'application/octet-stream';

  if (preferShare && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      const file = new File([blob], name, { type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      }
    } catch (e) {
      // AbortError = the user closed the share sheet on purpose — not a failure,
      // and we must NOT surprise them with a fallback download.
      if (e?.name === 'AbortError') return 'cancelled';
      // NotAllowedError (stale gesture) or share plumbing failure → ladder down.
    }
  }

  try {
    anchorDownload(blob, name);
    return 'downloaded';
  } catch { /* ladder down */ }

  try {
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    return 'opened';
  } catch {
    return 'failed';
  }
}
