// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 23 — Client-Zero routing. EVERY authenticated user — athletes and admins
// alike — lands on the Sovereign Vault first ("everyone is an athlete first").
// Admins cross into the Command Center via the in-Vault toggle, which routes to
// the dedicated /command path; <AdminGuard> still gates that route (admin /
// trainer / akeem only), so a non-admin who hits /command directly is denied.
//
//   unauthenticated     → <MarketingLanding>   (marketing / catch-all root)
//   authed (any role)   → <ClientVault>        (the apex home surface)
//   /command            → <AdminGuard> → <CommandCenter>  (admin console)
//
//   /login → public Login gate (username + PIN); on success → '/' (the Vault)
//   *      → bounce to '/'

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AdminGuard from './components/AdminGuard.jsx';
import Login from './pages/Login.jsx';
import CommandCenter from './pages/CommandCenter.jsx';
import ClientVault from './pages/ClientVault.jsx';
import MarketingLanding from './pages/MarketingLanding.jsx';

// Apex root: marketing for guests, the Vault for everyone authenticated.
function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div style={bootStyle}>Loading…</div>;
  if (!user) return <MarketingLanding />;
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
      <Route path="/" element={<RootRoute />} />
      {/* Admin console — AdminGuard denies non-admins before the shell mounts. */}
      <Route path="/command" element={<AdminGuard><CommandCenter /></AdminGuard>} />
      {/* Any unknown path (e.g. an old monolith deep link like /bbf-app.html)
          falls back to the root, which dispatches by audience — never a 404. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
