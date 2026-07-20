// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Root routing. On the WEB, the apex URL ("/") ALWAYS renders the public
// MarketingLanding — authenticated users are NEVER auto-redirected away from it.
// They reach their Sovereign Vault through the landing's navbar / hero doors
// (which point to /vault when a session exists). The Vault has its own guarded
// route; admins cross into the Command Center via the in-Vault toggle (→ /command,
// AdminGuard-gated). On the NATIVE (Capacitor) app shell, "/" is intercepted by
// RootRoute and never renders MarketingLanding at all — see that component below.
//
//   /          → <MarketingLanding>             (public, WEB ONLY — native → /login)
//   /vault     → <ClientVault>                  (authed only; unauth → /login; a
//                                                flagged sports athlete is bounced
//                                                to /sports-hub — the youth surface
//                                                is isolated from the adult Vault)
//   /sports-hub→ <SportsHub>                     (authed sports athlete home — THE
//                                                post-login landing for the youth
//                                                division; admins may preview)
//   /command   → <AdminGuard> → <CommandCenter> (admin console)
//   /login     → public Login gate (username + PIN); on success → home (Routing Fork)
//   *          → bounce to '/'

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AdminGuard from './components/AdminGuard.jsx';
import Login from './pages/Login.jsx';
import PendingIntakeSync from './components/PendingIntakeSync.jsx';
import TierGate from './components/TierGate.jsx';
import { isSportsAthlete, SPORTS_HUB_PATH } from './lib/sportsRoster.js';
import { isNativePlatform } from './native/platform.js';

// Route-level code splitting (Material Upgrade): each top surface ships as its
// own chunk, so the public landing no longer pays for the entire Vault + admin
// console, and the BBF Lab WebView boots on a fraction of the parse cost. The
// Login gate stays static — it's tiny and it IS the boot path. Vite hashes the
// chunks; the SW's stale-while-revalidate asset policy serves them after first
// load, and the Capacitor build reads them from local disk.
const MarketingLanding = lazy(() => import('./pages/MarketingLanding.jsx'));
// Top-of-funnel lead magnet (/burn) + its standalone Pathfinder handoff target
// (/pathfinder). Both public, both their own chunk so they don't drag in the Vault.
const DailyBurnCalculator = lazy(() => import('./pages/DailyBurnCalculator.jsx'));
const TierSelectionPitch = lazy(() => import('./pages/TierSelectionPitch.jsx'));
const OnboardingAssessment = lazy(() => import('./pages/OnboardingAssessment.jsx'));
const ExplorerVault = lazy(() => import('./pages/ExplorerVault.jsx'));
const PathfinderPage = lazy(() => import('./pages/PathfinderPage.jsx'));
const ProtocolInitialization = lazy(() => import('./pages/ProtocolInitialization.jsx'));
const ClientVault = lazy(() => import('./pages/ClientVault.jsx'));
const CommandCenter = lazy(() => import('./pages/CommandCenter.jsx'));
const YouthIntakeGate = lazy(() => import('./components/sportshub/YouthIntakeGate.jsx'));
const SportsPortal = lazy(() => import('./components/sports/SportsPortal.jsx'));
// Champion Mindset dashboard — the target of the CNS Triage Router's completion
// anchor. Mounted at its own guarded path (was previously only a Vault-internal tab)
// so the trilingual intercept can route straight into it.
const ChampionMindset = lazy(() => import('./components/vault/ChampionMindset.jsx'));

// The Sovereign Vault — the authenticated athlete home. Guarded: an unauthenticated
// visitor is bounced to the login gate rather than shown an empty shell. NOTE: the
// root "/" deliberately does NOT render this — it always serves the public landing,
// so the Vault now has its own /vault route (it used to be rendered at "/").
function VaultRoute() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div style={bootStyle}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Routing Fork (isolation side): a flagged sports athlete must NEVER land on the
  // adult Sovereign Vault — if one reaches /vault directly (deep link, stale tab,
  // bookmark), bounce them into The Sports Hub so the youth surface stays sealed
  // off from the adult lifestyle programming. Admins are exempt: the head coach can
  // still inspect the Vault.
  if (isSportsAthlete(user) && !isAdmin) return <Navigate to={SPORTS_HUB_PATH} replace />;
  return <ClientVault />;
}

// The Sports Hub — the authenticated home for the youth/sports division and the
// post-login landing for a flagged athlete. Auth-guarded (unauth → /login).
// Symmetric isolation: an ordinary adult client who deep-links here is sent to
// their Vault; admins may pass through to preview the youth surface.
//
// Phase 2.4 — Route Entitlement Mirror: after division isolation, the Hub is
// gated on the live `sports_hub` feature (Youth + God Tier) via <TierGate>,
// matching /sports. Fail-open while the tier resolves so a payer is never
// padlocked by a blip.
//
// First-run gate: a flagged athlete is wrapped in <YouthIntakeGate>, which blocks
// the Hub behind a forced PAR-Q+ intake until the DB confirms a completed
// screening (the gate self-skips for admins, so previewing stays ungated).
function SportsHubRoute() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div style={bootStyle}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Division isolation (not entitlement): ordinary adult clients never land on
  // the youth surface. Entitlement is enforced by TierGate below.
  if (!isSportsAthlete(user) && !isAdmin) return <Navigate to="/vault" replace />;
  // The gate renders the intake (until cleared) then the Hub itself, scoped to the
  // athlete's chosen sport/position — only when sports_hub is unlocked.
  return (
    <TierGate feature="sports_hub" featureLabelKey="uplock-sports-feature" testId="sports-hub-upgrade-overlay">
      <YouthIntakeGate />
    </TierGate>
  );
}

const bootStyle = {
  minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--bd)', color: 'var(--mut)', letterSpacing: '.5px',
};

// Champion Mindset dashboard — auth-guarded (mirrors VaultRoute): an unauthenticated
// visitor is bounced to the login gate. The CNS Triage Router's completion anchor
// routes here; all context providers (Lang/Auth/Readiness) live at the root so the
// surface mounts standalone with full trilingual + session context.
function ChampionMindsetRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div style={bootStyle}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <ChampionMindset />;
}

// Native start-URL guardrail (Apple/Android compliance): the Capacitor wrapper
// always boots index.html at "/", which — unlike the web PWA (manifest start_url
// is "/login") — has no equivalent "start path" config for a bundled webDir app.
// Left unguarded, a fresh native install would render the public MarketingLanding,
// exposing Stripe checkout links inside the app shell (an Apple IAP/anti-steering
// violation, guideline 3.1.1/3.1.3). Native sessions bypass "/" entirely and land
// on the guarded /login gate, which itself forwards a returning session straight
// into the Vault/Sports Hub (see Login.jsx's boot redirect).
function RootRoute() {
  if (isNativePlatform()) return <Navigate to="/login" replace />;
  return <MarketingLanding />;
}

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
  if (loading) return <div style={bootStyle}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="sp-route">
      <div className="sp-route-inner">
        <button type="button" className="sp-route-back" onClick={() => navigate('/vault')}>
          ← Athlete Vault
        </button>
        {/* Phase 2: Sports Hub gated via the declarative primitive (feature:
            sports_hub → Youth + God Tier). Fail-open while the tier resolves. */}
        <TierGate feature="sports_hub" featureLabelKey="uplock-sports-feature" testId="sports-upgrade-overlay">
          <SportsPortal />
        </TierGate>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
    {/* Root listener: writes the staged /assessment intake to the DB on first
        authenticated session, then purges it. Renders nothing. */}
    <PendingIntakeSync />
    <Suspense fallback={<div style={bootStyle}>Loading…</div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Apex root — the public marketing landing, even when authenticated (authed
          web users enter the Vault via the navbar/doors, never an auto-redirect).
          The NATIVE app shell never sees this panel at all — RootRoute bounces it
          straight to /login (see comment above). */}
      <Route path="/" element={<RootRoute />} />
      {/* The Metabolic Gateway — standalone, nav-free lead magnet; its CTA hands
          off to /pathfinder with the entered biometrics in router state. */}
      <Route path="/burn" element={<DailyBurnCalculator />} />
      {/* Upsell bridge — three Online Fitness tiers in the LOCKED tab-deck; a
          Select Plan choice forwards the chosen priceId + biometrics on. */}
      <Route path="/select-tier" element={<TierSelectionPitch />} />
      {/* The Sovereign Intake — premium multi-step assessment (top-of-funnel). Its
          "Get My Fitness Plan" CTA bridges into Supabase OAuth and shunts the
          post-auth redirect straight to the /select-tier subscription gate. */}
      <Route path="/assessment" element={<OnboardingAssessment />} />

      {/* EXPLORER MODE — the read-only guest sandbox (conversion funnel). Public
          route; the page itself bounces to /burn when no guest envelope exists. */}
      <Route path="/explore" element={<ExplorerVault />} />
      {/* Standalone Pathfinder intake — pre-fills from the handoff state and, when
          a tier was chosen, carries the checkout object into the screening flow. */}
      <Route path="/pathfinder" element={<PathfinderPage />} />
      {/* Protocol Initialization — the Explorer Mode funnel's screening-first
          entry ritual. Embeds the SAME Pathfinder intake, but forwards to
          /select-tier on completion instead of a tier-first checkout handoff. */}
      <Route path="/protocol-init" element={<ProtocolInitialization />} />
      {/* The authenticated Vault now lives at its own guarded route (was at "/"). */}
      <Route path="/vault" element={<VaultRoute />} />
      {/* The Sports Hub — youth/sports division home; the post-login Routing Fork
          (Login.jsx + the /vault bounce above) lands a flagged athlete HERE. */}
      <Route path="/sports-hub" element={<SportsHubRoute />} />
      {/* Sports Portal & Athlete Database — auth-guarded; the panel switches the
          admin-override vs client view on isAdmin (see SportsRoute). */}
      <Route path="/sports" element={<SportsRoute />} />
      {/* Champion Mindset dashboard — auth-guarded standalone surface; the CNS
          Triage Router's completion anchor routes here. */}
      <Route path="/champion-mindset" element={<ChampionMindsetRoute />} />
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
    </Suspense>
    </>
  );
}
