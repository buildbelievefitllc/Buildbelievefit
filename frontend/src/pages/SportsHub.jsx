// src/pages/SportsHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — the authenticated home for the youth/sports division.
//
// The OTHER side of the post-login Routing Fork (lib/sportsRoster.js): a flagged
// sports athlete lands here straight from the login gate (after the first-run
// PAR-Q+ intake gate), bypassing the adult Sovereign Vault entirely.
//
// DAILY EXECUTION PROTOCOL (CEO paradigm shift): the macro-dashboard is restructured
// into a chronological Day 1–7 view, mirroring the adult Vault's scrolling
// pill-navigation (Program.jsx / Nutrition.jsx). The active day shows the athlete's
// off/in-season workload plus that day's drills + film — each a tap-to-track
// checkoff (hubData.buildWeek distributes the sport's actionable items across the
// week). The Combine/Power/Size calculators are preserved in a collapsible
// "Combine & Measurables" panel so the daily view stays simple for youth execution.
//
// Isolation: lives entirely within pages/SportsHub.jsx + components/sportshub/*.

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { resolveSportsProfile } from '../lib/sportsRoster.js';
import { logYouthProgress } from '../lib/youthIntakeApi.js';
import { useAthleteTelemetry } from '../lib/athleteTelemetryApi.js';
import LangToggle from '../components/LangToggle.jsx';
import { buildHubModel, buildWeek, applyProgress, progressToward, computePowerIndex, nextStatus } from '../components/sportshub/hubData.js';
import { YOUTH_SPORTS, positionLabel } from '../components/sportshub/youthSports.js';
import {
  CombineMetrics,
  ExplosivePower,
  SizeMass,
  DayProtocol,
} from '../components/sportshub/sections.jsx';
import SportProtocol from '../components/sportshub/SportProtocol.jsx';
import { selectPlans } from '../lib/vaultApi.js';
import '../components/sportshub/sportsHub.css';

// First non-rest day, so the Hub never opens on a blank recovery card.
function firstTrainingDay(week) {
  const i = week.findIndex((d) => !d.rest);
  return i === -1 ? 0 : i;
}

// `selection` ({ sportId, positionCode }) is the athlete's intake choice and
// `progress` the persisted per-day check-off map (bbf_users.youth_progress) — both
// passed down by YouthIntakeGate. The gate keys this component on the selection, so
// a sport change cleanly re-seeds the week + editable model.
export default function SportsHub({ selection = null, progress = null }) {
  const { user, session, signOut } = useAuth();
  const { t } = useLang();
  const uid = user?.username || user?.id || '';

  // Per-set telemetry (weight / RPE / completed_at) — lifted here so the logbook map
  // is fetched once on mount (rehydrates logged sets across refresh / day-switch) and
  // shared by the Day Protocol + the Native Sport Engine cards.
  const telemetry = useAthleteTelemetry(uid);

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

  // Native Sport Engine payload — coach-staged into bbf_active_clients, delivered in
  // the login envelope (session.plans.sports_protocol). Null for a non-specialized
  // athlete → SportProtocol renders the General Physical Preparedness fallback.
  const sportsProtocol = useMemo(() => selectPlans(session).sportsProtocol, [session]);

  // Lifted state — seeded once from the sport-aware model. `model` powers the
  // Combine/Power/Size calculators; `week` is the 7-day protocol with checkoff
  // state, restored from the persisted progress map. Switching days never resets it.
  const [model, setModel] = useState(() => buildHubModel(effProfile));
  const [week, setWeek] = useState(() => applyProgress(buildWeek(model), progress));
  const [activeDay, setActiveDay] = useState(() => firstTrainingDay(week));
  const [phase, setPhase] = useState('offseason'); // 'offseason' | 'inseason'

  // ── Daily checkoffs — mutate the ACTIVE day optimistically, then persist the
  //    single check-off to the athlete's row (bbf_log_youth_progress). The server
  //    is the source of truth on the next load (refresh/logout restores state). ──
  const onToggleExercise = useCallback((i) => {
    const day = week[activeDay];
    if (!day || day.rest) return;
    const next = !day.exercises[i].done;
    setWeek((w) => w.map((d, di) => (di !== activeDay || d.rest ? d
      : { ...d, exercises: d.exercises.map((e, ei) => (ei === i ? { ...e, done: next } : e)) })));
    logYouthProgress(uid, day.label, 'ex', i, next);
  }, [week, activeDay, uid]);

  const onToggleDrill = useCallback((i) => {
    const day = week[activeDay];
    if (!day || day.rest) return;
    const next = !day.drills[i].done;
    setWeek((w) => w.map((d, di) => (di !== activeDay || d.rest ? d
      : { ...d, drills: d.drills.map((dr, j) => (j === i ? { ...dr, done: next } : dr)) })));
    logYouthProgress(uid, day.label, 'dr', i, next);
  }, [week, activeDay, uid]);

  const onCycleStatus = useCallback((i) => {
    const day = week[activeDay];
    if (!day || day.rest) return;
    const next = nextStatus(day.film[i].status);
    setWeek((w) => w.map((d, di) => (di !== activeDay || d.rest ? d
      : { ...d, film: d.film.map((c, j) => (j === i ? { ...c, status: next } : c)) })));
    logYouthProgress(uid, day.label, 'fm', i, next);
  }, [week, activeDay, uid]);

  // ── Real-time calculators (Combine & Measurables panel) ─────────────────────
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

        {/* ── Native Sport Protocol — the coach-staged engine prescription ─────── */}
        <SportProtocol protocol={sportsProtocol} telemetry={telemetry} />

        {/* ── Training block (off/in-season workload selector) ────────────────── */}
        <div className="sh-phase" role="group" aria-label="Training block">
          <span className="sh-phase-l">Block</span>
          <button
            type="button"
            className={`sh-phase-btn${phase === 'offseason' ? ' is-on' : ''}`}
            aria-pressed={phase === 'offseason'}
            data-testid="sh-phase-off"
            onClick={() => setPhase('offseason')}
          >
            Off-Season
          </button>
          <button
            type="button"
            className={`sh-phase-btn${phase === 'inseason' ? ' is-on' : ''}`}
            aria-pressed={phase === 'inseason'}
            data-testid="sh-phase-in"
            onClick={() => setPhase('inseason')}
          >
            In-Season
          </button>
        </div>

        {/* ── Day 1–7 scrolling pill-navigation (mirrors the Vault Program/Nutrition) ── */}
        <nav className="sh-daynav" role="tablist" aria-label="Protocol days">
          {week.map((d, i) => (
            <button
              key={d.label}
              type="button"
              role="tab"
              aria-selected={i === activeDay}
              className={`sh-day-pill${i === activeDay ? ' is-on' : ''}`}
              data-testid={`sh-day-pill-${i}`}
              onClick={() => setActiveDay(i)}
            >
              {d.label}
            </button>
          ))}
        </nav>

        {/* key={activeDay} remounts the panel per day → the transition fires; the
            lifted week state survives (only the presentation div remounts). */}
        <div className="sh-panel" key={activeDay}>
          <DayProtocol
            day={week[activeDay]}
            phase={phase}
            telemetry={telemetry}
            onToggleExercise={onToggleExercise}
            onToggleDrill={onToggleDrill}
            onCycleStatus={onCycleStatus}
          />
        </div>

        {/* ── Combine & Measurables — the live calculators, one tap away ──────── */}
        <details className="sh-measurables">
          <summary className="sh-measurables-toggle" data-testid="sh-measurables-toggle">
            <span>Combine &amp; Measurables</span>
            <span className="sh-measurables-caret" aria-hidden="true">▾</span>
          </summary>
          <div className="sh-measurables-body">
            <CombineMetrics combine={model.combine} onMetricChange={onMetricChange} />
            <ExplosivePower power={model.power} onPowerChange={onPowerChange} />
            <SizeMass size={model.size} onSizeChange={onSizeChange} />
          </div>
        </details>

        <p className="sh-foot">
          BBF Athlete Portal — youth training is coach-supervised and periodized for safe long-term development.
        </p>
      </div>
    </div>
  );
}
