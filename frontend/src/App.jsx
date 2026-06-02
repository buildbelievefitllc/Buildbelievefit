// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Root routing. The apex URL ("/") ALWAYS renders the public MarketingLanding —
// authenticated users are NEVER auto-redirected away from it. They reach their
// Sovereign Vault through the landing's navbar / hero doors (which point to /vault
// when a session exists). The Vault has its own guarded route; admins cross into
// the Command Center via the in-Vault toggle (→ /command, AdminGuard-gated).
//
//   /        → <MarketingLanding>             (public — ALWAYS, regardless of auth)
//   /vault   → <ClientVault>                  (authed only; unauth → /login)
//   /command → <AdminGuard> → <CommandCenter> (admin console)
//   /login   → public Login gate (username + PIN); on success → /vault
//   *        → bounce to '/'

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AdminGuard from './components/AdminGuard.jsx';
import Login from './pages/Login.jsx';
import CommandCenter from './pages/CommandCenter.jsx';
import ClientVault from './pages/ClientVault.jsx';
import MarketingLanding from './pages/MarketingLanding.jsx';

// The Sovereign Vault — the authenticated athlete home. Guarded: an unauthenticated
// visitor is bounced to the login gate rather than shown an empty shell. NOTE: the
// root "/" deliberately does NOT render this — it always serves the public landing,
// so the Vault now has its own /vault route (it used to be rendered at "/").
function VaultRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div style={bootStyle}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <ClientVault />;
}

const bootStyle = {
  minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--bd)', color: 'var(--mut)', letterSpacing: '.5px',
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Apex root — ALWAYS the public marketing landing, even when authenticated.
          Authed users enter the Vault via the navbar/doors, never an auto-redirect. */}
      <Route path="/" element={<MarketingLanding />} />
      {/* The authenticated Vault now lives at its own guarded route (was at "/"). */}
      <Route path="/vault" element={<VaultRoute />} />
      {/* Admin console — AdminGuard denies non-admins before the shell mounts. The
          optional :tab segment makes each surface deep-linkable; the sidebar nav
          and the segmented tabs both push to /command/<tab>. ONE route (not two)
          so the shell stays mounted across tab swaps — only the inner panel
          remounts (CommandCenter keys it). */}
      <Route path="/command/:tab?" element={<AdminGuard><CommandCenter /></AdminGuard>} />
      {/* Any unknown path (e.g. an old monolith deep link like /bbf-app.html)
          falls back to the public root — never a 404. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
