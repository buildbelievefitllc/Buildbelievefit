// src/lib/cardioApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 22 — Smart Cardio data layer (the athlete's OWN cardio surface).
//
// Restores the legacy Phase 10 Smart Cardio engine with a PERSISTENT backend.
// Mirrors vaultApi.js conventions and the Phase 21.1 vault-token auth model:
// reads/writes go through SECURITY DEFINER RPCs that validate the vault_token
// (bbf_vault_sessions) — there is no GoTrue session, so the token IS the
// per-user boundary. A user can only ever touch rows for the user_id their live
// token resolves to.
//
//   READ : bbf_get_cardio(p_session_token, p_log_limit) → { ok, protocols[], logs[] }
//   WRITE: bbf_log_cardio(p_session_token, p_log)        → { ok, log_id }
//
// Isolated from T2's Program grid: this module touches only cardio RPCs/tables.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

export const CARDIO_ZONES = {
  hiit: { label: 'HIIT', blurb: '< 20 min · max-effort intervals', accent: '#FF4500' },
  tempo: { label: 'Tempo', blurb: '20–35 min · sustained threshold', accent: '#F59E0B' },
  zone2: { label: 'Zone 2', blurb: '> 35 min · aerobic base', accent: '#22c55e' },
};

// Live read: active protocols + recent logs for the authenticated client.
export async function fetchCardio(limit = 30) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('Your session has expired — sign in again to load Smart Cardio.');

  const { data, error } = await supabase.rpc('bbf_get_cardio', {
    p_session_token: token,
    p_log_limit: limit,
  });
  if (error) throw new Error(`Smart Cardio load failed — ${error.message || 'cardio RPC error'}.`);
  if (!data?.ok) {
    if (data?.error === 'invalid_session') {
      throw new Error('Your session has expired — sign in again to load Smart Cardio.');
    }
    throw new Error('Smart Cardio is unavailable right now. Please try again.');
  }
  return {
    protocols: Array.isArray(data.protocols) ? data.protocols : [],
    logs: Array.isArray(data.logs) ? data.logs : [],
  };
}

// Write: log a completed cardio session. `entry` = { zone, duration_min,
// intensity?, avg_hr?, notes?, protocol_id?, session_date? }.
export async function logCardio(entry) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('Your session has expired — sign in again to log a session.');

  const { data, error } = await supabase.rpc('bbf_log_cardio', {
    p_session_token: token,
    p_log: entry,
  });
  if (error) throw new Error(`Could not log session — ${error.message || 'cardio RPC error'}.`);
  if (!data?.ok) {
    const map = {
      invalid_session: 'Your session has expired — sign in again to log a session.',
      invalid_zone: 'Pick a valid cardio zone.',
      invalid_duration: 'Enter a duration between 1 and 600 minutes.',
    };
    throw new Error(map[data?.error] || 'Could not log session. Please try again.');
  }
  return { logId: data.log_id };
}

// React hook: fetch-on-land + a refetch() the logger calls after a successful
// write. Mirrors useVaultProfile's contract ({ data, isLoading, error }). State is
// mutated only inside promise callbacks (never synchronously in the effect body),
// which keeps it clear of react-hooks/set-state-in-effect. `reloadKey` bumps to
// re-run the effect on demand (refetch).
export function useCardio() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchCardio()
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(e.message || 'Failed to load Smart Cardio.'); setData(null); } })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  return { data, isLoading, error, refetch };
}

// ── Machine preset library (additive — plugs into the existing flow) ─────────
// PUBLIC, read-only catalog (bbf_cardio_protocol_library). RLS allows anon SELECT
// of active rows, so this reads the table directly (no RPC). Grouped by machine →
// sort in the picker.
export async function fetchCardioLibrary() {
  const { data, error } = await supabase
    .from('bbf_cardio_protocol_library')
    .select('id, machine, title, zone, target_duration_min, intensity, protocol_detail, sort')
    .eq('active', true)
    .order('machine', { ascending: true })
    .order('sort', { ascending: true });
  if (error) throw new Error(`Could not load cardio presets — ${error.message || 'library error'}.`);
  return Array.isArray(data) ? data : [];
}

// Pick a preset → set it as the athlete's OWN active protocol. Same vault-token gate
// as logCardio (token → caller's uid; own rows only): bbf_set_active_cardio_protocol
// supersedes the prior active same-zone Rx and inserts the picked protocol. The
// existing session → calorie → check-in flow then takes over unchanged.
export async function setActiveCardioProtocol(protocol) {
  const token = getStoredVaultToken();
  if (!token) throw new Error('Your session has expired — sign in again to set a protocol.');

  const { data, error } = await supabase.rpc('bbf_set_active_cardio_protocol', {
    p_session_token: token,
    p_protocol: protocol,
  });
  if (error) throw new Error(`Could not set the protocol — ${error.message || 'cardio RPC error'}.`);
  if (!data?.ok) {
    const map = {
      invalid_session: 'Your session has expired — sign in again to set a protocol.',
      invalid_zone: 'This preset has an invalid training zone.',
      invalid_duration: 'This preset has an invalid duration.',
    };
    throw new Error(map[data?.error] || 'Could not set this protocol. Please try again.');
  }
  return { protocolId: data.protocol_id };
}
