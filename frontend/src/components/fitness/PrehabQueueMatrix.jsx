// src/components/fitness/PrehabQueueMatrix.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.4 — the daily prehab matrix (PREHAB_RECOVERY_LOOP §2 · §3.3).
//
// Reads today's prehab_queue via the vault-token RPC bbf_get_prehab_queue and
// renders the top 2 flagged joints (priority-ordered). DEGRADATION FALLBACK: when
// nothing is flagged (all_clear) — or before the read resolves, or on a soft
// failure — it shows the localized "All Clear / General Mobility" state instead of
// an empty panel or a raw error.
//
// AUTH: standard Vault Token API (p_session_token). TRILINGUAL: joints, priorities,
// and the all-clear copy resolve through useFitnessStr by preferred_locale.
//
// @param {{ limit?: number }} props  how many joints to surface (default 2)

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { getStoredVaultToken } from '../../context/AuthContext.jsx';
import { useFitnessStr } from './fitnessStrings.js';
import './fitness.css';

const PRIORITY_RANK = { mandatory: 0, strong: 1, advisory: 2 };

async function fetchQueue(limit) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  try {
    const { data, error } = await supabase.rpc('bbf_get_prehab_queue', { p_session_token: token, p_limit: limit });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false, error: 'empty' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

export default function PrehabQueueMatrix({ limit = 2 }) {
  const { fs } = useFitnessStr();
  const [state, setState] = useState({ loading: true, error: null, queue: [], allClear: true });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    fetchQueue(limit).then((res) => {
      if (!alive.current) return;
      // Fail-soft: any non-ok read degrades to the All-Clear state, never an error panel.
      if (!res.ok) { setState({ loading: false, error: res.error, queue: [], allClear: true }); return; }
      const queue = Array.isArray(res.queue) ? res.queue.slice(0, limit) : [];
      setState({ loading: false, error: null, queue, allClear: res.all_clear === true || queue.length === 0 });
    });
    return () => { alive.current = false; };
  }, [limit]);

  const { loading, queue, allClear } = state;

  return (
    <section className="pm-card" data-testid="prehab-matrix" aria-label={fs.prehabTitle}>
      <header className="pm-head">
        <span className="pm-kicker">{fs.prehabKicker}</span>
        <h3 className="pm-title">{fs.prehabTitle}</h3>
      </header>

      {loading ? (
        <div className="pm-loading">{fs.prehabLoading}</div>
      ) : allClear ? (
        // ── DEGRADATION FALLBACK — All Clear / General Mobility ──
        <div className="pm-clear" data-testid="prehab-allclear">
          <span className="pm-clear-mark" aria-hidden="true">✓</span>
          <div className="pm-clear-body">
            <div className="pm-clear-title">{fs.allClear}</div>
            <div className="pm-clear-sub">{fs.allClearSub}</div>
            <p className="pm-clear-copy">{fs.allClearBody}</p>
          </div>
        </div>
      ) : (
        <ul className="pm-matrix">
          {[...queue].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)).map((j, i) => (
            <li key={`${j.joint_zone}-${i}`} className={`pm-joint is-${j.priority}`}>
              <div className="pm-joint-top">
                <span className="pm-joint-name">{fs.joints[j.joint_zone] || j.joint_zone}</span>
                <span className={`pm-pri is-${j.priority}`}>{fs.priority[j.priority] || j.priority}</span>
              </div>
              {j.risk_score != null ? (
                <div className="pm-risk">
                  <span className="pm-risk-label">{fs.riskLabel}</span>
                  <div className="pm-risk-track">
                    <div className="pm-risk-fill" style={{ width: `${Math.max(0, Math.min(100, Number(j.risk_score)))}%` }} />
                  </div>
                  <span className="pm-risk-val">{Math.round(Number(j.risk_score))}</span>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
