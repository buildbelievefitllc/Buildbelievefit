// src/lib/forgeAthleteApi.js
// ─────────────────────────────────────────────────────────────────────────────
// THE HARDWIRE GATEWAY — client side of bbf_admin_forge_athlete.
//
// forgeAthlete(payload) executes the atomic master INSERT (credentials +
// bbf_users + bbf_active_clients + youth athlete_profiles in ONE transaction —
// any failure rolls the whole cascade back server-side; zero orphans).
//
// applyBiomechExclusions(protocol, limitations) is the clinical injection:
// it filters the deterministic buildSportsProtocol() output against a
// conservative joint→movement contraindication map, records exactly what was
// stripped on the protocol (`contraindications`), and carries the raw clinical
// arrays (`injury_history` / `joint_limitations` / `surgeries`) so every
// downstream engine + the coach can see WHY a movement is absent.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Conservative movement-exclusion keywords per joint complex. Matching is on
// the exercise NAME (lowercased substring), mirroring the allergen safety net's
// doctrine: when a flagged joint is limited, a matching movement never enters
// the forged protocol.
const JOINT_EXCLUSIONS = {
  knee: ['depth jump', 'box jump', 'jump', 'bound', 'plyo', 'lunge', 'cutting', 'change of direction'],
  shoulder: ['overhead', 'snatch', 'jerk', 'push press', 'handstand'],
  'lower back': ['deadlift', 'good morning', 'hyperextension', 'clean'],
  spine: ['deadlift', 'good morning', 'hyperextension', 'clean'],
  ankle: ['bound', 'hop', 'depth jump', 'sprint start'],
  hip: ['sprint', 'deep squat', 'bound'],
  elbow: ['heavy press', 'dip'],
  wrist: ['handstand', 'front rack'],
};

const norm = (s) => String(s || '').trim().toLowerCase();

// Resolve a free-text limitation ("bad knee", "Left Knee — meniscus") to its
// joint key by substring — freeform stays supported, the filter still fires.
function jointKeyFor(limitation) {
  const l = norm(limitation);
  return Object.keys(JOINT_EXCLUSIONS).find((k) => l.includes(k)) || null;
}

export function applyBiomechExclusions(protocol, { injuries = [], joint_limitations = [], surgeries = [] } = {}) {
  if (!protocol || !Array.isArray(protocol.blocks)) return protocol;
  const keys = [...new Set([...joint_limitations, ...injuries].map(jointKeyFor).filter(Boolean))];
  const banned = keys.flatMap((k) => JOINT_EXCLUSIONS[k]);
  const stripped = [];

  const blocks = protocol.blocks
    .map((b) => ({
      ...b,
      items: (b.items || []).filter((it) => {
        const hit = banned.some((kw) => norm(it.name).includes(kw));
        if (hit) stripped.push(it.name);
        return !hit;
      }),
    }))
    .filter((b) => b.items.length > 0);

  return {
    ...protocol,
    blocks,
    // Clinical record — first-class on the protocol so the Referee, the
    // Manual Override deck, and every future engine see the constraint set.
    injury_history: injuries,
    joint_limitations,
    surgeries,
    contraindications: stripped,
    summary: stripped.length
      ? `${protocol.summary} Clinical exclusions applied (${keys.join(', ')}): ${stripped.length} movement${stripped.length === 1 ? '' : 's'} stripped.`
      : protocol.summary,
  };
}

export async function forgeAthlete(payload) {
  const token = getStoredVaultToken();
  if (!token) { const e = new Error('no_session'); e.code = 'no_session'; throw e; }
  const { data, error } = await supabase.rpc('bbf_admin_forge_athlete', {
    p_session_token: token,
    p_payload: payload,
  });
  if (error) {
    // The RPC raises (full-rollback semantics) — the slug rides error.message.
    const slug = (String(error.message || '').match(/not_authorized|missing_name|invalid_typology|invalid_age|youth_requires_age|invalid_tdee|invalid_email|email_taken/) || [])[0];
    const e = new Error(slug || error.message || 'forge_failed');
    e.code = slug || 'rpc_error';
    throw e;
  }
  if (!data?.ok) { const e = new Error(data?.error || 'forge_failed'); e.code = data?.error || 'forge_failed'; throw e; }
  return data; // { ok, credentials:{uid,pin}, client:{…roster row} }
}

export function forgeErrorMessage(e) {
  const map = {
    no_session: 'No admin session — sign in to the Command Center.',
    not_authorized: 'The Hardwire Gateway is restricted to the administrative tier.',
    missing_name: 'A name is required to forge an athlete.',
    invalid_typology: 'Pick a typology — Youth Athlete or General Client.',
    invalid_age: 'Age must be between 5 and 100.',
    youth_requires_age: 'A Youth Athlete profile requires an age (drives the phase bands).',
    invalid_tdee: 'The caloric target is out of range.',
    invalid_email: 'That email address is not valid.',
    email_taken: 'An account already exists for that email.',
  };
  if (map[e?.code]) return map[e.code];
  if (/fetch|network/i.test(String(e?.message || ''))) return 'Network unreachable — check your connection and retry.';
  return e?.message || 'The forge failed — nothing was written (full rollback).';
}
