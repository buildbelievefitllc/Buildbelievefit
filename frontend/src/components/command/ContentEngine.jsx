// src/components/command/ContentEngine.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Command Center · Content panel — operator editing for the marketing CTA decks (the
// "Earn The Vault" calibration cards today; any deck tomorrow). Lists the deck, edits a
// card's TRILINGUAL copy + tone + order + live flag, and persists via the admin-gated
// Content Engine RPCs. The public landing reads the same rows live and falls back to its
// hardcoded deck if this is ever empty — so editing here is safe and self-serve.

import { useCallback, useEffect, useState } from 'react';
import {
  listMarketingCards,
  upsertMarketingCard,
  deleteMarketingCard,
} from '../../lib/contentEngineApi.js';

const TONES = ['locked', 'ignite', 'open'];
const BLANK = {
  id: '', deck: 'calibration', sort: 0, idx: '', tone: 'locked', active: true,
  state_en: '', state_es: '', state_pt: '',
  lead_en: '', lead_es: '', lead_pt: '',
  body_en: '', body_es: '', body_pt: '',
};
const FIELD_LABEL = { state: 'State chip', lead: 'Headline', body: 'Body copy' };

export default function ContentEngine() {
  const [cards, setCards] = useState([]);
  const [draft, setDraft] = useState(null); // the card being edited (or null)
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'ok'|'err', text }

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const rows = await listMarketingCards('calibration');
      setCards(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setMsg({ kind: 'err', text: e?.message || 'Could not load cards.' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Defer the initial load out of the synchronous effect body (mirrors AccessControl)
  // so the fetch's setState doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [load]);

  const field = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    try {
      await upsertMarketingCard({ ...draft, sort: Number(draft.sort) || 0 });
      setMsg({ kind: 'ok', text: 'Saved — live on the landing next load.' });
      setDraft(null);
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e?.message || 'Save failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!id) { setDraft(null); return; }
    setBusy(true);
    setMsg(null);
    try {
      await deleteMarketingCard(id);
      setDraft(null);
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e?.message || 'Delete failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <div>
          <h2 style={S.h}>Content Engine</h2>
          <p style={S.sub}>The “Earn The Vault” calibration deck — edits go live on the marketing landing.</p>
        </div>
        <div style={S.headBtns}>
          <button type="button" style={S.ghost} onClick={load} disabled={loading || busy}>↻ Refresh</button>
          <button type="button" style={S.gold} onClick={() => { setDraft({ ...BLANK, sort: cards.length + 1 }); setMsg(null); }} disabled={busy}>+ New card</button>
        </div>
      </div>

      {msg ? <div style={{ ...S.msg, ...(msg.kind === 'ok' ? S.msgOk : S.msgErr) }}>{msg.text}</div> : null}
      {loading ? <div style={S.dim}>Loading…</div> : null}

      <div style={S.list}>
        {cards.map((c) => (
          <button type="button" key={c.id} style={S.row} onClick={() => { setDraft({ ...BLANK, ...c }); setMsg(null); }}>
            <span style={S.rowIdx}>{c.idx || '—'}</span>
            <span style={S.rowLead}>{c.lead_en || '(untitled)'}</span>
            <span style={{ ...S.chip, ...(c.active ? S.chipOn : S.chipOff) }}>{c.active ? 'Live' : 'Hidden'}</span>
            <span style={S.rowTone}>{c.tone}</span>
          </button>
        ))}
        {!loading && !cards.length ? (
          <div style={S.dim}>No cards yet — the landing is showing its built-in fallback. Add one to take control.</div>
        ) : null}
      </div>

      {draft ? (
        <div style={S.editor}>
          <div style={S.editorTop}>
            <strong style={S.editorTitle}>{draft.id ? 'Edit card' : 'New card'}</strong>
            <button type="button" style={S.x} onClick={() => setDraft(null)} aria-label="Close">✕</button>
          </div>

          <div style={S.grid3}>
            <Field l="Index (badge)"><input style={S.in} value={draft.idx} onChange={(e) => field('idx', e.target.value)} placeholder="01" /></Field>
            <Field l="Order"><input style={S.in} type="number" value={draft.sort} onChange={(e) => field('sort', e.target.value)} /></Field>
            <Field l="Tone">
              <select style={S.in} value={draft.tone} onChange={(e) => field('tone', e.target.value)}>
                {TONES.map((tn) => <option key={tn} value={tn}>{tn}</option>)}
              </select>
            </Field>
          </div>

          {['state', 'lead', 'body'].map((f) => (
            <div key={f} style={S.fieldGroup}>
              <div style={S.fieldLabel}>{FIELD_LABEL[f]}</div>
              <div style={S.grid3}>
                {['en', 'es', 'pt'].map((lg) => (
                  <Field key={lg} l={lg.toUpperCase()}>
                    {f === 'body'
                      ? <textarea style={{ ...S.in, minHeight: 64, resize: 'vertical' }} value={draft[`${f}_${lg}`]} onChange={(e) => field(`${f}_${lg}`, e.target.value)} />
                      : <input style={S.in} value={draft[`${f}_${lg}`]} onChange={(e) => field(`${f}_${lg}`, e.target.value)} />}
                  </Field>
                ))}
              </div>
            </div>
          ))}

          <label style={S.activeRow}>
            <input type="checkbox" checked={!!draft.active} onChange={(e) => field('active', e.target.checked)} />
            <span>Live on the landing</span>
          </label>

          <div style={S.editorBtns}>
            <button type="button" style={S.gold} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save card'}</button>
            {draft.id ? <button type="button" style={S.danger} onClick={() => remove(draft.id)} disabled={busy}>Delete</button> : null}
            <button type="button" style={S.ghost} onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ l, children }) {
  return (<label style={S.lbl}><span style={S.lblText}>{l}</span>{children}</label>);
}

const PUR = '#6a0dad';
const GOLD = '#f5c800';
const INK = '#0e0a16';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";
const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 14 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  h: { fontFamily: HEAD, fontSize: '1.6rem', letterSpacing: '1px', color: '#fff', margin: 0 },
  sub: { fontFamily: BODY, color: 'rgba(255,255,255,.6)', margin: '2px 0 0', fontSize: '.95rem' },
  headBtns: { display: 'flex', gap: 8 },
  gold: { fontFamily: BODY, fontWeight: 700, letterSpacing: '.5px', background: GOLD, color: '#090909', border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' },
  ghost: { fontFamily: BODY, fontWeight: 700, background: 'transparent', color: 'rgba(255,255,255,.8)', border: `1px solid ${PUR}`, borderRadius: 8, padding: '9px 16px', cursor: 'pointer' },
  danger: { fontFamily: BODY, fontWeight: 700, background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,.5)', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' },
  msg: { borderRadius: 8, padding: '8px 12px', fontFamily: BODY, fontWeight: 600 },
  msgOk: { background: 'rgba(34,197,94,.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,.35)' },
  msgErr: { background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.35)' },
  dim: { color: 'rgba(255,255,255,.5)', fontFamily: BODY, padding: '4px 0' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', background: 'linear-gradient(135deg, rgba(106,13,173,.16), rgba(9,9,9,.4))', border: '1px solid rgba(157,39,201,.3)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' },
  rowIdx: { fontFamily: HEAD, fontSize: '1.2rem', color: PUR, minWidth: 28 },
  rowLead: { flex: 1, fontFamily: BODY, fontWeight: 600, color: '#fff' },
  rowTone: { fontFamily: BODY, fontSize: '.8rem', color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '1px' },
  chip: { fontFamily: BODY, fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '3px 9px', borderRadius: 999 },
  chipOn: { background: 'rgba(34,197,94,.16)', color: '#22c55e' },
  chipOff: { background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.55)' },
  editor: { background: INK, border: '1px solid rgba(157,39,201,.4)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  editorTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  editorTitle: { fontFamily: HEAD, fontSize: '1.2rem', letterSpacing: '1px', color: GOLD },
  x: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: '1.1rem', cursor: 'pointer' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontFamily: BODY, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', fontSize: '.78rem', color: GOLD },
  lbl: { display: 'flex', flexDirection: 'column', gap: 4 },
  lblText: { fontFamily: BODY, fontSize: '.74rem', letterSpacing: '.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' },
  in: { fontFamily: BODY, fontSize: '.95rem', color: '#fff', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(157,39,201,.4)', borderRadius: 8, padding: '8px 10px', width: '100%', boxSizing: 'border-box' },
  activeRow: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: BODY, color: '#fff' },
  editorBtns: { display: 'flex', gap: 8, flexWrap: 'wrap' },
};
