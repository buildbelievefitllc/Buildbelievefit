// src/components/command/ClientAnalytics.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 22.x — Sovereign Command Center · Client Analytics (Coach Portal).
//
// Consumes Terminal-5's verified RPC contracts (lib/coachAnalyticsApi):
//   • bbf_coach_client_analytics → 30/60/90-day volume, readiness, frequency.
//   • bbf_coach_body_composition → body-fat % series + progression.
//
// Flow: admin-PIN gate (cached in module memory for the session — typed once) →
// pick a client (roster reuse via the anon-key pattern) → switch 30/60/90 windows.
// Charts are hand-rolled SVG in the BBF purple/gold brutalist system (no chart
// lib). Per contract, readiness avg_score may be null on no-reading days — the
// line SEGMENTS across nulls (skips, never zero-fills or breaks). Unauthorized
// / lockout renders a live countdown.

import { useCallback, useEffect, useState } from 'react';
import CommandSurface from './CommandSurface.jsx';
import { Loading } from './primitives.jsx';
import { rosterCall } from '../../lib/rosterApi.js';
import {
  setAdminPin, hasAdminPin, clearAdminPin,
  fetchClientAnalytics, fetchBodyComposition,
} from '../../lib/coachAnalyticsApi.js';
import { BarChart, LineChart, BodyComp } from './charts.jsx';
import { numOrNull, fmtNum, GOLD, GOLD_SOFT, PURL, GRN } from './chartUtils.js';
import './analytics.css';

const WINDOWS = [30, 60, 90];

export default function ClientAnalytics() {
  // PIN gate state — hasAdminPin() persists across tab swaps (module memory).
  const [authed, setAuthed] = useState(hasAdminPin());
  const [pinInput, setPinInput] = useState('');
  const [lockout, setLockout] = useState(null); // { retryAfter } countdown

  // Client selection (reuses the admin roster the Client Hub already uses).
  const [roster, setRoster] = useState([]);
  const [activeUid, setActiveUid] = useState('');
  const [windowDays, setWindowDays] = useState(30);

  const [analytics, setAnalytics] = useState(null);
  const [bodyComp, setBodyComp] = useState(null);
  // Seed true — landing on an authed client always triggers a fetch; the effect's
  // .finally clears it. Toolbar actions (below) re-arm it in their handlers (event
  // context, where setState is fine — keeps the effect set-state-clean).
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Lockout countdown ──
  useEffect(() => {
    if (!lockout?.retryAfter) return undefined;
    const id = setInterval(() => {
      setLockout((l) => {
        if (!l) return null;
        const next = l.retryAfter - 1;
        return next > 0 ? { retryAfter: next } : null;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockout?.retryAfter]);

  // ── Load roster once authed (anon-key pattern, same as Client Hub) ──
  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    rosterCall('roster')
      .then((body) => {
        if (cancelled) return;
        const clients = Array.isArray(body.clients) ? body.clients : [];
        setRoster(clients);
        if (clients.length && !activeUid) setActiveUid(clients[0].uid);
      })
      .catch(() => { /* roster optional — coach can still type-less if empty */ });
    return () => { cancelled = true; };
  }, [authed, activeUid]);

  // ── Fetch analytics + body comp for the active client/window ──
  // State mutates ONLY inside promise callbacks (never synchronously in the effect
  // body) → clear of react-hooks/set-state-in-effect (mirrors useVaultProfile).
  // reloadKey bumps to force a refetch (the Refresh button).
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!activeUid) return undefined;
    let cancelled = false;
    Promise.all([
      fetchClientAnalytics(activeUid, windowDays),
      fetchBodyComposition(activeUid),
    ])
      .then(([a, b]) => { if (!cancelled) { setAnalytics(a); setBodyComp(b); setError(null); } })
      .catch((e) => {
        if (cancelled) return;
        if (e.code === 'unauthorized') {
          setAuthed(false);
          if (e.lockoutActive && e.retryAfter > 0) setLockout({ retryAfter: e.retryAfter });
          setError('Admin PIN rejected. Re-enter to continue.');
        } else if (e.code === 'no_pin') {
          setAuthed(false);
        } else {
          setError(e.message || 'Failed to load analytics.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeUid, windowDays, reloadKey]);

  function authenticate(e) {
    e.preventDefault();
    const pin = pinInput.trim();
    if (!pin) return;
    setAdminPin(pin);
    setPinInput('');
    setAuthed(true);
    setError(null);
  }

  // ── PIN GATE ──
  if (!authed) {
    return (
      <CommandSurface kicker="Coach Portal · Secure" title="Client Analytics"
        lede="30 / 60 / 90-day training analytics and body-composition tracking. Admin PIN required.">
        <form className="bbf-an bbf-an__gate" onSubmit={authenticate}>
          <label className="bbf-label" htmlFor="an-pin">Admin PIN</label>
          <div className="bbf-an__gate-row">
            <input id="an-pin" className="bbf-input" type="password" inputMode="numeric"
              autoComplete="off" spellCheck={false} placeholder="Enter admin PIN"
              value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} />
            <button className="bbf-btn" type="submit" style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0 1.2rem' }}>
              Unlock
            </button>
          </div>
          {lockout?.retryAfter ? (
            <div className="bbf-an__err" role="alert" style={{ marginTop: '.9rem' }}>
              <div className="bbf-an__err-title">Admin Locked</div>
              <div className="bbf-an__lockout">{fmtCountdown(lockout.retryAfter)}</div>
              <div className="bbf-an__err-msg">Too many attempts. Try again when the timer expires.</div>
            </div>
          ) : error ? (
            <div className="bbf-msg bbf-msg--error" role="alert">{error}</div>
          ) : null}
          <div className="bbf-an__gate-note">
            The PIN is held in memory for this session only — you won&apos;t be re-prompted on every chart update. It is never stored.
          </div>
        </form>
      </CommandSurface>
    );
  }

  const summary = analytics?.summary;

  return (
    <CommandSurface kicker="Coach Portal · Analytics" title="Client Analytics"
      lede="Training volume, readiness, and body composition across the selected window.">
      <div className="bbf-an">
        {/* Toolbar */}
        <div className="bbf-an__toolbar">
          {roster.length ? (
            <select className="bbf-input" style={{ width: 'auto' }} value={activeUid}
              onChange={(e) => { setLoading(true); setActiveUid(e.target.value); }} aria-label="Select client">
              {roster.map((c) => <option key={c.uid} value={c.uid}>{c.name || c.uid}</option>)}
            </select>
          ) : (
            <span className="bbf-an__client">{analytics?.name || activeUid || 'No client selected'}</span>
          )}
          <div className="bbf-an__windows" role="group" aria-label="Window">
            {WINDOWS.map((w) => (
              <button key={w} type="button" className={`bbf-an__win${w === windowDays ? ' is-active' : ''}`}
                onClick={() => { if (w !== windowDays) { setLoading(true); setWindowDays(w); } }}>{w}d</button>
            ))}
          </div>
          <button type="button" className="bbf-an__refresh" onClick={() => { setLoading(true); load(); }} disabled={loading}>↻ Refresh</button>
          <button type="button" className="bbf-an__refresh" onClick={() => { clearAdminPin(); setAuthed(false); }}>Lock</button>
        </div>

        {loading ? <Loading label="Loading analytics…" /> : null}

        {!loading && error ? (
          <div className="bbf-an__err" role="alert">
            <div className="bbf-an__err-title">Analytics fetch failed</div>
            <div className="bbf-an__err-msg">{error}</div>
          </div>
        ) : null}

        {!loading && !error && analytics ? (
          <>
            {/* Summary tiles */}
            <div className="bbf-an__summary">
              <Stat label="Sessions" value={summary?.total_sessions} accent={PURL} />
              <Stat label="Total Sets" value={summary?.total_sets} accent={PURL} />
              <Stat label="Tonnage (lbs)" value={summary?.total_tonnage_lbs} accent={GOLD} />
              <Stat label="Avg Readiness" value={summary?.avg_readiness} accent={GRN} suffix="" />
              <Stat label="Active Days" value={summary?.active_days} accent={PURL} />
            </div>

            {/* Volume — tonnage bars */}
            <ChartCard title="Training Volume" meta={`${windowDays}-day tonnage`}>
              <BarChart
                points={(analytics.volume_series || []).map((d) => ({ date: d.date, value: Number(d.tonnage_lbs) || 0 }))}
                color={GOLD}
                unit="lbs"
              />
            </ChartCard>

            {/* Readiness — segmented line that SKIPS nulls (contract note) */}
            <ChartCard title="Readiness Trend" meta="avg score · skips no-reading days">
              <LineChart
                series={[
                  { key: 'score', label: 'Readiness', color: GRN, points: (analytics.readiness_series || []).map((d) => ({ date: d.date, value: numOrNull(d.avg_score) })) },
                  { key: 'sleep', label: 'Sleep', color: PURL, points: (analytics.readiness_series || []).map((d) => ({ date: d.date, value: numOrNull(d.avg_sleep) })) },
                  { key: 'soreness', label: 'Soreness', color: GOLD_SOFT, points: (analytics.readiness_series || []).map((d) => ({ date: d.date, value: numOrNull(d.avg_soreness) })) },
                ]}
              />
            </ChartCard>

            {/* Body composition */}
            <ChartCard title="Body Composition" meta="body-fat %">
              <BodyComp data={bodyComp} />
            </ChartCard>
          </>
        ) : null}
      </div>
    </CommandSurface>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCountdown(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function Stat({ label, value, accent, suffix = '' }) {
  return (
    <div className="bbf-an__stat" style={{ '--zone': accent }}>
      <div className="bbf-an__stat-val">{fmtNum(value)}{value != null && suffix ? suffix : ''}</div>
      <div className="bbf-an__stat-lbl">{label}</div>
    </div>
  );
}

function ChartCard({ title, meta, children }) {
  return (
    <div className="bbf-an__chart">
      <div className="bbf-an__chart-h">
        <span className="bbf-an__chart-title">{title}</span>
        {meta ? <span className="bbf-an__chart-meta">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}
