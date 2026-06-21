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
import ClientDossier from '../command/ClientDossier.jsx';
import { fetchSportsRoster, insertAthlete, injectErrorMessage, setAthleteSport } from './sportsApi.js';
import { listSportsAthletes } from '../../lib/protocolOverrideApi.js';
import { PORTAL_SPORTS, GOAL_DIRECTIVES, getPositions, getPosition, getPortalSport } from './sportsData.js';
import './sports.css';

const toSportId = (s) => {
  const id = String(s || '').toLowerCase();
  return PORTAL_SPORTS.some((p) => p.id === id) ? id : PORTAL_SPORTS[0].id;
};

// Initial override for a selected athlete: discipline seeds from the live record;
// position defaults to that sport's first group. The Sovereign Override's "Apply"
// now PERSISTS the chosen sport + position back to bbf_users (the source of truth).
// Age has no column, so the slider stays a pure reference lens, never written.
const initOverride = (a) => {
  const sportId = toSportId(a?.sport);
  return { sportId, position: getPositions(sportId)[0].label, age: 16, goal: GOAL_DIRECTIVES[0] };
};

// ── Protocol Roster — athletes with a staged sports_protocol (bbf_active_clients).
//    Selecting one drills into the command ClientDossier where the manual overrides
//    (Phase / Nutrition) live. Pure renderer; the parent owns fetch + selection. ────
const PR = {
  wrap: { background: 'rgba(106,13,173,.10)', border: '1px solid rgba(245,200,0,.3)', borderRadius: 14, padding: '1.1rem 1.2rem', margin: '0 0 1.4rem' },
  head: { display: 'flex', flexDirection: 'column', gap: '.2rem', marginBottom: '.9rem' },
  kicker: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-soft)' },
  sub: { fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 600, color: 'var(--mut)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '.6rem' },
  card: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '.25rem', textAlign: 'left', cursor: 'pointer', background: 'var(--gry, #141018)', border: '1px solid var(--line, #2a1d45)', borderRadius: 10, padding: '.7rem .85rem' },
  idRow: { display: 'flex', alignItems: 'center', gap: '.55rem', width: '100%' },
  avatar: { width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(245,200,0,.45)', flex: '0 0 auto' },
  avatarFallback: { width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(106,13,173,.35)', border: '1px solid rgba(245,200,0,.3)', fontFamily: 'var(--display, "Bebas Neue", sans-serif)', fontSize: '.85rem', letterSpacing: '.5px', color: 'var(--gold-soft)', flex: '0 0 auto' },
  name: { fontFamily: 'var(--display, "Bebas Neue", sans-serif)', fontSize: '1.05rem', letterSpacing: '.5px', color: 'var(--wht, #fff)' },
  meta: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)' },
  cta: { fontFamily: 'var(--hb)', fontSize: '.62rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--gold-soft)', marginTop: '.2rem' },
  note: { fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 600, color: 'var(--mut)' },
  err: { fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 700, color: 'var(--red, #ff5d5d)', display: 'flex', alignItems: 'center', gap: '.6rem' },
  retry: { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--red, #ff5d5d)', background: 'none', border: '1px solid var(--red, #ff5d5d)', borderRadius: 6, padding: '.3rem .6rem', cursor: 'pointer' },
};
function ProtocolRoster({ athletes, loading, error, onRetry, onSelect }) {
  return (
    <section style={PR.wrap}>
      <div style={PR.head}>
        <span style={PR.kicker}>⚡ Autonomous Referee · Protocol Roster</span>
        <span style={PR.sub}>Athletes with a staged sports_protocol — select to open the dossier &amp; manual overrides.</span>
      </div>
      {loading ? (
        <div style={PR.note}>Loading protocol athletes…</div>
      ) : error ? (
        <div style={PR.err}><span>⚠ {error}</span><button type="button" style={PR.retry} onClick={onRetry}>Retry</button></div>
      ) : !athletes.length ? (
        <div style={PR.note}>No athletes with a staged sports_protocol yet — they appear here once intake stages one (or the Referee promotes).</div>
      ) : (
        <div style={PR.grid}>
          {athletes.map((a) => {
            const initials = String(a.name || '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'AB';
            return (
              <button key={a.id} type="button" style={PR.card} onClick={() => onSelect(a)}>
                <span style={PR.idRow}>
                  {a.avatar
                    ? <img src={a.avatar} alt="" style={PR.avatar} />
                    : <span style={PR.avatarFallback} aria-hidden="true">{initials}</span>}
                  <span style={PR.name}>{a.name}</span>
                </span>
                <span style={PR.meta}>{a.sport || 'General'} · Phase {a.phase_number || '—'}</span>
                <span style={PR.cta}>Open Dossier →</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function SportsPortal() {
  const { isAdmin } = useAuth();
  const { t, lang } = useLang();

  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [override, setOverride] = useState(() => initOverride(null));
  const [applied, setApplied] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState(null);

  // Inject form state (admin write path).
  const [injName, setInjName] = useState('');
  const [injConsent, setInjConsent] = useState(false);
  const [injBusy, setInjBusy] = useState(false);
  const [injError, setInjError] = useState(null);
  const [injOk, setInjOk] = useState(false);

  // ── Protocol Athletes (bbf_active_clients with a staged sports_protocol) → drill
  //    into the command ClientDossier where the Phase / Nutrition overrides live. ───
  const [protoAthletes, setProtoAthletes] = useState([]);
  const [protoLoading, setProtoLoading] = useState(isAdmin);
  const [protoErr, setProtoErr] = useState(null);
  const [dossierClient, setDossierClient] = useState(null);

  const loadProtocolAthletes = useCallback(async () => {
    setProtoLoading(true); setProtoErr(null);
    try {
      const rows = await listSportsAthletes();
      setProtoAthletes(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setProtoErr(toErrorMessage(e)); setProtoAthletes([]);
    } finally {
      setProtoLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) loadProtocolAthletes(); });
    return () => { cancelled = true; };
  }, [isAdmin, loadProtocolAthletes]);

  const patch = (next) => { setOverride((o) => ({ ...o, ...next })); setApplied(false); setApplyError(null); };
  const onSport = (sportId) => patch({ sportId, position: getPositions(sportId)[0].label });
  const onPosition = (position) => patch({ position });
  const onAge = (age) => patch({ age });
  const onGoal = (goal) => patch({ goal });

  // Apply now PERSISTS the override's discipline + position to the selected athlete's
  // canonical bbf_users profile (via the session-authed admin gate), then reloads so
  // the file tile reflects the new sport. Age stays reference-only (never written).
  const onApply = async () => {
    const target = athletes.find((a) => a.id === selectedId);
    if (!target) return;
    setApplyBusy(true);
    setApplyError(null);
    try {
      const pos = getPosition(override.sportId, override.position);
      await setAthleteSport({
        userId: target.user_id,
        sport: override.sportId,
        position: pos?.legacy ?? override.position,
      });
      await load(true); // reload + keep selection so the file tile reflects the new sport
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (e) {
      setApplyError(toErrorMessage(e));
    } finally {
      setApplyBusy(false);
    }
  };

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

  // Drill-in: a selected protocol athlete opens the command ClientDossier (manual
  // overrides). Back returns to the portal and refreshes the protocol roster.
  if (dossierClient) {
    return (
      <div className="sp">
        <ClientDossier client={dossierClient} onBack={() => { setDossierClient(null); loadProtocolAthletes(); }} />
      </div>
    );
  }

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
                  <span className="sp-file-sport">{sp.labelKey ? t(sp.labelKey) : sp.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {isAdmin ? (
        <ProtocolRoster
          athletes={protoAthletes}
          loading={protoLoading}
          error={protoErr}
          onRetry={loadProtocolAthletes}
          onSelect={(a) => setDossierClient(a)}
        />
      ) : null}

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
            applyBusy={applyBusy}
            applyError={applyError}
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
