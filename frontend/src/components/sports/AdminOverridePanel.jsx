// src/components/sports/AdminOverridePanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Admin Override Panel — the control surface gated to isAdmin. Sections:
//   1. Discipline Focal Sport      — selectable sport grid
//   2. Position Alignment Calibration — sub-menu that re-derives from the sport
//   3. Biological & Goal Settings  — age slider + strategic focus directive
//   4. Inject Youth Athlete        — GUARDED write into the live database (the
//      selected sport+position become the new athlete's assignment; guardian
//      consent is mandatory — the server rejects the insert without it).
// "Apply" PERSISTS the selected discipline + position to the athlete's canonical
// bbf_users profile (via the secure admin gate); "Inject" creates a new record. The
// age slider is a reference lens only — there is no age column, so it is never written.

import { useLang } from '../../context/LangContext.jsx';
import { PORTAL_SPORTS, GOAL_DIRECTIVES, getPositions, getPortalSport } from './sportsData.js';

export default function AdminOverridePanel({
  override, onSport, onPosition, onAge, onGoal, onApply, applied, applyBusy, applyError, inject,
}) {
  const { t } = useLang();
  // Trilingual sport name (yi-sport-* keys), English label as fallback.
  const sportName = (s) => (s?.labelKey ? t(s.labelKey) : s?.label || '');
  const positions = getPositions(override.sportId);
  const sportLabel = sportName(getPortalSport(override.sportId));

  return (
    <section className="sp-panel">
      <div className="sp-panel-head">
        <div>
          <div className="sp-panel-title-wrap">
            <h2 className="sp-card-title">Sovereign Admin Override Panel</h2>
            <span className="sp-tag-live">System Engaged</span>
          </div>
          <p className="sp-sec-note" style={{ margin: '.4rem 0 0' }}>
            Calibrate sport discipline, professional position, safe bio-age margins, and the active drills list —
            the athlete render below re-synthesizes in real time.
          </p>
        </div>
        <div className="sp-access">
          <span className="sp-access-l">Access Control</span>
          <span className="sp-access-box">🛡 Admin Controls Active</span>
        </div>
      </div>

      <div className="sp-cfg">
        {/* 1 — Discipline Focal Sport */}
        <div className="sp-section">
          <div className="sp-sec-head">
            <span className="sp-sec-num">1</span>
            <span className="sp-sec-title">Discipline Focal Sport</span>
            <span className="sp-sec-meta">{sportLabel}</span>
          </div>
          <div className="sp-sportgrid">
            {PORTAL_SPORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`sp-sport${s.id === override.sportId ? ' is-on' : ''}`}
                aria-pressed={s.id === override.sportId}
                onClick={() => onSport(s.id)}
              >
                <span className="sp-sport-ico" aria-hidden="true">{s.icon}</span>
                <span className="sp-sport-label">{sportName(s)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2 — Position Alignment Calibration */}
        <div className="sp-section">
          <div className="sp-sec-head">
            <span className="sp-sec-num">2</span>
            <span className="sp-sec-title">Position Alignment Calibration</span>
          </div>
          <p className="sp-sec-note">
            Assign a specific position to dynamically synthesize custom injury profiles, caloric outputs, corrective
            prehab protocols, and tailored physical tasks.
          </p>
          <div className="sp-poslist">
            {positions.map((p) => {
              const on = p.label === override.position;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`sp-pos${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => onPosition(p.label)}
                >
                  <span className="sp-pos-label"><span className="sp-pos-tick" />{p.label}</span>
                  <span className="sp-pos-state">{on ? 'Active' : 'Select'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 — Biological & Goal Settings */}
        <div className="sp-section is-wide">
          <div className="sp-sec-head">
            <span className="sp-sec-num">3</span>
            <span className="sp-sec-title">Biological &amp; Goal Settings</span>
          </div>

          <div className="sp-field">
            <div className="sp-field-head">
              <span className="sp-field-label">Calibrate Biological Age</span>
              <span className="sp-field-val">{override.age} Yrs</span>
            </div>
            <input
              className="sp-slider"
              type="range"
              min="6"
              max="18"
              value={override.age}
              aria-label="Calibrate biological age"
              onChange={(e) => onAge(Number(e.target.value))}
            />
            <p className="sp-help">Age determines safely managed PHV, heart-rate margins, and developmental brackets.</p>
          </div>

          <div className="sp-field">
            <div className="sp-field-head">
              <span className="sp-field-label">Bespoke Strategic Focus Directive</span>
            </div>
            <select className="sp-select" value={override.goal} onChange={(e) => onGoal(e.target.value)} aria-label="Strategic focus directive">
              {GOAL_DIRECTIVES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* 4 — Inject Youth Athlete (guarded live write) */}
        <div className="sp-section is-wide">
          <div className="sp-sec-head">
            <span className="sp-sec-num">4</span>
            <span className="sp-sec-title">Inject Youth Athlete</span>
            <span className="sp-sec-meta">{sportLabel} · {override.position}</span>
          </div>
          <p className="sp-sec-note">
            Create a real record in the live database. The discipline and position selected above become the new
            athlete&apos;s assignment. Guardian consent is mandatory for youth records.
          </p>
          <div className="sp-field">
            <div className="sp-field-head"><span className="sp-field-label">Athlete Full Name</span></div>
            <input
              className="sp-excl-input"
              value={inject.name}
              placeholder="e.g. Jordan Rivers"
              onChange={(e) => inject.setName(e.target.value)}
              aria-label="New athlete full name"
            />
          </div>
          <label className="sp-consent">
            <input type="checkbox" checked={inject.consent} onChange={(e) => inject.setConsent(e.target.checked)} />
            <span>Guardian consent is on file for this youth athlete.</span>
          </label>
          <button
            type="button"
            className={`sp-inject-btn${inject.ok ? ' is-ok' : ''}`}
            disabled={inject.busy || !inject.name.trim() || !inject.consent}
            onClick={inject.submit}
          >
            {inject.busy ? 'Injecting…' : inject.ok ? '✓ Athlete Injected' : 'Inject Athlete into Database'}
          </button>
          {inject.error ? <p className="sp-inject-err">{inject.error}</p> : null}
        </div>
      </div>

      <div className="sp-engine">
        <p className="sp-engine-note">
          <b>Recalibrating Engine Logic:</b> applying this override instantly adapts the athlete&apos;s metrics deck,
          restructures daily calendar goals, realigns the baseline orthopedic target, and shifts safe development
          phase limits.
        </p>
        <button
          type="button"
          className={`sp-apply${applied ? ' is-applied' : ''}`}
          disabled={applyBusy}
          onClick={onApply}
        >
          {applyBusy ? 'Saving…' : applied ? '✓ Override Applied' : 'Apply Sovereign Calibration Override'}
        </button>
        {applyError ? <p className="sp-inject-err">{applyError}</p> : null}
      </div>
    </section>
  );
}
