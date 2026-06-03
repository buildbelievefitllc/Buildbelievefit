// src/components/sportshub/YouthIntake.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SPORTS HUB — first-run intake gate (forced PAR-Q+ + guardian authorization).
//
// Rendered IN PLACE OF the Sports Hub by YouthIntakeGate until the athlete has a
// persisted screening. The athlete cannot reach the Hub without completing this:
// guardian authorization + the liability/terms acknowledgment are REQUIRED, and
// the 7 standard PAR-Q+ items are attested (reusing the public Pathfinder's
// trilingual f-parq* / f-liability copy — single-sourced legal language).
//
// On submit the canonical PAR-Q snapshot is persisted to the athlete's profile
// (par_q_screen / par_q_screened_at / cardiac_clearance via bbf_submit_youth_intake);
// once the DB confirms, the gate releases them into /sports-hub.

import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { resolveSportsProfile } from '../../lib/sportsRoster.js';
import { PARQ_ITEMS, classifyParq, submitYouthIntake } from '../../lib/youthIntakeApi.js';
import './sportsHub.css';

export default function YouthIntake({ uid, onComplete }) {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const profile = useMemo(() => user?.sportsProfile || resolveSportsProfile(user) || {}, [user]);

  const [parq, setParq] = useState({}); // { 'f-parq1': true, ... }
  const [health, setHealth] = useState({ injuries: '', conditions: '', medications: '' });
  const [guardianName, setGuardianName] = useState('');
  const [guardianRel, setGuardianRel] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [liability, setLiability] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const toggleParq = (k, on) => setParq((p) => ({ ...p, [k]: on }));
  const classification = classifyParq(parq);
  const flagged = classification !== 'self_attested';

  // Forced completion: a guardian must authorize AND the waiver/terms must be
  // acknowledged. PAR-Q answers default to "no" (unchecked) — a valid attestation.
  const canSubmit = guardianName.trim() && guardianConsent && liability && !busy;

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

    const payload = {
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
      athlete: { age: profile.age ?? null, sport: profile.sport ?? null, position: profile.position ?? null },
      locale: lang,
    };

    const res = await submitYouthIntake(uid, payload);
    if (res?.ok) {
      onComplete?.();
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
