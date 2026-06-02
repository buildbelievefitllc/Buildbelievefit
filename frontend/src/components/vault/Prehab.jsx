// src/components/vault/Prehab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.9 — Dynamic Prehab Matrix. The "Friction Scanner": the athlete reports
// specific joint/muscle friction points (quick-pick zones + free text), and the
// bbf-agentic-prehab engine returns a tailored 3-movement recovery protocol
// (name · duration · focus · reason). Nothing is hardcoded — every movement comes
// live from the engine, contextualized to the athlete's profile + today's lifts.
//
// Aesthetic: BBF brutalist — matte panels, purple structure, gold accents. No
// static yellow progress bars; the scan indicator is a purple pulse.

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { requestPrehabMatrix, localDateKey } from '../../lib/prehabApi.js';
import { resolveVideoId, watchURL, thumbURL } from './exerciseVideos.js';
import './vault.css';

// Quick-pick friction zones — specific joints/muscles the athlete taps to flag.
const ZONES = [
  'Lower back', 'Hips', 'Knees', 'Shoulders', 'Neck',
  'Hamstrings', 'Glutes', 'Upper back', 'Ankles', 'Wrists', 'Elbows', 'Calves',
];

// Compose the engine's free-text reported_friction from tapped zones + notes.
function composeFriction(zones, note) {
  const parts = [];
  if (zones.size) parts.push(`Friction zones: ${[...zones].join(', ')}`);
  const trimmed = note.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join('. ');
}

// ── YouTube form-cue / directive scaffold ────────────────────────────────────
// Each recovery movement gets a video directive. The engine may emit an explicit
// `video` id and/or a `cue` directive string; when it doesn't, we fuzzy-resolve a
// form demo from the authorized VIDEO_MAP (same resolver the Program grid uses).
// When nothing resolves, the scaffold still renders a "form cue pending" affordance
// so the slot is always present — no API/token call is made here.
function PrehabVideoCue({ movement }) {
  const explicit = typeof movement.video === 'string' ? movement.video.trim() : '';
  const videoId = explicit || resolveVideoId(movement.name);
  const directive = (movement.cue || '').trim() || 'Watch the form cue before you move.';

  return (
    <div className="ph-routine-cue" data-testid="prehab-routine-cue">
      {videoId ? (
        <a
          className="ph-cue-link"
          href={watchURL(videoId)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch the form cue for ${movement.name}`}
          data-testid="prehab-cue-link"
        >
          <span className="ph-cue-thumb">
            <img src={thumbURL(videoId)} alt="" loading="lazy" />
            <span className="ph-cue-play" aria-hidden="true">▶</span>
          </span>
          <span className="ph-cue-text">
            <span className="ph-cue-label">Video Directive</span>
            <span className="ph-cue-directive">{directive}</span>
          </span>
        </a>
      ) : (
        <div className="ph-cue-pending" data-testid="prehab-cue-pending">
          <span className="ph-cue-play ph-cue-play--muted" aria-hidden="true">▶</span>
          <span className="ph-cue-text">
            <span className="ph-cue-label">Video Directive</span>
            <span className="ph-cue-directive">Form cue pending — follow the written focus above.</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default function Prehab() {
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';

  const [zones, setZones] = useState(() => new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [matrix, setMatrix] = useState(null); // null = pre-scan, [] = none, [..] = protocol
  const [error, setError] = useState(null);

  const toggleZone = (z) => setZones((prev) => {
    const next = new Set(prev);
    if (next.has(z)) next.delete(z); else next.add(z);
    return next;
  });

  async function runScan() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const friction = composeFriction(zones, note);
      const result = await requestPrehabMatrix({ uid, friction, today: localDateKey() });
      setMatrix(result);
    } catch (e) {
      setError(e.message || 'The Recovery Matrix engine is unavailable.');
      setMatrix(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ph" data-testid="prehab-module">
      <div className="ph-head">
        <h2 className="ph-title">Dynamic Prehab Matrix</h2>
        <p className="ph-sub">
          Flag where you feel friction. The Recovery Matrix engine reads your profile and today’s
          training to prescribe a targeted 3-movement reset.
        </p>
      </div>

      {/* ── FRICTION SCANNER ─────────────────────────────────────── */}
      <div className="ph-scanner">
        <div className="ph-scan-kicker">Friction Scanner</div>

        <div className="ph-zones" role="group" aria-label="Friction zones">
          {ZONES.map((z) => {
            const active = zones.has(z);
            return (
              <button
                key={z}
                type="button"
                className={`ph-zone${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleZone(z)}
                data-testid="prehab-zone"
              >
                {z}
              </button>
            );
          })}
        </div>

        <label className="ph-note-lbl" htmlFor="ph-note">Describe the friction (optional)</label>
        <textarea
          id="ph-note"
          className="ph-note"
          rows={2}
          placeholder="e.g. tight left hip after squats, dull ache in lower back…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="prehab-friction-input"
        />

        <button
          type="button"
          className="ph-scan-btn"
          onClick={runScan}
          disabled={busy}
          data-testid="prehab-scan"
        >
          {busy ? 'Scanning…' : 'Scan & Generate Protocol'}
        </button>

        {busy ? <div className="ph-pulse" aria-hidden="true"><span /><span /><span /></div> : null}
      </div>

      {/* ── RESULTS ──────────────────────────────────────────────── */}
      {error ? (
        <div className="ph-error" role="alert" data-testid="prehab-error">{error}</div>
      ) : null}

      {!error && matrix && matrix.length === 0 ? (
        <div className="ph-empty" data-testid="prehab-empty">
          No recovery protocol returned. Adjust your friction zones and scan again.
        </div>
      ) : null}

      {!error && matrix && matrix.length > 0 ? (
        <div className="ph-matrix">
          <div className="ph-matrix-head">
            <span className="ph-matrix-kicker">Recovery Protocol</span>
            <span className="ph-matrix-count">{matrix.length} movements</span>
          </div>
          {matrix.map((mv, i) => (
            <div className="ph-routine" key={mv.name + i} data-testid="prehab-routine">
              <div className="ph-routine-top">
                <span className="ph-routine-idx">{i + 1}</span>
                <span className="ph-routine-name" data-testid="prehab-routine-name">{mv.name}</span>
              </div>
              <div className="ph-routine-meta">
                {mv.focus ? <span className="ph-routine-focus" data-testid="prehab-routine-focus">{mv.focus}</span> : null}
                {mv.duration ? <span className="ph-routine-dur" data-testid="prehab-routine-duration">{mv.duration}</span> : null}
              </div>
              {mv.reason ? <p className="ph-routine-reason" data-testid="prehab-routine-reason">{mv.reason}</p> : null}
              <PrehabVideoCue movement={mv} />
            </div>
          ))}
        </div>
      ) : null}

      {!error && matrix === null && !busy ? (
        <div className="ph-prompt" data-testid="prehab-prompt">
          Tap the zones where you feel tight or sore, then run the scan.
        </div>
      ) : null}
    </div>
  );
}
