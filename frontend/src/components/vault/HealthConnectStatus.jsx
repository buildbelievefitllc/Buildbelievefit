// src/components/vault/HealthConnectStatus.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Health Connect Status — the zero-guess handshake diagnostic (CEO order).
//
// A low-profile panel under the Check-In hub that surfaces the DIRECT state of
// the native Android Health Connect bridge so the athlete can instantly tell a
// broken API handshake apart from a day the wearable simply logged nothing:
//
//   Status        — Connected / Disconnected (live bridge probe)
//   Last Sync     — timestamp of the last NATIVE attempt (persisted)
//   Payload       — HRV / Calories / Sleep from that attempt (value or Null)
//
// Lazy-loaded by SovereignClientHub (its own chunk — keeps the hub lean). Reads
// the persisted handshake snapshot from the shared vitals pipeline; probes bridge
// availability locally (no sync side-effects). Token-layer CSS only (no Tailwind).

import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useHealthConnectHandshake } from '../../lib/vitalsPipeline.js';
import { hasHealthBridge, healthConnectAvailable } from '../../native/healthConnectBridge.js';

function fmtTime(ts) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString([], {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}
function fmtSleep(min) {
  const v = Number(min);
  if (!Number.isFinite(v)) return null;
  return `${Math.floor(v / 60)}h ${String(Math.round(v % 60)).padStart(2, '0')}m`;
}

export default function HealthConnectStatus() {
  const { t } = useLang();
  const handshake = useHealthConnectHandshake();
  // Lazy init reflects the bridge's presence WITHOUT a synchronous effect setState:
  // on web/PWA there is no Capacitor shell, so it lands 'no_bridge' immediately.
  const [bridge, setBridge] = useState(() => (
    hasHealthBridge() ? { connected: false, reason: 'probing' } : { connected: false, reason: 'no_bridge' }
  ));

  // Live availability probe — async only (no sync side-effects in the effect body).
  useEffect(() => {
    if (!hasHealthBridge()) return undefined; // initial state already says no_bridge
    let cancelled = false;
    healthConnectAvailable()
      .then((s) => { if (!cancelled) setBridge({ connected: !!(s && s.available), reason: (s && s.status) || null }); })
      .catch((e) => { if (!cancelled) setBridge({ connected: false, reason: String((e && e.message) || e) }); });
    return () => { cancelled = true; };
  }, []);

  // Android-only diagnostic: with no native bridge (web / PWA) there is nothing to
  // report, so the panel hides entirely instead of parking a permanent "off" chip
  // under the hub. Visibility now tracks whether the bridge can even be active.
  if (bridge.reason === 'no_bridge') return null;

  const connected = bridge.connected;
  // 'probing' is the brief indeterminate window before the native availability
  // check resolves — treat it as neutral (no alert pulse) so the header doesn't
  // flash-then-settle. Only a RESOLVED, unauthorized bridge is "permissions missing".
  const probing = bridge.reason === 'probing';
  const permsMissing = !connected && !probing;
  const lastSync = handshake ? fmtTime(handshake.at) : null;

  // Payload snapshot — value or the explicit "Null" token (the whole point: an
  // empty cell is a measurement that wasn't logged, not a UI gap).
  const NULL = t('sch-hc-null');
  const snapshot = [
    { id: 'hrv', label: t('sch-hc-hrv'), val: handshake && handshake.hrv_ms != null ? `${Number(handshake.hrv_ms).toFixed(0)} ms` : null },
    { id: 'cal', label: t('sch-hc-cal'), val: handshake && handshake.active_kcal != null ? `${Math.round(Number(handshake.active_kcal))} kcal` : null },
    { id: 'sleep', label: t('sch-hc-sleep'), val: handshake ? fmtSleep(handshake.sleep_minutes) : null },
  ];

  return (
    <details className="sch-hc" data-testid="sch-hc-status">
      {/* Authorized → solid high-status chrome (is-live), no pulse. Permissions
          missing → active gold pulse to prompt a reconnect. Probing → neutral. */}
      <summary className={`sch-hc-summary${connected ? ' is-live' : ''}${permsMissing ? ' bbf-pulse bbf-pulse--gold' : ''}`}>
        <span className={`sch-hc-dot${connected ? ' is-on' : ''}`} aria-hidden="true" />
        <span className="sch-hc-title">{t('sch-hc-title')}</span>
        <span className={`sch-hc-state${connected ? ' is-on' : ''}`} data-testid="sch-hc-state">
          {connected ? t('sch-hc-connected') : t('sch-hc-disconnected')}
        </span>
      </summary>

      <div className="sch-hc-body">
        <div className="sch-hc-row">
          <span className="sch-hc-k">{t('sch-hc-lastsync')}</span>
          <span className="sch-hc-v" data-testid="sch-hc-lastsync">{lastSync || t('sch-hc-never')}</span>
        </div>

        <div className="sch-hc-row sch-hc-row--col">
          <span className="sch-hc-k">{t('sch-hc-payload')}</span>
          <div className="sch-hc-payload" data-testid="sch-hc-payload">
            {snapshot.map((s) => (
              <span key={s.id} className={`sch-hc-chip${s.val == null ? ' is-null' : ''}`}>
                <span className="sch-hc-chip-k">{s.label}</span>
                <span className="sch-hc-chip-v">{s.val == null ? NULL : s.val}</span>
              </span>
            ))}
          </div>
        </div>

        {handshake && (handshake.hrv_raw_dump || handshake.active_cal_raw_dump) ? (
          <div className="sch-hc-row sch-hc-row--col">
            <span className="sch-hc-k">{t('sch-hc-rawprobe')}</span>
            <code className="sch-hc-dump" data-testid="sch-hc-hrv-dump">HRV → {handshake.hrv_raw_dump || '—'}</code>
            <code className="sch-hc-dump" data-testid="sch-hc-cal-dump">CAL → {handshake.active_cal_raw_dump || '—'}</code>
          </div>
        ) : null}

        {handshake && handshake.error ? (
          <code className="sch-hc-err" data-testid="sch-hc-err">{handshake.error}</code>
        ) : null}

        <p className="sch-hc-purpose">{t('sch-hc-purpose')}</p>
      </div>
    </details>
  );
}
