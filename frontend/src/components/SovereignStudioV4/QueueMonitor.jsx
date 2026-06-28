// src/components/SovereignStudioV4/QueueMonitor.jsx
// FRONT 5 — Supabase auto-post queue monitor. Reads recent jobs (cards + reels)
// from bbf-studio-queue's `list` action and shows them grouped by status so the
// user can watch active/pending/posted/failed jobs. studioQueueApi is imported
// DYNAMICALLY so this component still mounts in the supabase-less harness.

import { useCallback, useEffect, useRef, useState } from 'react';

const STATUS_META = {
  queued:  { label: 'PENDING',  cls: 'q-pending' },
  posting: { label: 'POSTING',  cls: 'q-posting' },
  posted:  { label: 'POSTED',   cls: 'q-posted' },
  failed:  { label: 'FAILED',   cls: 'q-failed' },
};
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || ''; } };

export default function QueueMonitor() {
  const [jobs, setJobs] = useState([]);
  const [counts, setCounts] = useState({});
  const [state, setState] = useState('loading'); // loading | ready | error
  const [err, setErr] = useState('');
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { fetchQueue } = await import('../../lib/studioQueueApi.js');
      const r = await fetchQueue({ limit: 40 });
      setJobs(Array.isArray(r.jobs) ? r.jobs : []);
      setCounts(r.counts || {});
      setState('ready');
      setErr('');
    } catch (e) {
      setState('error');
      setErr(e?.message === 'no_admin_session'
        ? 'Sign in to the Command Center to view the queue.'
        : e?.message === 'not_admin'
          ? 'This session is not an authorized admin.'
          : 'Could not load the queue — retry.');
    }
  }, []);

  // Initial load + light auto-refresh (15s) while mounted. queueMicrotask defers
  // the first fetch out of the effect's synchronous phase (house pattern — see
  // ContentEngine), so state updates never fire during render.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(); });
    timerRef.current = setInterval(() => { if (!cancelled) load(); }, 15000);
    return () => { cancelled = true; if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  return (
    <div className="qmon">
      <div className="qmon-head">
        <div className="qmon-title">📡 Auto-Post Queue</div>
        <button type="button" className="qmon-refresh" onClick={load}>↻ Refresh</button>
      </div>

      <div className="qmon-counts">
        {['queued', 'posting', 'posted', 'failed'].map((s) => (
          <div key={s} className={`qmon-stat ${STATUS_META[s].cls}`}>
            <span className="qmon-stat-n">{counts[s] || 0}</span>
            <span className="qmon-stat-l">{STATUS_META[s].label}</span>
          </div>
        ))}
      </div>

      {state === 'loading' && <div className="qmon-msg">Loading queue…</div>}
      {state === 'error' && <div className="qmon-msg qmon-msg-warn">{err}</div>}
      {state === 'ready' && jobs.length === 0 && <div className="qmon-msg">No jobs yet — queue or post a card to populate this.</div>}

      {state === 'ready' && jobs.length > 0 && (
        <div className="qmon-list">
          {jobs.map((j) => {
            const meta = STATUS_META[j.status] || { label: String(j.status || '—').toUpperCase(), cls: '' };
            return (
              <div className="qmon-row" key={`${j.kind}-${j.id}`}>
                <span className={`qmon-badge ${meta.cls}`}>{meta.label}</span>
                <div className="qmon-row-main">
                  <div className="qmon-row-title">
                    <span className="qmon-kind">{j.kind === 'video' ? '🎬' : '🃏'}</span>
                    {j.headline || j.caption || j.id}
                  </div>
                  <div className="qmon-row-sub">
                    {fmtTime(j.posted_at || j.created_at)}
                    {j.platform_target ? ` · ${j.platform_target}` : ''}
                    {j.last_error ? ` · ⚠ ${String(j.last_error).slice(0, 80)}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
