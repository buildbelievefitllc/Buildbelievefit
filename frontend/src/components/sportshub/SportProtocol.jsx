// src/components/sportshub/SportProtocol.jsx
// ─────────────────────────────────────────────────────────────────────────────
// NATIVE SPORT ENGINE renderer. Receives the coach-staged `sports_protocol`
// payload — staged into bbf_active_clients by the Pathfinder intake, delivered to
// the client in the login envelope (session.plans.sports_protocol) and read by
// SportsHub. Renders it as clean, modular cards (agility / sprints / skill work).
//
// The payload CONTRACT is owned by the backend engine (built in parallel) and is
// NOT yet finalized, so this normalizer is deliberately TOLERANT: it accepts an
// explicit { blocks:[…] } / { sections:[…] } array, OR a category-keyed object
// ({ agility:[…], sprints:[…], skills:[…] }), OR a bare array, OR a JSON string —
// rendering whatever it can and never crashing on an unexpected field. A
// null / empty / unusable payload → the General Physical Preparedness fallback.

import './sportProtocol.css';

// Per-item prescription fields → chip label. Only present fields render.
const META_KEYS = [
  ['sets', 'Sets'], ['reps', 'Reps'], ['rounds', 'Rounds'], ['distance', 'Distance'],
  ['duration', 'Duration'], ['time', 'Time'], ['rest', 'Rest'], ['intensity', 'Intensity'],
  ['rpe', 'RPE'], ['tempo', 'Tempo'], ['load', 'Load'], ['pace', 'Pace'],
];

// Recognized category keys (when the payload is keyed by category, not blocks[]).
const CATEGORY_KEYS = [
  ['warmup', 'Warm-Up'], ['mobility', 'Mobility'], ['agility', 'Agility Drills'],
  ['speed', 'Speed'], ['sprints', 'Sprint Intervals'], ['sprint_intervals', 'Sprint Intervals'],
  ['plyometrics', 'Plyometrics'], ['power', 'Power'], ['strength', 'Strength'],
  ['skills', 'Skill Work'], ['skill_work', 'Skill Work'], ['position_work', 'Position Work'],
  ['drills', 'Drills'], ['conditioning', 'Conditioning'], ['recovery', 'Recovery'],
];
const RESERVED = new Set(['blocks', 'sections', 'sport', 'position', 'focus', 'summary', 'headline']);

function prettyKey(k) {
  return String(k).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toItem(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { name, meta: [], detail: '' } : null;
  }
  if (typeof raw !== 'object') return null;
  const name = String(raw.name || raw.drill || raw.title || raw.movement || raw.exercise || '').trim();
  const meta = [];
  META_KEYS.forEach(([k, label]) => {
    const v = raw[k];
    if (v != null && v !== '') meta.push(`${label} ${v}`);
  });
  const detail = String(raw.detail || raw.notes || raw.note || raw.cue || raw.description || raw.desc || '').trim();
  if (!name && !meta.length && !detail) return null;
  return { name: name || 'Movement', meta, detail };
}

function toItems(rawList) {
  return Array.isArray(rawList) ? rawList.map(toItem).filter(Boolean) : [];
}

function toBlock(rawBlock, fallbackTitle) {
  if (!rawBlock) return null;
  if (Array.isArray(rawBlock)) {
    const items = toItems(rawBlock);
    return items.length ? { title: fallbackTitle || 'Protocol', items } : null;
  }
  if (typeof rawBlock !== 'object') return null;
  const title = String(rawBlock.title || rawBlock.label || rawBlock.name || rawBlock.category || fallbackTitle || 'Protocol').trim();
  const list = rawBlock.items || rawBlock.drills || rawBlock.work || rawBlock.exercises || rawBlock.movements || [];
  const items = toItems(list);
  return items.length ? { title: title || 'Protocol', items } : null;
}

// Tolerant normalizer → { headline, blocks:[{title, items:[{name, meta[], detail}]}] } | null.
function normalizeSportsProtocol(raw) {
  let data = raw;
  if (data == null) return null;
  if (typeof data === 'string') {
    const s = data.trim();
    if (!s) return null;
    try { data = JSON.parse(s); } catch { return { headline: '', blocks: [{ title: 'Protocol', items: [{ name: s, meta: [], detail: '' }] }] }; }
  }
  if (Array.isArray(data)) {
    const items = toItems(data);
    return items.length ? { headline: '', blocks: [{ title: 'Protocol', items }] } : null;
  }
  if (typeof data !== 'object') return null;

  const headline = String(
    data.summary || data.headline || data.focus
    || [data.sport, data.position].filter(Boolean).join(' · ') || '',
  ).trim();

  const blocks = [];
  const rawBlocks = Array.isArray(data.blocks) ? data.blocks
    : Array.isArray(data.sections) ? data.sections : null;
  if (rawBlocks) {
    rawBlocks.forEach((b) => { const blk = toBlock(b); if (blk) blocks.push(blk); });
  } else {
    CATEGORY_KEYS.forEach(([key, label]) => {
      if (data[key] != null) { const b = toBlock(data[key], label); if (b) blocks.push(b); }
    });
    // Any other array-valued key we didn't explicitly map → still render it.
    Object.keys(data).forEach((k) => {
      if (RESERVED.has(k) || CATEGORY_KEYS.some(([ck]) => ck === k)) return;
      if (Array.isArray(data[k])) { const b = toBlock(data[k], prettyKey(k)); if (b) blocks.push(b); }
    });
  }

  if (!blocks.length && !headline) return null;
  return { headline, blocks };
}

export default function SportProtocol({ protocol }) {
  const model = normalizeSportsProtocol(protocol);

  // ── Non-athlete fallback — never empty boxes, never a crash ───────────────
  if (!model || !model.blocks.length) {
    return (
      <section className="sh-proto sh-proto--gpp" aria-label="Sport Protocol" data-testid="sport-protocol-gpp">
        <div className="sh-proto-head">
          <span className="sh-proto-kicker">Native Sport Engine</span>
          <h2 className="sh-proto-title">General Physical Preparedness Active</h2>
        </div>
        <p className="sh-proto-gpp">
          No specific sports protocol assigned. Your daily protocol below builds the athletic
          base — speed, strength, and conditioning — until your coach stages a sport-specific plan.
        </p>
      </section>
    );
  }

  return (
    <section className="sh-proto" aria-label="Native Sport Protocol" data-testid="sport-protocol">
      <div className="sh-proto-head">
        <span className="sh-proto-kicker">Native Sport Engine</span>
        <h2 className="sh-proto-title">Sport Protocol</h2>
        {model.headline ? <p className="sh-proto-sub">{model.headline}</p> : null}
      </div>
      <div className="sh-proto-deck">
        {model.blocks.map((block, bi) => (
          <article className="sh-proto-card" key={`${block.title}-${bi}`}>
            <h3 className="sh-proto-card-title">{block.title}</h3>
            <ul className="sh-proto-items">
              {block.items.map((item, ii) => (
                <li className="sh-proto-item" key={ii}>
                  <span className="sh-proto-item-name">{item.name}</span>
                  {item.meta.length ? (
                    <span className="sh-proto-chips">
                      {item.meta.map((m, mi) => <span className="sh-proto-chip" key={mi}>{m}</span>)}
                    </span>
                  ) : null}
                  {item.detail ? <p className="sh-proto-item-detail">{item.detail}</p> : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
