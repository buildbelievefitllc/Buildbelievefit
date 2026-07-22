// src/lib/studioInbox.js
// ─────────────────────────────────────────────────────────────────────────────
// GROUPED MEDIA PASS — one-shot handoff channel into the Studio V4 Video Engine.
//
// The Command Center remounts each tab (CommandCenter's `key={activeTab}`), so a
// click inside the Marketing Vault or the Review Bucket cannot hand props to the
// Studio V4 panel directly — they never co-exist in the tree. This localStorage
// "inbox" bridges that remount boundary: the SENDER writes a compact editor
// payload + navigates to `/command/studio-v4`; Studio V4 CONSUMES it exactly once
// on mount (read → apply → clear), so a refresh never re-injects a stale asset.
//
// Only JSON-serializable, DURABLE references travel — remote https asset URLs
// (Supabase Storage / the marketing CDN), NEVER blob: object URLs (those die with
// the sender's JS session and would rehydrate as a broken reference).
//
// Fails soft everywhere (private-mode / storage-full): the sender simply no-ops
// and the receiver returns null. Nothing here throws into a caller.

const INBOX_KEY = 'bbf-studio-v4-inbox-v1';
// A handoff the user never followed through on shouldn't hijack a Studio session
// opened much later — anything older than this is treated as stale and ignored.
const TTL_MS = 10 * 60 * 1000; // 10 minutes

// Map a Digital Content Manager series name → the reel Series Tag id (VibeSelector
// SERIES). Keeps the "visual theme" travelling with a Review Bucket handoff so the
// reel opens pre-tagged. Unknown series → '' (no tag), never a crash.
const SERIES_TO_REEL_TAG = {
  'Mindset Engine': 'mindset',
  'Form Fix': 'form-fix',
  'Prehab Architect': 'prehab-minute',
  'Recovery Mode': 'recovery-protocol',
  'Fuel Files': 'fuel',
};
export function seriesToReelTag(series) {
  return SERIES_TO_REEL_TAG[series] || '';
}

// Write the handoff payload + navigate is the caller's job. Returns true when the
// payload was stored (best-effort). Payload keys the Studio V4 receiver understands:
//   mode           'reel' (default) — which Studio surface to open
//   videoUrl       durable https URL → loads as the reel footage
//   hook, hookSub  overlay copy
//   series         reel Series Tag id (use seriesToReelTag() for DCM series names)
//   overlayStyle   reel overlay skin
//   voUrl          durable https URL → loads onto the voice channel
//   voTopic, lang  voiceover seed + language
//   backgroundColor  reel canvas color
//   source, sourceLabel  provenance → drives the "loaded from …" banner
export function sendToStudioV4(payload = {}) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(INBOX_KEY, JSON.stringify({ ...payload, ts: Date.now() }));
    return true;
  } catch {
    return false; // private mode / storage full — the bridge degrades to a no-op
  }
}

// One-shot read: returns the payload and REMOVES it (consumed on read, success or
// not, so a reload can never replay it). Null when empty, corrupt, or stale.
export function consumeStudioInbox() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(INBOX_KEY);
    if (!raw) return null;
    localStorage.removeItem(INBOX_KEY);
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (typeof data.ts === 'number' && Date.now() - data.ts > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}
