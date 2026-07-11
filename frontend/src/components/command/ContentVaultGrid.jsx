// src/components/command/ContentVaultGrid.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Marketing Vault grid — renders live content_vault rows (Supabase realtime + a
// mount fetch). Each card shows the clip preview, status, platform targets, and
// caption, plus the TikTok Manual Bridge (brand-purple #6a0dad) that downloads the
// clip, copies the caption, and opens the TikTok upload screen in one click.
//
// Mobile: the BGM picker accepts standard Android gallery video (.mp4 screen
// recordings) so a Galaxy S25 Ultra can attach a background-music source per clip.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchContentVault, subscribeContentVault } from '../../lib/contentVaultApi.js';
import { runTikTokBridge } from '../../lib/tiktokBridge.js';
import './contentVault.css';

const STATUS_COLOR = {
  staged: '#8a8f98',
  queued: '#f5c800',      // BBF Gold
  published: '#20c997',
};

function StatusChip({ status }) {
  const c = STATUS_COLOR[status] || '#8a8f98';
  return (
    <span className="cv-status" style={{ borderColor: c, color: c }} data-status={status}>
      ● {status}
    </span>
  );
}

function VaultCard({ row }) {
  const [bridge, setBridge] = useState(null); // null | 'run' | 'ok' | 'err'
  const [bgmName, setBgmName] = useState('');

  const onBridge = useCallback(() => {
    setBridge('run');
    // Call synchronously from the click so the popup + clipboard stay gesture-bound.
    runTikTokBridge({ videoUrl: row.video_url, caption: row.caption_body, title: row.title })
      .then((r) => setBridge(r.opened && r.copied && r.downloaded ? 'ok' : 'err'))
      .catch(() => setBridge('err'));
  }, [row.video_url, row.caption_body, row.title]);

  // Device BGM source — accept Android gallery mp4/screen recordings. Captured
  // client-side here; the server mux pipeline (ducked -18dB under the VO) consumes
  // it and writes back bgm_source_url.
  const onBgm = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setBgmName(f.name);
  }, []);

  return (
    <article className="cv-card" data-testid={`vault-card-${row.id}`}>
      <div className="cv-media">
        <video
          className="cv-video"
          src={`${row.video_url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          controls
        />
      </div>
      <div className="cv-body">
        <div className="cv-row-top">
          <h3 className="cv-title" title={row.title}>{row.title}</h3>
          <StatusChip status={row.status} />
        </div>

        {Array.isArray(row.platform_targets) && row.platform_targets.length ? (
          <div className="cv-targets">
            {row.platform_targets.map((t) => <span key={t} className="cv-tag">{t}</span>)}
          </div>
        ) : (
          <div className="cv-targets cv-targets--empty">No platform targets yet</div>
        )}

        <p className="cv-caption">{row.caption_body}</p>

        {bgmName ? <div className="cv-bgm-name" title={bgmName}>🎵 {bgmName}</div> : null}

        <div className="cv-actions">
          <button
            type="button"
            className="cv-tiktok"
            onClick={onBridge}
            data-testid={`vault-tiktok-${row.id}`}
            aria-label={`TikTok bridge for ${row.title}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16.5 3c.3 2 1.6 3.6 3.5 3.9v2.6c-1.3 0-2.5-.4-3.6-1.1v6.3a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v2.7a3 3 0 1 0 2.1 2.9V3h2.8Z" />
            </svg>
            {bridge === 'run' ? 'Bridging…' : bridge === 'ok' ? 'Bridged ✓' : 'TikTok Bridge'}
          </button>

          <label className="cv-bgm" title="Attach background music (mp4 / screen recording)">
            <input type="file" accept="video/mp4,video/*,audio/*,.mp4" onChange={onBgm} data-testid={`vault-bgm-${row.id}`} />
            <span>＋ BGM</span>
          </label>
        </div>

        {bridge === 'err' ? <div className="cv-bridge-note" role="status">Bridge partially completed — check the new tab / clipboard.</div> : null}
      </div>
    </article>
  );
}

export default function ContentVaultGrid() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchContentVault();
      if (alive.current) { setRows(data); setState({ loading: false, error: null }); }
    } catch (e) {
      if (alive.current) setState({ loading: false, error: e?.message || 'read_failed' });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    // Initial pull — inline async (setState lands after the await, never synchronously
    // in the effect body). The refresh button + realtime callback reuse `load`.
    (async () => {
      try {
        const data = await fetchContentVault();
        if (alive.current) { setRows(data); setState({ loading: false, error: null }); }
      } catch (e) {
        if (alive.current) setState({ loading: false, error: e?.message || 'read_failed' });
      }
    })();
    const unsub = subscribeContentVault(() => load()); // live re-pull on any row change
    return () => { alive.current = false; unsub(); };
  }, [load]);

  return (
    <div className="cv-wrap" data-testid="content-vault-grid">
      <div className="cv-head">
        <span className="cv-count">{rows.length} clip{rows.length === 1 ? '' : 's'} staged</span>
        <button type="button" className="cv-refresh" onClick={load} data-testid="vault-refresh">↻ Refresh</button>
      </div>

      {state.error ? <p className="cv-error" role="alert">⚠ Could not load the vault: {state.error}</p> : null}
      {state.loading && rows.length === 0 ? (
        <p className="cv-empty">Loading the marketing vault…</p>
      ) : rows.length === 0 ? (
        <p className="cv-empty">No clips seated in content_vault yet.</p>
      ) : (
        <div className="cv-grid">
          {rows.map((row) => <VaultCard key={row.id} row={row} />)}
        </div>
      )}
    </div>
  );
}
