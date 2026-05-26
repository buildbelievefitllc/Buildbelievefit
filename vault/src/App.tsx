// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/App.tsx
//
// Phase 4.3 Stage 2 · Authentication gate · routes the React tree
// between <Login /> and <VaultShell /> based on session state.
//
// Reads the initial uid from getCurrentUser() — which was already
// populated synchronously by hydrateSessionFromStorage() in main.tsx
// (Phase 6.0h Bootstrapper) BEFORE createRoot — so a returning
// athlete with a valid sigil drops straight into the VaultShell with
// no Login flash. New / signed-out athletes see <Login />.
//
// onAuthenticated is the upward boundary from <Login />: by the time
// it fires, setCurrentUser + setCurrentUserSigil have already run in
// supabaseClient.ts, so this component only mirrors the uid into
// React state to trigger the re-render that swaps to <VaultShell />.
//
// onLogout clears the in-memory tracker AND the localStorage sigil ·
// the storage-event listener in main.tsx will then propagate the
// logout to other tabs on the same origin via window.location.reload().
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import {
  getCurrentUser,
  clearActiveSession,
  setCurrentUserSigil,
} from './services/supabaseClient';
import Login from './components/Login';
import VaultShell from './components/VaultShell';

export default function App() {
  const [uid, setUid] = useState<string | null>(getCurrentUser());

  const handleAuthenticated = useCallback((nextUid: string) => {
    // Login already wrote module state + sigil · just mirror to React.
    setUid(nextUid);
  }, []);

  const handleLogout = useCallback(() => {
    clearActiveSession();
    setCurrentUserSigil(null);
    setUid(null);
  }, []);

  if (!uid) {
    return <Login onAuthenticated={handleAuthenticated} />;
  }
  return <VaultShell uid={uid} onLogout={handleLogout} />;
}
