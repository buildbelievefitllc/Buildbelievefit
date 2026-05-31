// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 12 — Apex routing matrix. The root now serves THREE audiences so the
// production-domain cutover drops no one:
//
//   unauthenticated  → <PublicTerminal>   (marketing / catch-all root)
//   authed admin/coach → <AdminGuard> → <CommandCenter>   (admin console)
//   authed client/athlete → <ClientVault>   (client catch-surface)
//
// <AdminGuard> is unchanged — it remains the authoritative gate for the Command
// Center (admin/trainer/akeem only); RootRoute simply routes the other audiences
// to their own surfaces before they would ever reach the denial branch.
//
//   /login → public Login gate (username + PIN); on success → '/' (dispatched here)
//   *      → bounce to '/' (which itself dispatches by audience)

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AdminGuard from './components/AdminGuard.jsx';
import Login from './pages/Login.jsx';
import CommandCenter from './pages/CommandCenter.jsx';
import ClientVault from './pages/ClientVault.jsx';
import PublicTerminal from './pages/PublicTerminal.jsx';

// Role-aware dispatcher for the apex root.
function RootRoute() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div style={bootStyle}>Loading…</div>;
  if (!user) return <PublicTerminal />;
  if (isAdmin) return <AdminGuard><CommandCenter /></AdminGuard>;
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
      {/* Any unknown path (e.g. an old monolith deep link like /bbf-app.html)
          falls back to the root, which dispatches by audience — never a 404. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
