// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/main.tsx
//
// Phase 6.0h · Vault Bootstrapper.
//   1. hydrateSessionFromStorage() runs SYNCHRONOUSLY before createRoot
//      so the React tree mounts with populated session state · closes
//      the Stage-2 foot-gun where getActiveUid() returned null on first
//      render even with a logged-in user cached in localStorage.
//   2. window.addEventListener('storage', ...) wired at module load ·
//      cross-tab session drift (a logout in the legacy bbf-app.html tab,
//      a logout in another React tab, or any external mutation of the
//      bbf_v7 master payload) triggers window.location.reload() so this
//      tab resyncs from a clean module state. Heavy-handed but
//      bulletproof for the current placeholder · Stage 2 may swap to a
//      custom-event + React state hook to preserve mid-form scroll
//      position on resync (queued in MASTER_PLAN.md §6.0h-stage2).
// ═══════════════════════════════════════════════════════════════════════

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {
  hydrateSessionFromStorage,
  STORAGE_KEYS,
} from './services/supabaseClient';

function bootstrapVault(): void {
  // ─── 1. Synchronous session hydration · before any React paint ────
  const session = hydrateSessionFromStorage();
  if (typeof console !== 'undefined' && console.log) {
    console.log(
      `[vault/boot] session hydrated · uid=${session.uid ?? 'none'} · source=${session.source}`
    );
  }

  // ─── 2. Cross-tab session drift watcher ────────────────────────────
  // The `storage` event fires in OTHER tabs (not the writer's tab) when
  // localStorage changes on the same origin. We watch the master
  // payload key + the boot sigil + a null key (which signals
  // localStorage.clear()). On any drift, reload to resync.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e: StorageEvent) => {
      const isPayloadDrift  = e.key === STORAGE_KEYS.PAYLOAD;
      const isSigilDrift    = e.key === 'bbf_current_user';
      const isFullClear     = e.key === null; // localStorage.clear() fired in another tab
      if (isPayloadDrift || isSigilDrift || isFullClear) {
        if (typeof console !== 'undefined' && console.log) {
          console.log(
            `[vault/boot] cross-tab drift detected · key=${e.key ?? '<full_clear>'} · reloading`
          );
        }
        try {
          window.location.reload();
        } catch {
          /* reload() should never throw · swallow defensively */
        }
      }
    });
  }
}

// Boot synchronously · MUST run before createRoot so the React tree's
// first render sees the hydrated module state.
bootstrapVault();

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Vault mount aborted · #root element missing from index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
