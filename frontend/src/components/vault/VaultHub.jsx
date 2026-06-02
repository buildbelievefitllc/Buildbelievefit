// src/components/vault/VaultHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 → 24 — Client Vault · Hub. The athlete's personal dashboard (the
// client-facing counterpart to the admin Command Center's roster-wide Client
// Hub, which is service-role and not applicable to a single client).
//
// Phase 24 — Clinical Hub upgrade. The bland metric boxes are replaced with a
// high-contrast "MY CLIENT PROFILE HUB" banner, a sharp monospace data strip
// (sessions · streak · macro targets), and a massive Smart-Day-Sync mission
// panel that reads the athlete's assigned workout_plan and surfaces TODAY's
// training focus the second the app opens. Brutalist: hard borders, pure
// black, deep purple, sharp geometric containers — no soft gradients.
//
// Data contract { isLoading, error, profile } is owned by the Vault shell; the
// plan envelope (plans.workoutPlan / plans.mealPlan) is passed in alongside so
// the Smart Day Sync + macro targets render from the athlete's real plan.

import { useMemo } from 'react';
import { Loading, Empty } from '../command/primitives.jsx';
import { parseWorkoutPlan, parseMealPlan } from '../../lib/vaultApi.js';
import { getProgram } from './programData.js';
import './vault.css';

const STATS = [
  { key: 'totalSessions', label: 'Total Sessions', unit: 'logged', accent: 'var(--yel)' },
  { key: 'currentStreak', label: 'Current Streak', unit: 'days', accent: 'var(--grn)' },
  { key: 'bestStreak', label: 'Best Streak', unit: 'days', accent: 'var(--purl)' },
  { key: 'thisWeek', label: 'This Week', unit: 'sessions', accent: 'var(--blu)' },
  { key: 'thisMonth', label: 'This Month', unit: 'sessions', accent: 'var(--blu)' },
  { key: 'avgPerWeek', label: 'Avg / Week', unit: 'sessions', accent: 'var(--orn)' },
];

// Smart Day Sync — resolve TODAY's day object from the assigned plan.
//   1) Exact weekday-name match ("Monday" → the plan's Monday object).
//   2) Positional fallback for "Day 1…7"-style plans: map today's Monday-indexed
//      weekday (Mon=0 … Sun=6) onto the matching plan slot.
//   3) First day as a last resort, so the mission panel is never blank.
// Returns { day, focus, focus_cue?, isRest?, restNote?, source } or null when no
// structured plan exists at all (caller then shows the unassigned state).
function resolveToday(plan) {
  if (!Array.isArray(plan) || !plan.length) return null;
  const now = new Date();
  const longName = now.toLocaleDateString('en-US', { weekday: 'long' }); // "Monday"
  const idxMon = (now.getDay() + 6) % 7; // 0=Mon … 6=Sun

  const byName = plan.find((d) => String(d?.day || '').trim().toLowerCase() === longName.toLowerCase());
  if (byName) return { ...byName, source: 'weekday' };
  if (plan[idxMon]) return { ...plan[idxMon], source: 'position' };
  return { ...plan[0], source: 'fallback' };
}

// Macro targets from the assigned meal plan, with a safe placeholder fallback so
// the data strip is never empty. Returns ordered [{ key, label, value, unit }].
function resolveMacros(mealPlanRaw) {
  const parsed = parseMealPlan(mealPlanRaw);
  const cal = parsed.cal != null ? parsed.cal.toLocaleString() : '—';
  const m = parsed.macros || {};
  const g = (n) => (Number.isFinite(n) && n > 0 ? String(n) : '—');
  return [
    { key: 'kcal', label: 'Calories', value: cal, unit: 'kcal' },
    { key: 'protein', label: 'Protein', value: g(m.p), unit: 'g' },
    { key: 'carbs', label: 'Carbs', value: g(m.c), unit: 'g' },
    { key: 'fat', label: 'Fat', value: g(m.f), unit: 'g' },
  ];
}

// ── Hero: high-contrast banner + Smart-Day-Sync mission + monospace datastrip ──
function HubHero({ displayName, slug, today, macros, sessions, streak }) {
  const isRest = today?.isRest;
  const focus = today?.focus || (today ? 'Training Day' : 'No Program Assigned');
  const dayLabel = today?.day || todayWeekday();

  return (
    <section className="cv-hub" aria-label="Client profile hub">
      {/* ── Banner ── */}
      <header className="cv-hub-banner">
        <div className="cv-hub-banner-l">
          <span className="cv-hub-eyebrow">Sovereign Vault</span>
          <h1 className="cv-hub-title">MY CLIENT PROFILE HUB</h1>
        </div>
        <div className="cv-hub-banner-r">
          <span className="cv-hub-id">{slug ? `@${slug}` : displayName}</span>
        </div>
      </header>

      {/* ── Smart Day Sync — the mission ── */}
      <div className={`cv-mission${isRest ? ' is-rest' : ''}`}>
        <div className="cv-mission-tag">
          <span className="cv-mission-dot" aria-hidden="true" />
          {dayLabel} · Today&apos;s Mission
        </div>
        {today ? (
          <>
            <div className="cv-mission-focus">{isRest ? 'Recovery / Rest Day' : focus}</div>
            <div className="cv-mission-sub">
              {isRest
                ? (today.restNote || 'Active recovery — stretch, hydrate, sleep.')
                : (today.focus_cue
                    ? `🎯 ${today.focus_cue}`
                    : `${Array.isArray(today.exercises) ? today.exercises.length : 0} exercises prescribed · open Program to execute`)}
            </div>
          </>
        ) : (
          <>
            <div className="cv-mission-focus">No Program Assigned</div>
            <div className="cv-mission-sub">Your coach&apos;s assigned protocol will appear here.</div>
          </>
        )}
      </div>

      {/* ── Monospace data strip — sessions · streak · macro targets ── */}
      <div className="cv-datastrip" aria-label="Profile data points">
        <DataPoint label="Sessions Logged" value={fmtInt(sessions)} />
        <DataPoint label="Streak" value={fmtInt(streak)} unit="d" tone="grn" />
        {macros.map((mm) => (
          <DataPoint key={mm.key} label={mm.label} value={mm.value} unit={mm.unit} tone="gold" />
        ))}
      </div>
    </section>
  );
}

function DataPoint({ label, value, unit, tone }) {
  return (
    <div className={`cv-dp${tone ? ` is-${tone}` : ''}`}>
      <span className="cv-dp-k">{label}</span>
      <span className="cv-dp-v">
        {value}
        {unit ? <span className="cv-dp-u">{unit}</span> : null}
      </span>
    </div>
  );
}

function todayWeekday() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function fmtInt(v) {
  return v !== null && v !== undefined && v !== '' ? Number(v).toLocaleString() : '—';
}

export default function VaultHub({ profile, isLoading, error, displayName = 'Athlete', slug = '', plans = null, programKey = '' }) {
  // Smart Day Sync — prefer the athlete's assigned JSON plan; fall back to the
  // authorized static catalog by persona (same precedence as the Program grid)
  // so the mission panel is populated for every athlete, never blank.
  const today = useMemo(() => {
    const assigned = parseWorkoutPlan(plans?.workoutPlan || '');
    const plan = Array.isArray(assigned) && assigned.length ? assigned : getProgram(programKey);
    return resolveToday(plan);
  }, [plans?.workoutPlan, programKey]);
  const macros = useMemo(() => resolveMacros(plans?.mealPlan || ''), [plans?.mealPlan]);

  return (
    <div className="pg">
      <HubHero
        displayName={displayName}
        slug={slug}
        today={today}
        macros={macros}
        sessions={profile?.totalSessions}
        streak={profile?.currentStreak}
      />
      {isLoading ? <Loading label="Loading your Vault…" /> : null}
      {!isLoading && error ? <div className="pg-hub-error">{error}</div> : null}
      {!isLoading && !error && !profile ? <Empty>No profile data yet.</Empty> : null}
      {!isLoading && !error && profile ? <HubMetrics profile={profile} /> : null}
    </div>
  );
}

function HubMetrics({ profile }) {
  const fresh = profile.found && profile.totalSessions > 0;

  return (
    <>
      <h2 className="pg-hub-subhead">Performance Index</h2>
      <div className="pg-hub-grid">
        {STATS.map((s) => {
          const v = profile[s.key];
          const has = v !== null && v !== undefined && v !== '';
          return (
            <div key={s.key} className="pg-stat" style={{ borderTopColor: s.accent }}>
              <div className="pg-stat-k">{s.label}</div>
              <div className="pg-stat-v">{has ? Number(v).toLocaleString() : '—'}</div>
              <div className="pg-stat-u">{has ? s.unit : ''}</div>
            </div>
          );
        })}
      </div>

      <h2 className="pg-hub-subhead">Last 30 Days</h2>
      {profile.heatmap.length ? (
        <div className="pg-heatmap" aria-label="30-day training consistency">
          {profile.heatmap.map((d) => (
            <span
              key={d.date}
              title={`${d.date}${d.logged ? ' — trained' : ''}`}
              className={`pg-heat-cell${d.logged ? ' is-on' : ''}`}
            />
          ))}
        </div>
      ) : (
        <Empty>
          {fresh
            ? 'No sessions in the last 30 days — time to log one.'
            : 'Your first logged session will light up here.'}
        </Empty>
      )}
    </>
  );
}
