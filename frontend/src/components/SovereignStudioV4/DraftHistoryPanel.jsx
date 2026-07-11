// src/components/SovereignStudioV4/DraftHistoryPanel.jsx
// VAULT EXPORT HISTORY — the 🗂 HISTORY tab. Lists every export the studio backed
// up to the private studio-drafts-v1 vault so a render made on one device (the
// phone) can be pulled back down on another (the laptop) even when the original
// phone-side download failed. studioDraftsApi is imported DYNAMICALLY so this
// component still mounts in the supabase-less harness (house pattern, QueueMonitor).
//
// DOWNLOAD PATHS (same physics as lib/exportDelivery.js):
//   • Desktop → one tap: mint the signed URL and anchor-navigate it; the server
//     answers Content-Disposition: attachment (?download=) so it lands in Downloads.
//   • Mobile  → two taps: tap 1 FETCHES the blob into memory (the async fetch burns
//     the tap's transient activation, exactly like a render does), then tap 2
//     (⬇ SAVE TO PHONE) drives the share sheet from a FRESH gesture.

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveBlobToDevice, isMobileish } from '../../lib/exportDelivery.js';

const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || ''; } };
const fmtSize = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

export default function DraftHistoryPanel() {
  const [drafts, setDrafts] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [err, setErr] = useState('');
  // Per-draft download machinery: { [id]: { phase: 'fetching'|'ready'|'error', blob?, name?, note? } }
  const [dl, setDl] = useState({});
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { listDrafts } = await import('../../lib/studioDraftsApi.js');
      const r = await listDrafts({ limit: 60 });
      setDrafts(Array.isArray(r.drafts) ? r.drafts : []);
      setState('ready');
      setErr('');
    } catch (e) {
      setState('error');
      setErr(e?.message === 'no_admin_session'
        ? 'Sign in to the Command Center to view your export history.'
        : e?.message === 'not_admin'
          ? 'This session is not an authorized admin.'
          : 'Could not load the export history — retry.');
    }
  }, []);

  // Initial load + light auto-refresh (30s) while mounted (house pattern — QueueMonitor).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(); });
    timerRef.current = setInterval(() => { if (!cancelled) load(); }, 30000);
    return () => { cancelled = true; if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const setRow = (id, patch) => setDl((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));

  // Desktop path — signed URL straight into the browser's download manager.
  const downloadDesktop = async (d) => {
    setRow(d.id, { phase: 'fetching', note: 'Minting download link…' });
    try {
      const { getDraftDownloadUrl } = await import('../../lib/studioDraftsApi.js');
      const { url } = await getDraftDownloadUrl(d.id);
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setRow(d.id, { phase: null, note: `✓ ${d.file_name} downloading — check your Downloads.` });
    } catch (e) {
      setRow(d.id, { phase: 'error', note: `⚠ Download failed (${e?.message || 'error'}) — retry.` });
    }
  };

  // Mobile tap 1 — pull the blob into memory so tap 2 can share it from a fresh gesture.
  const fetchForPhone = async (d) => {
    setRow(d.id, { phase: 'fetching', note: 'Fetching from the vault…' });
    try {
      const { getDraftDownloadUrl } = await import('../../lib/studioDraftsApi.js');
      const { url, content_type: ct } = await getDraftDownloadUrl(d.id);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`fetch_${r.status}`);
      const raw = await r.blob();
      const blob = raw.type ? raw : new Blob([raw], { type: ct || 'application/octet-stream' });
      setRow(d.id, { phase: 'ready', blob, name: d.file_name, note: '✓ Ready — tap ⬇ SAVE TO PHONE.' });
    } catch (e) {
      setRow(d.id, { phase: 'error', note: `⚠ Fetch failed (${e?.message || 'error'}) — retry.` });
    }
  };

  // Mobile tap 2 — the fresh gesture that drives the share sheet.
  const saveToPhone = async (d) => {
    const row = dl[d.id];
    if (!row?.blob) return;
    const how = await saveBlobToDevice(row.blob, row.name || d.file_name);
    if (how === 'cancelled') return;
    setRow(d.id, {
      note: how === 'shared'
        ? '✓ Share sheet opened — pick “Save to Files” / Gallery, or send it to IG/TikTok.'
        : how === 'downloaded'
          ? `✓ ${d.file_name} downloaded — check your Downloads.`
          : how === 'opened'
            ? 'Opened in a new tab — long-press the file to save it.'
            : '⚠ Could not hand the file to this device — try again.',
    });
  };

  // Promote a stored draft into the auto-post pipeline — the "render on the phone,
  // post from the laptop" bridge. Entirely server-side (no re-upload from here).
  // queue → the daily drip; postNow → fires the distributor immediately (videos
  // are polled via the queue's poststatus, same as the editor's POST NOW).
  const promote = async (d, postNow) => {
    const verb = postNow ? 'POST this to IG/FB NOW' : 'QUEUE this for the next daily drip';
    if (!window.confirm(`${verb}?\n\n${d.file_name}\n\nCaption (saved with the draft):\n${(d.caption || '(none)').slice(0, 400)}`)) return;
    setRow(d.id, { phase: 'fetching', note: postNow ? 'Posting…' : 'Queuing…' });
    try {
      const { promoteDraft } = await import('../../lib/studioDraftsApi.js');
      const r = await promoteDraft({ id: d.id, now: !!postNow });
      if (r.status === 'posting' && r.queue_id) {
        setRow(d.id, { note: 'Posting… Meta is transcoding (~60–90s).' });
        const { pollPostStatus } = await import('../../lib/studioQueueApi.js');
        const verdict = await pollPostStatus({ kind: d.kind, id: r.queue_id });
        setRow(d.id, {
          phase: verdict === 'posted' ? null : 'error',
          note: verdict === 'posted' ? '✓ Posted to IG/FB.' : verdict === 'failed' ? '⚠ Meta rejected it — check the 📡 QUEUE tab for the error.' : 'Still finishing at Meta — check the 📡 QUEUE tab shortly.',
        });
      } else if (r.status === 'posted') {
        setRow(d.id, { phase: null, note: '✓ Posted to IG/FB.' });
      } else {
        setRow(d.id, { phase: null, note: '✓ Queued — posts on the next daily drip (manage it in 📡 QUEUE).' });
      }
    } catch (e) {
      setRow(d.id, { phase: 'error', note: `⚠ ${postNow ? 'Post' : 'Queue'} failed (${e?.message || 'error'}) — retry.` });
    }
  };

  const removeDraft = async (d) => {
    if (!window.confirm(`Delete ${d.file_name} from the vault?\n\nThis permanently removes the stored file — it cannot be re-downloaded afterwards.`)) return;
    setRow(d.id, { phase: 'fetching', note: 'Deleting…' });
    try {
      const { deleteDraft } = await import('../../lib/studioDraftsApi.js');
      await deleteDraft(d.id);
      setDrafts((list) => list.filter((x) => x.id !== d.id));
      setDl((m) => { const rest = { ...m }; delete rest[d.id]; return rest; });
    } catch (e) {
      setRow(d.id, { phase: 'error', note: `⚠ Delete failed (${e?.message || 'error'}).` });
    }
  };

  const mobile = isMobileish();

  return (
    <div className="dhist-v4">
      <div className="qmon-head">
        <div className="qmon-title">🗂 Vault Export History</div>
        <button type="button" className="qmon-refresh" onClick={load}>↻ Refresh</button>
      </div>
      <div className="hint-v4 dhist-lede-v4">
        Every export is auto-backed-up here the moment it finishes rendering. If a phone
        download fails, open this tab on any device — laptop included — and pull the file back down.
      </div>

      {state === 'loading' && <div className="qmon-msg">Loading export history…</div>}
      {state === 'error' && <div className="qmon-msg qmon-msg-warn">{err}</div>}
      {state === 'ready' && drafts.length === 0 && (
        <div className="qmon-msg">No exports vaulted yet — render a card or reel and it will appear here automatically.</div>
      )}

      {state === 'ready' && drafts.length > 0 && (
        <div className="qmon-list">
          {drafts.map((d) => {
            const row = dl[d.id] || {};
            const busy = row.phase === 'fetching';
            const meta = [
              fmtSize(d.bytes),
              d.duration_sec ? `${Math.round(Number(d.duration_sec))}s` : '',
              fmtTime(d.created_at),
              d.source_device ? `from ${d.source_device}` : '',
            ].filter(Boolean).join(' · ');
            return (
              <div className="qmon-row dhist-row-v4" key={d.id}>
                <div className="qmon-row-main">
                  <div className="qmon-row-title">
                    <span className="qmon-kind">{d.kind === 'video' ? '🎬' : '🃏'}</span>
                    {d.file_name}
                  </div>
                  <div className="qmon-row-sub">{meta}</div>
                  <div className="dhist-actions-v4">
                    {mobile ? (
                      row.phase === 'ready' ? (
                        <button type="button" className="dhist-btn-v4 primary" onClick={() => saveToPhone(d)} data-testid={`save-${d.id}`}>
                          ⬇ SAVE TO PHONE
                        </button>
                      ) : (
                        <button type="button" className="dhist-btn-v4 primary" onClick={() => fetchForPhone(d)} disabled={busy} data-testid={`fetch-${d.id}`}>
                          {busy ? '… FETCHING' : '⬇ FETCH TO THIS PHONE'}
                        </button>
                      )
                    ) : (
                      <button type="button" className="dhist-btn-v4 primary" onClick={() => downloadDesktop(d)} disabled={busy} data-testid={`download-${d.id}`}>
                        {busy ? '… WORKING' : '⬇ DOWNLOAD'}
                      </button>
                    )}
                    <button type="button" className="dhist-btn-v4" onClick={() => promote(d, false)} disabled={busy} data-testid={`promote-${d.id}`}>
                      📡 QUEUE → SOCIAL
                    </button>
                    <button type="button" className="dhist-btn-v4" onClick={() => promote(d, true)} disabled={busy} data-testid={`postnow-${d.id}`}>
                      🚀 POST NOW
                    </button>
                    <button type="button" className="dhist-btn-v4 danger" onClick={() => removeDraft(d)} disabled={busy}>
                      ✕ DELETE
                    </button>
                  </div>
                  {row.note && (
                    <div className="hint-v4" style={{ color: row.phase === 'error' ? '#fb923c' : 'var(--green, #4ade80)' }}>
                      {row.note}
                    </div>
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
