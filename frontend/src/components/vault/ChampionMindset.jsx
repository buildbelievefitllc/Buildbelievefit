// src/components/vault/ChampionMindset.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Champion's Mindset — Cognitive Conditioning module (client-facing Vault tab).
//
// A React reconstruction of the AI Studio "Champion's Mindset" prototype, now
// expanded into a Netflix-style "Premium Video Vault & Mind-Muscle
// Synchronization" surface: mental fortitude training, a daily valor
// affirmation, and a searchable/filterable "Championship Mindset Cinema" roster
// of motivational films. Four sections, faithful to the ground truth:
//   1. Hero          — Cognitive Fortitude pill + title + framing copy.
//   2. Affirmation   — the day's Daily Vault Affirmation quote block.
//   3. Cinema        — search + category-tag filters → a responsive film grid →
//                      a YouTube player + Focus Objective panel that both track
//                      the selected film.
//   4. Protocols     — the Focus Strategies / Visualization Drills split-pane.
//
// All copy is static ground-truth. Selecting a champion locks the player +
// objective to that film; "Engage Obsession Cycle" advances through the films
// currently in view; "Lock In This Mindset Today" persists the day's pick to
// localStorage (per-day, mirroring MindsetEngine). Public to every authenticated
// client — mounted in ClientVault with no admin gate.

import { useMemo, useState } from 'react';
import './championMindset.css';

// The day's affirmation — the centerpiece of the hero's quote block.
const AFFIRMATION =
  'I possess the strength to overcome every challenge and the discipline to master my craft today.';

// ── Championship Mindset Cinema roster ───────────────────────────────────────
// Final CEO-approved cuts live in the `youtubeId` field of this one array; the
// player builds youtube.com/embed/<id> from them. The roster is rendered as a
// searchable, tag-filterable grid (see FILTER_BUCKETS below for the category
// taxonomy). The Kobe, David Goggins, and Eric Thomas records are LOCKED data —
// kept byte-for-byte intact.
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
    youtubeId: '2g7yEljgdN0',
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
  {
    id: 'jocko',
    category: 'Discipline = Freedom',
    title: 'Jocko Willink: Discipline Equals Freedom',
    youtubeId: 'eBmVv2P-v2s',
    objective:
      'Freedom is bought with discipline. The pre-dawn wake-up, the cold start, the ' +
      'rep you do not feel like doing — each is a deposit. Stop waiting on motivation ' +
      'and let the standard, not the mood, govern the day. When in doubt: default ' +
      'aggressive and attack the task in front of you.',
    dictums: [
      'Discipline equals freedom — the more you impose, the more you earn.',
      'Do not count on motivation; count on discipline.',
      'Hit snooze and you have already lost the first battle of the day.',
      'Whatever the setback: good. Find the advantage in it and move.',
    ],
  },
  {
    id: 'arnold',
    category: 'Rules of Success',
    title: 'Arnold Schwarzenegger: 6 Rules of Success',
    youtubeId: 'vdw_JvZOpwA',
    objective:
      'Hold a clear vision, then back it with relentless work. Trust yourself, ' +
      'break the rules, ignore the naysayers, and never fear failure — but above all, ' +
      'do not just take: give something back. The reps you fear most are the exact ' +
      'reps that build you.',
    dictums: [
      'Have a vision, trust yourself, and the body will follow.',
      'The last three reps are the ones that build the muscle.',
      'Ignore the naysayers; they cannot see what you can.',
      'There is no self-made success — give something back.',
    ],
  },
  {
    id: 'serena',
    category: 'Unbreakable Grace',
    title: 'Serena Williams: Still I Rise',
    youtubeId: '3sAckI5Ldyw',
    objective:
      'Greatness is a choice you defend every day, against every doubt and every ' +
      'count-out. Carry pressure as proof that you belong, answer adversity with ' +
      'poise, and rise — again and again — no matter who is watching or how steep ' +
      'the deficit on the board.',
    dictums: [
      'I am not lucky; I have earned every inch of this.',
      'Pressure is a privilege — it means you are in the arena.',
      'Believe in yourself when no one else will.',
      'Still I rise — the deficit is only the start of the comeback.',
    ],
  },
  {
    id: 'courtney',
    category: 'The Pain Cave',
    title: 'Courtney Dauwalter: Embracing the Pain Cave',
    youtubeId: 'IcZipDEeezI',
    objective:
      'The pain cave is not a place to escape — it is a place to explore and ' +
      'expand. When the body screams stop, go in, take the next step, and chip the ' +
      'wall back a little further. Your perceived limit is a room with far more ' +
      'space inside it than you think.',
    dictums: [
      'When it hurts, go into the pain cave and make it bigger.',
      'The next step is always possible — take it, then the next.',
      'Your mind quits long before your body has to.',
      'Meet your limit with curiosity, not fear.',
    ],
  },
  {
    id: 'huberman',
    category: 'Neuroscience of Will',
    title: 'Andrew Huberman: Building Extreme Willpower',
    youtubeId: '84dYijIpWjQ',
    objective:
      'Willpower is not a mood — it is a structure you can grow. The anterior ' +
      'midcingulate cortex strengthens each time you do the hard thing you would ' +
      'rather avoid. Lean into friction on purpose and you are not just finishing ' +
      'the rep — you are building the organ of tenacity itself.',
    dictums: [
      'Do the thing you resist; that is what grows the will.',
      'The anterior midcingulate cortex is the seat of the will — train it.',
      'Discomfort, chosen on purpose, is the stimulus for grit.',
      'Tenacity is a muscle of the mind; progressive overload applies.',
    ],
  },
];

// ── Category-tag taxonomy (Netflix-style filter rails) ───────────────────────
// Membership is declared here by champion id rather than as a field on the
// records above, so the LOCKED data objects (kobe / goggins / et) stay intact.
// A film may belong to more than one bucket. "All Films" is rendered implicitly.
const FILTER_BUCKETS = [
  { key: 'championship-drive', label: 'Championship Drive', ids: ['kobe', 'jordan', 'arnold'] },
  { key: 'stoic-grit', label: 'Stoic Heavy Grit', ids: ['goggins', 'et', 'jocko'] },
  { key: 'female-strength', label: 'Female Strength Grace', ids: ['serena', 'courtney'] },
  { key: 'neuro-synapse', label: 'Neurological Synapse', ids: ['huberman'] },
];

// The bucket labels a given champion belongs to (used for the card badge search
// surface and for tag-aware text matching).
function bucketsFor(id) {
  return FILTER_BUCKETS.filter((b) => b.ids.includes(id)).map((b) => b.label);
}

// Case-insensitive search across title, category badge, and tag labels.
function matchesQuery(champion, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [champion.title, champion.category, ...bucketsFor(champion.id)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

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

  // Search + category-tag filter state for the cinema grid.
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const active = useMemo(
    () => CHAMPIONS.find((c) => c.id === selectedId) ?? CHAMPIONS[0],
    [selectedId],
  );

  // Films currently in view, after applying the active tag filter + search.
  const visible = useMemo(() => {
    const bucket = FILTER_BUCKETS.find((b) => b.key === filter);
    return CHAMPIONS.filter((c) => {
      const inBucket = !bucket || bucket.ids.includes(c.id);
      return inBucket && matchesQuery(c, query);
    });
  }, [filter, query]);

  // "Engage Obsession Cycle" — advance through the films currently in view.
  const cycle = () => {
    const pool = visible.length ? visible : CHAMPIONS;
    const i = pool.findIndex((c) => c.id === selectedId);
    setSelectedId(pool[(i + 1) % pool.length].id);
  };

  const clearFilters = () => { setQuery(''); setFilter('all'); };

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

        {/* Search + category-tag filter toolbar */}
        <div className="cm-toolbar">
          <div className="cm-search">
            <span className="cm-search-ic" aria-hidden="true">⌕</span>
            <input
              type="search"
              className="cm-search-input"
              placeholder="Search the vault — champion, theme, or tag…"
              aria-label="Search champion films"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="cm-filters" role="group" aria-label="Filter films by category">
            <button
              type="button"
              className={`cm-chip${filter === 'all' ? ' is-active' : ''}`}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All Films
            </button>
            {FILTER_BUCKETS.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`cm-chip${filter === b.key ? ' is-active' : ''}`}
                aria-pressed={filter === b.key}
                onClick={() => setFilter(b.key)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cm-count" aria-live="polite">
          Showing {visible.length} of {CHAMPIONS.length} films
        </div>

        {/* Responsive film grid */}
        {visible.length > 0 ? (
          <div className="cm-grid" role="tablist" aria-label="Champion films">
            {visible.map((c) => {
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
        ) : (
          <div className="cm-empty" role="status">
            <p className="cm-empty-title">No films match your search.</p>
            <p className="cm-empty-sub">Try a different champion, theme, or tag.</p>
            <button type="button" className="cm-empty-clear" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

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
