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
  // Per-row action machinery (retry/cancel): { [kind-id]: { busy, ok, note } }.
  const [act, setAct] = useState({});
  const setRow = (k, patch) => setAct((m) => ({ ...m, [k]: { ...(m[k] || {}), ...patch } }));

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

  // RETRY a failed job now. Safe against double-posting — the distributor replays
  // the row's post_refs, so an already-live channel is never re-fired; only the
  // channel(s) that actually failed go out again.
  const retryJob = async (j) => {
    const k = `${j.kind}-${j.id}`;
    if (!window.confirm(`RETRY this ${j.kind === 'video' ? 'reel' : 'card'} now?\n\nOnly the channel(s) that failed will fire — anything already posted is never duplicated.`)) return;
    setRow(k, { busy: true, ok: true, note: 'Retrying…' });
    try {
      const { retryPost, pollPostStatus } = await import('../../lib/studioQueueApi.js');
      const r = await retryPost({ kind: j.kind, id: j.id, now: true });
      if (r.status === 'posting') {
        setRow(k, { note: 'Posting… Meta is transcoding (~60–90s).' });
        const verdict = await pollPostStatus({ kind: j.kind, id: j.id });
        setRow(k, {
          busy: false, ok: verdict === 'posted',
          note: verdict === 'posted' ? '✓ Posted.' : verdict === 'failed' ? '⚠ Failed again — the row keeps the error detail.' : 'Still finishing at Meta — refresh shortly.',
        });
      } else {
        setRow(k, { busy: false, ok: r.status === 'posted', note: r.status === 'posted' ? '✓ Posted.' : `⚠ Retry ended as ${r.status}.` });
      }
    } catch (e) {
      setRow(k, { busy: false, ok: false, note: `⚠ Retry failed (${e?.message || 'error'}).` });
    } finally {
      load();
    }
  };

  // CANCEL a still-queued job (removes the row + its uploaded asset).
  const cancelJob = async (j) => {
    const k = `${j.kind}-${j.id}`;
    if (!window.confirm('Cancel this queued post?\n\nIt is removed from the queue and will not post. This cannot be undone.')) return;
    setRow(k, { busy: true, ok: true, note: 'Cancelling…' });
    try {
      const { cancelPost } = await import('../../lib/studioQueueApi.js');
      await cancelPost({ kind: j.kind, id: j.id });
      setRow(k, { busy: false, ok: true, note: '✓ Cancelled — removed from the queue.' });
    } catch (e) {
      setRow(k, { busy: false, ok: false, note: `⚠ Cancel failed (${e?.message || 'error'}).` });
    } finally {
      load();
    }
  };

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
            const k = `${j.kind}-${j.id}`;
            const row = act[k] || {};
            return (
              <div className="qmon-row" key={k}>
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
                  {(j.status === 'failed' || j.status === 'queued') && (
                    <div className="dhist-actions-v4">
                      {j.status === 'failed' && (
                        <button type="button" className="dhist-btn-v4 primary" onClick={() => retryJob(j)} disabled={row.busy} data-testid={`retry-${j.id}`}>
                          {row.busy ? '… WORKING' : '↻ RETRY NOW'}
                        </button>
                      )}
                      {j.status === 'queued' && (
                        <button type="button" className="dhist-btn-v4 danger" onClick={() => cancelJob(j)} disabled={row.busy} data-testid={`cancel-${j.id}`}>
                          ✕ CANCEL
                        </button>
                      )}
                    </div>
                  )}
                  {row.note && (
                    <div className="hint-v4" style={{ color: row.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>{row.note}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
