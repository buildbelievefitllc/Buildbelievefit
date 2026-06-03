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

import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AdminGuard from './components/AdminGuard.jsx';
import Login from './pages/Login.jsx';
import CommandCenter from './pages/CommandCenter.jsx';
import ClientVault from './pages/ClientVault.jsx';
import MarketingLanding from './pages/MarketingLanding.jsx';
import SportsPortal from './components/sports/SportsPortal.jsx';
import { useEntitlement } from './lib/useEntitlement.js';
import UpgradeOverlay from './components/vault/UpgradeOverlay.jsx';

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

// The Sports Portal & Athlete Database — its own GUARDED route. Authentication is
// required (unauth → /login), but admin is NOT: the SportsPortal component itself
// strictly switches the Sovereign Admin Override View vs the Client View on
// isAdmin, so a client reaches their own dossier here while an admin gets the full
// override surface (also linked as a Command Center tab at /command/sports).
function SportsRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  // Sports Hub is gated like the Vault tabs: Youth + God Mode (Hybrid / admin /
  // active trial) enter; everyone else gets the upsell padlock in place of the
  // portal. Fail-open on an unresolved tier (see useEntitlement) so a payer is
  // never falsely locked out. Hooks run before the early returns (Rules of Hooks).
  const ent = useEntitlement();
  if (loading) return <div style={bootStyle}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="sp-route">
      <div className="sp-route-inner">
        <button type="button" className="sp-route-back" onClick={() => navigate('/vault')}>
          ← Athlete Vault
        </button>
        {ent.canAccessSports() ? (
          <SportsPortal />
        ) : (
          <UpgradeOverlay
            featureLabelKey="uplock-sports-feature"
            target={ent.upgradeTargetForSports()}
            testId="sports-upgrade-overlay"
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Apex root — ALWAYS the public marketing landing, even when authenticated.
          Authed users enter the Vault via the navbar/doors, never an auto-redirect. */}
      <Route path="/" element={<MarketingLanding />} />
      {/* The authenticated Vault now lives at its own guarded route (was at "/"). */}
      <Route path="/vault" element={<VaultRoute />} />
      {/* Sports Portal & Athlete Database — auth-guarded; the panel switches the
          admin-override vs client view on isAdmin (see SportsRoute). */}
      <Route path="/sports" element={<SportsRoute />} />
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
