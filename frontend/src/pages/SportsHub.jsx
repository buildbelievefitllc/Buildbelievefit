// src/pages/SportsHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — the authenticated home for the youth/sports division.
//
// The OTHER side of the post-login Routing Fork (lib/sportsRoster.js): a flagged
// sports athlete lands here straight from the login gate (after the first-run
// PAR-Q+ intake gate), bypassing the adult Sovereign Vault entirely.
//
// STRICT TAB-DECK (CEO order — kill the scroll fest): the hub mirrors the adult
// Vault's navigation — a horizontal tab rail over a SINGLE VISIBLE domain. Exactly
// one panel is shown at a time (no vertical stacking). Phase 3 keep-alive: panels
// mount on first visit and STAY mounted (CSS-hidden when inactive) so Fuel /
// Mindset never re-fire their network/audio lifecycles on every tab swap.
// Domains:
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
import { logYouthProgress } from '../lib/youthIntakeApi.js';
import { fetchMySportBlock } from '../lib/sportsCatalogApi.js';
import SeasonCalendarCard from '../components/sportshub/SeasonCalendarCard.jsx';
import { fetchAvatar, pushAvatar } from '../lib/avatarApi.js';
import { useAthleteTelemetry } from '../lib/athleteTelemetryApi.js';
import { useDailyReadiness, handshakeChannel } from '../lib/useDailyReadiness.js';
import LangToggle from '../components/LangToggle.jsx';
import { buildHubModel, buildWeek, applyProgress, applyWeekOverrides, progressToward, computePowerIndex, nextStatus } from '../components/sportshub/hubData.js';
import { YOUTH_SPORTS, positionLabel } from '../components/sportshub/youthSports.js';
import {
  CombineMetrics,
  ExplosivePower,
  SizeMass,
  DayProtocol,
} from '../components/sportshub/sections.jsx';
import AthleteBlueprint from '../components/sportshub/AthleteBlueprint.jsx';
import YouthChampionMindset from '../components/sportshub/YouthChampionMindset.jsx';
import RecoveryPrescriptionCard from '../components/vault/RecoveryPrescriptionCard.jsx';
import SovereignReadinessDashboard from '../components/vault/SovereignReadinessDashboard.jsx';
import SovereignPrepPanels from '../components/vault/SovereignPrepPanels.jsx';
import { YOUTH_BASELINE_PREP } from '../components/sportshub/youthRecoveryPrep.js';
import Concierge from '../components/vault/Concierge.jsx';
import YouthGameplan from '../components/sportshub/YouthGameplan.jsx';
import YouthPostGameCheck from '../components/sportshub/YouthPostGameCheck.jsx';
import YouthPrehab from '../components/sportshub/YouthPrehab.jsx';
import { YouthNext } from '../components/sportshub/youthSequenceParts.jsx';
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
  // Prescription-only Prehab — the Post-Game Check fork lands here with a targeted,
  // hard-capped fix for the reported zone (no library; CEO "Netflix rule").
  { id: 'prehab', icon: '✚', en: 'Prehab', es: 'Prehab', pt: 'Prehab' },
  { id: 'mindset', icon: '❖', en: 'Mindset', es: 'Mentalidad', pt: 'Mentalidade' },
];

// THE GAMEPLAN inter-tab hand-off labels (the youth guided sequence). Component-local
// trilingual, parity with the rest of the youth surface (CLAUDE.md §1).
const SEQ_LABELS = {
  en: { armor: 'Step 2: Armor Prep ➔', drills: 'Step 3: Hit the Drills ➔' },
  es: { armor: 'Paso 2: Preparar la Armadura ➔', drills: 'Paso 3: A la Práctica ➔' },
  pt: { armor: 'Passo 2: Preparar a Armadura ➔', drills: 'Passo 3: Bora pro Treino ➔' },
};

// Shared Day-deck — the Off-Season / In-Season toggle + a Day 1–7 pill nav over a
// SINGLE mounted day. Rendered by BOTH the Drills (view='drills') and Exercises
// (view='exercises') tabs so a day's drills / weight-room work are never stacked
// vertically — clicking a day shows ONLY that day's items.
function DayDeck({ view, phase, setPhase, week, activeDay, setActiveDay, telemetry, onToggleExercise, onToggleDrill, onCycleStatus }) {
  return (
    <>
      <div className="sh-phase" role="group" aria-label="Training block">
        <span className="sh-phase-l">Block</span>
        <button type="button" className={`sh-phase-btn${phase === 'offseason' ? ' is-on' : ''}`} aria-pressed={phase === 'offseason'} data-testid="sh-phase-off" onClick={() => setPhase('offseason')}>Off-Season</button>
        <button type="button" className={`sh-phase-btn${phase === 'inseason' ? ' is-on' : ''}`} aria-pressed={phase === 'inseason'} data-testid="sh-phase-in" onClick={() => setPhase('inseason')}>In-Season</button>
      </div>
      <nav className="sh-daynav" role="tablist" aria-label="Protocol days">
        {week.map((d, i) => (
          <button key={d.label} type="button" role="tab" aria-selected={i === activeDay}
            className={`sh-day-pill${i === activeDay ? ' is-on' : ''}`} data-testid={`sh-day-pill-${i}`}
            onClick={() => setActiveDay(i)}>{d.label}</button>
        ))}
      </nav>
      {/* key remounts the panel per day/view → the transition fires; lifted week state survives. */}
      <div className="sh-panel" key={`${view}-${activeDay}`}>
        <DayProtocol view={view} day={week[activeDay]} phase={phase} telemetry={telemetry}
          onToggleExercise={onToggleExercise} onToggleDrill={onToggleDrill} onCycleStatus={onCycleStatus} />
      </div>
    </>
  );
}

// ── Avatar (profile picture) — client-side upload, compressed to a small square data
// URL and persisted per-uid to localStorage so it survives reloads on the device. ──
const AVATAR_KEY = 'bbf.avatar.v1';
function loadAvatar(uid) {
  try { const all = JSON.parse(localStorage.getItem(AVATAR_KEY) || '{}'); return (uid && all[uid]) || ''; } catch { return ''; }
}
function saveAvatar(uid, dataUrl) {
  if (!uid) return;
  try { const all = JSON.parse(localStorage.getItem(AVATAR_KEY) || '{}'); all[uid] = dataUrl; localStorage.setItem(AVATAR_KEY, JSON.stringify(all)); } catch { /* quota */ }
}
// Resize/center-crop an uploaded image to a square ≤256px JPEG data URL (tiny storage).
function compressImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale; const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Post-Game friction (the youth closed loop) — the last zone the athlete flagged
// in the Post-Game Check, persisted per-uid for the SAME calendar day so the Prehab
// tab keeps the targeted fix on a refresh. A stale (prior-day) log never drives
// today's tab; a clean "I feel great" clears it. (The server session_feedback row is
// the durable source of truth the recovery engine reads — this is just the UI hint.)
const FRICTION_KEY = 'bbf.youth.friction.v1';
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function loadFriction(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(FRICTION_KEY) || '{}');
    const f = uid && all[uid];
    return (f && f.date === todayKey() && f.area) ? { area: f.area, pain: f.pain } : null;
  } catch { return null; }
}
function saveFriction(uid, friction) {
  if (!uid) return;
  try {
    const all = JSON.parse(localStorage.getItem(FRICTION_KEY) || '{}');
    if (friction && friction.area) all[uid] = { area: friction.area, pain: friction.pain, date: todayKey() };
    else delete all[uid];
    localStorage.setItem(FRICTION_KEY, JSON.stringify(all));
  } catch { /* quota — non-fatal */ }
}

// `selection` ({ sportId, positionCode }) is the athlete's intake choice and
// `progress` the persisted per-day check-off map (bbf_users.youth_progress) — both
// passed down by YouthIntakeGate. The gate keys this component on the selection, so
// a sport change cleanly re-seeds the week + editable model.
export default function SportsHub({ selection = null, progress = null }) {
  const { user, signOut } = useAuth();
  const { t, lang } = useLang();
  const uid = user?.username || user?.id || '';

  // The UNIFIED athlete profile — `setIntakeSport` pushes the resolved intake
  // selection into the context so the Blueprint engines (Nutrition tab auto-forge)
  // follow the athlete's CURRENT discipline.
  const { setIntakeSport } = useAthleteProfile();

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
  // No football/OL hard-default — multi-sport / pre-intake athletes stay generic
  // until intake (or a real profile) supplies a discipline.
  const effProfile = useMemo(() => {
    const sportId = selection?.sportId || profile.sportId || '';
    const positionCode = selection?.positionCode || profile.positionCode || '';
    const cfg = YOUTH_SPORTS.find((s) => s.id === sportId);
    const sport = cfg ? t(cfg.labelKey) : (profile.sport || 'Multi-Sport');
    return { ...profile, sportId, positionCode, sport, position: positionLabel(sportId, positionCode) };
  }, [selection, profile, t]);

  // SPORT SOURCE OF TRUTH — push the resolved intake selection into the unified
  // AthleteProfileContext so the Blueprint engines (Nutrition auto-forge) follow the
  // athlete's CURRENT discipline. The context setter is no-op-guarded, so this can't loop.
  useEffect(() => {
    setIntakeSport(effProfile.sportId, effProfile.positionCode);
  }, [effProfile.sportId, effProfile.positionCode, setIntakeSport]);

  // Lifted state — seeded once from the sport-aware model. `model` powers the
  // Combine/Power/Size calculators; `week` is the 7-day protocol with checkoff
  // state, restored from the persisted progress map. Switching days never resets it.
  const [model, setModel] = useState(() => buildHubModel(effProfile));
  const [week, setWeek] = useState(() => applyProgress(buildWeek(model), progress));
  const [activeDay, setActiveDay] = useState(() => firstTrainingDay(week));

  const [phase, setPhase] = useState('offseason'); // 'offseason' | 'inseason'

  // SP-1/SP-2 · Sport Periodization Catalog + Season Brain — when a founder-
  // approved baked block exists for this athlete's (sport × position × phase ×
  // tier) cell it replaces the generic WEEK_TEMPLATE, and any approved game-week
  // overlay (taper notes / volume trims) rides on top. The season calendar also
  // drives the off/in-season default. FAIL-OPEN: null/error keeps the template;
  // labels stay "Day N" so persisted check-offs re-apply cleanly.
  const [seasonState, setSeasonState] = useState(null);
  const [seasonRefresh, setSeasonRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchMySportBlock(uid).then((res) => {
      if (!alive || !res) return;
      if (res.season) {
        setSeasonState(res.season);
        if (res.season.in_season) setPhase('inseason');
      }
      if (res.block?.days) {
        setWeek(applyWeekOverrides(applyProgress(buildWeek(model, res.block.days), progress), res.week_overrides));
      } else if (res.week_overrides) {
        setWeek((w) => applyWeekOverrides(w, res.week_overrides));
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one catalog fetch per model identity + explicit season refresh; `progress` is the load-time snapshot by design
  }, [uid, model, seasonRefresh]);
  // Strict tab-deck — one panel visible at a time. Keep-alive: mount each domain on
  // first visit, then hide (don't unmount) so Fuel/Mindset network + audio effects
  // don't re-run on every rail click. Athlete LANDS on Check-In first.
  const [activeTab, setActiveTab] = useState('checkin');
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['checkin']));
  const visitTab = useCallback((id) => {
    setActiveTab(id);
    setVisitedTabs((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // THE GAMEPLAN — the guided youth sequence drives tab swaps through one callback
  // (mirrors the adult Vault's onNavigate). The Post-Game Check lifts the reported
  // friction zone here so the Prehab tab can prescribe the targeted fix.
  const onNavigate = useCallback((id) => visitTab(id), [visitTab]);
  const [lastFriction, setLastFriction] = useState(() => loadFriction(uid));
  const onLogFriction = useCallback((f) => { setLastFriction(f); saveFriction(uid, f); }, [uid]);

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

  // Profile avatar — uploaded, compressed, persisted to bbf_users.avatar (server
  // = source of truth, cross-device) with localStorage as the instant on-device
  // cache. Local state seeds from cache for a flash-free first paint; an on-mount
  // hydrate reconciles against the server. Falls back to jersey initials when unset.
  const [avatar, setAvatar] = useState(() => loadAvatar(uid));
  useEffect(() => {
    let alive = true;
    (async () => {
      const remote = await fetchAvatar();
      if (!alive || !remote) return;       // no server copy → keep local cache as-is
      setAvatar((cur) => (remote === cur ? cur : remote));
      saveAvatar(uid, remote);             // refresh the on-device cache
    })();
    return () => { alive = false; };
  }, [uid]);
  const onAvatarChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setAvatar(dataUrl);
      saveAvatar(uid, dataUrl);            // instant local-first update
      pushAvatar(dataUrl);                 // best-effort server sync (cross-device + CRM)
    } catch { /* unreadable image — keep the current avatar */ }
  }, [uid]);

  const name = profile.athleteName || user?.displayName || 'Athlete';
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const seq = SEQ_LABELS[lang] || SEQ_LABELS.en;

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
            <div className="sh-jersey">
              {avatar ? (
                <img className="sh-jersey-img" src={avatar} alt={`${name} profile`} data-testid="sh-avatar-img" />
              ) : (
                <>
                  <span className="sh-jersey-no" aria-hidden="true">{profile.jerseyNo ?? '00'}</span>
                  <span className="sh-jersey-init" aria-hidden="true">{initials || 'AB'}</span>
                </>
              )}
              <label className="sh-avatar-edit" title="Upload profile photo">
                <input type="file" accept="image/*" hidden data-testid="sh-avatar-input" onChange={onAvatarChange} />
                <span aria-hidden="true">📷</span>
                <span className="sh-sr-only">Upload profile photo</span>
              </label>
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
                onClick={() => visitTab(tab.id)}
              >
                <span className="sh-deck-ic" aria-hidden="true">{tab.icon}</span>
                {tab[lang] || tab.en}
              </button>
            );
          })}
        </nav>

        {/* Keep-alive deck: each domain mounts once on first visit, then toggles
            visibility (no remount). Lifted week/model state still lives here. */}
        <div className="sh-deck-panels">
          {/* ── CHECK-IN — the morning CNS readiness scan; the athlete lands here
              first and sets today's training volume before any daily work. ─────── */}
          {visitedTabs.has('checkin') ? (
            <div
              className={`sh-deck-panel${activeTab === 'checkin' ? ' is-active' : ''}`}
              role="tabpanel"
              aria-hidden={activeTab !== 'checkin'}
              hidden={activeTab !== 'checkin'}
              data-testid="sh-panel-checkin"
            >
              {/* PHASE 1 · THE GAMEPLAN — audio pep-talk + the daily-gameplan shield,
                  the FIRST thing the athlete sees, before they log their sleep. */}
              <YouthGameplan />
              <SovereignReadinessDashboard />
              {/* SP-2 · Season calendar — guardian/athlete game-date input; feeds the
                  Season Brain's weekly taper pass and the off/in-season default. */}
              <SeasonCalendarCard
                uid={uid}
                season={seasonState}
                lang={lang}
                onSaved={() => setSeasonRefresh((n) => n + 1)}
              />
              {/* Step 2 hand-off → Armor Prep (Recovery). */}
              <YouthNext label={seq.armor} onClick={() => onNavigate('recovery')} testid="youth-step-2" />
            </div>
          ) : null}

          {/* ── DRILLS — sport drills distributed across Off/In × Day 1–7, ONE day at
              a time (no vertical protocol dump). Combine calculators one tap away. ── */}
          {visitedTabs.has('protocol') ? (
            <div
              className={`sh-deck-panel${activeTab === 'protocol' ? ' is-active' : ''}`}
              role="tabpanel"
              aria-hidden={activeTab !== 'protocol'}
              hidden={activeTab !== 'protocol'}
              data-testid="sh-panel-protocol"
            >
              <DayDeck
                view="drills"
                phase={phase} setPhase={setPhase}
                week={week} activeDay={activeDay} setActiveDay={setActiveDay}
                telemetry={telemetry}
                onToggleExercise={onToggleExercise}
                onToggleDrill={onToggleDrill}
                onCycleStatus={onCycleStatus}
              />

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

              {/* PHASE 3 · POST-GAME CHECK — the youth friction logger (writes the
                  SAME session_feedback the recovery engine reads) + PHASE 4 fork:
                  Cool Down → Mindset, and Fix the Pain → Prehab when sore. */}
              <YouthPostGameCheck onNavigate={onNavigate} onLogged={onLogFriction} />
            </div>
          ) : null}

          {/* ── EXERCISES — the weight room as per-day interactive video cards
              (Off/In × Day 1–7), matching the adult side's card layout. ─────────── */}
          {visitedTabs.has('program') ? (
            <div
              className={`sh-deck-panel${activeTab === 'program' ? ' is-active' : ''}`}
              role="tabpanel"
              aria-hidden={activeTab !== 'program'}
              hidden={activeTab !== 'program'}
              data-testid="sh-panel-program"
            >
              <DayDeck
                view="exercises"
                phase={phase} setPhase={setPhase}
                week={week} activeDay={activeDay} setActiveDay={setActiveDay}
                telemetry={telemetry}
                onToggleExercise={onToggleExercise}
                onToggleDrill={onToggleDrill}
                onCycleStatus={onCycleStatus}
              />
            </div>
          ) : null}

          {/* ── FUEL — nutrition / macros (buildMealPlan output). READ-ONLY: the
              Program tab is the single forge control; Fuel purely displays. ────── */}
          {visitedTabs.has('fuel') ? (
            <div
              className={`sh-deck-panel${activeTab === 'fuel' ? ' is-active' : ''}`}
              role="tabpanel"
              aria-hidden={activeTab !== 'fuel'}
              hidden={activeTab !== 'fuel'}
              data-testid="sh-panel-fuel"
            >
              <AthleteBlueprint sportLabel={effProfile.sport} positionLabel={effProfile.position} room="fuel" readOnly />
            </div>
          ) : null}

          {/* ── RECOVERY — engine prescription + the transplanted media-rich prep
              (foam rolling → static stretching → dynamic drills), same UI as the
              adult ClientHub via SovereignPrepPanels. ─────────────────────────── */}
          {visitedTabs.has('recovery') ? (
            <div
              className={`sh-deck-panel${activeTab === 'recovery' ? ' is-active' : ''}`}
              role="tabpanel"
              aria-hidden={activeTab !== 'recovery'}
              hidden={activeTab !== 'recovery'}
              data-testid="sh-panel-recovery"
            >
              {/* The interactive 3-phase prep deck FIRST (Tissue Release · Static
                  Elongation · Dynamic Potentiation) — the same component the adult
                  ClientHub uses. The engine-generated prescription sits below it. */}
              <section className="sp-section" data-testid="youth-recovery-prep">
                <header className="sp-section-head">
                  <div className="sp-kicker">{t('sp-kicker')}</div>
                  <h2 className="sp-title">{t('sp-title')}</h2>
                  <p className="sp-section-sub">{t('sp-section-sub')}</p>
                </header>
                <SovereignPrepPanels data={YOUTH_BASELINE_PREP} />
              </section>
              <RecoveryPrescriptionCard />
              {/* Step 3 hand-off → Hit the Drills (Program/Drills). */}
              <YouthNext label={seq.drills} onClick={() => onNavigate('protocol')} testid="youth-step-3" />
            </div>
          ) : null}

          {/* ── PREHAB — prescription-only fix (CEO "Netflix rule"): the Post-Game
              fork lands here with a hard-capped, zone-targeted routine. No library,
              no browse — just the fix for the zone the athlete flagged. ───────── */}
          {visitedTabs.has('prehab') ? (
            <div
              className={`sh-deck-panel${activeTab === 'prehab' ? ' is-active' : ''}`}
              role="tabpanel"
              aria-hidden={activeTab !== 'prehab'}
              hidden={activeTab !== 'prehab'}
              data-testid="sh-panel-prehab"
            >
              <YouthPrehab friction={lastFriction} />
            </div>
          ) : null}

          {/* ── MINDSET — sport/language-aware Champion Mindset film deck ──────── */}
          {visitedTabs.has('mindset') ? (
            <div
              className={`sh-deck-panel${activeTab === 'mindset' ? ' is-active' : ''}`}
              role="tabpanel"
              aria-hidden={activeTab !== 'mindset'}
              hidden={activeTab !== 'mindset'}
              data-testid="sh-panel-mindset"
            >
              <YouthChampionMindset sportId={effProfile.sportId} />
            </div>
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
          PINNED to the Check-In tab (the athlete's first interaction): `armed` only
          arms the auto-fire while Check-In is active, so the welcome lands in the
          readiness-scan context and never pops over Drills/Exercises. The Replay
          button (summon) still works from any tab. */}
      <Concierge hub="sports" armed={activeTab === 'checkin'} />
    </div>
  );
}
