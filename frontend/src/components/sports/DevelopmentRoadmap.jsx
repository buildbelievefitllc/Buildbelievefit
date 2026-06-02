// src/components/sports/DevelopmentRoadmap.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Development Roadmap — the athlete's bio-planning hub with three
// nested sub-tabs:
//   • NUTRITION PLAN — phase, hydration, macro split, approved bio-energetic foods
//   • AGE COMP       — bracket, safe max-HR cap, skeletal/PHV guidance (age-driven)
//   • EXCLUSIONS     — editable allergy / intolerance / dislike blacklist
// Age-Comp data is derived from the admin override's age slider via ageProfile();
// the exclusions list is locally editable (bound to in-memory state).

import { useState } from 'react';

const SUBTABS = [
  { id: 'nutrition', label: 'Nutrition Plan' },
  { id: 'agecomp', label: 'Age Comp' },
  { id: 'exclusions', label: 'Exclusions' },
];

export default function DevelopmentRoadmap({ nutrition, exclusions, ageInfo }) {
  const [tab, setTab] = useState('nutrition');

  return (
    <section className="sp-card">
      <div className="sp-card-head">
        <div>
          <div className="sp-card-tag">Athlete Milestone &amp; Bio-Planning</div>
          <h3 className="sp-card-title">Sovereign Development Roadmap</h3>
        </div>
        <div className="sp-subtabs" role="tablist" aria-label="Development roadmap sections">
          {SUBTABS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={tab === s.id}
              className={`sp-subtab${tab === s.id ? ' is-on' : ''}`}
              onClick={() => setTab(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'nutrition' ? <NutritionPlan nutrition={nutrition} /> : null}
      {tab === 'agecomp' ? <AgeComp ageInfo={ageInfo} /> : null}
      {tab === 'exclusions' ? <Exclusions initial={exclusions} /> : null}
    </section>
  );
}

function NutritionPlan({ nutrition }) {
  const { carbs, protein, fats } = nutrition.macros;
  return (
    <>
      <div className="sp-block-tag">Active Phase Nutrition Macro-Strategy</div>
      <div className="sp-block-title">{nutrition.phase}</div>

      <div className="sp-nut-grid">
        <div>
          <div className="sp-hydration">
            <span className="sp-hydration-l">Pre-Hydration Threshold</span>
            <span className="sp-hydration-v">{nutrition.hydration}</span>
          </div>
          <div className="sp-macro-label">Macronutrient Target Ratios</div>
          <div className="sp-macro-bar" role="img" aria-label={`Carbs ${carbs}%, Protein ${protein}%, Fats ${fats}%`}>
            <span className="sp-macro-seg carbs" style={{ width: `${carbs}%` }} />
            <span className="sp-macro-seg protein" style={{ width: `${protein}%` }} />
            <span className="sp-macro-seg fats" style={{ width: `${fats}%` }} />
          </div>
          <div className="sp-macro-legend">
            <span className="sp-macro-key"><span className="sp-macro-dot" style={{ background: 'var(--purl)' }} />{carbs}% Carbs</span>
            <span className="sp-macro-key"><span className="sp-macro-dot" style={{ background: 'var(--yel)' }} />{protein}% Protein</span>
            <span className="sp-macro-key"><span className="sp-macro-dot" style={{ background: 'var(--blu)' }} />{fats}% Fats</span>
          </div>
        </div>

        <div>
          <div className="sp-foods-title">Approved Bio-Energetic Foods &amp; Collagen Loading</div>
          <div className="sp-foods">
            {nutrition.foods.map((f) => (
              <span key={f.label} className="sp-food"><span aria-hidden="true">{f.icon}</span>{f.label}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function AgeComp({ ageInfo }) {
  return (
    <>
      <div className="sp-block-tag">Chronological Safeguard Calibration</div>
      <div className="sp-agegrid">
        <div className="sp-agecell">
          <div className="sp-agecell-l">Development Age-Group Bracket</div>
          <div className="sp-agecell-v">{ageInfo.bracketLabel}</div>
        </div>
        <div className="sp-agecell">
          <div className="sp-agecell-l">Safe Max Heart-Rate Limit</div>
          <div className="sp-agecell-v">{ageInfo.maxHR} BPM</div>
          <div className="sp-agecell-s">Capped peak to offset cardiac stress indicators.</div>
        </div>
        <div className="sp-agecell">
          <div className="sp-agecell-l">Skeletal Integrity Guidance</div>
          <div className={`sp-agecell-v${ageInfo.complianceRate >= 100 ? ' is-grn' : ''}`}>{ageInfo.skeletal}</div>
          <div className="sp-agecell-s">PHV alignment safeguards active.</div>
        </div>
      </div>
      <div className="sp-phv">
        <div className="sp-phv-t">Peak Height Velocity (PHV) Growth Advice Node</div>
        <div className="sp-phv-b">{ageInfo.phvNote}</div>
      </div>
    </>
  );
}

function Exclusions({ initial }) {
  const [list, setList] = useState(initial);
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v || list.includes(v)) { setDraft(''); return; }
    setList((prev) => [...prev, v]);
    setDraft('');
  };
  const remove = (item) => setList((prev) => prev.filter((x) => x !== item));

  return (
    <>
      <div className="sp-block-tag">Custom Athlete Preferences</div>
      <div className="sp-block-title">Allergies, Severe Intolerances &amp; Dislikes Blacklist</div>
      <p className="sp-sec-note">
        Configure foods the athlete cannot eat or digest. Blacklisted items trigger warning markers on daily
        generated nutrition cards.
      </p>

      <div className="sp-block-tag" style={{ marginBottom: '.4rem' }}>Active Dietary Exclusions ({list.length})</div>
      {list.length ? (
        <div className="sp-excl">
          {list.map((x) => (
            <span key={x} className="sp-excl-tag">
              {x}
              <button type="button" className="sp-excl-x" aria-label={`Remove ${x}`} onClick={() => remove(x)}>×</button>
            </span>
          ))}
        </div>
      ) : (
        <p className="sp-empty">No active exclusions. The athlete can eat across the full approved corpus.</p>
      )}

      <div className="sp-block-tag" style={{ margin: '.4rem 0' }}>Add Custom Restriction or Dislike</div>
      <div className="sp-excl-add">
        <input
          className="sp-excl-input"
          value={draft}
          placeholder="e.g. Soy, Peanuts, Pork (Dislike)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          aria-label="New dietary exclusion"
        />
        <button type="button" className="sp-excl-btn" onClick={add}>Add</button>
      </div>
      <p className="sp-help">Changes are bound in local memory state. Type an allergen or food name and press Add.</p>
    </>
  );
}
