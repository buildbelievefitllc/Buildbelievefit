// src/lib/floorDb.js
// ─────────────────────────────────────────────────────────────────────────────
// Local-First floor cache (Dexie / IndexedDB) — the gym is a network dead zone,
// so the Active Workout Logger reads/writes IndexedDB exclusively and a
// background queue reconciles to Supabase whenever the network returns.
//
// LIGHTWEIGHT + ACTIVE-SESSION SCOPED (guardrail): three tiny tables, no history
// store. The cloud (bbf_sets via bbf_sync_vault_session) remains the durable
// record; this DB is the offline working set + an outbound sync queue.
//
//   prescription   — the predictive routine per exercise slot for a day: target
//                    reps/weight + the cross-device last working weight. Seeded by
//                    hydrateFloor() from the assigned plan + bbf_get_last_weights.
//   sets           — the athlete's logged sets (optimistic; written instantly on
//                    tap). The UI binds to THIS via useLiveQuery.
//   syncQueue      — dirty (uid, dayKey) markers awaiting a cloud flush.
//   manualBaseline — (v2) the athlete's Manual Health Input for a calendar day:
//                    subjective sleep/stress + a recovery-shaped snapshot in the
//                    EXACT structure the Health Connect bridge emits, so the
//                    readiness engine scores it with equal validity. One row per
//                    (uid, date); see manualBaseline.js.
//
// Keys are deterministic composite strings so re-hydration is idempotent (put,
// never duplicate). Compound [uid+dayKey] indexes drive the live queries.

import Dexie from 'dexie';

export const floorDb = new Dexie('bbf_floor_v1');

floorDb.version(1).stores({
  prescription: '&id, [uid+dayKey], exIdx',
  sets: '&id, [uid+dayKey], exKey',
  syncQueue: '&dayKey, [uid+dayKey], synced, updatedAt',
});

// v2 — additive upgrade: the three v1 stores are unchanged (Dexie preserves their
// data); `manualBaseline` is the only new table. Bumping the version, never
// mutating v1, is the safe upgrade path for athletes carrying a populated cache.
floorDb.version(2).stores({
  prescription: '&id, [uid+dayKey], exIdx',
  sets: '&id, [uid+dayKey], exKey',
  syncQueue: '&dayKey, [uid+dayKey], synced, updatedAt',
  manualBaseline: '&id, [uid+date], uid, date, updatedAt',
});

// Deterministic composite keys — same inputs always resolve the same row.
export function prescriptionId(uid, dayKey, exIdx) {
  return `${uid}|${dayKey}|ex_${exIdx}`;
}
export function setId(uid, dayKey, exIdx, setNumber) {
  return `${uid}|${dayKey}|ex_${exIdx}|set_${setNumber}`;
}
// Manual baseline row key — one per athlete per calendar day (idempotent put).
export function manualBaselineId(uid, date) {
  return `${uid}|${date}`;
}
