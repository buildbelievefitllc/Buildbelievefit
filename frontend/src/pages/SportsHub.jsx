// src/pages/SportsHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — the authenticated home for the youth/sports division.
//
// The OTHER side of the post-login Routing Fork (lib/sportsRoster.js): a flagged
// sports athlete lands here straight from the login gate (after the first-run
// PAR-Q+ intake gate), bypassing the adult Sovereign Vault entirely.
//
// INTERACTIVE: the performance views are a live sub-nav (Combine Metrics ·
// Explosive Power · Size & Mass · Positional Ability). The dashboard model is
// LIFTED into local state here, so editing a combine/size/power mark recomputes
// its % against the target threshold in real time, and drill/film items mutate on
// click. State is client-side (mechanics test) — the mock fixture swaps for a real
// telemetry fetch later without touching this wiring.
//
// Isolation: lives entirely within pages/SportsHub.jsx + components/sportshub/*.

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { resolveSportsProfile } from '../lib/sportsRoster.js';
import LangToggle from '../components/LangToggle.jsx';
import { buildHubModel, progressToward, computePowerIndex, nextStatus } from '../components/sportshub/hubData.js';
import { YOUTH_SPORTS, positionLabel } from '../components/sportshub/youthSports.js';
import {
  CombineMetrics,
  ExplosivePower,
  SizeMass,
  PositionalAbility,
} from '../components/sportshub/sections.jsx';
import '../components/sportshub/sportsHub.css';

const TABS = [
  { id: 'combine', label: 'Combine Metrics', icon: '🎯' },
  { id: 'power', label: 'Explosive Power', icon: '⚡' },
  { id: 'size', label: 'Size & Mass', icon: '📏' },
  { id: 'positional', label: 'Positional Ability', icon: '🎬' },
];

// `selection` ({ sportId, positionCode }) is the athlete's intake choice, passed
// down by YouthIntakeGate (just-submitted or persisted). It wins over the seed so
// every tab renders the sport they picked. The gate keys this component on the
// selection, so a sport change cleanly re-seeds the editable model.
export default function SportsHub({ selection = null }) {
  const { user, signOut } = useAuth();
  const { t } = useLang();

  // The profile is attached to the user by AuthContext; fall back to the resolver
  // (and its default) so the Hub can never crash on a missing profile.
  const profile = useMemo(() => user?.sportsProfile || resolveSportsProfile(user) || {}, [user]);

  // Effective sport/position: the chosen/persisted selection over the seed.
  const effProfile = useMemo(() => {
    const sportId = selection?.sportId || profile.sportId || 'football';
    const positionCode = selection?.positionCode || profile.positionCode || 'OL';
    const cfg = YOUTH_SPORTS.find((s) => s.id === sportId);
    const sport = cfg ? t(cfg.labelKey) : (profile.sport || 'Multi-Sport');
    return { ...profile, sportId, positionCode, sport, position: positionLabel(sportId, positionCode) };
  }, [selection, profile, t]);

  // Lifted, editable dashboard model — seeded from the sport-aware effective
  // profile. Tab switches never reset it (state lives here, above the keyed panel).
  const [model, setModel] = useState(() => buildHubModel(effProfile));
  const [tab, setTab] = useState('combine');

  // ── Real-time calculators ───────────────────────────────────────────────────
  const onMetricChange = useCallback((key, raw) => {
    setModel((m) => ({
      ...m,
      combine: {
        ...m.combine,
        metrics: m.combine.metrics.map((x) =>
          x.key === key ? { ...x, current: raw, progress: progressToward(raw, x.target, x.lowerIsBetter) } : x),
      },
    }));
  }, []);

  const onPowerChange = useCallback((field, raw) => {
    setModel((m) => {
      const power = { ...m.power, [field]: raw };
      power.index = computePowerIndex(power.peakPowerW, power.cmjPowerW, power);
      return { ...m, power };
    });
  }, []);

  const onSizeChange = useCallback((field, raw) => {
    setModel((m) => ({ ...m, size: { ...m.size, [field]: raw } }));
  }, []);

  // ── State mutations ─────────────────────────────────────────────────────────
  const onToggleDrill = useCallback((idx) => {
    setModel((m) => ({
      ...m,
      drills: { ...m.drills, items: m.drills.items.map((d, i) => (i === idx ? { ...d, done: !d.done } : d)) },
    }));
  }, []);

  const onCycleStatus = useCallback((idx) => {
    setModel((m) => ({
      ...m,
      film: { ...m.film, clips: m.film.clips.map((c, i) => (i === idx ? { ...c, status: nextStatus(c.status) } : c)) },
    }));
  }, []);

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
                {effProfile.age != null ? <span className="sh-chip">Age <b>{effProfile.age}</b></span> : null}
                {profile.gradeLevel ? <span className="sh-chip">{profile.gradeLevel}</span> : null}
                <span className="sh-chip" data-testid="sh-hero-sport">{effProfile.sport || 'Multi-Sport'}</span>
                <span className="sh-chip is-pos" data-testid="sh-hero-position">{effProfile.position || '—'}</span>
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

        {/* ── Performance sub-navigation ──────────────────────────────────────── */}
        <nav className="sh-subnav" role="tablist" aria-label="Performance views">
          {TABS.map((tb) => {
            const active = tb.id === tab;
            return (
              <button
                key={tb.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`sh-tab${active ? ' is-active' : ''}`}
                data-testid={`sh-tab-${tb.id}`}
                onClick={() => setTab(tb.id)}
              >
                <span className="sh-tab-ico" aria-hidden="true">{tb.icon}</span>
                {tb.label}
              </button>
            );
          })}
        </nav>

        {/* key={tab} remounts the panel per switch → the transition fires, and the
            section reads the lifted model fresh (no stale view bleeds across tabs). */}
        <div className="sh-panel" key={tab}>
          {tab === 'combine' && <CombineMetrics combine={model.combine} onMetricChange={onMetricChange} />}
          {tab === 'power' && <ExplosivePower power={model.power} onPowerChange={onPowerChange} />}
          {tab === 'size' && <SizeMass size={model.size} onSizeChange={onSizeChange} />}
          {tab === 'positional' && (
            <PositionalAbility
              drills={model.drills}
              film={model.film}
              onToggleDrill={onToggleDrill}
              onCycleStatus={onCycleStatus}
            />
          )}
        </div>

        <p className="sh-foot">
          BBF Athlete Portal — youth training is coach-supervised and periodized for safe long-term development.
        </p>
      </div>
    </div>
  );
}
