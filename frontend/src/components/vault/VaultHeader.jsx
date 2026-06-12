// src/components/vault/VaultHeader.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 25 — Vault Prototype Sync. The persistent client-profile header that
// sits ABOVE the nested tab navigation and stays fixed while the athlete moves
// between Hub / Program / Cardio / … (faithful to the AI Studio prototype).
//
// Three stacked clinical cards — deep purple / near-black surfaces, gold used
// only as an accent (no loud yellow fills):
//   1) Portal     — "MY CLIENT PROFILE HUB" + sessions / hydration read-outs.
//   2) Identity   — "WELCOME, <NAME>" + access tier + today's focus + macros.
//   3) Blueprint  — Smart Day Sync: today's training focus pulled live from the
//                   assigned workout_plan (static-catalog fallback), + streak.
//
// Pure presentational: it receives the already-fetched profile + plan envelope
// from the Vault shell; no fetching of its own.

import { memo, useMemo } from 'react';
import { parseWorkoutPlan, parseMealPlan } from '../../lib/vaultApi.js';
import { getProgram } from './programData.js';
import './vault.css';

const HYDRATION_TARGET_L = 3.5; // prototype read-out; live hydration tracking is a later phase

// Smart Day Sync — resolve TODAY's day object from the plan.
//   1) exact weekday-name match ("Monday" → the plan's Monday object),
//   2) positional fallback for "Day 1…7" plans (Mon=0 … Sun=6),
//   3) first day as a last resort, so the panel is never blank.
function resolveToday(plan) {
  if (!Array.isArray(plan) || !plan.length) return null;
  const now = new Date();
  const longName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const idxMon = (now.getDay() + 6) % 7;
  const byName = plan.find((d) => String(d?.day || '').trim().toLowerCase() === longName.toLowerCase());
  if (byName) return { ...byName, source: 'weekday' };
  if (plan[idxMon]) return { ...plan[idxMon], source: 'position' };
  return { ...plan[0], source: 'fallback' };
}

// Macro targets from the assigned meal plan; '—' placeholders keep the row clean
// when a structured plan hasn't been generated yet.
function resolveMacros(mealPlanRaw) {
  const parsed = parseMealPlan(mealPlanRaw);
  const m = parsed.macros || {};
  const g = (n) => (Number.isFinite(n) && n > 0 ? String(n) : '—');
  return [
    { key: 'kcal', label: 'Calories', value: parsed.cal != null ? parsed.cal.toLocaleString() : '—', unit: 'kcal' },
    { key: 'protein', label: 'Protein', value: g(m.p), unit: 'g' },
    { key: 'carbs', label: 'Carbs', value: g(m.c), unit: 'g' },
    { key: 'fat', label: 'Fats', value: g(m.f), unit: 'g' },
  ];
}

function fmtInt(v) {
  return v !== null && v !== undefined && v !== '' ? Number(v).toLocaleString() : '0';
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'BB';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function VaultHeader({ profile, plans = null, displayName = 'Athlete', slug = '', programKey = '', isAdmin = false }) {
  const today = useMemo(() => {
    const assigned = parseWorkoutPlan(plans?.workoutPlan || '');
    const plan = Array.isArray(assigned) && assigned.length ? assigned : getProgram(programKey);
    return resolveToday(plan);
  }, [plans?.workoutPlan, programKey]);
  const macros = useMemo(() => resolveMacros(plans?.mealPlan || ''), [plans?.mealPlan]);

  const isRest = today?.isRest;
  const focus = isRest ? 'Recovery / Rest Day' : (today?.focus || 'Training Day');
  const sessions = fmtInt(profile?.totalSessions);
  const streak = fmtInt(profile?.currentStreak);
  const accessLabel = isAdmin ? 'Sovereign Vault Admin Portal' : 'Sovereign Client Access';

  const blueprintSub = isRest
    ? (today?.restNote || 'Active recovery — stretch, hydrate, sleep. Protect the work.')
    : (today?.focus_cue
        ? today.focus_cue
        : `${Array.isArray(today?.exercises) ? today.exercises.length : 0} exercises prescribed today — open Program to execute.`);

  return (
    <section className="cv-head" aria-label="Client profile header">
      {/* ── 1 · Portal ── */}
      <div className="cv-portal">
        <div className="cv-portal-main">
          <span className="cv-pill">◇ {accessLabel}</span>
          <h1 className="cv-portal-title"><span className="cv-portal-mark" aria-hidden="true">🏆</span> MY CLIENT PROFILE HUB</h1>
          <p className="cv-portal-sub">
            Configure, track, and optimize your elite lifestyle metrics. Balance raw loading
            program sets, biokinetic prehab targets, and pristine macro ledgers.
          </p>
        </div>
        <div className="cv-portal-stats">
          <div className="cv-readout">
            <span className="cv-readout-k">Sessions Logged</span>
            <span className="cv-readout-v">{sessions} <em>Done</em></span>
          </div>
          <div className="cv-readout">
            <span className="cv-readout-k">Hydration Target</span>
            <span className="cv-readout-v">0.00L <em>/ {HYDRATION_TARGET_L}</em></span>
          </div>
        </div>
      </div>

      {/* ── 2 · Identity ── */}
      <div className="cv-identity">
        <div className="cv-identity-l">
          <div className="cv-avatar" aria-hidden="true">
            {initials(displayName)}
            {isAdmin ? <span className="cv-avatar-badge">ADMIN</span> : null}
          </div>
          <div className="cv-identity-meta">
            <h2 className="cv-identity-name">WELCOME, {displayName.toUpperCase()}</h2>
            <span className="cv-pill cv-pill-sm">{accessLabel}</span>
            <div className="cv-identity-focus">
              <span className="cv-identity-slug">@{slug || 'athlete'}</span>
              <span className="cv-dotsep">•</span>
              <span className="cv-identity-phase">{focus.toUpperCase()}</span>
            </div>
          </div>
        </div>
        <div className="cv-identity-macros">
          {macros.map((m) => (
            <div key={m.key} className="cv-macro">
              <span className="cv-macro-k">{m.label}</span>
              <span className="cv-macro-v">{m.value}</span>
              <span className="cv-macro-u">{m.unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3 · Daily Blueprint (Smart Day Sync) ── */}
      <div className={`cv-blueprint${isRest ? ' is-rest' : ''}`}>
        <div className="cv-blueprint-l">
          <span className="cv-blueprint-k">Sovereign Vault Daily Blueprint</span>
          <div className="cv-blueprint-focus">{focus}</div>
          <p className="cv-blueprint-sub">{blueprintSub}</p>
        </div>
        <div className="cv-blueprint-streak">
          <span className="cv-blueprint-streak-k">Streak</span>
          <span className="cv-blueprint-streak-v">⚡ {streak} {streak === '1' ? 'Day' : 'Days'}</span>
        </div>
      </div>
    </section>
  );
}

// memo: the header is pure presentation off shell-owned props — tab swaps and
// readiness commits in the shell must not re-paint these three cards.
export default memo(VaultHeader);
