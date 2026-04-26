// ═══════════════════════════════════════════════════════════════
// CNS-ENGINE.JS — Sovereign Neurological Engine
// Clinical CNS Readiness Matrix (79-source distillation):
// HRV / RMSSD deviation × Sleep Architecture × Acute:Chronic
// Workload Ratio → Sovereign Readiness Score (SRS) & Lockout.
// ───────────────────────────────────────────────────────────────
//   HRV  GREEN  > -5%          YELLOW  -5 to -15%   RED  < -15%
//   SLP  Total < 7.0h  OR  Deep < 1.0h        → Lockout (RFD)
//   ACWR 0.8-1.3 Sweet   1.3-1.5 Caution   >1.5 Lockout (Injury)
//   SRS  = 0.45·HRV + 0.25·Sleep + 0.15·Deep + 0.15·ACWR
//         − 15 (penalty if ACWR > 1.5)
// ═══════════════════════════════════════════════════════════════

const CNS_ENGINE = (function () {
  'use strict';

  const STORE_KEY = 'bbf_cns_state_v1';

  const DEFAULTS = {
    hrvDeviation: 0,   // % deviation from 7-day RMSSD baseline
    totalSleep:   8.0, // hours
    deepSleep:    1.5, // hours (N3 slow-wave)
    acwr:         1.0  // Acute:Chronic Workload Ratio (Banister)
  };

  // ─── STATE IO ────────────────────────────────────────────
  function readState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      const p = JSON.parse(raw) || {};
      return {
        hrvDeviation: num(p.hrvDeviation, DEFAULTS.hrvDeviation),
        totalSleep:   num(p.totalSleep,   DEFAULTS.totalSleep),
        deepSleep:    num(p.deepSleep,    DEFAULTS.deepSleep),
        acwr:         num(p.acwr,         DEFAULTS.acwr)
      };
    } catch (_) { return Object.assign({}, DEFAULTS); }
  }

  function writeState(patch) {
    try {
      const next = Object.assign(readState(), patch || {});
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      return next;
    } catch (_) { return readState(); }
  }

  function num(v, fb) {
    const n = parseFloat(v);
    return isFinite(n) ? n : fb;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ─── COMPONENT SCORES (0–100) ────────────────────────────
  function hrvScore(dev) {
    // dev in %; 0 → 100, -5 → 80, -15 → 40, ≤ -25 → 0
    return clamp(100 + 4 * dev, 0, 100);
  }
  function totalSleepScore(h) {
    // 8h caps at 100; 7h → 87.5; 6h → 75; 0 → 0
    return clamp((h / 8) * 100, 0, 100);
  }
  function deepSleepScore(h) {
    // 2h caps at 100; 1h → 50; 0 → 0
    return clamp((h / 2) * 100, 0, 100);
  }
  function acwrScore(r) {
    if (r >= 0.8 && r <= 1.3) return 100;
    if (r < 0.8)              return clamp((r / 0.8) * 100, 0, 100);
    if (r <= 1.5)             return 100 - ((r - 1.3) / 0.2) * 60; // 100 → 40
    return 0;
  }

  // ─── SRS CALCULATION ─────────────────────────────────────
  function calculateSRS(s) {
    const state = Object.assign(readState(), s || {});
    const comp = {
      hrv:   hrvScore(state.hrvDeviation),
      total: totalSleepScore(state.totalSleep),
      deep:  deepSleepScore(state.deepSleep),
      acwr:  acwrScore(state.acwr)
    };
    const weighted =
      comp.hrv   * 0.45 +
      comp.total * 0.25 +
      comp.deep  * 0.15 +
      comp.acwr  * 0.15;
    const penalty = (state.acwr > 1.5) ? 15 : 0;
    const score = Math.round(clamp(weighted - penalty, 0, 100));
    return { score: score, components: comp, penalty: penalty, inputs: state };
  }

  // ─── BIOMETRIC AUDIT → GREEN / YELLOW / RED ──────────────
  function auditBiometrics(s) {
    const srs = calculateSRS(s);
    const st  = srs.inputs;
    const lockReasons = [];
    const yellowReasons = [];

    if (st.hrvDeviation < -15) {
      lockReasons.push({
        code: 'HRV_RED',
        headline: 'HRV COLLAPSE',
        detail: 'RMSSD deviation ' + st.hrvDeviation.toFixed(1) + '% — sympathetic override. Parasympathetic tone insufficient for max-effort loading.'
      });
    } else if (st.hrvDeviation <= -5) {
      yellowReasons.push({
        code: 'HRV_YELLOW',
        headline: 'HRV TAPER',
        detail: 'RMSSD ' + st.hrvDeviation.toFixed(1) + '% below baseline — auto-regulate volume −20%.'
      });
    }

    if (st.totalSleep < 7.0 || st.deepSleep < 1.0) {
      lockReasons.push({
        code: 'SLEEP_RED',
        headline: 'SLEEP ARCHITECTURE LOCKOUT',
        detail: 'CNS Restoration Incomplete. Rate of Force Development (RFD) will be blunted. ' +
                'Total ' + st.totalSleep.toFixed(1) + 'h / Deep ' + st.deepSleep.toFixed(1) + 'h.'
      });
    }

    if (st.acwr > 1.5) {
      lockReasons.push({
        code: 'ACWR_RED',
        headline: 'EXPONENTIAL INJURY RISK DETECTED',
        detail: 'Acute:Chronic Workload Ratio ' + st.acwr.toFixed(2) + ' — tissue load outpacing adaptation reserve.'
      });
    } else if (st.acwr > 1.3) {
      yellowReasons.push({
        code: 'ACWR_YELLOW',
        headline: 'WORKLOAD CAUTION',
        detail: 'ACWR ' + st.acwr.toFixed(2) + ' — watch tissue accrual.'
      });
    }

    const state = lockReasons.length ? 'RED'
                : yellowReasons.length ? 'YELLOW'
                : 'GREEN';

    return {
      state: state,
      srs: srs,
      lockout: {
        active: lockReasons.length > 0,
        reasons: lockReasons,
        primary: lockReasons[0] || null
      },
      taper: state === 'YELLOW',
      yellowReasons: yellowReasons,
      inputs: st
    };
  }

  // ─── SAVELOG LOCKOUT ENFORCEMENT ─────────────────────────
  //   Block save IF audit === RED AND (intensity > 7 OR 1-RM work)
  function enforceLockout(entry) {
    const audit = auditBiometrics();
    if (!audit.lockout.active) return { block: false, audit: audit };

    const intensity = parseFloat(entry && entry.intensity);
    const highIntensity = isFinite(intensity) && intensity > 7;
    const hasOneRM = entry && Array.isArray(entry.exercises) &&
      entry.exercises.some(function (ex) {
        return /1[\s-]?rm\b/i.test(String(ex || ''));
      });

    const trigger = highIntensity || hasOneRM;
    if (!trigger) return { block: false, audit: audit };

    return {
      block: true,
      audit: audit,
      trigger: highIntensity ? 'INTENSITY>7' : 'ONE_REP_MAX',
      headline: 'SOVEREIGN LOCKOUT',
      reasons: audit.lockout.reasons
    };
  }

  // ─── DASHBOARD UI ────────────────────────────────────────
  function renderDashboardBlock() {
    const host = document.getElementById('cns-engine-block');
    if (!host) return null;
    ensureStyles();
    const audit = auditBiometrics();
    const st = audit.inputs;
    const tier = audit.state;
    const tierColor = tier === 'RED'    ? '#ef4444'
                    : tier === 'YELLOW' ? '#f5c800'
                    :                     '#22c55e';
    const ringColor = tier === 'RED'    ? 'rgba(239,68,68,.55)'
                    : tier === 'YELLOW' ? 'rgba(245,200,0,.55)'
                    :                     'rgba(34,197,94,.45)';

    const srs = audit.srs.score;

    const reasonsHTML = buildReasonsHTML(audit);

    host.style.display = 'block';
    host.innerHTML =
      '<div class="cns-card" data-tier="' + tier + '" style="position:relative;background:linear-gradient(160deg,rgba(18,18,20,.92),rgba(8,8,8,.82));border:1px solid ' + ringColor.replace('.55','.4').replace('.45','.35') + ';border-radius:18px;padding:1.15rem 1.1rem 1.2rem;margin-bottom:1rem;overflow:hidden;backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);box-shadow:0 18px 44px -18px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.04),0 0 28px ' + ringColor.replace('.55','.08').replace('.45','.06') + '">' +
        '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#00e5ff,' + tierColor + ',#6a0dad)"></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">' +
          '<div>' +
            '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.6rem;letter-spacing:3px;color:#00e5ff;font-weight:800">SOVEREIGN NEUROLOGICAL ENGINE</div>' +
            '<div style="font-family:var(--hb,\'Anton\',\'Bebas Neue\');font-size:1.2rem;letter-spacing:1.6px;color:#fff;margin-top:.15rem">SOVEREIGN READINESS</div>' +
            '<div style="font-size:.66rem;letter-spacing:2px;color:' + tierColor + ';font-weight:800;margin-top:.25rem">' + tier + ' · ' + (tier === 'RED' ? 'LOCKOUT ACTIVE' : tier === 'YELLOW' ? 'VOLUME TAPER −20%' : 'CLEARED FOR MAX EFFORT') + '</div>' +
          '</div>' +
          buildGauge(srs, tierColor) +
        '</div>' +
        reasonsHTML +
        buildSliderGrid(st) +
        '<div style="font-size:.58rem;letter-spacing:2px;color:#666;margin-top:.7rem;text-align:center">HRV·SLEEP·ACWR · 79 CLINICAL SOURCES · MOCK WEARABLE FEED</div>' +
      '</div>';

    attachSliderHandlers();
    return audit;
  }

  function buildGauge(score, color) {
    return (
      '<div style="position:relative;width:72px;height:72px;flex-shrink:0">' +
        '<svg viewBox="0 0 72 72" style="width:72px;height:72px;transform:rotate(-90deg)">' +
          '<circle cx="36" cy="36" r="30" fill="none" stroke="#1a1a1a" stroke-width="6"/>' +
          '<circle cx="36" cy="36" r="30" fill="none" stroke="' + color + '" stroke-width="6" stroke-linecap="round" ' +
            'stroke-dasharray="' + (2 * Math.PI * 30).toFixed(2) + '" stroke-dashoffset="' + ((1 - score / 100) * 2 * Math.PI * 30).toFixed(2) + '" style="transition:stroke-dashoffset .6s cubic-bezier(.22,1,.36,1),stroke .4s ease"/>' +
        '</svg>' +
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
          '<div style="font-family:var(--hb,\'Anton\');font-size:1.35rem;color:#fff;line-height:1">' + score + '</div>' +
          '<div style="font-size:.5rem;letter-spacing:1.8px;color:#888;margin-top:1px">SRS</div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildReasonsHTML(audit) {
    const items = audit.lockout.active ? audit.lockout.reasons : audit.yellowReasons;
    if (!items || !items.length) return '';
    const isLock = audit.lockout.active;
    const borderCol = isLock ? 'rgba(239,68,68,.4)' : 'rgba(245,200,0,.4)';
    const accent    = isLock ? '#ef4444' : '#f5c800';
    return (
      '<div style="margin-top:.9rem;border:1px solid ' + borderCol + ';border-radius:12px;overflow:hidden;background:linear-gradient(135deg,rgba(10,10,10,.92),rgba(22,10,10,.82))">' +
        items.map(function (r) {
          return (
            '<div style="display:flex;gap:.7rem;padding:.7rem .85rem;border-bottom:1px solid rgba(255,255,255,.04)">' +
              '<div style="width:3px;background:' + accent + ';border-radius:2px;flex-shrink:0"></div>' +
              '<div>' +
                '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.65rem;letter-spacing:2.2px;color:' + accent + ';font-weight:800">' + escapeHtml(r.headline) + '</div>' +
                '<div style="font-size:.72rem;color:#ddd;margin-top:.2rem;line-height:1.45">' + escapeHtml(r.detail) + '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  function buildSliderGrid(st) {
    const rows = [
      { key: 'hrvDeviation', label: 'HRV DEVIATION', unit: '%',    min: -30, max: 10,  step: 0.5, val: st.hrvDeviation, color: '#00e5ff', fmt: function(v){return (v>=0?'+':'')+v.toFixed(1);} },
      { key: 'totalSleep',   label: 'TOTAL SLEEP',   unit: 'h',    min: 0,   max: 12,  step: 0.1, val: st.totalSleep,   color: '#8b5cf6', fmt: function(v){return v.toFixed(1);} },
      { key: 'deepSleep',    label: 'DEEP SLEEP',    unit: 'h',    min: 0,   max: 3,   step: 0.1, val: st.deepSleep,    color: '#a855f7', fmt: function(v){return v.toFixed(1);} },
      { key: 'acwr',         label: 'ACWR',          unit: '',     min: 0,   max: 2.5, step: 0.05, val: st.acwr,        color: '#f5c800', fmt: function(v){return v.toFixed(2);} }
    ];
    return (
      '<div style="margin-top:.95rem;display:grid;grid-template-columns:1fr;gap:.55rem">' +
        rows.map(function (r) {
          return (
            '<div class="cns-sldr" style="background:rgba(12,12,14,.72);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:.6rem .75rem">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">' +
                '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.58rem;letter-spacing:2.2px;color:#bbb;font-weight:700">' + r.label + '</div>' +
                '<div style="font-family:var(--hb,\'Anton\');font-size:.95rem;color:' + r.color + ';letter-spacing:.5px"><span id="cns-val-' + r.key + '">' + r.fmt(r.val) + '</span><span style="font-size:.6rem;color:#777;margin-left:.2rem">' + r.unit + '</span></div>' +
              '</div>' +
              '<input type="range" class="cns-range" data-cns-key="' + r.key + '" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" value="' + r.val + '" style="width:100%;accent-color:' + r.color + '">' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  function attachSliderHandlers() {
    const inputs = document.querySelectorAll('#cns-engine-block input.cns-range');
    inputs.forEach(function (inp) {
      inp.addEventListener('input', function () {
        const key = inp.getAttribute('data-cns-key');
        const v = parseFloat(inp.value);
        const patch = {}; patch[key] = v;
        writeState(patch);
        renderDashboardBlock();
      });
    });
  }

  // ─── MATTE BLACK / RED LOCKOUT ERROR (SAVELOG hook) ──────
  function renderLockoutError(targetId, enforcement) {
    ensureStyles();
    const reasons = (enforcement && enforcement.reasons) || [];
    const trigger = (enforcement && enforcement.trigger) === 'ONE_REP_MAX'
      ? '1-RM attempt blocked'
      : 'Intensity > 7 blocked';

    const html =
      '<div class="cns-lockout" role="alert" style="margin:.9rem 0 1rem;border-radius:16px;overflow:hidden;' +
        'background:linear-gradient(135deg,rgba(6,6,6,.96) 0%,rgba(28,6,6,.92) 100%);' +
        'border:1px solid rgba(239,68,68,.55);backdrop-filter:blur(14px) saturate(1.2);' +
        '-webkit-backdrop-filter:blur(14px) saturate(1.2);' +
        'box-shadow:0 18px 44px -12px rgba(0,0,0,.9),0 0 28px rgba(239,68,68,.18),inset 0 1px 0 rgba(255,255,255,.04);' +
        'animation:cnsLockPulse 1.6s ease-in-out infinite">' +
        '<div style="padding:1rem 1.1rem .9rem;border-bottom:1px solid rgba(239,68,68,.18);display:flex;align-items:center;gap:.75rem">' +
          '<div style="font-size:1.45rem;line-height:1">&#x26D4;</div>' +
          '<div>' +
            '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.6rem;letter-spacing:3.2px;color:#ef4444;font-weight:800">SOVEREIGN LOCKOUT</div>' +
            '<div style="font-family:var(--hb,\'Anton\',\'Bebas Neue\');font-size:1.15rem;letter-spacing:1.5px;color:#fff;margin-top:.15rem">Physical Clearance REVOKED</div>' +
            '<div style="font-size:.65rem;letter-spacing:1.5px;color:#ef4444;margin-top:.2rem;font-weight:700">' + escapeHtml(trigger) + ' · SRS ' + enforcement.audit.srs.score + '/100</div>' +
          '</div>' +
        '</div>' +
        '<div style="padding:.85rem 1.1rem">' +
          reasons.map(function (r) {
            return (
              '<div style="display:flex;gap:.6rem;padding:.45rem 0">' +
                '<div style="width:3px;background:#ef4444;border-radius:2px;flex-shrink:0"></div>' +
                '<div>' +
                  '<div style="font-family:var(--hb,\'Bebas Neue\');font-size:.62rem;letter-spacing:2.2px;color:#ef4444;font-weight:800">' + escapeHtml(r.headline) + '</div>' +
                  '<div style="font-size:.72rem;color:#ddd;margin-top:.15rem;line-height:1.45">' + escapeHtml(r.detail) + '</div>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
          '<div style="font-size:.64rem;color:#888;margin-top:.6rem;letter-spacing:.5px;line-height:1.5">' +
            'Save blocked until CNS state resolves to GREEN. Log a mobility / Z2 session, or lower intensity &le; 7 and remove 1-RM work.' +
          '</div>' +
        '</div>' +
      '</div>';

    const target = targetId ? document.getElementById(targetId) : null;
    if (target) {
      let slot = document.getElementById('cns-lockout-slot');
      if (!slot) {
        slot = document.createElement('div');
        slot.id = 'cns-lockout-slot';
        target.insertBefore(slot, target.firstChild);
      }
      slot.innerHTML = html;
      slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () {
        const s = document.getElementById('cns-lockout-slot');
        if (s) s.innerHTML = '';
      }, 9000);
    }
    return html;
  }

  // ─── STYLES ──────────────────────────────────────────────
  function ensureStyles() {
    if (document.getElementById('cns-style')) return;
    const s = document.createElement('style');
    s.id = 'cns-style';
    s.textContent =
      '@keyframes cnsLockPulse{' +
        '0%,100%{box-shadow:0 18px 44px -12px rgba(0,0,0,.9),0 0 28px rgba(239,68,68,.18),inset 0 1px 0 rgba(255,255,255,.04);border-color:rgba(239,68,68,.55)}' +
        '50%{box-shadow:0 18px 44px -12px rgba(0,0,0,.9),0 0 46px rgba(239,68,68,.35),inset 0 1px 0 rgba(255,255,255,.04);border-color:rgba(239,68,68,.85)}' +
      '}' +
      '#cns-engine-block input.cns-range{-webkit-appearance:none;appearance:none;height:4px;background:#1a1a1a;border-radius:4px;outline:none;cursor:pointer}' +
      '#cns-engine-block input.cns-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.6),0 0 10px rgba(0,229,255,.4);cursor:pointer}' +
      '#cns-engine-block input.cns-range::-moz-range-thumb{width:16px;height:16px;border:none;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.6),0 0 10px rgba(0,229,255,.4);cursor:pointer}';
    document.head.appendChild(s);
  }

  // ─── HTML SAFETY ─────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ─── BOOT ────────────────────────────────────────────────
  function init() {
    ensureStyles();
    renderDashboardBlock();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 0);
    }
  }

  return {
    // core matrix
    calculateSRS:     calculateSRS,
    auditBiometrics:  auditBiometrics,
    enforceLockout:   enforceLockout,
    // state
    readState:        readState,
    writeState:       writeState,
    // ui
    renderDashboardBlock: renderDashboardBlock,
    renderLockoutError:   renderLockoutError,
    init:             init
  };
})();

if (typeof window !== 'undefined') window.CNS_ENGINE = CNS_ENGINE;
if (typeof module !== 'undefined' && module.exports) module.exports = CNS_ENGINE;
