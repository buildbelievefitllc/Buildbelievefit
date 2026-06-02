// src/components/LangToggle.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 26 — Global brutalist language switcher (EN · ES · PT).
//
// ONE shared toggle, two homes: the public MarketingLanding master nav and the
// authenticated Vault top bar (ClientVault). It reads the app-wide LangContext,
// so a tap flips every t()-wired string instantly (no reload) and persists the
// choice to localStorage via the provider — the language follows the athlete
// straight through the login gate.
//
// Brand-locked styling (CLAUDE.md §2): a purple-framed segmented control whose
// ACTIVE segment fills brand purple with a Victory-Gold label. Self-contained
// inline styles (no CSS import) so it drops onto any dark BBF surface unchanged.
// An optional `style` prop lets a host nudge spacing without forking the look.

import { useLang } from '../context/LangContext.jsx';
import { LANGS } from '../context/langs.js';

const GOLD = '#F5C800'; // Victory Gold — active label
const PUR = '#6A0DAD';  // brand purple — active fill

export default function LangToggle({ style }) {
  const { lang, setLang } = useLang();
  return (
    <div style={{ ...styles.wrap, ...style }} role="group" aria-label="Language">
      {LANGS.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            data-lang={code}
            style={{ ...styles.btn, ...(active ? styles.btnActive : null) }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    display: 'inline-flex',
    flex: '0 0 auto',
    border: '1px solid rgba(157,39,201,.45)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  btn: {
    fontFamily: "'Bebas Neue',sans-serif",
    fontSize: '.82rem',
    letterSpacing: '1.5px',
    lineHeight: 1,
    color: 'rgba(255,255,255,.6)',
    background: 'transparent',
    border: 'none',
    padding: '.4rem .6rem',
    cursor: 'pointer',
  },
  btnActive: { background: PUR, color: GOLD },
};
