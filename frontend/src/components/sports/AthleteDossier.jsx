// src/components/sports/AthleteDossier.jsx
// ─────────────────────────────────────────────────────────────────────────────
// LIVE athlete dossier. Renders a real bbf_athlete_progression ⋈ bbf_users record
// — NO mock data. The top half is the athlete's LIVE record (sport, position,
// phase, mesocycle, RPE/friction averages, guardian-consent state). The lower half
// is the legacy-fusion REFERENCE protocol (KPI traits + Lab-Verified drills +
// age-tier guidance + Lifeline roadmap), driven by the admin's calibration lens and
// clearly labeled as reference — never presented as measured athlete telemetry.

import LifelineRoadmap from './LifelineRoadmap.jsx';
import { getPortalSport, getPositions, kpisFor, drillsFor, ageProfile } from './sportsData.js';

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';
}
function num(v, dp = 1) {
  return (v === null || v === undefined || v === '') ? '—' : Number(v).toFixed(dp);
}
const PHASE_LABEL = { off: 'Off-Season', in: 'In-Season', pre: 'Pre-Season', post: 'Post-Season', peak: 'Peak' };
const phaseLabel = (p) => PHASE_LABEL[String(p || '').toLowerCase()] || (p || '—');

export default function AthleteDossier({ athlete, view, lang }) {
  const sport = getPortalSport(view.sportId);
  const ageInfo = ageProfile(view.age);
  // Reference protocol uses the calibrated position; fall back to the sport's first.
  const positions = getPositions(view.sportId);
  const position = positions.find((p) => p.label === view.positionLabel) || positions[0];
  const kpis = kpisFor(position);
  const drills = drillsFor(view.sportId, position);
  const firstDrill = drills[0] || null;

  const consent = athlete.guardian_consent === true;

  return (
    <>
      <section className="sp-card sp-dossier">
        <div className="sp-dossier-top">
          <div className="sp-id">
            <div className="sp-avatar" aria-hidden="true">{initials(athlete.name)}</div>
            <div>
              <div className="sp-id-kicker">Live Athlete Record</div>
              <h3 className="sp-name">{athlete.name}</h3>
              <div className="sp-meta">
                <span className="sp-chip">Sport: <b>{sport.icon} {sport.label}</b></span>
                <span className="sp-chip">POS: <b>{athlete.position || '—'}</b></span>
                <span className="sp-chip">Phase: <b>{phaseLabel(athlete.phase)}</b></span>
                <span className="sp-chip">Meso Wk: <b>{athlete.mesocycle_week ?? '—'}</b></span>
                {athlete.uid ? <span className="sp-chip">@{athlete.uid}</span> : null}
              </div>
            </div>
          </div>

          <div className="sp-bio-metrics">
            <div className="sp-metric">
              <div className="sp-metric-l">RPE Avg (last 3)</div>
              <div className="sp-metric-v tone-yel">{num(athlete.rpe_avg_last_3)}</div>
            </div>
            <div className="sp-metric">
              <div className="sp-metric-l">Friction Avg (last 3)</div>
              <div className="sp-metric-v tone-grn">{num(athlete.friction_avg_last_3)}</div>
            </div>
            <div className="sp-metric">
              <div className="sp-metric-l">Guardian Consent</div>
              <div><span className={`sp-pill ${consent ? 'bg-grn' : 'bg-red'}`}>{consent ? 'On File' : 'Pending'}</span></div>
            </div>
          </div>
        </div>

        <div className="sp-meta" style={{ marginTop: '1rem' }}>
          {athlete.target_phase ? <span className="sp-chip">Target Phase: <b>{phaseLabel(athlete.target_phase)}</b></span> : null}
          <span className="sp-chip">Protocol: <b>{athlete.protocol_completed ? 'Completed' : 'In Progress'}</b></span>
          {athlete.subscription_tier ? <span className="sp-chip">Tier: <b>{athlete.subscription_tier}</b></span> : null}
          {athlete.updated_at ? <span className="sp-chip">Updated {new Date(athlete.updated_at).toLocaleDateString()}</span> : null}
        </div>
      </section>

      {/* ── Reference protocol (legacy fusion · derived from the calibration lens) ── */}
      <section className="sp-card">
        <div className="sp-card-head">
          <div>
            <div className="sp-card-tag">Reference Protocol · {sport.label}</div>
            <h3 className="sp-card-title">{position.label} — Development Reference</h3>
          </div>
          <span className="sp-sec-meta">Calibrated · not measured telemetry</span>
        </div>

        {kpis.length ? (
          <>
            <div className="sp-foods-title">Key Performance Vectors</div>
            <div className="sp-meta" style={{ marginBottom: '.8rem' }}>
              {kpis.map((k) => <span key={k} className="sp-chip"><b>◆</b> {k}</span>)}
            </div>
          </>
        ) : null}

        {firstDrill ? (
          <>
            <div className="sp-foods-title">Lab-Verified Drill</div>
            <div className="sp-drill is-met" style={{ marginTop: '.4rem' }}>
              <div className="sp-drill-body">
                <div className="sp-drill-name">{firstDrill.name?.[lang] || firstDrill.name?.en}</div>
                <div className="sp-drill-desc">{firstDrill.focus?.[lang] || firstDrill.focus?.en}</div>
                <div className="sp-drill-metric">Sets: {firstDrill.sets} · Equipment: {firstDrill.equipment} · KPI: {firstDrill.kpi}</div>
              </div>
            </div>
          </>
        ) : null}

        <div className="sp-agegrid" style={{ marginTop: '1rem' }}>
          <div className="sp-agecell">
            <div className="sp-agecell-l">Development Bracket</div>
            <div className="sp-agecell-v">{ageInfo.bracketLabel}</div>
          </div>
          <div className="sp-agecell">
            <div className="sp-agecell-l">Safe Max Heart Rate</div>
            <div className="sp-agecell-v">{ageInfo.maxHR} BPM</div>
          </div>
          <div className="sp-agecell">
            <div className="sp-agecell-l">Strategic Focus</div>
            <div className="sp-agecell-v" style={{ fontSize: '.92rem' }}>{view.goal}</div>
          </div>
        </div>
      </section>

      <LifelineRoadmap activePhaseId={ageInfo.lifelinePhaseId} age={view.age} />
    </>
  );
}
