// src/pages/SportsHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — the authenticated home for the youth/sports division.
//
// The OTHER side of the post-login Routing Fork (lib/sportsRoster.js): a flagged
// sports athlete lands here straight from the login gate (after the first-run
// PAR-Q+ intake gate), bypassing the adult Sovereign Vault entirely.
//
// STRICT TAB-DECK (CEO order — kill the scroll fest): the hub mirrors the adult
// Vault's navigation — a horizontal tab rail over a SINGLE mounted domain. Exactly
// one data domain is on screen at a time; switching tabs unmounts the rest (no
// vertical stacking). Five domains:
//   Protocol  — field work (Native Sport Engine) + the Day 1–7 drill/film execution
//               protocol + the Combine & Measurables calculators.
//   Program   — the weight room (AthleteBlueprint, room="weight").
//   Fuel      — nutrition / macros (AthleteBlueprint, room="fuel").
//   Recovery  — the engine-generated RecoveryPrescriptionCard + baseline mobility.
//   Mindset   — the Champion Mindset film deck.
// The athlete identity hero + readiness banner stay persistent above the rail.
//
// Isolation: lives entirely within pages/SportsHub.jsx + components/sportshub/*.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { useAthleteProfile } from '../context/AthleteProfileContext.jsx';
import { resolveSportsProfile } from '../lib/sportsRoster.js';
import { buildSportsProtocol } from '../lib/sportsEngine.js';
import { levelToExperience, tierToPhase, levelForTier } from '../lib/athleteBlueprint.js';
import { logYouthProgress } from '../lib/youthIntakeApi.js';
import { useAthleteTelemetry } from '../lib/athleteTelemetryApi.js';
import { useDailyReadiness, handshakeChannel } from '../lib/useDailyReadiness.js';
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
import AthleteBlueprint from '../components/sportshub/AthleteBlueprint.jsx';
import YouthChampionMindset from '../components/sportshub/YouthChampionMindset.jsx';
import RecoveryPrescriptionCard from '../components/vault/RecoveryPrescriptionCard.jsx';
import SovereignReadinessDashboard from '../components/vault/SovereignReadinessDashboard.jsx';
import SovereignPrepPanels from '../components/vault/SovereignPrepPanels.jsx';
import { YOUTH_BASELINE_PREP } from '../components/sportshub/youthRecoveryPrep.js';
import Concierge from '../components/vault/Concierge.jsx';
import '../components/sportshub/sportsHub.css';

// First non-rest day, so the Hub never opens on a blank recovery card.
function firstTrainingDay(week) {
  const i = week.findIndex((d) => !d.rest);
  return i === -1 ? 0 : i;
}

// Readiness mode → trilingual chip key + youth directive key. ONE source of truth:
// this reads the SAME useDailyReadiness store the adult Vault regulates off.
const SH_MODE = {
  PRIME_EXECUTION: { chip: 'sch-mode-prime', dir: 'sh-rdy-prime' },
  STANDARD_OPERATIONS: { chip: 'sch-mode-standard', dir: 'sh-rdy-standard' },
  SYSTEM_STRAIN: { chip: 'sch-mode-strain', dir: 'sh-rdy-strain' },
  SYSTEM_BREACH: { chip: 'sch-mode-breach', dir: 'sh-rdy-breach' },
};

// Honest readiness banner — renders ONLY on a real same-window verdict (hasData).
// A youth athlete with no telemetry source shows nothing (no ghost UI); the moment
// real biometrics flow through the shared pipeline, the banner + handshake light up.
function ReadinessBanner({ readiness, t }) {
  if (!readiness?.hasData || !readiness.mode) return null;
  const meta = SH_MODE[readiness.mode];
  if (!meta) return null;
  const cls = readiness.isBreach ? 'breach'
    : readiness.mode === 'SYSTEM_STRAIN' ? 'strain'
    : readiness.mode === 'PRIME_EXECUTION' ? 'prime' : 'standard';
  return (
    <section className={`sh-rdy is-${cls}`} data-testid="sh-readiness-banner">
      <div className="sh-rdy-top">
        <span className="sh-rdy-kicker">{t('sh-rdy-kicker')}</span>
        <span className={`sh-rdy-chip is-${cls}`}>{t(meta.chip)}</span>
      </div>
      <div className="sh-rdy-body">
        <div className="sh-rdy-score">
          <span className="sh-rdy-score-v">{readiness.score ?? '—'}</span>
          <span className="sh-rdy-score-k">{t('sh-rdy-score')}</span>
        </div>
        <p className="sh-rdy-dir">{t(meta.dir)}</p>
      </div>
    </section>
  );
}

// ── Deck tabs — the strict single-domain navigation (mirrors the adult Vault's
// cv-tabs): exactly one panel mounts at a time, never a vertical stack. Trilingual
// labels are component-local (parity with the rest of the youth surface). ──
// Athlete-language deck (CEO terminology): Check-In · Drills (field work) · Exercises
// (weight room) · Nutrition · Recovery · Mindset. One domain mounts at a time.
const DECK_TABS = [
  { id: 'checkin', icon: '◉', en: 'Check-In', es: 'Chequeo', pt: 'Check-In' },
  { id: 'protocol', icon: '◎', en: 'Drills', es: 'Práctica', pt: 'Treino' },
  { id: 'program', icon: '▤', en: 'Exercises', es: 'Ejercicios', pt: 'Exercícios' },
  { id: 'fuel', icon: '◆', en: 'Nutrition', es: 'Nutrición', pt: 'Nutrição' },
  { id: 'recovery', icon: '❂', en: 'Recovery', es: 'Recuperación', pt: 'Recuperação' },
  { id: 'mindset', icon: '❖', en: 'Mindset', es: 'Mentalidad', pt: 'Mentalidade' },
];

// `selection` ({ sportId, positionCode }) is the athlete's intake choice and
// `progress` the persisted per-day check-off map (bbf_users.youth_progress) — both
// passed down by YouthIntakeGate. The gate keys this component on the selection, so
// a sport change cleanly re-seeds the week + editable model.
export default function SportsHub({ selection = null, progress = null }) {
  const { user, signOut } = useAuth();
  const { t, lang } = useLang();
  const uid = user?.username || user?.id || '';

  // The UNIFIED athlete profile — the single source of truth the Sport Protocol +
  // Athlete Blueprint both read. `setIntakeSport` lets us push the resolved intake
  // selection in (below), so the context follows the athlete's CURRENT discipline.
  const { profile: athleteProfile, currentTier, setIntakeSport } = useAthleteProfile();

  // Per-set telemetry (weight / RPE / completed_at) — lifted here so the logbook map
  // is fetched once on mount (rehydrates logged sets across refresh / day-switch) and
  // shared by the Day Protocol + the Native Sport Engine cards.
  const telemetry = useAthleteTelemetry(uid);

  // Sovereign Readiness off the SHARED biometric store — the SAME pipeline the
  // adult Vault regulates off (one source of truth for athlete biometrics). Drives
  // the [data-bbf-mode] handshake on the Sports Hub screen + the readiness banner.
  // No telemetry → handshake 'none' (neutral) and the banner self-hides.
  const { data: readiness } = useDailyReadiness();
  const handshake = handshakeChannel(readiness);

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

  // SPORT SOURCE OF TRUTH — push the resolved intake selection into the unified
  // AthleteProfileContext so the Sport Protocol + Blueprint follow the athlete's
  // CURRENT discipline. This severs the "sport bleed": Champion Mindset + Today's
  // Drills already track the selection, and now the engine-built protocol does too.
  // The context setter is no-op-guarded, so this can't loop.
  useEffect(() => {
    setIntakeSport(effProfile.sportId, effProfile.positionCode);
  }, [effProfile.sportId, effProfile.positionCode, setIntakeSport]);

  // Native Sport Engine prescription — built DETERMINISTICALLY from the unified
  // athlete profile (AthleteProfileContext), NOT the stale coach-staged login blob
  // (selectPlans(session).sports_protocol, which froze at the old sport). Sport,
  // experience, goal and phase all flow from the single source of truth, so an
  // intake sport change immediately re-forges this protocol — no bleed.
  const sportsProtocol = useMemo(() => buildSportsProtocol({
    sport: athleteProfile.sportId,
    age: Number(athleteProfile.age) || null,
    experience: levelToExperience(athleteProfile.level || levelForTier(currentTier)),
    goal: athleteProfile.goal,
    targetPhase: tierToPhase(currentTier),
  }), [athleteProfile.sportId, athleteProfile.age, athleteProfile.level, athleteProfile.goal, currentTier]);

  // Lifted state — seeded once from the sport-aware model. `model` powers the
  // Combine/Power/Size calculators; `week` is the 7-day protocol with checkoff
  // state, restored from the persisted progress map. Switching days never resets it.
  const [model, setModel] = useState(() => buildHubModel(effProfile));
  const [week, setWeek] = useState(() => applyProgress(buildWeek(model), progress));
  const [activeDay, setActiveDay] = useState(() => firstTrainingDay(week));
  const [phase, setPhase] = useState('offseason'); // 'offseason' | 'inseason'
  // Strict tab-deck — the active data domain. One panel mounts at a time. The athlete
  // LANDS on Check-In (the morning readiness scan) before any daily work.
  const [activeTab, setActiveTab] = useState('checkin');

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
    <div className="sh-screen" data-testid="sports-hub" data-bbf-mode={handshake}>
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
        {/* ── Athlete identity hero — persistent varsity scoreboard register ───── */}
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

        {/* ── Sovereign Readiness — same useDailyReadiness pipeline as the Vault
            (one source of truth). Self-hides with no telemetry; never ghost UI. ── */}
        <ReadinessBanner readiness={readiness} t={t} />

        {/* ── Strict tab-deck rail — one data domain mounted at a time (no scroll
            fest). Mirrors the adult Vault's cv-tabs navigation. ──────────────── */}
        <nav className="sh-deck" role="tablist" aria-label="Athlete Hub">
          {DECK_TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`sh-deck-tab${active ? ' is-active' : ''}`}
                data-testid={`sh-deck-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="sh-deck-ic" aria-hidden="true">{tab.icon}</span>
                {tab[lang] || tab.en}
              </button>
            );
          })}
        </nav>

        {/* key={activeTab} → clean unmount/remount per swap; no domain ever bleeds
            into another. The lifted week/model state lives on the component (not the
            panel), so day check-offs survive a tab switch. */}
        <div className="sh-deck-panel" role="tabpanel" key={activeTab}>
          {/* ── CHECK-IN — the morning CNS readiness scan; the athlete lands here
              first and sets today's training volume before any daily work. ─────── */}
          {activeTab === 'checkin' ? (
            <SovereignReadinessDashboard />
          ) : null}

          {/* ── PROTOCOL — field work + the Day 1–7 execution protocol + combine ── */}
          {activeTab === 'protocol' ? (
            <>
              <SportProtocol protocol={sportsProtocol} telemetry={telemetry} />

              {/* Training block (off/in-season workload selector) */}
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

              {/* Day 1–7 scrolling pill-navigation */}
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

              {/* Combine & Measurables — the live calculators, one tap away */}
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
            </>
          ) : null}

          {/* ── EXERCISES — the weight room, auto-forged (no manual calibrate) ─── */}
          {activeTab === 'program' ? (
            <AthleteBlueprint sportLabel={effProfile.sport} positionLabel={effProfile.position} room="weight" readOnly />
          ) : null}

          {/* ── FUEL — nutrition / macros (buildMealPlan output). READ-ONLY: the
              Program tab is the single forge control; Fuel purely displays. ────── */}
          {activeTab === 'fuel' ? (
            <AthleteBlueprint sportLabel={effProfile.sport} positionLabel={effProfile.position} room="fuel" readOnly />
          ) : null}

          {/* ── RECOVERY — engine prescription + the transplanted media-rich prep
              (foam rolling → static stretching → dynamic drills), same UI as the
              adult ClientHub via SovereignPrepPanels. ─────────────────────────── */}
          {activeTab === 'recovery' ? (
            <>
              <RecoveryPrescriptionCard />
              <section className="sp-section" data-testid="youth-recovery-prep">
                <header className="sp-section-head">
                  <div className="sp-kicker">{t('sp-kicker')}</div>
                  <h2 className="sp-title">{t('sp-title')}</h2>
                  <p className="sp-section-sub">{t('sp-section-sub')}</p>
                </header>
                <SovereignPrepPanels data={YOUTH_BASELINE_PREP} />
              </section>
            </>
          ) : null}

          {/* ── MINDSET — sport/language-aware Champion Mindset film deck ──────── */}
          {activeTab === 'mindset' ? (
            <YouthChampionMindset sportId={effProfile.sportId} />
          ) : null}
        </div>

        {/* Replay the Sports Hub welcome tour — mirrors the Vault Settings button,
            but summons the SPORTS concierge (detail.hub:'sports'). */}
        <div className="sh-replay-row">
          <button
            type="button"
            className="sh-replay"
            data-testid="sports-concierge-summon"
            onClick={() => {
              try { window.dispatchEvent(new CustomEvent('bbf:concierge:summon', { detail: { hub: 'sports' } })); } catch { /* no-op */ }
            }}
          >
            {t('concierge-replay')}
          </button>
        </div>

        <p className="sh-foot">
          BBF Athlete Portal — youth training is coach-supervised and periodized for safe long-term development.
        </p>
      </div>

      {/* Self-Serve Sports Concierge — the BBF Athlete Portal first-open welcome.
          Hub-forked: distinct greeting + its own durable gate (has_seen_sports_welcome). */}
      <Concierge hub="sports" />
    </div>
  );
}
