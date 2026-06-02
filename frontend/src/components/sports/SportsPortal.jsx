// src/components/sports/SportsPortal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// BBF Sports Portal & Athlete Database — orchestrator.
//
// Renders the high-fidelity scouting terminal and STRICTLY switches on isAdmin:
//   • Admin  → Sovereign Admin Override Panel + full athlete-file roster + the
//              Admin Target View (athlete render, incl. the Developer hub).
//   • Client → their own Athlete Profile render only (no override controls).
//
// All sport/position/drill/kinematic/benchmark data is FUSED from the legacy
// Sports Hub (sportsData.js + athleteRoster.js) — nothing is hardcoded here.

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import AdminOverridePanel from './AdminOverridePanel.jsx';
import AthleteDossier from './AthleteDossier.jsx';
import {
  ATHLETES, getAthlete, sportLabel, resolveClientAthlete,
} from './athleteRoster.js';
import {
  ageProfile, getPositions, getPosition, kpisFor, benchmarkFor, getPortalSport,
} from './sportsData.js';
import './sports.css';

const initOverride = (a) => ({
  sportId: a.sportId,
  position: a.positionLabel,
  age: a.age,
  goal: a.focusDirective,
});

export default function SportsPortal() {
  const { user, isAdmin } = useAuth();

  // Admin sees the whole roster; a client sees only their own athlete file.
  const roster = isAdmin ? ATHLETES : [resolveClientAthlete(user)];
  const [athleteId, setAthleteId] = useState(roster[0].id);
  const athlete = getAthlete(athleteId);

  const [override, setOverride] = useState(() => initOverride(athlete));
  const [applied, setApplied] = useState(false);

  // Selecting a different athlete file resets the override to that athlete's base.
  const selectAthlete = (id) => {
    setAthleteId(id);
    setOverride(initOverride(getAthlete(id)));
    setApplied(false);
  };

  const patch = (next) => { setOverride((o) => ({ ...o, ...next })); setApplied(false); };
  const onSport = (sportId) => patch({ sportId, position: getPositions(sportId)[0].label });
  const onPosition = (position) => patch({ position });
  const onAge = (age) => patch({ age });
  const onGoal = (goal) => patch({ goal });
  const onApply = () => { setApplied(true); setTimeout(() => setApplied(false), 2000); };

  // Derived view — the override is the single driver of the calibrated render.
  const view = {
    sportId: override.sportId,
    positionLabel: override.position,
    age: override.age,
    focusDirective: override.goal,
  };
  const ageInfo = ageProfile(view.age);
  const position = getPosition(view.sportId, view.positionLabel);
  const kpis = kpisFor(position);
  const benchmark = benchmarkFor(view.sportId, position);

  return (
    <div className="sp">
      <header className="sp-head">
        <span className="sp-badge">Roster Intel</span>
        <h1 className="sp-title">BBF Sports Portal &amp; <span>Athlete Database</span></h1>
        <p className="sp-sub">
          Biomechanical monitoring tracking elite performance vectors from school yard to collegiate draft.
        </p>

        {roster.length > 1 ? (
          <div className="sp-files" role="tablist" aria-label="Athlete files">
            {roster.map((a) => {
              const on = a.id === athleteId;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`sp-file${on ? ' is-active' : ''}`}
                  onClick={() => selectAthlete(a.id)}
                >
                  <span className="sp-file-dot" aria-hidden="true">{getPortalSport(a.sportId).icon}</span>
                  <span className="sp-file-name">{a.firstName}</span>
                  <span className="sp-file-sport">{sportLabel(a)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {isAdmin ? (
        <AdminOverridePanel
          override={override}
          onSport={onSport}
          onPosition={onPosition}
          onAge={onAge}
          onGoal={onGoal}
          onApply={onApply}
          applied={applied}
        />
      ) : (
        <div className="sp-clientnote">
          <span aria-hidden="true">🛡</span>
          <span><b>Client View</b> — your live performance dossier, calibrated by your BBF coach. Track your drills, fueling, and recruiting profile below.</span>
        </div>
      )}

      <AthleteDossier
        athlete={athlete}
        view={view}
        ageInfo={ageInfo}
        kpis={kpis}
        benchmark={benchmark}
        isAdmin={isAdmin}
      />
    </div>
  );
}
