// src/lib/studioAssetStore.js
// ─────────────────────────────────────────────────────────────────────────────
// STUDIO V4 WIP ASSET STORE — IndexedDB persistence for uploaded input assets.
//
// The Studio's editor state is mirrored to localStorage (index.jsx), but that can
// only hold JSON — the BYTES of an uploaded file can't ride there, and the blob:
// URL minted for one dies with the JS session. So a voiceover the user uploaded
// (an ElevenLabs / Sovereign Studio render) evaporated on the next reload.
//
// This is the binary companion to that localStorage snapshot: it stashes the
// uploaded file's bytes under a stable slot key so the next mount can re-mint a
// fresh object URL and the upload survives a reload / an Android-reclaimed PWA tab.
// It is deliberately CLIENT-SIDE — work-in-progress inputs stay on the device by
// design (finished exports are what get pushed to the cloud draft vault); this
// never touches the network.
//
// Every call fails SOFT: no IndexedDB (private mode, locked-down browser) → the
// helpers resolve to a no-op / null and the upload simply behaves session-only,
// exactly as it did before this store existed. Nothing here can throw into a caller.

const DB_NAME = 'bbf-studio-assets-v1';
const STORE = 'assets';

function openDb() {
  return new Promise((resolve) => {
    let req;
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      req = indexedDB.open(DB_NAME, 1);
    } catch { resolve(null); return; }
    req.onupgradeneeded = () => {
      try {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      } catch { /* another connection created it — fine */ }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

// Persist a File/Blob under `key`. `meta.name` keeps the original filename for the
// UI chip. Resolves true on success, false on any failure (never throws).
export async function putAsset(key, blob, meta = {}) {
  if (!blob) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ blob, name: meta.name || null, type: blob.type || null, savedAt: Date.now() }, key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    } catch { try { db.close(); } catch { /* noop */ } resolve(false); }
  });
}

// Read the stored asset → { blob, name, type } or null (absent / unavailable).
export async function getAsset(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => {
        db.close();
        const rec = rq.result;
        resolve(rec && rec.blob ? { blob: rec.blob, name: rec.name || null, type: rec.type || null } : null);
      };
      rq.onerror = () => { db.close(); resolve(null); };
    } catch { try { db.close(); } catch { /* noop */ } resolve(null); }
  });
}

// Remove the stored asset. Resolves true on success (or if it was already absent),
// false only on a hard failure. Never throws.
export async function deleteAsset(key) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
    } catch { try { db.close(); } catch { /* noop */ } resolve(false); }
  });
}
