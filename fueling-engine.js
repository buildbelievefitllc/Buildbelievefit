// ═══════════════════════════════════════════════════════════════
// FUELING-ENGINE.JS — Sovereign Fueling Engine
// Clinical bioenergetic matrix: TDEE, sport-specific macros,
// 48-hour carb-loading trigger, ATP-PC creatine protocol.
// ───────────────────────────────────────────────────────────────
// Matrix:
//   RMR  = 500 + (22 * Lean Body Mass kg)
//   TDEE = RMR * Activity Factor
//     AF 1.55  → 3-5 training days/wk
//     AF 1.725 → 6-7 training days/wk
//     AF 2.00  → 2x daily
//   ATP-PC (football linemen): creatine load 0.3 g/kg/d × 5-7d,
//                              maintenance 0.03 g/kg/d.
//   Glycolytic (soccer/basketball): carbs by volume
//     ~60 min  → 5-7  g/kg
//     1-3 hrs  → 6-10 g/kg
//     >4 hrs   → 8-12 g/kg
//   48-hr carb load (Glycolytic + event ≤ 48h): 10-12 g/kg
// ═══════════════════════════════════════════════════════════════

const FUELING_ENGINE = (function () {
  'use strict';

  const LB_TO_KG = 0.45359237;
  const STORE_KEY_ATHLETE = 'bbf_athlete_portal_v2';
  const STORE_KEY_EVENT   = 'bbf_fueling_event_v1';

  const SPORT_PROFILE = {
    football: { skill: 'glycolytic', bigs: 'atp_pc' },
    soccer:     { field: 'glycolytic', goal: 'glycolytic' },
    basketball: { perimeter: 'glycolytic', post: 'glycolytic' }
  };

  // ─── STATE READERS ───────────────────────────────────────
  function readAthleteState() {
    try {
      const raw = localStorage.getItem(STORE_KEY_ATHLETE);
      if (!raw) return { sport: '', position: '', phase: 'off' };
      const p = JSON.parse(raw) || {};
      return {
        sport:    typeof p.sport    === 'string' ? p.sport    : '',
        position: typeof p.position === 'string' ? p.position : '',
        phase:    (p.phase === 'in' || p.phase === 'off') ? p.phase : 'off'
      };
    } catch (_) { return { sport:'', position:'', phase:'off' }; }
  }

  function readEventDate() {
    try {
      const raw = localStorage.getItem(STORE_KEY_EVENT);
      if (!raw) return '';
      const p = JSON.parse(raw) || {};
      return typeof p.eventDate === 'string' ? p.eventDate : '';
    } catch (_) { return ''; }
  }

  function writeEventDate(isoDate) {
    try {
      localStorage.setItem(STORE_KEY_EVENT, JSON.stringify({ eventDate: isoDate || '' }));
      return true;
    } catch (_) { return false; }
  }

  function latestMetrics(uid) {
    try {
      const d = (typeof GD === 'function') ? GD() : JSON.parse(localStorage.getItem('bbfData') || '{}');
      const user = (d && d.u && d.u[uid]) || {};
      const logs = (d && d.l && d.l[uid]) || [];
      let wt = null, bf = null;
      for (let i = logs.length - 1; i >= 0; i--) {
        const l = logs[i];
        if (l && l.type === 'metrics') {
          if (wt === null && l.wt !== '' && l.wt != null) wt = parseFloat(l.wt);
          if (bf === null && l.bf !== '' && l.bf != null) bf = parseFloat(l.bf);
          if (wt !== null && bf !== null) break;
        }
      }
      if ((wt === null || isNaN(wt)) && user.wt_start) wt = parseFloat(user.wt_start);
      if ((bf === null || isNaN(bf)) && user.bf_start) bf = parseFloat(user.bf_start);
      return {
        weightLb: (wt !== null && !isNaN(wt)) ? wt : null,
        bodyFatPct: (bf !== null && !isNaN(bf)) ? bf : null,
        user: user
      };
    } catch (_) {
      return { weightLb: null, bodyFatPct: null, user: {} };
    }
  }

  // ─── PROFILE CLASSIFIER ──────────────────────────────────
  function resolveProfile(sport, position) {
    const sp = SPORT_PROFILE[sport];
    if (!sp) return null;
    return sp[position] || null;
  }

  // ─── ACTIVITY FACTOR ─────────────────────────────────────
  function activityFactor(trainingDaysPerWeek, twiceDaily) {
    if (twiceDaily) return 2.0;
    const days = Number(trainingDaysPerWeek) || 0;
    if (days >= 6) return 1.725;
    if (days >= 3) return 1.55;
    return 1.55;
  }

  // ─── TDEE / RMR ──────────────────────────────────────────
  function calculateTDEE(opts) {
    opts = opts || {};
    const weightLb   = (opts.weightLb   != null) ? opts.weightLb   : null;
    const bodyFatPct = (opts.bodyFatPct != null) ? opts.bodyFatPct : null;
    const days       = (opts.trainingDaysPerWeek != null) ? opts.trainingDaysPerWeek : 4;
    const twice      = !!opts.twiceDaily;

    if (weightLb == null || bodyFatPct == null) {
      return { ok:false, reason:'missing_inputs' };
    }
    const weightKg = weightLb * LB_TO_KG;
    const leanKg   = weightKg * (1 - (bodyFatPct / 100));
    const rmr      = 500 + (22 * leanKg);
    const af       = activityFactor(days, twice);
    const tdee     = rmr * af;
    return {
      ok: true,
      weightKg: weightKg,
      leanKg:   leanKg,
      rmr:      Math.round(rmr),
      af:       af,
      tdee:     Math.round(tdee)
    };
  }

  // ─── MACRO ASSIGNMENT ────────────────────────────────────
  function assignMacros(opts) {
    opts = opts || {};
    const base = calculateTDEE(opts);
    if (!base.ok) return base;

    const profile        = opts.profile || null;
    const sessionMinutes = Number(opts.sessionMinutes) || 0;
    const carbLoad       = !!opts.carbLoad;
    const weightKg       = base.weightKg;

    let carbsPerKg;
    let carbBand = '';
    if (carbLoad) {
      carbsPerKg = 11;
      carbBand = '10–12 g/kg (Sovereign Load)';
    } else if (profile === 'glycolytic') {
      if (sessionMinutes >= 240)      { carbsPerKg = 10; carbBand = '8–12 g/kg (>4 hr volume)'; }
      else if (sessionMinutes >= 60)  { carbsPerKg = 8;  carbBand = '6–10 g/kg (1–3 hr volume)'; }
      else                            { carbsPerKg = 6;  carbBand = '5–7 g/kg (~60 min volume)'; }
    } else if (profile === 'atp_pc') {
      carbsPerKg = 4;  carbBand = '3–5 g/kg (ATP-PC baseline)';
    } else {
      carbsPerKg = 4;  carbBand = '3–5 g/kg (general)';
    }

    const proteinPerKg = 1.8;
    const carbsG   = Math.round(carbsPerKg  * weightKg);
    const proteinG = Math.round(proteinPerKg * weightKg);
    const carbKcal    = carbsG * 4;
    const proteinKcal = proteinG * 4;
    const fatKcal     = Math.max(0, base.tdee - carbKcal - proteinKcal);
    const fatsG       = Math.round(fatKcal / 9);

    let creatine = null;
    if (profile === 'atp_pc') {
      creatine = {
        loadingGramsPerDay:     +(0.3  * weightKg).toFixed(1),
        loadingDays:            '5–7',
        maintenanceGramsPerDay: +(0.03 * weightKg).toFixed(1)
      };
    }

    return {
      ok: true,
      rmr: base.rmr,
      tdee: base.tdee,
      af: base.af,
      weightKg: weightKg,
      leanKg: base.leanKg,
      profile: profile,
      carbBand: carbBand,
      carbs:   carbsG,
      protein: proteinG,
      fats:    fatsG,
      creatine: creatine,
      carbLoadActive: carbLoad
    };
  }

  // ─── EVENT PREP AUDIT ────────────────────────────────────
  function hoursUntil(isoDate) {
    if (!isoDate) return null;
    const t = new Date(isoDate).getTime();
    if (isNaN(t)) return null;
    return (t - Date.now()) / 3600000;
  }

  function auditEventPrep(opts) {
    opts = opts || {};
    const athlete = opts.athlete || readAthleteState();
    const profile = resolveProfile(athlete.sport, athlete.position);
    const eventDate = opts.eventDate != null ? opts.eventDate : readEventDate();
    const hrs = hoursUntil(eventDate);
    const within48 = (hrs !== null && hrs >= 0 && hrs <= 48);
    const carbLoad = within48 && (profile === 'glycolytic');
    return {
      profile: profile,
      sport: athlete.sport,
      position: athlete.position,
      eventDate: eventDate,
      hoursUntilEvent: (hrs === null) ? null : Math.round(hrs * 10) / 10,
      withinWindow: within48,
      carbLoadActive: carbLoad
    };
  }

  // ─── SESSION MINUTES HEURISTIC ──────────────────────────
  function sessionMinutesFor(sport) {
    if (sport === 'soccer') return 90;
    if (sport === 'basketball') return 48;
    if (sport === 'football') return 60;
    return 60;
  }

  // ─── PUBLIC SNAPSHOT (drives UI) ─────────────────────────
  function snapshot(uid, opts) {
    opts = opts || {};
    const m = latestMetrics(uid);
    const athlete = readAthleteState();
    const audit = auditEventPrep({ athlete: athlete });
    const macros = assignMacros({
      weightLb:   m.weightLb,
      bodyFatPct: m.bodyFatPct,
      trainingDaysPerWeek: opts.trainingDaysPerWeek != null ? opts.trainingDaysPerWeek : 4,
      twiceDaily: !!opts.twiceDaily,
      profile:    audit.profile,
      sessionMinutes: opts.sessionMinutes != null ? opts.sessionMinutes : sessionMinutesFor(athlete.sport),
      carbLoad:   audit.carbLoadActive
    });
    return {
      uid: uid,
      inputs: { weightLb: m.weightLb, bodyFatPct: m.bodyFatPct },
      athlete: athlete,
      audit: audit,
      macros: macros
    };
  }

  // ─── DOCUMENT FRAGMENT + rAF PAINT ───────────────────────
  // CLS-safe render path — parse off-DOM, commit in a single frame.
  function paintFragment(host, html) {
    if (!host) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    const frag = tpl.content;
    const commit = function () {
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(frag);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(commit);
    else commit();
  }

  // ─── DASHBOARD DATA BLOCK (Sovereign Matte Black) ────────
  // All colors / borders / shadows live in #sovereign-ui-layer.
  // This function emits semantic markup only — no inline styles.
  function renderDashboardBlock(uid) {
    const host = document.getElementById('fueling-engine-block');
    if (!host) return null;
    host.classList.remove('is-hidden');
    const snap = snapshot(uid);
    const m = snap.macros;
    const a = snap.audit;

    if (!m.ok) {
      const emptyHTML =
        '<div class="sv-glass sv-block fe-block" data-fe-state="empty">' +
          '<div class="sv-block-head">' +
            '<div>' +
              '<div class="sv-block-kicker">SOVEREIGN FUELING ENGINE</div>' +
              '<div class="sv-block-title">BIOENERGETIC TARGET</div>' +
            '</div>' +
            '<div class="sv-block-tag">AWAITING INPUT</div>' +
          '</div>' +
          '<div class="fe-empty-msg">Log <strong>Weight</strong> and <strong>Body Fat&nbsp;%</strong> on the Body tab to unlock your TDEE, RMR and macro grams.</div>' +
        '</div>';
      paintFragment(host, emptyHTML);
      return snap;
    }

    const profileLabel = m.profile === 'atp_pc' ? 'ATP-PC'
                       : m.profile === 'glycolytic' ? 'GLYCOLYTIC'
                       : 'BASELINE';
    const profileStateClass = m.profile === 'atp_pc' ? 'is-critical-lockout'
                            : m.profile === 'glycolytic' ? 'is-ok'
                            : 'is-active';

    let banner = '';
    if (a.carbLoadActive) {
      banner =
        '<div class="fe-carbload-banner" role="status" aria-live="polite">' +
          '<span class="fe-carbload-icon">⚡</span>' +
          '<div>' +
            '<div class="fe-carbload-title">SOVEREIGN CARB LOADING ACTIVE</div>' +
            '<div class="fe-carbload-sub"><span class="mono">10–12 g/kg</span> Glycogen Saturation Required</div>' +
          '</div>' +
        '</div>';
    }

    let creatineLine = '';
    if (m.creatine) {
      creatineLine =
        '<div class="fe-creatine sv-glass--flat">' +
          '<div class="fe-creatine-kicker">ATP-PC CREATINE PROTOCOL</div>' +
          '<div class="fe-creatine-body">' +
            'Load <strong class="mono">' + m.creatine.loadingGramsPerDay + ' g/day</strong> &middot; ' +
            '<span class="mono">' + escapeHtml(m.creatine.loadingDays) + ' d</span> &middot; ' +
            'Maintain <strong class="mono">' + m.creatine.maintenanceGramsPerDay + ' g/day</strong>' +
          '</div>' +
        '</div>';
    }

    const html =
      '<div class="sv-glass sv-block fe-block" data-fe-profile="' + escapeAttr(m.profile || 'baseline') + '">' +
        '<div class="sv-block-head">' +
          '<div>' +
            '<div class="sv-block-kicker">SOVEREIGN FUELING ENGINE</div>' +
            '<div class="sv-block-title">BIOENERGETIC TARGET</div>' +
          '</div>' +
          '<div class="sv-block-tag ' + profileStateClass + '">' + profileLabel + '</div>' +
        '</div>' +
        '<div class="sv-metric-grid">' +
          '<div class="sv-metric">' +
            '<div class="sv-metric-label">TDEE</div>' +
            '<div class="sv-metric-value sv-metric-value--cta"><span class="mono">' + m.tdee + '</span><span class="sv-metric-unit">kcal</span></div>' +
          '</div>' +
          '<div class="sv-metric">' +
            '<div class="sv-metric-label">RMR</div>' +
            '<div class="sv-metric-value"><span class="mono">' + m.rmr + '</span><span class="sv-metric-unit">kcal</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="sv-metric-grid sv-metric-grid--3 fe-macros">' +
          '<div class="sv-metric">' +
            '<div class="sv-metric-label fe-macro-label--carbs">CARBS</div>' +
            '<div class="sv-metric-value"><span class="mono">' + m.carbs + '</span><span class="sv-metric-unit">g</span></div>' +
          '</div>' +
          '<div class="sv-metric">' +
            '<div class="sv-metric-label fe-macro-label--protein">PROTEIN</div>' +
            '<div class="sv-metric-value"><span class="mono">' + m.protein + '</span><span class="sv-metric-unit">g</span></div>' +
          '</div>' +
          '<div class="sv-metric">' +
            '<div class="sv-metric-label fe-macro-label--fats">FATS</div>' +
            '<div class="sv-metric-value"><span class="mono">' + m.fats + '</span><span class="sv-metric-unit">g</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="fe-foot"><span class="mono">' + escapeHtml(m.carbBand) + '</span> &middot; AF <span class="mono">' + m.af + '</span></div>' +
        creatineLine +
        banner +
      '</div>';

    paintFragment(host, html);
    return snap;
  }

  // ─── SETTINGS: EVENT-DATE SELECTOR ───────────────────────
  function renderSettingsControl() {
    const host = document.getElementById('fueling-event-row');
    if (!host) return;
    const current = readEventDate();
    const audit = auditEventPrep();
    let status = '';
    let statusStateClass = '';
    if (current) {
      if (audit.hoursUntilEvent == null) status = '';
      else if (audit.hoursUntilEvent < 0) { status = 'Event passed'; statusStateClass = 'is-caution'; }
      else if (audit.carbLoadActive)      { status = 'CARB LOAD ACTIVE · ' + audit.hoursUntilEvent + ' hrs'; statusStateClass = 'is-active'; }
      else if (audit.hoursUntilEvent <= 48) { status = audit.hoursUntilEvent + ' hrs · profile not glycolytic'; statusStateClass = 'is-caution'; }
      else                                { status = 'T-' + Math.round(audit.hoursUntilEvent) + ' hrs'; statusStateClass = 'is-ok'; }
    } else {
      status = 'No event scheduled';
    }
    const html =
      '<div class="psrl fe-event-row"><span class="fe-event-icon">📆</span>' +
        '<div><div class="psrn">Upcoming Event Date</div>' +
        '<div class="psrs fe-event-status ' + statusStateClass + '" id="fe-event-status"><span class="mono">' + escapeHtml(status) + '</span></div></div></div>' +
      '<input type="datetime-local" id="fe-event-input" class="fe-event-input mono" value="' + escapeAttr(current) + '">';
    paintFragment(host, html);
    // Defer listener binding until after rAF paint commits.
    const bind = function () {
      const input = document.getElementById('fe-event-input');
      if (!input) return;
      input.addEventListener('change', function () {
        writeEventDate(input.value || '');
        renderSettingsControl();
        const uid = (typeof VC !== 'undefined' && VC) ? VC
                  : (typeof CU !== 'undefined' && CU) ? CU : null;
        if (uid) renderDashboardBlock(uid);
      });
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(bind);
    else bind();
  }

  // Legacy ensureStyles — kept as a no-op so external callers don't break.
  // All Sovereign animations now live in #sovereign-ui-layer.
  function ensureStyles() { /* Sovereign UI layer owns this now. */ }

  // ─── HTML SAFETY ─────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ─── BOOT ────────────────────────────────────────────────
  function init() {
    const uid = (typeof VC !== 'undefined' && VC) ? VC
              : (typeof CU !== 'undefined' && CU) ? CU : null;
    if (uid) renderDashboardBlock(uid);
    renderSettingsControl();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 0);
    }
  }

  return {
    // core
    calculateTDEE:   calculateTDEE,
    assignMacros:    assignMacros,
    auditEventPrep:  auditEventPrep,
    // helpers
    snapshot:             snapshot,
    resolveProfile:       resolveProfile,
    readEventDate:        readEventDate,
    writeEventDate:       writeEventDate,
    // renderers
    renderDashboardBlock: renderDashboardBlock,
    renderSettingsControl: renderSettingsControl,
    init: init
  };
})();

if (typeof window !== 'undefined') window.FUELING_ENGINE = FUELING_ENGINE;
if (typeof module !== 'undefined' && module.exports) module.exports = FUELING_ENGINE;
