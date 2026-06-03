// src/components/sports/SportsPortal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// BBF Sports Portal & Athlete Database — LIVE.
//
// No mock data. Admins pull the real youth-athlete roster (bbf_athlete_progression
// ⋈ bbf_users) through the session-authed bbf-admin-roster gate, calibrate a
// reference lens via the Sovereign Admin Override Panel, and inject new youth
// athletes straight into the live database (guardian consent enforced server-side).
// A non-admin lands on a managed-by-coach notice — the live database is admin-only.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { toErrorMessage } from '../../lib/rosterApi.js';
import AdminOverridePanel from './AdminOverridePanel.jsx';
import AthleteDossier from './AthleteDossier.jsx';
import { fetchSportsRoster, insertAthlete, injectErrorMessage } from './sportsApi.js';
import { PORTAL_SPORTS, GOAL_DIRECTIVES, getPositions, getPortalSport } from './sportsData.js';
import './sports.css';

const toSportId = (s) => {
  const id = String(s || '').toLowerCase();
  return PORTAL_SPORTS.some((p) => p.id === id) ? id : PORTAL_SPORTS[0].id;
};

// Calibration lens for a live athlete. Age isn't a stored column, so the slider
// defaults to a youth midpoint — it drives the REFERENCE protocol only, never the
// live record.
const initOverride = (a) => {
  const sportId = toSportId(a?.sport);
  return { sportId, position: getPositions(sportId)[0].label, age: 16, goal: GOAL_DIRECTIVES[0] };
};

export default function SportsPortal() {
  const { isAdmin } = useAuth();
  const { lang } = useLang();

  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [override, setOverride] = useState(() => initOverride(null));
  const [applied, setApplied] = useState(false);

  // Inject form state (admin write path).
  const [injName, setInjName] = useState('');
  const [injConsent, setInjConsent] = useState(false);
  const [injBusy, setInjBusy] = useState(false);
  const [injError, setInjError] = useState(null);
  const [injOk, setInjOk] = useState(false);

  const selectAthlete = useCallback((a) => {
    if (!a) return;
    setSelectedId(a.id);
    setOverride(initOverride(a));
    setApplied(false);
  }, []);

  const load = useCallback(async (keepSelection) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSportsRoster();
      setAthletes(rows);
      setSelectedId((prev) => {
        const keep = keepSelection && prev && rows.some((r) => r.id === prev);
        const next = keep ? prev : (rows[0]?.id ?? null);
        const a = rows.find((r) => r.id === next) || null;
        if (!keep && a) setOverride(initOverride(a));
        return next;
      });
    } catch (e) {
      setError(toErrorMessage(e));
      setAthletes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(false); });
    return () => { cancelled = true; };
  }, [isAdmin, load]);

  const patch = (next) => { setOverride((o) => ({ ...o, ...next })); setApplied(false); };
  const onSport = (sportId) => patch({ sportId, position: getPositions(sportId)[0].label });
  const onPosition = (position) => patch({ position });
  const onAge = (age) => patch({ age });
  const onGoal = (goal) => patch({ goal });
  const onApply = () => { setApplied(true); setTimeout(() => setApplied(false), 2000); };

  const submitInject = async () => {
    setInjBusy(true); setInjError(null); setInjOk(false);
    try {
      const created = await insertAthlete({
        name: injName,
        sport: override.sportId,
        position: override.position,
        phase: 'off',
        guardianConsent: injConsent,
      });
      setInjOk(true);
      setInjName(''); setInjConsent(false);
      await load(false);
      if (created?.id) setSelectedId(created.id);
      setTimeout(() => setInjOk(false), 2500);
    } catch (e) {
      setInjError(injectErrorMessage(e));
    } finally {
      setInjBusy(false);
    }
  };

  const selected = athletes.find((a) => a.id === selectedId) || null;
  const view = {
    sportId: override.sportId, positionLabel: override.position, age: override.age, goal: override.goal,
  };

  return (
    <div className="sp">
      <header className="sp-head">
        <span className="sp-badge">Roster Intel · Live</span>
        <h1 className="sp-title">BBF Sports Portal &amp; <span>Athlete Database</span></h1>
        <p className="sp-sub">
          Biomechanical monitoring of live youth-athlete records — from school yard to collegiate draft.
        </p>

        {isAdmin && athletes.length ? (
          <div className="sp-files" role="tablist" aria-label="Athlete files">
            {athletes.map((a) => {
              const on = a.id === selectedId;
              const sp = getPortalSport(toSportId(a.sport));
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`sp-file${on ? ' is-active' : ''}`}
                  onClick={() => selectAthlete(a)}
                >
                  <span className="sp-file-dot" aria-hidden="true">{sp.icon}</span>
                  <span className="sp-file-name">{a.name}</span>
                  <span className="sp-file-sport">{sp.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {!isAdmin ? (
        <div className="sp-clientnote">
          <span aria-hidden="true">🛡</span>
          <span><b>Managed by your coach</b> — your athlete profile and progression are maintained by your BBF coach inside the Sovereign database.</span>
        </div>
      ) : loading ? (
        <div className="sp-state"><span className="sp-state-dot" />Loading live athlete records…</div>
      ) : error ? (
        <div className="sp-state is-error">
          <span>⚠ {error}</span>
          <button type="button" className="sp-retry" onClick={() => load(true)}>Retry</button>
        </div>
      ) : (
        <>
          <AdminOverridePanel
            override={override}
            onSport={onSport}
            onPosition={onPosition}
            onAge={onAge}
            onGoal={onGoal}
            onApply={onApply}
            applied={applied}
            inject={{
              name: injName, setName: setInjName,
              consent: injConsent, setConsent: setInjConsent,
              busy: injBusy, error: injError, ok: injOk, submit: submitInject,
            }}
          />
          {selected ? (
            <AthleteDossier athlete={selected} view={view} lang={lang} />
          ) : (
            <div className="sp-state">No athlete records yet. Inject the first youth athlete above.</div>
          )}
        </>
      )}
    </div>
  );
}
