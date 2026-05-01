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

  // ─── DASHBOARD DATA BLOCK (Matte Black) ──────────────────
  function renderDashboardBlock(uid) {
    const host = document.getElementById('fueling-engine-block');
    if (!host) return null;
    const snap = snapshot(uid);
    const m = snap.macros;
    const a = snap.audit;

    if (!m.ok) {
      host.style.display = 'block';
      host.innerHTML =
        '<div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:14px;padding:1.1rem;margin-bottom:1rem;position:relative;overflow:hidden">' +
          '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#f5c800,#6a0dad)"></div>' +
          '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.62rem;letter-spacing:3px;color:#f5c800;font-weight:700">BIOENERGETIC GOVERNANCE</div>' +
          '<div style="font-size:.82rem;color:#ccc;margin-top:.4rem;line-height:1.5">Log <strong style="color:#fff">Weight</strong> and <strong style="color:#fff">Body Fat %</strong> on the Body tab to unlock your TDEE, RMR and macro grams.</div>' +
        '</div>';
      return snap;
    }

    const profileLabel = m.profile === 'atp_pc' ? 'ATP-PC'
                       : m.profile === 'glycolytic' ? 'GLYCOLYTIC'
                       : 'BASELINE';
    const profileColor = m.profile === 'atp_pc' ? '#ef4444'
                       : m.profile === 'glycolytic' ? '#22c55e'
                       : '#888';

    let banner = '';
    if (a.carbLoadActive) {
      banner =
        '<div class="fe-carbload-banner" style="margin:.75rem 0 .2rem;padding:.7rem .85rem;border-radius:10px;' +
          'background:linear-gradient(90deg,#0a0a0a,#111,#0a0a0a);border:1px solid #f5c800;' +
          'animation:feCarbPulse 1.4s ease-in-out infinite;display:flex;align-items:center;gap:.6rem">' +
          '<span style="font-size:1.1rem">⚡</span>' +
          '<div>' +
            '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.72rem;letter-spacing:2.5px;color:#f5c800;font-weight:800">SOVEREIGN CARB LOADING ACTIVE</div>' +
            '<div style="font-size:.74rem;color:#ddd;margin-top:.15rem">10–12 g/kg Glycogen Saturation Required</div>' +
          '</div>' +
        '</div>';
    }

    let creatineLine = '';
    if (m.creatine) {
      creatineLine =
        '<div style="margin-top:.55rem;padding:.55rem .7rem;background:#111;border:1px solid #1e1e1e;border-radius:8px">' +
          '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.6rem;letter-spacing:2.5px;color:#f5c800">ATP-PC CREATINE PROTOCOL</div>' +
          '<div style="font-size:.74rem;color:#ddd;margin-top:.2rem">Load <strong style="color:#fff">' + m.creatine.loadingGramsPerDay + ' g/day</strong> × ' + m.creatine.loadingDays + ' d · Maintain <strong style="color:#fff">' + m.creatine.maintenanceGramsPerDay + ' g/day</strong></div>' +
        '</div>';
    }

    host.style.display = 'block';
    host.innerHTML =
      '<div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:14px;padding:1.1rem;margin-bottom:1rem;position:relative;overflow:hidden">' +
        '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#f5c800,#6a0dad)"></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.55rem">' +
          '<div>' +
            '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.62rem;letter-spacing:3px;color:#f5c800;font-weight:700">BIOENERGETIC GOVERNANCE</div>' +
            '<div style="font-family:var(--hb,\'Anton\',\'Bebas Neue\');font-size:1.15rem;letter-spacing:1.5px;color:#fff;margin-top:.1rem">BIOENERGETIC TARGET</div>' +
          '</div>' +
          '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.58rem;letter-spacing:2px;color:' + profileColor + ';border:1px solid ' + profileColor + '44;padding:.2rem .55rem;border-radius:6px">' + profileLabel + '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.55rem;margin-bottom:.55rem">' +
          '<div style="background:#111;border:1px solid #1e1e1e;border-radius:8px;padding:.55rem .7rem">' +
            '<div style="font-size:.58rem;letter-spacing:2.5px;color:#888;font-weight:700">TDEE</div>' +
            '<div style="font-family:var(--hb,\'Anton\');font-size:1.3rem;color:#f5c800;letter-spacing:1px">' + m.tdee + '<span style="font-size:.62rem;color:#888;margin-left:.3rem">kcal</span></div>' +
          '</div>' +
          '<div style="background:#111;border:1px solid #1e1e1e;border-radius:8px;padding:.55rem .7rem">' +
            '<div style="font-size:.58rem;letter-spacing:2.5px;color:#888;font-weight:700">RMR</div>' +
            '<div style="font-family:var(--hb,\'Anton\');font-size:1.3rem;color:#fff;letter-spacing:1px">' + m.rmr + '<span style="font-size:.62rem;color:#888;margin-left:.3rem">kcal</span></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem">' +
          '<div style="background:#111;border:1px solid #1e1e1e;border-radius:8px;padding:.55rem .6rem;text-align:center">' +
            '<div style="font-size:.55rem;letter-spacing:2px;color:#22c55e;font-weight:700">CARBS</div>' +
            '<div style="font-family:var(--hb,\'Anton\');font-size:1.15rem;color:#fff">' + m.carbs + 'g</div>' +
          '</div>' +
          '<div style="background:#111;border:1px solid #1e1e1e;border-radius:8px;padding:.55rem .6rem;text-align:center">' +
            '<div style="font-size:.55rem;letter-spacing:2px;color:#ef4444;font-weight:700">PROTEIN</div>' +
            '<div style="font-family:var(--hb,\'Anton\');font-size:1.15rem;color:#fff">' + m.protein + 'g</div>' +
          '</div>' +
          '<div style="background:#111;border:1px solid #1e1e1e;border-radius:8px;padding:.55rem .6rem;text-align:center">' +
            '<div style="font-size:.55rem;letter-spacing:2px;color:#3b82f6;font-weight:700">FATS</div>' +
            '<div style="font-family:var(--hb,\'Anton\');font-size:1.15rem;color:#fff">' + m.fats + 'g</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:.65rem;color:#888;margin-top:.5rem">' + escapeHtml(m.carbBand) + ' · AF ' + m.af + '</div>' +
        (function(){
          // ── RED-S AUDIT (non-destructive clinical label) ────────────
          // Proxy Energy Availability = prescribed TDEE ÷ FFM.
          // ISCD / IOC RED-S threshold: EA ≥ 30 kcal/kg FFM/day.
          var ea = m.leanKg > 0 ? (m.tdee / m.leanKg) : 0;
          var safe = ea >= 30;
          var eaColor = safe ? '#22c55e' : '#ef4444';
          return '<div style="margin-top:.55rem;padding:.5rem .7rem;background:#0d0d0d;border:1px solid ' + eaColor + '33;border-left:2px solid ' + eaColor + ';border-radius:8px;display:flex;justify-content:space-between;align-items:center;gap:.6rem">' +
            '<div>' +
              '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.58rem;letter-spacing:2.5px;color:' + eaColor + ';font-weight:700">RED-S AUDIT · ENERGY AVAILABILITY</div>' +
              '<div style="font-size:.68rem;color:#aaa;margin-top:.15rem">' + ea.toFixed(1) + ' kcal/kg FFM · Threshold &ge; 30</div>' +
            '</div>' +
            '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.62rem;letter-spacing:2px;color:' + eaColor + ';font-weight:800">' + (safe ? 'CLEARED' : 'AT-RISK') + '</div>' +
          '</div>';
        })() +
        creatineLine +
        banner +
      '</div>';
    return snap;
  }

  // Phase 10 — renderSettingsControl removed. The "Upcoming Event Date"
  // settings input was confusing clients and non-functional in production;
  // its container (#fueling-event-row) and call sites in bbf-app.html were
  // pruned in the same slice. readEventDate / auditEventPrep / writeEventDate
  // remain as infrastructure for the dashboard bioenergetic block.

  // ─── STYLE INJECTION (pulse keyframes) ───────────────────
  function ensureStyles() {
    if (document.getElementById('fe-style')) return;
    const s = document.createElement('style');
    s.id = 'fe-style';
    s.textContent =
      '@keyframes feCarbPulse{' +
        '0%,100%{box-shadow:0 0 0 0 rgba(245,200,0,.55),inset 0 0 0 1px rgba(245,200,0,.6);border-color:#f5c800}' +
        '50%{box-shadow:0 0 18px 3px rgba(245,200,0,.15),inset 0 0 0 1px rgba(245,200,0,1);border-color:#ffe033}' +
      '}';
    document.head.appendChild(s);
  }

  // ─── HTML SAFETY ─────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ─── BOOT ────────────────────────────────────────────────
  function init() {
    ensureStyles();
    const uid = (typeof VC !== 'undefined' && VC) ? VC
              : (typeof CU !== 'undefined' && CU) ? CU : null;
    if (uid) renderDashboardBlock(uid);
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
    init: init
  };
})();

if (typeof window !== 'undefined') window.FUELING_ENGINE = FUELING_ENGINE;
if (typeof module !== 'undefined' && module.exports) module.exports = FUELING_ENGINE;
