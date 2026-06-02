// src/components/sports/AthleteDossier.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Active Biometric Dossier — the athlete render shared by the Client View and the
// Admin Target View. Header (identity + live biometrics + KPI traits + ported
// collegiate benchmarks) over the six development modules. Position KPIs,
// benchmarks, the age bracket, and the active Lifeline phase all recompute from
// the admin override; the deeper telemetry is the athlete's own logged record.

import DevelopmentRoadmap from './DevelopmentRoadmap.jsx';
import AssessmentNode from './AssessmentNode.jsx';
import DrillsSchedule from './DrillsSchedule.jsx';
import LifelineRoadmap from './LifelineRoadmap.jsx';
import RecruitingPortfolio from './RecruitingPortfolio.jsx';
import KinematicsMatrix from './KinematicsMatrix.jsx';
import { fullName, sportLabel, RISK_TONE } from './athleteRoster.js';
import { copyText } from './clipboard.js';
import { useState } from 'react';

// Friendly labels for the ported sports-hub combine benchmark keys.
const BENCH_LABELS = {
  forty: '40-yd', vert: 'Vert', broad: 'Broad', bench: 'Bench', height: 'Height',
  wingspan: 'Wingspan', lane: 'Lane', beep: 'Beep', ttest: 'T-Test', sprint: 'Sprint',
  sixty: '60-yd', velo: 'Velo', exit: 'Exit Velo', medball: 'Med-Ball', block: 'Block',
  approach: 'Approach',
};

export default function AthleteDossier({ athlete, view, ageInfo, kpis, benchmark, isAdmin }) {
  const risk = athlete.biometrics.injuryRisk;
  const riskTone = RISK_TONE[risk] || 'mut';

  return (
    <>
      <section className="sp-card sp-dossier">
        <div className="sp-dossier-top">
          <div className="sp-id">
            <div className="sp-avatar" aria-hidden="true">{athlete.initials}</div>
            <div>
              <div className="sp-id-kicker">Active Biometric Dossier</div>
              <h3 className="sp-name">{fullName(athlete)}</h3>
              <div className="sp-meta">
                <span className="sp-chip">Age: <b>{view.age}</b></span>
                <span className="sp-chip">POS: <b>{view.positionLabel}</b></span>
                <span className="sp-chip">{ageInfo.headerLabel}</span>
                <span className="sp-chip">Era Phase: <b>{ageInfo.eraPhase}</b></span>
              </div>
            </div>
          </div>

          <div className="sp-bio-metrics">
            <div className="sp-metric">
              <div className="sp-metric-l">ANS HRV Recovery</div>
              <div className="sp-metric-v tone-grn">{athlete.biometrics.hrvRecovery}<small> ms</small></div>
            </div>
            <div className="sp-metric">
              <div className="sp-metric-l">Central Fatigue Drift</div>
              <div className="sp-metric-v tone-yel">{athlete.biometrics.fatigueDrift}<small> %</small></div>
            </div>
            <div className="sp-metric">
              <div className="sp-metric-l">Injury Risk Index</div>
              <div><span className={`sp-pill bg-${riskTone}`}>{risk}</span></div>
            </div>
          </div>
        </div>

        {/* KPI traits for the calibrated position — straight from the legacy KPI map */}
        {kpis.length ? (
          <div className="sp-meta" style={{ marginTop: '1rem' }}>
            {kpis.map((k) => <span key={k} className="sp-chip"><b>◆</b> {k}</span>)}
          </div>
        ) : null}

        {/* Ported collegiate combine benchmarks, where legacy keys align */}
        {benchmark ? (
          <div style={{ marginTop: '.6rem' }}>
            <div className="sp-foods-title">Collegiate Combine Benchmark · {sportLabel(athlete)}</div>
            <div className="sp-meta">
              {Object.entries(benchmark).map(([k, v]) => (
                <span key={k} className="sp-chip">{BENCH_LABELS[k] || k}: <b>{v}</b></span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="sp-focus">Focus Directive: <b>{view.focusDirective}</b></div>
      </section>

      <DevelopmentRoadmap
        nutrition={athlete.nutrition}
        exclusions={athlete.exclusions}
        ageInfo={ageInfo}
      />
      <AssessmentNode assessment={athlete.assessment} />
      <DrillsSchedule drills={athlete.drills} forecast={athlete.forecast} />
      <LifelineRoadmap activePhaseId={ageInfo.lifelinePhaseId} age={view.age} />
      <RecruitingPortfolio recruiting={athlete.recruiting} />
      <KinematicsMatrix rows={athlete.kinematics} sportLabel={sportLabel(athlete)} />

      {isAdmin ? <DeveloperHub athlete={athlete} view={view} ageInfo={ageInfo} /> : null}
    </>
  );
}

// Developer Integration Hub — admin/coach-only. Copies a high-level coaching
// CONTEXT prompt (athlete framing only — no backend/model internals, per
// CLAUDE.md §7). Gated behind isAdmin so client-facing copy never exposes it.
function DeveloperHub({ athlete, view, ageInfo }) {
  const [copied, setCopied] = useState(false);
  const prompt =
    `BBF Sovereign Co-Coach context for ${fullName(athlete)} — a ${view.age}-yr ${sportLabel(athlete)} ${view.positionLabel} ` +
    `in the ${ageInfo.bracketLabel}. Primary directive: ${view.focusDirective}. ` +
    `Honor the active dietary exclusions, the safe max-HR cap of ${ageInfo.maxHR} BPM, and PHV growth safeguards. ` +
    `Periodize toward the athlete's current Lifeline phase and communicate in the athlete's language (EN/ES/PT).`;

  const onCopy = async () => {
    const ok = await copyText(prompt);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };

  return (
    <section className="sp-card">
      <div className="sp-card-head">
        <div>
          <div className="sp-card-tag">Developer Integration Hub</div>
          <h3 className="sp-card-title">Athlete AI Context Layer</h3>
        </div>
      </div>
      <div className="sp-devhub">
        <p className="sp-sec-note" style={{ margin: 0, flex: '1 1 280px' }}>
          Export the athlete&apos;s framing context for the Co-Coach. Coach-only — never surfaced in client copy.
        </p>
        <button type="button" className={`sp-copyprompt${copied ? ' is-copied' : ''}`} onClick={onCopy}>
          {copied ? '✓ Context Copied' : '⧉ Copy System Context'}
        </button>
      </div>
    </section>
  );
}
