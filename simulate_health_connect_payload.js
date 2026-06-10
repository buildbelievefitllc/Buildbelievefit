#!/usr/bin/env node
// simulate_health_connect_payload.js — Health Connect push simulator (stress test)
// ─────────────────────────────────────────────────────────────────────────────
// Mimics the Android wrapper reading local Google Health Connect data and
// pushing it to the bbf-health-sync edge function. Default payload carries
// deliberately COMPROMISED CNS stats (HRV < 35ms · sleep < 240min) to trigger
// the bbf-agentic-peaking Agent Override; pass --healthy for a green-CNS
// control run. After ingesting, it fires bbf-agentic-peaking for the same
// athlete to verify the override end-to-end.
//
// Usage:
//   BBF_UID=<athlete uuid> BBF_INGEST_TOKEN=<vault secret> \
//   SUPABASE_ANON_KEY=<anon key> node simulate_health_connect_payload.js [--healthy] [--skip-peaking]
//
// Env:
//   SUPABASE_URL       (default: https://ihclbceghxpuawymlvgi.supabase.co)
//   BBF_UID            athlete UUID (admin/webhook path)  — or —
//   BBF_SESSION_TOKEN  vault session token (athlete path)
//   BBF_INGEST_TOKEN   X-BBF-Admin-Token (Vault `wearable_ingest_token`), admin path only
//   SUPABASE_ANON_KEY  sent as apikey/Bearer for the functions gateway
//   BBF_DATE           override reading date (YYYY-MM-DD, default: today UTC)
//
// Node 18+ (global fetch). No dependencies.

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const INGEST_TOKEN = process.env.BBF_INGEST_TOKEN || '';
const UID = process.env.BBF_UID || '';
const SESSION_TOKEN = process.env.BBF_SESSION_TOKEN || '';

const HEALTHY = process.argv.includes('--healthy');
const SKIP_PEAKING = process.argv.includes('--skip-peaking');
const DATE = process.env.BBF_DATE || new Date().toISOString().slice(0, 10);

const jitter = (base, spread) => Math.round((base + (Math.random() * 2 - 1) * spread) * 10) / 10;

// ── Build the simulated Health Connect record dump ───────────────────────────
// Raw record shape (the edge function aggregates), exactly what the Android
// bridge will emit once it reads HeartRateVariabilityRmssdRecord /
// RestingHeartRateRecord / SleepSessionRecord from the on-device store.
function buildPayload() {
  if (HEALTHY) {
    // Control: green CNS — should NOT trip the Agent Override.
    return {
      date: DATE,
      recorded_at: new Date().toISOString(),
      records: {
        HeartRateVariabilityRmssd: [
          { heartRateVariabilityMillis: jitter(68, 4), time: `${DATE}T05:58:00Z` },
          { heartRateVariabilityMillis: jitter(72, 4), time: `${DATE}T06:28:00Z` },
        ],
        RestingHeartRate: [{ beatsPerMinute: 52 }],
        SleepSession: [{ startTime: `${DATE}T00:10:00Z`, endTime: `${DATE}T07:55:00Z` }], // 465 min
      },
    };
  }
  // Stress test: fried CNS — HRV ~28ms (< 35 floor), sleep 215 min (< 240 floor),
  // elevated resting HR. MUST trip the Agent Override.
  return {
    date: DATE,
    recorded_at: new Date().toISOString(),
    records: {
      HeartRateVariabilityRmssd: [
        { heartRateVariabilityMillis: jitter(27, 2), time: `${DATE}T05:58:00Z` },
        { heartRateVariabilityMillis: jitter(29, 2), time: `${DATE}T06:28:00Z` },
      ],
      RestingHeartRate: [{ beatsPerMinute: 72 }, { beatsPerMinute: 74 }],
      SleepSession: [
        { startTime: `${DATE}T01:40:00Z`, endTime: `${DATE}T04:10:00Z` }, // 150 min
        { startTime: `${DATE}T04:45:00Z`, endTime: `${DATE}T05:50:00Z` }, //  65 min
      ],
    },
  };
}

function gatewayHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (ANON_KEY) {
    h['apikey'] = ANON_KEY;
    h['Authorization'] = `Bearer ${ANON_KEY}`;
  }
  return h;
}

async function post(path, body, extraHeaders = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...gatewayHeaders(), ...extraHeaders },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON error body */ }
  return { status: res.status, json };
}

async function main() {
  if (!UID && !SESSION_TOKEN) {
    console.error('✗ Set BBF_UID (+ BBF_INGEST_TOKEN) or BBF_SESSION_TOKEN. Aborting.');
    process.exit(1);
  }

  const payload = buildPayload();
  const envelope = SESSION_TOKEN
    ? { session_token: SESSION_TOKEN, payload }
    : { uid: UID, payload };
  const headers = SESSION_TOKEN ? {} : { 'X-BBF-Admin-Token': INGEST_TOKEN };

  console.log(`── BBF Health Connect Simulator ── mode=${HEALTHY ? 'HEALTHY (control)' : 'COMPROMISED CNS (stress test)'}`);
  console.log(`   target: ${SUPABASE_URL}/functions/v1/bbf-health-sync · date=${DATE}`);
  console.log('   payload:', JSON.stringify(payload, null, 2));

  // ── 1. Push the simulated Health Connect payload ──
  const sync = await post('bbf-health-sync', envelope, headers);
  console.log(`\n[1] bbf-health-sync → HTTP ${sync.status}`);
  console.log(JSON.stringify(sync.json, null, 2));
  if (sync.status !== 200 || !sync.json?.ok) {
    console.error('✗ Ingestion failed — fix forward before testing the override.');
    process.exit(1);
  }
  const flags = sync.json.cns_flags || {};
  console.log(`    CNS compromised: ${flags.compromised} ${flags.triggers?.length ? `(${flags.triggers.join(' · ')})` : ''}`);

  if (SKIP_PEAKING) return;
  if (!UID) {
    console.log('\n[2] bbf-agentic-peaking skipped (needs BBF_UID).');
    return;
  }

  // ── 2. Fire the peaking engine — verify the Agent Override ──
  const peaking = await post('bbf-agentic-peaking', {
    uid: UID,
    scheduled_focus: 'Heavy Lower — Squat Day',
    scheduled_lifts: ['Barbell Back Squat', 'Romanian Deadlift', 'Walking Lunges'],
  });
  console.log(`\n[2] bbf-agentic-peaking → HTTP ${peaking.status}`);
  console.log(JSON.stringify(peaking.json, null, 2));

  const overrode = !!peaking.json?.override_active;
  if (!HEALTHY && !overrode) {
    console.error('\n✗ STRESS TEST FAILED — compromised CNS did NOT trigger the Agent Override.');
    process.exit(1);
  }
  if (HEALTHY && overrode) {
    console.error('\n✗ CONTROL FAILED — healthy CNS incorrectly triggered the Agent Override.');
    process.exit(1);
  }
  console.log(`\n✓ ${HEALTHY ? 'Control passed — no false intercept.' : 'Stress test passed — Agent Override engaged.'}`);
}

main().catch((e) => {
  console.error('✗ Simulator crashed:', e);
  process.exit(1);
});
