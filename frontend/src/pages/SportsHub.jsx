// src/pages/SportsHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — the authenticated home for the youth/sports division.
//
// This is the OTHER side of the post-login Routing Fork (lib/sportsRoster.js):
// an athlete flagged a sports athlete is sent here straight from the login gate,
// bypassing the adult Sovereign Vault entirely (App.jsx · VaultRoute redirects a
// flagged athlete who lands on /vault back here, so the youth surface stays
// isolated from the adult lifestyle programming).
//
// Isolation: lives entirely within pages/SportsHub.jsx + components/sportshub/*;
// it imports only the shared LangToggle and the auth context. It never touches the
// adult Vault tabs, the public MarketingLanding, or the admin Command Center.
//
// SCAFFOLD: the dashboard sections paint the buildHubModel() fixture (mock youth
// telemetry). Swap that builder for a real fetch hook when the youth backend lands
// — the visual shell and section contract stay put.

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveSportsProfile } from '../lib/sportsRoster.js';
import LangToggle from '../components/LangToggle.jsx';
import { buildHubModel } from '../components/sportshub/hubData.js';
import {
  CombineMetrics,
  ExplosivePower,
  DrillProgress,
  FilmStudy,
} from '../components/sportshub/sections.jsx';
import '../components/sportshub/sportsHub.css';

export default function SportsHub() {
  const { user, signOut } = useAuth();

  // The profile is attached to the user by AuthContext; fall back to the resolver
  // (and its default) so the Hub can never crash on a missing profile.
  const profile = useMemo(
    () => user?.sportsProfile || resolveSportsProfile(user) || {},
    [user],
  );
  const model = useMemo(() => buildHubModel(profile), [profile]);

  const name = profile.athleteName || user?.displayName || 'Athlete';
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="sh-screen" data-testid="sports-hub">
      <header className="sh-topbar">
        <div className="sh-brand">
          <span className="sh-logo">BUILD BELIEVE <b>FIT</b></span>
          <span className="sh-kicker">Athlete Portal · Sports Hub</span>
        </div>
        <div className="sh-who">
          <span className="sh-greet">@{user?.username || 'athlete'}</span>
          <LangToggle />
          <button type="button" className="sh-signout" onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <div className="sh-container">
        {/* ── Athlete identity hero — varsity scoreboard register ─────────────── */}
        <section className="sh-hero">
          <div className="sh-hero-id">
            <div className="sh-jersey" aria-hidden="true">
              <span className="sh-jersey-no">{profile.jerseyNo ?? '00'}</span>
              <span className="sh-jersey-init">{initials || 'AB'}</span>
            </div>
            <div className="sh-hero-meta">
              <div className="sh-hero-kicker">Youth Division · Active Athlete</div>
              <h1 className="sh-hero-name">{name}</h1>
              <div className="sh-chips">
                {profile.age != null ? <span className="sh-chip">Age <b>{profile.age}</b></span> : null}
                {profile.gradeLevel ? <span className="sh-chip">{profile.gradeLevel}</span> : null}
                <span className="sh-chip">{profile.sport || 'Multi-Sport'}</span>
                <span className="sh-chip is-pos">{profile.position || '—'}</span>
              </div>
            </div>
          </div>
          {Array.isArray(profile.focusAreas) && profile.focusAreas.length ? (
            <div className="sh-focus">
              <span className="sh-focus-l">Development Focus</span>
              <div className="sh-focus-tags">
                {profile.focusAreas.map((f) => (
                  <span key={f} className="sh-focus-tag">{f}</span>
                ))}
              </div>
            </div>
          ) : null}
          {profile.team ? <div className="sh-team">{profile.team}</div> : null}
        </section>

        {/* ── Dashboard grid — the four scoped youth/lineman surfaces ─────────── */}
        <div className="sh-grid">
          <CombineMetrics combine={model.combine} size={model.size} />
          <ExplosivePower power={model.power} />
          <DrillProgress drills={model.drills} />
          <FilmStudy film={model.film} />
        </div>

        <p className="sh-foot">
          BBF Athlete Portal — youth training is coach-supervised and periodized for safe long-term development.
        </p>
      </div>
    </div>
  );
}
