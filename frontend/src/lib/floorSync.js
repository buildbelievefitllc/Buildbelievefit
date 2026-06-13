// src/lib/floorSync.js
// ─────────────────────────────────────────────────────────────────────────────
// Floor sync engine — the ONLY module that talks to Supabase for the Active
// Workout Logger. The React component never queries the network; it binds to the
// Dexie cache (useLiveQuery) while this engine:
//
//   1) HYDRATES the cache from the cloud on session open (prescribed routine +
//      cross-device last weights), idempotently.
//   2) Accepts OPTIMISTIC writes — a tapped set lands in Dexie instantly and the
//      day is marked dirty in the sync queue.
//   3) FLUSHES the queue to the durable RPC bbf_sync_vault_session whenever the
//      network is stable (immediately if online, else on the next 'online' event).
//
// Reuses the EXISTING contracts — fetchLastWeights + bbf_sync_vault_session — so
// no new backend surface is introduced; the cloud record stays identical to the
// legacy logger's, which is the convergence point for both surfaces.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';
import { fetchLastWeights, dayKeyFor, exKey } from '../components/vault/programApi.js';
import { floorDb, prescriptionId, setId } from './floorDb.js';

function numOrNull(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// "135 lb" → 135 · "Bodyweight" → null. The numeric load the input pre-fills with.
function loadToNumber(raw) {
  const m = String(raw ?? '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Map a plan day's exercises → prescription rows (the predictive pre-fill). Pure.
export function buildPrescription(uid, dayIdx, day) {
  const dayKey = dayKeyFor(dayIdx);
  const exercises = (day && Array.isArray(day.exercises) ? day.exercises : []).filter((e) => e && e.name);
  return exercises.map((ex, i) => ({
    id: prescriptionId(uid, dayKey, i),
    uid,
    dayKey,
    dayIdx,
    exIdx: i,
    exKey: exKey(i),
    name: String(ex.name || ''),
    equipment: String(ex.equipment || ''),
    setCount: Number(ex.sets) > 0 ? Number(ex.sets) : 1,
    targetReps: String(ex.reps ?? '').trim(),
    targetWeight: loadToNumber(ex.weight ?? ex.target_weight ?? ex.targetWeight ?? ex.load),
    lastWeight: null,
  }));
}

// HYDRATE — seed the prescription for a day (idempotent put) and fold in the
// cross-device last weights. NEVER touches logged `sets`, so re-hydrating mid-
// session can't wipe what the athlete just tapped in. Last-weights fetch is
// best-effort (offline → keep whatever's cached).
export async function hydrateFloor({ uid, dayIdx, day }) {
  const slug = String(uid || '').trim().toLowerCase();
  if (!slug || dayIdx == null || dayIdx < 0) return;
  const rows = buildPrescription(slug, dayIdx, day);
  if (!rows.length) return;

  let lastMap = {};
  try {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      lastMap = await fetchLastWeights(slug, dayIdx);
    }
  } catch {
    /* offline / RPC error — fall back to whatever is already cached */
  }
  const merged = rows.map((r) => {
    const last = numOrNull(lastMap?.[r.exKey]);
    return { ...r, lastWeight: last ?? r.lastWeight ?? null };
  });
  await floorDb.prescription.bulkPut(merged);
}

// OPTIMISTIC set write — lands in Dexie instantly, marks the day dirty, then
// fires a (best-effort) flush. `done` flips the completed state.
export async function logSet({ uid, dayIdx, exIdx, setNumber, reps, weightLbs, done = true }) {
  const slug = String(uid || '').trim().toLowerCase();
  const dayKey = dayKeyFor(dayIdx);
  await floorDb.sets.put({
    id: setId(slug, dayKey, exIdx, setNumber),
    uid: slug,
    dayKey,
    dayIdx,
    exIdx,
    exKey: exKey(exIdx),
    setNumber,
    reps: numOrNull(reps),
    weightLbs: numOrNull(weightLbs),
    done: !!done,
    updatedAt: Date.now(),
  });
  await markDirty(slug, dayKey);
  flushQueue().catch(() => { /* stays queued for the next online flush */ });
}

async function markDirty(uid, dayKey) {
  await floorDb.syncQueue.put({ dayKey, uid, synced: 0, updatedAt: Date.now() });
}

// FLUSH — drain dirty days to the durable RPC. Each dirty day reads its `done`
// sets from Dexie, builds the bbf_sync_vault_session payload, and on success
// marks the queue row synced. Offline / missing-token / RPC error → left queued.
let flushing = false;
export async function flushQueue() {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const token = getStoredVaultToken();
  if (!token) return; // no session — keep queued; a fresh login will flush.

  flushing = true;
  try {
    const dirty = await floorDb.syncQueue.where('synced').equals(0).toArray();
    for (const row of dirty) {
      const ok = await flushDay(row.uid, row.dayKey, token);
      if (ok) await floorDb.syncQueue.update(row.dayKey, { synced: 1, updatedAt: Date.now() });
    }
  } finally {
    flushing = false;
  }
}

async function flushDay(uid, dayKey, token) {
  const sets = await floorDb.sets.where('[uid+dayKey]').equals([uid, dayKey]).toArray();
  const rows = sets
    .filter((s) => s.done && (s.reps != null || s.weightLbs != null))
    .sort((a, b) => (a.exIdx - b.exIdx) || (a.setNumber - b.setNumber))
    .map((s) => ({
      day_key: dayKey,
      exercise_key: s.exKey,
      set_number: s.setNumber,
      reps: s.reps,
      weight_lbs: s.weightLbs,
    }));
  if (!rows.length) return true; // nothing to push → consider the day clean

  const dayIdx = sets[0]?.dayIdx ?? 0;
  try {
    const { data, error } = await supabase.rpc('bbf_sync_vault_session', {
      p_uid: uid,
      p_session_token: token,
      p_session: { date: new Date().toISOString().slice(0, 10), day_key: dayKey, day_idx: dayIdx },
      p_sets: rows,
    });
    if (error || !data?.ok) return false; // keep queued; retry on next online
    return true;
  } catch {
    return false;
  }
}

// Register the reconnect flush ONCE. The Floor logger calls this on mount; the
// listener then drains the queue every time the device regains the network.
let wired = false;
export function ensureFloorSyncWired() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('online', () => { flushQueue().catch(() => {}); });
}
