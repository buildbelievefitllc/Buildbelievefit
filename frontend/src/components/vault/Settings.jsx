// src/components/vault/Settings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.2 — Vault · Settings.
//
// A lightweight account surface shared by the client Vault and the admin
// "player-coach" Command Center. Three blocks: account identity (read-only from
// the auth session), trilingual language preference (LangContext — structural,
// not optional per the brand), and session control (sign out). No backend writes
// — identity is server-issued at PIN login and language is a local preference.

import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import './vault.css';

const LANG_LABELS = { en: 'English', es: 'Español', pt: 'Português' };

export default function Settings() {
  const { user, isAdmin, signOut } = useAuth();
  const { lang, setLang } = useLang();

  const username = user?.username || user?.id || '—';
  const role = isAdmin ? 'Admin · Coach' : (user?.role ? user.role : 'Client');

  return (
    <div className="pg-nut">
      <div>
        <h2 className="pg-nut-head">Settings</h2>
        <div className="pg-nut-meta">Account · preferences · session</div>
      </div>

      <div className="pg-card">
        <div className="pg-set-title">Account</div>
        <div className="pg-set-row">
          <span className="pg-set-k">Username</span>
          <span className="pg-set-v">@{username}</span>
        </div>
        <div className="pg-set-row">
          <span className="pg-set-k">Access tier</span>
          <span className="pg-set-v">{role}</span>
        </div>
      </div>

      <div className="pg-card">
        <div className="pg-set-title">Language</div>
        <div className="pg-set-langs">
          {Object.keys(LANG_LABELS).map((code) => (
            <button
              key={code}
              type="button"
              className={`pg-set-lang${lang === code ? ' is-active' : ''}`}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
            >
              {LANG_LABELS[code]}
            </button>
          ))}
        </div>
      </div>

      <div className="pg-card">
        <div className="pg-set-title">Session</div>
        <button type="button" className="pg-set-signout" onClick={signOut}>Sign Out</button>
      </div>
    </div>
  );
}
