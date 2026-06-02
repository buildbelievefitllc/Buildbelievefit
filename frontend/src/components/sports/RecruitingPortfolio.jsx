// src/components/sports/RecruitingPortfolio.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Recruiting Portfolio (Live Bio) — the shareable scout-facing module. Verified
// performance highlights + an AI scout summary, with a one-click "Copy Scout
// Access URL" that yields a public portfolio link.

import { useState } from 'react';
import { copyText } from './clipboard.js';

const SCOUT_BASE = 'https://buildbelievefit.fitness/scout/';

export default function RecruitingPortfolio({ recruiting }) {
  const [copied, setCopied] = useState(false);
  const url = SCOUT_BASE + recruiting.scoutSlug;

  const onCopy = async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <section className="sp-card sp-recruit">
      <div className="sp-card-head">
        <div>
          <div className="sp-card-tag">Recruiting Portfolio (Live Bio)</div>
          <h3 className="sp-card-title">Shareable Scout Profile</h3>
        </div>
        {recruiting.verified ? <span className="sp-verified">✓ AI-Verified</span> : null}
      </div>

      <div style={{ marginBottom: '.8rem' }}>
        <span className="sp-card-tag">Recruiting Visibility: </span>
        <span className="sp-recruit-vis">{recruiting.visibility}</span>
      </div>

      <div className="sp-hl-title">Verified Performance Highlights</div>
      <div className="sp-highlights">
        {recruiting.highlights.map((h) => (
          <div key={h.label} className="sp-highlight">
            <div className="sp-highlight-l">{h.label}</div>
            <div className="sp-highlight-v">{h.value}</div>
          </div>
        ))}
      </div>

      <p className="sp-recruit-bio">{recruiting.bio}</p>

      <button type="button" className={`sp-copy${copied ? ' is-copied' : ''}`} onClick={onCopy}>
        {copied ? '✓ Scout URL Copied' : '👁 Copy Scout Access URL'}
      </button>
    </section>
  );
}
