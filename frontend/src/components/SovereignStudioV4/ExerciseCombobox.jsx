// src/components/SovereignStudioV4/ExerciseCombobox.jsx
// Grouped, type-to-filter combobox for the 125 cached vault exercises. Native
// React (no deps): a free-text input + a categorized dropdown panel (Core /
// Prehab / Recovery). Picking an item sets the exact cached name (→ zero-cost
// manifest hit); typing anything else is preserved verbatim (→ generate & cache).

import { useEffect, useId, useRef, useState } from 'react';

export default function ExerciseCombobox({ value, onChange, groups, placeholder }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const listId = useId();

  // Close on click/focus outside the widget.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Filter each group by the current query (case-insensitive substring); drop
  // empty groups. Empty query → show everything.
  const q = (value || '').trim().toLowerCase();
  const filtered = groups
    .map((g) => ({ ...g, items: q ? g.items.filter((n) => n.toLowerCase().includes(q)) : g.items }))
    .filter((g) => g.items.length > 0);
  const totalShown = filtered.reduce((n, g) => n + g.items.length, 0);
  const exactCached = groups.some((g) => g.items.some((n) => n.toLowerCase() === q));

  const pick = (name) => { onChange(name); setOpen(false); };

  return (
    <div className="excb" ref={wrapRef}>
      <input
        type="text"
        className="input-v4"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      />
      <span className="excb-caret" aria-hidden="true">▾</span>

      {open && (
        <div className="excb-panel" id={listId} role="listbox">
          {totalShown === 0 ? (
            <div className="excb-empty">
              No cached match — <b>“{value}”</b> will be generated &amp; cached.
            </div>
          ) : (
            filtered.map((g) => (
              <div className="excb-group" key={g.label}>
                <div className="excb-grouphead">
                  {g.label} <span className="excb-count">{g.items.length}</span>
                </div>
                {g.items.map((name) => (
                  <button
                    type="button"
                    key={name}
                    role="option"
                    aria-selected={name.toLowerCase() === q}
                    className={`excb-item ${name.toLowerCase() === q ? 'is-active' : ''}`}
                    onClick={() => pick(name)}
                  >
                    <span className="excb-name">{name}</span>
                    <span className="excb-tag">$0</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {!exactCached && value.trim() && (
        <div className="hint-v4" style={{ color: '#fb923c', marginTop: 6 }}>
          Custom topic — not in the vault yet; it’ll generate &amp; cache on first run.
        </div>
      )}
    </div>
  );
}
