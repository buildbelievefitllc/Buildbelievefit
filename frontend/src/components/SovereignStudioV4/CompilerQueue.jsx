// src/components/SovereignStudioV4/CompilerQueue.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Ad Compiler job list for the Studio V4 Queue tab. Reads bbf-studio-compiler's
// `list` action and renders each job by status — completed jobs get an inline
// <video> player (the "automatically display the playable compiled video"
// requirement), queued/rendering/failed jobs get a status badge. Auto-refreshes
// every 15s, same cadence as QueueMonitor. studioCompilerApi is imported
// DYNAMICALLY so this still mounts in the supabase-less harness.

import { useCallback, useEffect, useRef, useState } from 'react';

const STATUS_META = {
  queued: { label: 'PENDING', cls: 'q-pending' },
  rendering: { label: 'RENDERING', cls: 'q-posting' },
  completed: { label: 'COMPILED', cls: 'q-posted' },
  failed: { label: 'FAILED', cls: 'q-failed' },
};
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || ''; } };

export default function CompilerQueue() {
  const [jobs, setJobs] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [err, setErr] = useState('');
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { listCompileJobs } = await import('../../lib/studioCompilerApi.js');
      const r = await listCompileJobs(30);
      setJobs(Array.isArray(r.jobs) ? r.jobs : []);
      setState('ready');
      setErr('');
    } catch (e) {
      setState('error');
      setErr(e?.message === 'no_admin_session'
        ? 'Sign in to the Command Center to view compiled ads.'
        : e?.message === 'not_admin'
          ? 'This session is not an authorized admin.'
          : 'Could not load compiled ads — retry.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(); });
    timerRef.current = setInterval(() => { if (!cancelled) load(); }, 15000);
    return () => { cancelled = true; if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (state === 'loading') return <div className="qmon-msg">Loading compiled ads…</div>;
  if (state === 'error') return <div className="qmon-msg qmon-msg-warn">{err}</div>;

  return (
    <div className="cq-wrap" data-testid="compiler-queue">
      <div className="qmon-head">
        <div className="qmon-title">🎬 Ad Compiler</div>
        <button type="button" className="qmon-refresh" onClick={load}>↻ Refresh</button>
      </div>

      {jobs.length === 0 ? (
        <div className="qmon-msg">No compiled ads yet — run the Compiler tab to populate this.</div>
      ) : (
        <div className="cq-list">
          {jobs.map((j) => {
            const meta = STATUS_META[j.status] || { label: String(j.status || '—').toUpperCase(), cls: '' };
            return (
              <div className="cq-row" key={j.id} data-testid={`cq-row-${j.id}`}>
                <div className="cq-row-head">
                  <span className={`qmon-badge ${meta.cls}`}>{meta.label}</span>
                  <span className="qmon-row-sub">
                    {fmtTime(j.updated_at || j.created_at)}
                    {j.duration_sec ? ` · ${j.duration_sec}s` : ''}
                    {j.error ? ` · ⚠ ${String(j.error).slice(0, 80)}` : ''}
                  </span>
                </div>
                {(j.hook_text || j.sub_line_text) && (
                  <div className="cq-row-copy">{j.hook_text || j.sub_line_text}</div>
                )}
                {j.status === 'completed' && j.output_url ? (
                  <video className="cq-video" src={j.output_url} controls playsInline data-testid={`cq-video-${j.id}`} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
