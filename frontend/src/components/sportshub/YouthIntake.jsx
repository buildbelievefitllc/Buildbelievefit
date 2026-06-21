// src/components/sportshub/YouthIntake.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — first-run intake gate (PAR-Q+ + sport selection + guardian auth).
//
// Rendered IN PLACE OF the Sports Hub by YouthIntakeGate until the athlete has a
// persisted screening. Forced completion: sport + position/event, guardian
// authorization, and the liability/terms acknowledgment are ALL required; the 7
// standard PAR-Q+ items are attested (reusing the public Pathfinder's trilingual
// f-parq* / f-liability copy).
//
// On submit the canonical PAR-Q snapshot AND the sport/position selection persist
// to the athlete's profile (par_q_screen + the sport/position columns via
// bbf_submit_youth_intake); the chosen sport/position then drives the Hub.

import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { resolveSportsProfile } from '../../lib/sportsRoster.js';
import { PARQ_ITEMS, classifyParq, submitYouthIntake } from '../../lib/youthIntakeApi.js';
import { YOUTH_SPORTS, getSport } from './youthSports.js';
import './sportsHub.css';

// Dietary & allergy multi-select (CRITICAL safety). Vegan/Vegetarian set the meal
// profile; Peanut/Dairy/Gluten become hard allergen exclusions the meal engine
// strictly honors. 'None' is mutually exclusive with the rest.
const DIETARY_OPTIONS = [
  { v: 'none', k: 'yi-diet-none' },
  { v: 'peanut', k: 'yi-diet-peanut' },
  { v: 'dairy_free', k: 'yi-diet-dairy' },
  { v: 'gluten_free', k: 'yi-diet-gluten' },
  { v: 'vegetarian', k: 'yi-diet-veg' },
  { v: 'vegan', k: 'yi-diet-vegan' },
];

export default function YouthIntake({ uid, onComplete, selection = null, prefill = null }) {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const profile = useMemo(() => user?.sportsProfile || resolveSportsProfile(user) || {}, [user]);

  const [parq, setParq] = useState({}); // { 'f-parq1': true, ... }
  const [health, setHealth] = useState({ injuries: '', conditions: '', medications: '' });
  // Sport selection — pre-seeded from the persisted selection (legacy back-population:
  // sport/position the athlete already gave) first, then the athlete's profile, when
  // either maps cleanly to the current roster.
  const seedSportId = selection?.sportId || profile.sportId;
  const seedPosCode = selection?.positionCode || profile.positionCode;
  const [sportId, setSportId] = useState(() =>
    (YOUTH_SPORTS.some((s) => s.id === seedSportId) ? seedSportId : ''));
  const [posCode, setPosCode] = useState(() =>
    (getSport(seedSportId)?.options.some((o) => o.legacy === seedPosCode) ? seedPosCode : ''));
  const [guardianName, setGuardianName] = useState('');
  const [guardianRel, setGuardianRel] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [liability, setLiability] = useState(false);
  // Athlete details — feed athlete_profiles (birth_date drives the tier calc; gender
  // is Male / Female / Coed, matching the athlete_profiles CHECK constraint). Both
  // pre-fill from anything already on the profile (legacy back-population).
  const [birthDate, setBirthDate] = useState(() => prefill?.birthDate || '');
  const [gender, setGender] = useState(() =>
    (['male', 'female', 'coed'].includes(prefill?.gender) ? prefill.gender : ''));
  // Dietary restrictions / allergies (REQUIRED) — feeds the meal engine's allergen
  // safety net. Pre-fills from anything already on the profile.
  const [dietary, setDietary] = useState(() =>
    (Array.isArray(prefill?.dietaryRestrictions) ? prefill.dietaryRestrictions : []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const toggleParq = (k, on) => setParq((p) => ({ ...p, [k]: on }));
  // 'None' is mutually exclusive; any allergen/diet pick clears it (and vice versa).
  const toggleDietary = (v) => setDietary((cur) => {
    if (v === 'none') return cur.includes('none') ? [] : ['none'];
    return cur.includes(v) ? cur.filter((x) => x !== v) : [...cur.filter((x) => x !== 'none'), v];
  });
  const classification = classifyParq(parq);
  const flagged = classification !== 'self_attested';

  const sportCfg = getSport(sportId);
  const secondaryLabel = sportCfg?.field === 'event' ? t('yi-field-event') : t('yi-field-position');

  // Forced completion: sport + position/event, birth date + gender (athlete_profiles),
  // a guardian authorization, AND the waiver/terms acknowledgment. PAR-Q answers
  // default to "no" (a valid attestation).
  const canSubmit = sportId && posCode && birthDate && gender && dietary.length > 0
    && guardianName.trim() && guardianConsent && liability && !busy;

  function onSportChange(next) {
    setSportId(next);
    setPosCode(''); // clear the dependent field — its options changed
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    // Canonical PAR-Q answers map (q1..q7) — the server re-derives the safety
    // classification from THIS, so a tampered client value can't downgrade it.
    const answers = PARQ_ITEMS.reduce((acc, k, i) => {
      acc[`q${i + 1}`] = parq[k] === true;
      return acc;
    }, {});
    const posLabel = sportCfg?.options.find((o) => o.legacy === posCode)?.label || null;

    const payload = {
      // Top-level sport/position (canonical ids) → persisted to the profile columns.
      sport: sportId,
      position: posCode,
      // Athlete details → athlete_profiles (birth_date drives current_tier; gender ∈
      // male|female|coed). The RPC re-validates/derives server-side.
      birth_date: birthDate,
      gender,
      // Dietary restrictions / allergies → athlete_profiles.dietary_restrictions →
      // the meal engine's strict allergen exclusion.
      dietary_restrictions: dietary,
      answers,
      flagged_items: PARQ_ITEMS.filter((k) => parq[k]),
      classified: classification, // advisory; server is authoritative
      health: {
        injuries: health.injuries.trim() || null,
        medical_conditions: health.conditions.trim() || null,
        medications: health.medications.trim() || null,
      },
      guardian: {
        name: guardianName.trim(),
        relationship: guardianRel.trim() || null,
        consent: true,
      },
      liability_agreed: true,
      athlete: { age: profile.age ?? null, sportId, positionCode: posCode, positionLabel: posLabel },
      locale: lang,
    };

    const res = await submitYouthIntake(uid, payload);
    if (res?.ok) {
      // Carry the chosen sport/position so the Hub renders it immediately.
      onComplete?.({ sportId, positionCode: posCode });
      return;
    }
    setBusy(false);
    setError(t('yi-error'));
  }

  return (
    <div className="sh-screen">
      <div className="sh-intake">
        <div className="sh-intake-card">
          <header className="sh-intake-head">
            <span className="sh-intake-kicker">Athlete Portal · Youth Division</span>
            <h1 className="sh-intake-title">{t('yi-title')}</h1>
            <p className="sh-intake-sub">{t('yi-sub')}</p>
          </header>

          <form onSubmit={handleSubmit} noValidate>
            {/* ── PAR-Q+ readiness screen (7 attested items) ── */}
            <div className="sh-intake-sec-title">{t('f-health-q')}</div>
            <div className="sh-intake-note">{t('f-parq-note')}</div>
            {PARQ_ITEMS.map((k) => (
              <label key={k} className="sh-intake-check" htmlFor={`yi-${k}`}>
                <input
                  id={`yi-${k}`}
                  type="checkbox"
                  checked={!!parq[k]}
                  disabled={busy}
                  onChange={(ev) => toggleParq(k, ev.target.checked)}
                />
                <span>{t(k)}</span>
              </label>
            ))}

            {flagged ? (
              <div className="sh-intake-flag" role="status">⚠ {t('yi-clearance-flag')}</div>
            ) : null}

            {/* ── Sport & position/event (REQUIRED) — drives the Sports Hub ── */}
            <div className="sh-intake-sec-title">{t('yi-sport-head')}</div>
            <label className="bbf-label" htmlFor="yi-sport">{t('yi-field-sport')} <span className="sh-intake-req">*</span></label>
            <select id="yi-sport" className="bbf-input" value={sportId} disabled={busy}
              data-testid="yi-sport" onChange={(e) => onSportChange(e.target.value)}>
              <option value="">{t('yi-choose')}</option>
              {YOUTH_SPORTS.map((s) => <option key={s.id} value={s.id}>{t(s.labelKey)}</option>)}
            </select>
            {sportCfg ? (
              <>
                <label className="bbf-label sh-intake-gap" htmlFor="yi-position">{secondaryLabel} <span className="sh-intake-req">*</span></label>
                <select id="yi-position" className="bbf-input" value={posCode} disabled={busy}
                  data-testid="yi-position" onChange={(e) => setPosCode(e.target.value)}>
                  <option value="">{t('yi-choose')}</option>
                  {sportCfg.options.map((o) => <option key={o.legacy} value={o.legacy}>{o.label}</option>)}
                </select>
              </>
            ) : null}

            {/* ── Athlete details (REQUIRED) — birth date drives the tier calc ── */}
            <label className="bbf-label sh-intake-gap" htmlFor="yi-birth">{t('yi-field-birth')} <span className="sh-intake-req">*</span></label>
            <input id="yi-birth" className="bbf-input" type="date" value={birthDate} disabled={busy}
              max={new Date().toISOString().slice(0, 10)}
              data-testid="yi-birth" onChange={(e) => setBirthDate(e.target.value)} />
            <label className="bbf-label sh-intake-gap" htmlFor="yi-gender">{t('yi-field-gender')} <span className="sh-intake-req">*</span></label>
            <select id="yi-gender" className="bbf-input" value={gender} disabled={busy}
              data-testid="yi-gender" onChange={(e) => setGender(e.target.value)}>
              <option value="">{t('yi-choose')}</option>
              <option value="male">{t('yi-gender-male')}</option>
              <option value="female">{t('yi-gender-female')}</option>
              <option value="coed">{t('yi-gender-coed')}</option>
            </select>

            {/* ── Dietary & allergies (REQUIRED) — meal-engine allergen safety net ── */}
            <div className="sh-intake-sec-title sh-intake-gap">{t('yi-diet-head')} <span className="sh-intake-req">*</span></div>
            <div className="sh-intake-note">{t('yi-diet-note')}</div>
            <div className="yi-diet" role="group" aria-label={t('yi-diet-head')}>
              {DIETARY_OPTIONS.map((o) => {
                const on = dietary.includes(o.v);
                return (
                  <button
                    key={o.v}
                    type="button"
                    className={`yi-diet-pill${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    disabled={busy}
                    data-testid={`yi-diet-${o.v}`}
                    onClick={() => toggleDietary(o.v)}
                  >
                    {t(o.k)}
                  </button>
                );
              })}
            </div>

            {/* ── Health disclosure (optional) ── */}
            <div className="sh-intake-sec-title">{t('f-injuries')}</div>
            <textarea className="bbf-input" rows={2} placeholder={t('f-injuries')} value={health.injuries}
              disabled={busy} onChange={(e) => setHealth((h) => ({ ...h, injuries: e.target.value }))} />
            <textarea className="bbf-input sh-intake-gap" rows={2} placeholder={t('f-conditions')} value={health.conditions}
              disabled={busy} onChange={(e) => setHealth((h) => ({ ...h, conditions: e.target.value }))} />
            <textarea className="bbf-input sh-intake-gap" rows={2} placeholder={t('f-medications')} value={health.medications}
              disabled={busy} onChange={(e) => setHealth((h) => ({ ...h, medications: e.target.value }))} />

            {/* ── Parent / guardian authorization (REQUIRED — minor) ── */}
            <div className="sh-intake-sec-title">{t('yi-guardian-head')}</div>
            <label className="bbf-label" htmlFor="yi-guardian-name">{t('yi-guardian-name')} <span className="sh-intake-req">*</span></label>
            <input id="yi-guardian-name" className="bbf-input" type="text" autoComplete="name" value={guardianName}
              disabled={busy} onChange={(e) => setGuardianName(e.target.value)} />
            <label className="bbf-label sh-intake-gap" htmlFor="yi-guardian-rel">{t('yi-guardian-rel')}</label>
            <input id="yi-guardian-rel" className="bbf-input" type="text" value={guardianRel}
              disabled={busy} onChange={(e) => setGuardianRel(e.target.value)} />

            <label className="sh-intake-check sh-intake-gap" htmlFor="yi-guardian-consent">
              <input id="yi-guardian-consent" type="checkbox" checked={guardianConsent} disabled={busy}
                onChange={(e) => setGuardianConsent(e.target.checked)} />
              <span>{t('yi-guardian-consent')} <span className="sh-intake-req">*</span></span>
            </label>
            <label className="sh-intake-check" htmlFor="yi-liability">
              <input id="yi-liability" type="checkbox" checked={liability} disabled={busy}
                onChange={(e) => setLiability(e.target.checked)} />
              <span>{t('f-liability')} <span className="sh-intake-req">*</span></span>
            </label>

            <button type="submit" className="bbf-btn sh-intake-submit" disabled={!canSubmit}>
              {busy ? t('yi-submitting') : t('yi-submit')}
            </button>
            {error ? <div className="bbf-msg bbf-msg--error" role="alert">{error}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
