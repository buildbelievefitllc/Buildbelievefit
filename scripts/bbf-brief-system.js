#!/usr/bin/env node
/**
 * scripts/bbf-brief-system.js
 * ---------------------------------------------------------------------------
 * BBF Brief System — two-phase client-brief engine (deterministic, no network).
 *
 *  PHASE 1 — METRIC VERIFICATION
 *   1. CNS missing            → baseline from 3-week trailing avg (history) → PARTIAL_BIO
 *   2. Sleep/Stress missing   → assume 50 → ASSUMED
 *   3. Load >40% over the client's 3-week avg volume → SPIKE_WARNING
 *   4. Friction points        → mobility | stability | strength | recovery
 *                               (unmapped → suggested category, FRICTION_UNMAPPED)
 *
 *  PHASE 2 — SCENARIO TABLING
 *   Bucket each metric, compose [LANG]_[CNS]_[SLEEP]_[STRESS]_[LOAD]_[PREHAB]
 *   (each numeric token = the bucket's UPPER bound, e.g. CNS 55 ∈ 41–60 → "60";
 *    top load bucket → "151_plus"), map to a pre-rendered vault brief reference.
 *
 *  OUTPUT: strict JSON array (Gemini-Spark ready).
 *
 *  Usage:
 *    node scripts/bbf-brief-system.js [input.json] [-o output.json]
 *    cat clients.json | node scripts/bbf-brief-system.js -      (stdin)
 *    (default input: scripts/bbf-brief-canary.json)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VALID_LANGS = ['EN', 'ES', 'PT'];

// Brief script library (scenario_id → pre-written brief). Lets the matrix report
// which scenarios already have a vault brief (RESOLVED) vs need authoring.
function loadBriefLibrary() {
  try {
    const f = path.resolve(__dirname, 'bbf-brief-scripts.json');
    if (!fs.existsSync(f)) return new Map();
    const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
    return new Map((Array.isArray(arr) ? arr : []).map((x) => [x.scenario_id, x]));
  } catch { return new Map(); }
}
const BRIEF_LIBRARY = loadBriefLibrary();
const SPIKE_THRESHOLD = 1.4; // >40% over the trailing average
const ASSUMED_DEFAULT = 50;
const CNS_BASELINE_FALLBACK = 50; // when CNS is missing AND no usable history

// ── helpers ──────────────────────────────────────────────────────────────────
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const volume = (pl) => (pl && isNum(pl.reps) && isNum(pl.sets) && isNum(pl.weight_lbs) ? pl.reps * pl.sets * pl.weight_lbs : 0);

// Bucket → upper-bound token (matches the spec example EN_60_70_40_100_mobility).
function cnsToken(v) { return v <= 40 ? '40' : v <= 60 ? '60' : v <= 80 ? '80' : '100'; }
function triToken(v) { return v <= 40 ? '40' : v <= 70 ? '70' : '100'; } // sleep & stress share ranges
function loadToken(weight) { return weight <= 50 ? '50' : weight <= 100 ? '100' : weight <= 150 ? '150' : '151_plus'; }

// Friction keyword → canonical category.
const FRICTION_RULES = [
  { cat: 'mobility', re: /mobil|stiff|tight|\brom\b|range of motion|flexib|ankle|thoracic|hip flex|locked|cramp/i },
  { cat: 'stability', re: /stabil|balance|wobble|valgus|control|anti-?rotat|single[\s-]?leg|core|proprio|shaky/i },
  { cat: 'strength', re: /strength|weak|plateau|1rm|force|power|stall|grip|fail(ed|ing)?/i },
  { cat: 'recovery', re: /recover|sore|doms|fatigue|tired|burnout|overtrain|sleep|stress|drained|wiped/i },
];
function mapFriction(points) {
  const tally = {}; let mapped = 0;
  for (const p of (points || [])) {
    const hit = FRICTION_RULES.find((r) => r.re.test(String(p)));
    if (hit) { tally[hit.cat] = (tally[hit.cat] || 0) + 1; mapped++; }
  }
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return { primary: ranked.length ? ranked[0][0] : null, allMapped: mapped === (points || []).length && (points || []).length > 0, tally };
}
// Best-guess suggestion when nothing mapped cleanly.
function suggestFriction(points, prehabZone) {
  const blob = `${(points || []).join(' ')} ${prehabZone || ''}`;
  for (const r of FRICTION_RULES) if (r.re.test(blob)) return r.cat;
  // zone-based fallback: joints lean mobility, spine/core lean stability.
  if (/knee|ankle|hip|shoulder|wrist|elbow|neck/i.test(blob)) return 'mobility';
  if (/spine|core|back|pelvis/i.test(blob)) return 'stability';
  return 'recovery';
}

// 3-week (21-day) trailing averages from optional client.history.
function trailing(client) {
  const hist = Array.isArray(client.history) ? client.history : [];
  const ref = client.date ? Date.parse(client.date) : Date.now();
  const windowMs = 21 * 24 * 60 * 60 * 1000;
  const recent = hist.filter((h) => {
    const t = h && h.date ? Date.parse(h.date) : NaN;
    return Number.isFinite(t) && ref - t >= 0 && ref - t <= windowMs;
  });
  const cnsVals = recent.map((h) => h.cns_score).filter(isNum);
  const volVals = recent.map((h) => volume(h.program_load)).filter((v) => v > 0);
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return { cnsAvg: avg(cnsVals), volAvg: avg(volVals), samples: recent.length };
}

// ── 30-DAY ONBOARDING PARAMETER ───────────────────────────────────────────────
// Brand-new clients run a 30-day window (Foundation → Calibration → Momentum →
// Graduation-approach → Day-30 GRADUATION). We compute where the client sits so
// the brief routes them through the onboarding track while the metrics calculate.
const PROGRAM_WINDOW_DAYS = 30;
function computeOnboarding(client) {
  const start = client.start_date || client.enrollment_date || client.onboard_date || client.join_date;
  const startMs = start ? Date.parse(start) : NaN;
  const refMs = client && client.date ? Date.parse(client.date) : Date.now();
  if (!Number.isFinite(startMs)) {
    return { status: 'ONBOARDING_UNKNOWN', is_new_client: null, program_day: null, window_days: PROGRAM_WINDOW_DAYS, days_remaining: null, phase: 'UNKNOWN', completion_pct: null, milestone: null, note: 'No start_date — onboarding position not computable.' };
  }
  const programDay = Math.floor((refMs - startMs) / 86400000) + 1; // start day = day 1
  let phase;
  if (programDay < 1) phase = 'PRE_START';
  else if (programDay <= 7) phase = 'FOUNDATION';
  else if (programDay <= 14) phase = 'CALIBRATION';
  else if (programDay <= 21) phase = 'MOMENTUM';
  else if (programDay <= 29) phase = 'GRADUATION_APPROACH';
  else if (programDay === 30) phase = 'GRADUATION';
  else phase = 'ESTABLISHED';
  let milestone = null;
  if (programDay === 7) milestone = 'WEEK_1';
  else if (programDay === 14) milestone = 'WEEK_2';
  else if (programDay === 21) milestone = 'WEEK_3';
  else if (programDay === 30) milestone = 'GRADUATION';
  const isNew = programDay >= 1 && programDay <= PROGRAM_WINDOW_DAYS;
  return {
    status: 'TRACKED',
    is_new_client: isNew,
    program_day: programDay,
    window_days: PROGRAM_WINDOW_DAYS,
    days_remaining: Math.max(0, PROGRAM_WINDOW_DAYS - programDay),
    phase,
    completion_pct: Math.round(clamp(programDay / PROGRAM_WINDOW_DAYS, 0, 1) * 100),
    milestone,
  };
}

// ── PHASE 1 ──────────────────────────────────────────────────────────────────
function verify(client) {
  const flags = [];
  const notes = [];

  // Hard-fail gate: identity + language must be valid.
  const clientId = client && typeof client.client_id === 'string' && client.client_id.trim() ? client.client_id.trim() : null;
  const lang = String(client && client.language_preference || '').toUpperCase();
  if (!clientId) { return { status: 'FAIL', flags: ['MISSING_CLIENT_ID'], notes: ['No client_id — cannot brief.'], resolved: null }; }
  if (!VALID_LANGS.includes(lang)) { return { status: 'FAIL', flags: ['INVALID_LANGUAGE'], notes: [`language_preference "${client.language_preference}" not in EN|ES|PT.`], resolved: null }; }

  const tr = trailing(client);

  // Rule 1 — CNS.
  let cns = client.cns_score;
  if (!isNum(cns)) {
    if (isNum(tr.cnsAvg)) { cns = Math.round(tr.cnsAvg); notes.push(`CNS missing → baseline ${cns} from ${tr.samples}-sample 3-week trailing avg.`); }
    else { cns = CNS_BASELINE_FALLBACK; notes.push(`CNS missing and no usable history → neutral baseline ${cns}.`); }
    flags.push('PARTIAL_BIO');
  }
  cns = clamp(cns, 0, 100);

  // Rule 2 — Sleep / Stress.
  let sleep = client.sleep_quality;
  let stress = client.stress_level;
  if (!isNum(sleep)) { sleep = ASSUMED_DEFAULT; flags.push('ASSUMED'); notes.push('sleep_quality missing → assumed 50.'); }
  if (!isNum(stress)) { stress = ASSUMED_DEFAULT; if (!flags.includes('ASSUMED')) flags.push('ASSUMED'); notes.push('stress_level missing → assumed 50.'); }
  sleep = clamp(sleep, 0, 100); stress = clamp(stress, 0, 100);

  // Rule 3 — Load spike (volume vs trailing avg).
  const vol = volume(client.program_load);
  let spike = false;
  if (vol > 0 && isNum(tr.volAvg) && tr.volAvg > 0) {
    if (vol > tr.volAvg * SPIKE_THRESHOLD) {
      spike = true; flags.push('SPIKE_WARNING');
      notes.push(`Session volume ${vol} is ${Math.round((vol / tr.volAvg - 1) * 100)}% over the 3-week avg (${Math.round(tr.volAvg)}).`);
    }
  } else if (vol > 0) {
    notes.push('Load present but no trailing history → spike not assessable.');
  }

  // Rule 4 — Friction mapping.
  const fr = mapFriction(client.friction_points);
  let frictionCategory = fr.primary;
  let suggested = null;
  if (!fr.primary || !fr.allMapped) {
    suggested = suggestFriction(client.friction_points, client.prehab_zone);
    if (!fr.primary) { frictionCategory = suggested; flags.push('FRICTION_UNMAPPED'); notes.push(`Friction unmapped → suggested "${suggested}".`); }
    else { notes.push(`Some friction points unmapped → primary "${fr.primary}", suggested fill "${suggested}".`); }
  }

  const status = flags.length ? 'PARTIAL' : 'PASS';
  return {
    status,
    flags,
    notes,
    resolved: {
      cns_score: cns,
      sleep_quality: sleep,
      stress_level: stress,
      session_volume: vol,
      trailing_volume_avg: isNum(tr.volAvg) ? Math.round(tr.volAvg) : null,
      load_lbs: client.program_load && isNum(client.program_load.weight_lbs) ? client.program_load.weight_lbs : 0,
      friction_category: frictionCategory,
      friction_suggested: suggested,
      spike,
    },
  };
}

// ── PHASE 2 ──────────────────────────────────────────────────────────────────
function table(client, v1, ob) {
  const r = v1.resolved;
  const lang = String(client.language_preference).toUpperCase();
  const prehab = r.friction_category || 'general';
  const scenarioId = [lang, cnsToken(r.cns_score), triToken(r.sleep_quality), triToken(r.stress_level), loadToken(r.load_lbs), prehab].join('_');
  // New clients (within the 30-day window) route onto the onboarding track; their
  // vault pointer is namespaced by program day + phase. Everyone else is standard.
  const newClient = !!(ob && ob.is_new_client === true);
  const briefTrack = newClient ? '30_day_onboarding' : 'standard';
  const briefRef = newClient
    ? `vault://briefs/onboarding/D${ob.program_day}_${ob.phase}/${scenarioId}`
    : `vault://briefs/${scenarioId}`;
  // Customize when the bio wasn't a clean PASS, OR the client is still onboarding.
  const customizationRequired = v1.status !== 'PASS' || newClient;
  // Resolve against the brief vault — RESOLVED if a script exists for this
  // scenario_id, else NEEDS_AUTHORING (squad authors/renders it next).
  const briefAvailable = BRIEF_LIBRARY.has(scenarioId);
  return {
    scenario_id: scenarioId,
    measurement_matrix_entry: {
      brief_script_reference: briefRef,
      brief_track: briefTrack,
      brief_available: briefAvailable,
      brief_status: briefAvailable ? 'RESOLVED' : 'NEEDS_AUTHORING',
      customization_required: customizationRequired,
    },
  };
}

// ── EXECUTION ────────────────────────────────────────────────────────────────
function run(clients, stampISO) {
  return clients.map((client) => {
    const v1 = verify(client);
    const ob = computeOnboarding(client);
    const base = {
      execution_timestamp: stampISO,
      client_id: (client && client.client_id) || null,
      language: String(client && client.language_preference || '').toUpperCase() || null,
      onboarding_parameter: ob,
      phase_1_verification: { status: v1.status, flags: v1.flags, notes: v1.notes, resolved: v1.resolved },
    };
    if (v1.status === 'FAIL') return { ...base, phase_2_tabling: null };
    return { ...base, phase_2_tabling: table(client, v1, ob) };
  });
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  let outFile = null;
  const oIdx = args.indexOf('-o');
  if (oIdx >= 0) { outFile = args[oIdx + 1]; args.splice(oIdx, 2); }
  const inArg = args[0];

  let rawText;
  if (inArg === '-' || (!inArg && !process.stdin.isTTY && false)) {
    rawText = fs.readFileSync(0, 'utf8');
  } else {
    const inFile = inArg || path.resolve(__dirname, 'bbf-brief-canary.json');
    if (!fs.existsSync(inFile)) { console.error(`FATAL: input not found: ${inFile}`); process.exit(1); }
    rawText = fs.readFileSync(inFile, 'utf8');
  }

  let payload;
  try { payload = JSON.parse(rawText); } catch (e) { console.error('FATAL: invalid JSON input:', e.message); process.exit(1); }
  const clients = Array.isArray(payload) ? payload : (payload.clients || []);
  if (!Array.isArray(clients)) { console.error('FATAL: expected a client array.'); process.exit(1); }

  const out = run(clients, new Date().toISOString());
  const json = JSON.stringify(out, null, 2);
  if (outFile) { fs.writeFileSync(outFile, json + '\n'); console.error(`Wrote ${out.length} records → ${outFile}`); }
  process.stdout.write(json + '\n');
}

if (require.main === module) main();
module.exports = { run, verify, table, cnsToken, triToken, loadToken, mapFriction };
