// src/components/sports/clipboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Small clipboard helper with a legacy fallback — the async Clipboard API is
// gated to secure contexts and not present in every embedded webview, so fall
// back to a hidden-textarea execCommand copy. Returns true on success.

export async function copyText(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
