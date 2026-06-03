// src/components/vault/ChampionMindset.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Champion's Mindset — Cognitive Conditioning module (client-facing Vault tab).
//
// A React reconstruction of the AI Studio "Champion's Mindset" prototype: mental
// fortitude training, a daily valor affirmation, and a "Championship Mindset
// Cinema" roster of motivational films. Four sections, faithful to the ground
// truth:
//   1. Hero          — Cognitive Fortitude pill + title + framing copy.
//   2. Affirmation   — the day's Daily Vault Affirmation quote block.
//   3. Cinema        — 2×2 champion roster → a YouTube player + Focus Objective
//                      panel that both track the selected film.
//   4. Protocols     — the Focus Strategies / Visualization Drills split-pane.
//
// All copy is static ground-truth (transcribed from the prototype). Selecting a
// champion locks the player + objective to that film; "Engage Obsession Cycle"
// advances the roster; "Lock In This Mindset Today" persists the day's pick to
// localStorage (per-day, mirroring MindsetEngine). Public to every authenticated
// client — mounted in ClientVault with no admin gate.

import { useMemo, useState } from 'react';
import './championMindset.css';

// The day's affirmation — the centerpiece of the hero's quote block.
const AFFIRMATION =
  'I possess the strength to overcome every challenge and the discipline to master my craft today.';

// ── Championship Mindset Cinema roster ───────────────────────────────────────
// Final CEO-approved cuts live in the `youtubeId` field of this one array; the
// player builds youtube.com/embed/<id> from them. (Jordan is still a placeholder
// embed pending its approved cut — swap it the same way.)
const CHAMPIONS = [
  {
    id: 'kobe',
    category: 'Mamba Mentality',
    title: 'Kobe Bryant: The Mamba Mentality',
    youtubeId: 'GE0UAdxPTc0',
    objective:
      'The relentless pursuit of being the best version of yourself. Obsessive ' +
      'preparation, zero excuses, and the will to outwork every opponent in the room.',
    dictums: [
      'The moment you give up is the moment you let someone else win.',
      'Everything negative — pressure, challenges — is a chance for me to rise.',
      'Dedicate yourself to the process, and the outcome takes care of itself.',
    ],
  },
  {
    id: 'jordan',
    category: 'Obsession & Competition',
    title: 'Michael Jordan: Driven From Within',
    youtubeId: 'JA7G7AV-LT8',
    objective:
      'Channel competitive fire into fuel. Take every slight personally, turn ' +
      'failure into evidence, and let an unbreakable will separate you from the field.',
    dictums: [
      'I have failed over and over — and that is precisely why I succeed.',
      "Obstacles don't have to stop you; if you hit a wall, find a way through it.",
      'I play to win, whether practice or the final. Accept nothing less.',
    ],
  },
  {
    id: 'goggins',
    category: 'Discipline & Willpower',
    title: 'David Goggins: The 40% Mind Rule',
    youtubeId: 'ocIWBpT-AGc',
    objective:
      'When your mind says you are finished, you are only at 40% of your true ' +
      'capacity. Callous the mind, embrace the suffering, and take souls in the darkroom.',
    dictums: [
      'When you think you are done, you are only at 40% of your capacity.',
      'Suffering is the true test of life — callous your mind against it.',
      'Hold yourself accountable in the mirror, every single day.',
    ],
  },
  {
    id: 'et',
    category: 'Relentless Execution',
    title: 'Discipline Yourself | Eric Thomas Motivation',
    youtubeId: 'jsabTHhM54A',
    objective:
      'Discipline is the bridge between your goals and your accomplishments. This ' +
      'module requires you to abandon the fleeting feeling of motivation and rely ' +
      'entirely on engineered consistency. Your emotions and fatigue are irrelevant; ' +
      'your execution of the standard is the only metric that matters.',
    dictums: [
      'Motivation is a feeling; discipline is an unshakeable standard.',
      'I do not negotiate with my own weakness or fatigue.',
      'The work is required whether I feel like executing it or not.',
      'I am the sole architect of my consistency and my outcomes.',
    ],
  },
];

// ── Cognitive Action Protocols (static ground-truth) ─────────────────────────
const FOCUS_STRATEGIES = [
  'Practice Box Breathing for four counts each to center your nervous system before starting your session.',
  'Identify one specific technical cue to focus on during high-intensity intervals to prevent mental fatigue.',
  'Establish a consistent pre-performance ritual that signals to your brain it is time to transition into a flow state.',
];

const VISUALIZATION_DRILLS = [
  'Imagine yourself executing a perfect movement sequence with effortless precision and absolute confidence.',
  'Picture a high-pressure moment where you remain calm, composed, and successfully deliver a winning performance.',
  'Visualize the feeling of recovery after a hard workout, feeling your muscles growing stronger and your mind feeling satisfied.',
];

// ── Per-day "locked-in mindset" persistence (mirrors MindsetEngine) ──────────
const LOCK_KEY = 'bbf.vault.mindset.lockedin.v1';
function todayKey() { return new Date().toISOString().slice(0, 10); }

function readLocked() {
  try {
    const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    return all?.[todayKey()] ?? null;
  } catch { return null; }
}
function writeLocked(id) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    all[todayKey()] = id;
    localStorage.setItem(LOCK_KEY, JSON.stringify(all));
  } catch { /* storage blocked — selection holds for the tab */ }
}

export default function ChampionMindset() {
  // Restore today's locked-in champion (if any); otherwise open on the roster head.
  const [selectedId, setSelectedId] = useState(() => {
    const stored = readLocked();
    return stored && CHAMPIONS.some((c) => c.id === stored) ? stored : CHAMPIONS[0].id;
  });
  const [lockedToday, setLockedToday] = useState(() => readLocked());

  const active = useMemo(
    () => CHAMPIONS.find((c) => c.id === selectedId) ?? CHAMPIONS[0],
    [selectedId],
  );

  // "Engage Obsession Cycle" — advance to the next champion in the roster.
  const cycle = () => {
    const i = CHAMPIONS.findIndex((c) => c.id === selectedId);
    setSelectedId(CHAMPIONS[(i + 1) % CHAMPIONS.length].id);
  };

  // "Lock In This Mindset Today" — persist the active pick as the day's mindset.
  const lockIn = () => { writeLocked(active.id); setLockedToday(active.id); };
  const isLockedIn = lockedToday === active.id;

  return (
    <div className="cm" data-testid="champion-mindset-module">
      {/* ── 1 · Hero ──────────────────────────────────────────────────────── */}
      <section className="cm-hero">
        <span className="cm-pill">Cognitive Fortitude</span>
        <h2 className="cm-title">
          <span className="cm-spark" aria-hidden="true">✦</span> Champion&apos;s Mindset
        </h2>
        <p className="cm-sub">
          Physical strength is empty without robust mental resilience. Forge your
          mental armor here with daily expert cognitive conditioning.
        </p>
      </section>

      {/* ── 2 · Daily Vault Affirmation ───────────────────────────────────── */}
      <section className="cm-affirm" aria-label="Daily Vault Affirmation">
        <div className="cm-affirm-orb" aria-hidden="true">✦</div>
        <div className="cm-affirm-lbl">Daily Vault Affirmation</div>
        <blockquote className="cm-affirm-quote">&ldquo;{AFFIRMATION}&rdquo;</blockquote>
      </section>

      {/* ── 3 · Championship Mindset Cinema ───────────────────────────────── */}
      <section className="cm-cinema">
        <div className="cm-cinema-head">
          <div>
            <div className="cm-kicker"><span aria-hidden="true">🏆</span> Championship Mindset Cinema</div>
            <h3 className="cm-cinema-title">Advanced Cognitive Fortitude &amp; Drive Players</h3>
          </div>
          <button type="button" className="cm-obsession" onClick={cycle}>
            <span aria-hidden="true">🔥</span> Engage Obsession Cycle
          </button>
        </div>

        {/* 2×2 champion roster */}
        <div className="cm-grid" role="tablist" aria-label="Champion films">
          {CHAMPIONS.map((c) => {
            const on = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={`cm-vcard${on ? ' is-active' : ''}`}
                data-testid={`cm-film-${c.id}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="cm-vcard-cat">{c.category}</span>
                <span className="cm-vcard-title">{c.title}</span>
                <span className="cm-vcard-foot">
                  <span className="cm-vcard-stream"><span aria-hidden="true">▷</span> Stream Now</span>
                  {on ? <span className="cm-vcard-locked"><span aria-hidden="true">✓</span> Locked</span> : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Video player — tracks the selected champion */}
        <div className="cm-player">
          <div className="cm-player-frame">
            <iframe
              key={active.youtubeId}
              className="cm-player-iframe"
              src={`https://www.youtube.com/embed/${active.youtubeId}`}
              title={active.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="cm-player-note">
            <span aria-hidden="true">ⓘ</span> Note: Ensure audio/earphones are configured.
            Let the message echo in your subconsciousness.
          </p>
        </div>

        {/* Focus Objective — tracks the selected champion */}
        <div className="cm-objective">
          <div className="cm-obj-lbl"><span className="cm-obj-ic" aria-hidden="true">▶</span> Focus Objective</div>
          <h4 className="cm-obj-title">{active.title}</h4>
          <p className="cm-obj-desc">{active.objective}</p>

          <div className="cm-obj-dictums-lbl">Cognitive Dictums for Internalization</div>
          <ul className="cm-dictums">
            {active.dictums.map((d, i) => (
              <li className="cm-dictum" key={i}>
                <span className="cm-dictum-arrow" aria-hidden="true">›</span>
                <span className="cm-dictum-txt">&ldquo;{d}&rdquo;</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className={`cm-lockin${isLockedIn ? ' is-locked' : ''}`}
            aria-pressed={isLockedIn}
            onClick={lockIn}
          >
            <span aria-hidden="true">{isLockedIn ? '✓' : '⚡'}</span>{' '}
            {isLockedIn ? 'Mindset Locked In Today' : 'Lock In This Mindset Today'}
          </button>
        </div>
      </section>

      {/* ── 4 · Cognitive Action Protocols (split-pane) ───────────────────── */}
      <section className="cm-protocols">
        <div className="cm-pane">
          <div className="cm-pane-head">
            <span className="cm-pane-ic cm-pane-ic--focus" aria-hidden="true">⚡</span>
            <div>
              <h4 className="cm-pane-title">Focus Strategies</h4>
              <div className="cm-pane-sub">Mental Efficiency Training</div>
            </div>
          </div>
          <ul className="cm-list">
            {FOCUS_STRATEGIES.map((s, i) => (
              <li className="cm-list-item cm-list-item--focus" key={i}>
                <span className="cm-bullet cm-bullet--focus" aria-hidden="true" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cm-pane">
          <div className="cm-pane-head">
            <span className="cm-pane-ic cm-pane-ic--viz" aria-hidden="true">👁</span>
            <div>
              <h4 className="cm-pane-title">Visualization Drills</h4>
              <div className="cm-pane-sub">Neuromuscular Pathing</div>
            </div>
          </div>
          <ul className="cm-list">
            {VISUALIZATION_DRILLS.map((s, i) => (
              <li className="cm-list-item cm-list-item--viz" key={i}>
                <span className="cm-bullet cm-bullet--viz" aria-hidden="true" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
