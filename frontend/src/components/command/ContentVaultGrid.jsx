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
import {
  fetchContentVault, subscribeContentVault, dispatchToMeta, purgeVaultItem,
} from '../../lib/contentVaultApi.js';
import { runTikTokBridge } from '../../lib/tiktokBridge.js';
import './contentVault.css';

// Human-readable slugs for the vault write failures surfaced by bbf-content-manager.
function vaultErr(msg) {
  const map = {
    no_admin_session: 'No admin session — sign in to the Command Center.',
    not_admin: 'Restricted to the administrative tier.',
    no_channel_configured: 'Meta channels not configured on the server.',
    missing_video_url: 'This clip has no video URL to dispatch.',
    not_found: 'Row already gone — refreshing.',
  };
  return map[msg] || `Failed (${msg || 'unknown'}).`;
}

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

function VaultCard({ row, onPurged }) {
  const [bridge, setBridge] = useState(null); // null | 'run' | 'ok' | 'err'
  const [bgmName, setBgmName] = useState('');
  // Local status mirror — flips to 'published' the instant a Meta dispatch confirms,
  // so the badge updates with 0 refresh (the server also persists it durably).
  const [status, setStatus] = useState(row.status);
  // Two-step confirm for the outward/irreversible actions (live Meta post + purge).
  const [meta, setMeta] = useState(null);   // null | 'confirm' | 'run' | 'ok' | 'err'
  const [purge, setPurge] = useState(null);  // null | 'confirm' | 'run' | 'err'
  const [note, setNote] = useState('');      // inline error/status line
  const confirmTimer = useRef(null);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  // First click arms the confirm state (auto-disarms after 4s); the caller fires on
  // the second click. Prevents a stray single click going live / destroying an asset.
  const armThenRun = useCallback((phase, setPhase, run) => {
    if (phase !== 'confirm') {
      setNote('');
      setPhase('confirm');
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setPhase(null), 4000);
      return;
    }
    clearTimeout(confirmTimer.current);
    run();
  }, []);

  const onDispatch = useCallback(() => {
    armThenRun(meta, setMeta, async () => {
      setMeta('run');
      try {
        await dispatchToMeta({ id: row.id, video_url: row.video_url, caption_body: row.caption_body });
        setStatus('published');
        setMeta('ok');
        setNote('');
      } catch (e) {
        setMeta('err');
        setNote(vaultErr(e?.message));
      }
    });
  }, [armThenRun, meta, row.id, row.video_url, row.caption_body]);

  const onPurge = useCallback(() => {
    armThenRun(purge, setPurge, async () => {
      setPurge('run');
      try {
        await purgeVaultItem({ id: row.id, video_url: row.video_url });
        onPurged?.(row.id); // optimistic slice-out — card leaves the grid immediately
      } catch (e) {
        setPurge('err');
        setNote(vaultErr(e?.message));
        if (e?.message === 'not_found') onPurged?.(row.id); // already gone — drop it anyway
      }
    });
  }, [armThenRun, purge, row.id, row.video_url, onPurged]);
  // ── LAZY MEDIA THROTTLE ────────────────────────────────────────────────────
  // Rendering 36 seated <video> nodes at once saturates the main thread + client
  // memory. The clip element is NOT mounted until the card is intentionally
  // activated (tap / hover / keyboard focus). Until then the media area is a
  // matte-black poster with a play glyph — zero network, zero decode. On activation
  // the <video> mounts with preload="none", so even then no binary fragment
  // downloads until the user hits play.
  const [active, setActive] = useState(false);
  const activate = useCallback(() => setActive(true), []);

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
      <div
        className="cv-media"
        onMouseEnter={activate}
        onFocus={activate}
      >
        {active ? (
          <video
            className="cv-video"
            src={`${row.video_url}#t=0.1`}
            preload="none"
            muted
            playsInline
            controls
            autoPlay
          />
        ) : (
          <button
            type="button"
            className="cv-poster"
            onClick={activate}
            data-testid={`vault-poster-${row.id}`}
            aria-label={`Load and play ${row.title}`}
          >
            <span className="cv-poster-play" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="cv-poster-label">Tap to load</span>
          </button>
        )}
      </div>
      <div className="cv-body">
        <div className="cv-row-top">
          <h3 className="cv-title" title={row.title}>{row.title}</h3>
          <StatusChip status={status} />
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

        {/* Automated distribution + secure purge — both LIVE/irreversible, so each
            arms a confirm state on the first click and only fires on the second. */}
        <div className="cv-dispatch-row">
          <button
            type="button"
            className={`cv-meta${meta === 'confirm' ? ' is-confirm' : ''}`}
            onClick={onDispatch}
            disabled={meta === 'run'}
            data-testid={`vault-meta-${row.id}`}
            aria-label={`Dispatch ${row.title} to Meta (Facebook + Instagram)`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 3v7h7v2h-7v9h-2v-9H4v-2h7V3z" transform="rotate(45 12 12)" />
            </svg>
            {meta === 'run' ? 'Dispatching…'
              : meta === 'ok' ? 'Dispatched ✓'
                : meta === 'confirm' ? 'Confirm → FB + IG'
                  : 'Dispatch to Meta'}
          </button>

          <button
            type="button"
            className={`cv-purge${purge === 'confirm' ? ' is-confirm' : ''}`}
            onClick={onPurge}
            disabled={purge === 'run'}
            data-testid={`vault-purge-${row.id}`}
            aria-label={`Purge ${row.title} from the vault`}
            title="Permanently delete the .mp4 from storage and the vault row"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 12H8L7 9Z" />
            </svg>
            {purge === 'run' ? 'Purging…' : purge === 'confirm' ? 'Confirm purge?' : 'Purge from Vault'}
          </button>
        </div>

        {bridge === 'err' ? <div className="cv-bridge-note" role="status">Bridge partially completed — check the new tab / clipboard.</div> : null}
        {note ? <div className="cv-bridge-note" role="alert">⚠ {note}</div> : null}
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

  // Optimistic slice-out after a confirmed purge — the card leaves the grid the
  // instant the edge fn returns, no refresh needed (realtime will reconcile too).
  const handlePurged = useCallback((id) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
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
          {rows.map((row) => <VaultCard key={row.id} row={row} onPurged={handlePurged} />)}
        </div>
      )}
    </div>
  );
}
