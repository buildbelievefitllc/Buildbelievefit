// src/components/vault/VaultHeader.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The persistent client-profile header above the nested tab nav (stays fixed as
// the athlete moves between Hub / Program / Cardio / …).
//
// Three stacked clinical cards — deep void / near-black surfaces, gold as accent:
//   1) Portal          — profile hub banner + sessions / hydration read-outs.
//   2) Identity        — "WELCOME, <NAME>" + access tier + active focus + macros.
//   3) ACTIVE DIRECTIVE — the asynchronous routine QUEUE (CEO order): renders the
//      active queue item, NOT a calendar day. No `new Date()`, no weekday match,
//      no "missed session" friction — the backend owns the local-midnight
//      rotation; the frontend renders whatever the head of the queue is. Built
//      for shift workers who train at erratic hours. Carries a READINESS GATE on
//      the execute button (advisory, never disabling — the athlete keeps the
//      ultimate override).
//
// I18N: every string resolves through the LangContext dictionary (vh-* keys,
// EN/ES/PT); the focus headline runs through localizeFocus.
//
// Pure presentational: receives the already-fetched profile + plan envelope +
// the readiness verdict + a tab-navigate callback from the Vault shell.

import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { parseWorkoutPlan, parseMealPlan } from '../../lib/vaultApi.js';
import { localizeFocus } from '../../lib/trainingI18n.js';
import { getProgram } from './programData.js';
import { BoltIcon, CrestIcon } from './icons.jsx';
import SovereignPrepButton from './SovereignPrepButton.jsx';
import { fetchAvatar, pushAvatar } from '../../lib/avatarApi.js';
import './vault.css';

// ── Avatar helpers — mirrors the Sports Hub pattern (same AVATAR_KEY, same
// compressImage algo, same server-first / localStorage-cache strategy). ──
const AVATAR_KEY = 'bbf.avatar.v1';
function loadAvatar(uid) {
  try { const all = JSON.parse(localStorage.getItem(AVATAR_KEY) || '{}'); return (uid && all[uid]) || ''; } catch { return ''; }
}
function saveAvatar(uid, dataUrl) {
  if (!uid) return;
  try { const all = JSON.parse(localStorage.getItem(AVATAR_KEY) || '{}'); all[uid] = dataUrl; localStorage.setItem(AVATAR_KEY, JSON.stringify(all)); } catch { /* quota */ }
}
function compressImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale; const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const HYDRATION_TARGET_L = 3.5; // prototype read-out; live hydration tracking is a later phase

// Active Directive = the HEAD of the assigned queue. No date logic: the backend
// rotates the queue at local midnight; the frontend renders index 0 as-is (rest
// or training — a recovery block is a valid directive). Null only on an empty plan.
function resolveActiveDirective(plan) {
  if (!Array.isArray(plan) || !plan.length) return null;
  return plan[0];
}

// Readiness → execute-gate state (advisory only):
//   'optimal'   PRIME / STANDARD          → standard Sovereign Gold, no warning.
//   'caution'   STRAIN / BREACH           → amber recovery-pivot sub-text; button stays live.
//   'calibrate' INSUFFICIENT / no verdict → normal button + a Check-In prompt.
function readinessGate(readiness) {
  if (!readiness || !readiness.hasData) return 'calibrate';
  const mode = readiness.mode;
  if (readiness.isBreach || mode === 'SYSTEM_BREACH' || mode === 'SYSTEM_STRAIN') return 'caution';
  if (mode === 'INSUFFICIENT_TELEMETRY') return 'calibrate';
  return 'optimal';
}

// Macro VALUES from the assigned meal plan; labels applied in render via the
// dictionary so they follow the language toggle. '—' keeps the row clean when no
// structured plan exists yet.
function resolveMacros(mealPlanRaw) {
  const parsed = parseMealPlan(mealPlanRaw);
  const m = parsed.macros || {};
  const g = (n) => (Number.isFinite(n) && n > 0 ? String(n) : '—');
  return [
    { key: 'kcal', labelKey: 'vh-m-cal', value: parsed.cal != null ? parsed.cal.toLocaleString() : '—', unit: 'kcal' },
    { key: 'protein', labelKey: 'vh-m-protein', value: g(m.p), unit: 'g' },
    { key: 'carbs', labelKey: 'vh-m-carbs', value: g(m.c), unit: 'g' },
    { key: 'fat', labelKey: 'vh-m-fat', value: g(m.f), unit: 'g' },
  ];
}

function fmtInt(v) {
  return v !== null && v !== undefined && v !== '' ? Number(v).toLocaleString() : '0';
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'BB';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function VaultHeader({ profile, plans = null, displayName = 'Athlete', slug = '', programKey = '', isAdmin = false, readiness = null, onNavigate = null }) {
  const { t, lang } = useLang();
  // The active queue item (head). Pure — no date input — so the same directive
  // renders whenever the athlete opens the app, until the backend rotates it.
  const directive = useMemo(() => {
    const assigned = parseWorkoutPlan(plans?.workoutPlan || '');
    const plan = Array.isArray(assigned) && assigned.length ? assigned : getProgram(programKey);
    return resolveActiveDirective(plan);
  }, [plans?.workoutPlan, programKey]);
  const macros = useMemo(() => resolveMacros(plans?.mealPlan || ''), [plans?.mealPlan]);

  const isRest = directive?.isRest;
  const focus = isRest
    ? t('vh-rest-day')
    : (localizeFocus(directive?.focus, lang) || t('vh-training-day'));
  const sessions = fmtInt(profile?.totalSessions);
  const streak = fmtInt(profile?.currentStreak);
  const accessLabel = isAdmin ? t('vh-access-admin') : t('vh-access-client');

  const exCount = Array.isArray(directive?.exercises) ? directive.exercises.length : 0;
  const directiveSub = isRest
    ? (directive?.restNote || t('vh-rest-note'))
    : (directive?.focus_cue ? directive.focus_cue : `${exCount} ${t('vh-ex-count')}`);

  const gate = readinessGate(readiness);
  const go = (tab) => { if (typeof onNavigate === 'function') onNavigate(tab); };

  // Profile avatar — local-first (localStorage) with server reconciliation on
  // mount. Same AVATAR_KEY + compressImage pattern as SportsHub so one upload
  // from either portal is instantly visible in both (shared bbf_users.avatar row).
  const [avatar, setAvatar] = useState(() => loadAvatar(slug));
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    (async () => {
      const remote = await fetchAvatar();
      if (!alive || !remote) return;
      setAvatar((cur) => (remote === cur ? cur : remote));
      saveAvatar(slug, remote);
    })();
    return () => { alive = false; };
  }, [slug]);
  const onAvatarChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setAvatar(dataUrl);
      saveAvatar(slug, dataUrl);
      pushAvatar(dataUrl); // best-effort server sync (cross-device + Command Center CRM)
    } catch { /* unreadable image — keep current */ }
  }, [slug]);

  return (
    <section className="cv-head" aria-label={t('vh-head-aria')}>
      {/* ── 1 · Portal ── */}
      <div className="cv-portal">
        <div className="cv-portal-main">
          <span className="cv-pill">◇ {accessLabel}</span>
          <h1 className="cv-portal-title"><CrestIcon className="cv-portal-mark" size={20} /> {t('vh-portal-title').toUpperCase()}</h1>
          <p className="cv-portal-sub">{t('vh-portal-sub')}</p>
        </div>
        <div className="cv-portal-stats">
          <div className="cv-readout">
            <span className="cv-readout-k">{t('vh-sessions')}</span>
            <span className="cv-readout-v">{sessions} <em>{t('vh-done')}</em></span>
          </div>
          <div className="cv-readout">
            <span className="cv-readout-k">{t('vh-hydration')}</span>
            <span className="cv-readout-v">0.00L <em>/ {HYDRATION_TARGET_L}</em></span>
          </div>
        </div>
      </div>

      {/* ── 2 · Identity ── */}
      <div className="cv-identity">
        <div className="cv-identity-l">
          <div className="cv-avatar">
            {avatar
              ? <img src={avatar} alt="" className="cv-avatar-img" aria-hidden="true" />
              : <span className="cv-avatar-initials" aria-hidden="true">{initials(displayName)}</span>
            }
            <label className="cv-avatar-edit" title="Upload profile photo">
              <input type="file" accept="image/*" hidden onChange={onAvatarChange} />
              <span aria-hidden="true">✎</span>
            </label>
            {isAdmin ? <span className="cv-avatar-badge" aria-hidden="true">ADMIN</span> : null}
          </div>
          <div className="cv-identity-meta">
            <h2 className="cv-identity-name">{t('vh-welcome').toUpperCase()} {displayName.toUpperCase()}</h2>
            <span className="cv-pill cv-pill-sm">{accessLabel}</span>
            <div className="cv-identity-focus">
              <span className="cv-identity-slug">@{slug || 'athlete'}</span>
              <span className="cv-dotsep">•</span>
              <span className="cv-identity-phase">{focus.toUpperCase()}</span>
            </div>
          </div>
        </div>
        <div className="cv-identity-macros">
          {macros.map((m) => (
            <div key={m.key} className="cv-macro">
              <span className="cv-macro-k">{t(m.labelKey)}</span>
              <span className="cv-macro-v">{m.value}</span>
              <span className="cv-macro-u">{m.unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3 · ACTIVE DIRECTIVE (asynchronous queue — no calendar friction) ── */}
      <div className={`cv-blueprint cv-directive is-gate-${gate}${isRest ? ' is-rest' : ''}`} data-testid="vault-active-directive">
        <div className="cv-blueprint-l">
          <span className="cv-blueprint-k">{t('vh-blueprint-k')}</span>
          <div className="cv-blueprint-focus">{focus}</div>
          <p className="cv-blueprint-sub">{directiveSub}</p>

          {/* Readiness gate — advisory; never disables. The athlete always overrides. */}
          {gate === 'caution' ? (
            <p className="cv-directive-warn" role="status" data-testid="vh-gate-caution">{t('vh-gate-caution')}</p>
          ) : null}
          {gate === 'calibrate' ? (
            <p className="cv-directive-calibrate" role="status" data-testid="vh-gate-calibrate">{t('vh-gate-calibrate')}</p>
          ) : null}

          <div className="cv-directive-actions">
            <button
              type="button"
              className={`cv-directive-exec is-${gate}`}
              onClick={() => go('program')}
              data-testid="vh-directive-exec"
            >
              {t('vh-exec')}
            </button>
            {/* Sovereign Prep — the 3-phase pre-session protocol, adjacent to Open
                Program. Self-contained: resolves T-0/T-1 loads, fetches, renders. */}
            <SovereignPrepButton plans={plans} programKey={programKey} uid={slug} />
            {gate === 'caution' ? (
              <button type="button" className="cv-directive-alt" onClick={() => go('prehab')} data-testid="vh-directive-pivot">
                {t('vh-gate-pivot')}
              </button>
            ) : null}
            {gate === 'calibrate' ? (
              <button type="button" className="cv-directive-alt" onClick={() => go('checkin')} data-testid="vh-directive-checkin">
                {t('vh-gate-checkin')}
              </button>
            ) : null}
          </div>
        </div>
        <div className="cv-blueprint-streak">
          <span className="cv-blueprint-streak-k">{t('vh-streak')}</span>
          <span className="cv-blueprint-streak-v"><BoltIcon className="cv-streak-bolt" /> {streak} {streak === '1' ? t('vh-day') : t('vh-days')}</span>
        </div>
      </div>
    </section>
  );
}

// memo: pure presentation off shell-owned props. readiness drives the gate (it
// SHOULD re-render on a fresh verdict); onNavigate is stable (useCallback in the
// shell), so tab swaps alone never re-paint these cards. Language flips pass
// through (useLang is a context subscription, not a prop).
export default memo(VaultHeader);
