// src/components/command/AccessControl.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "Access Control / Revenue Roster" — the CEO's master control switches for
// subscription tier + Vault access. Brutalist two-pane (purple/gold, dark) built
// on the shared Founder-Five master-detail shell (founderfive.css):
//
//   MASTER → every registered athlete, each row showing their TIER badge and a
//            live ACCOUNT STATUS badge (Active / Delinquent / Locked). Filterable.
//   DETAIL → the Executive Override console for the selected athlete:
//              • Tier Reassignment — manual comp / up / downgrade (bypasses Stripe)
//              • The Kill Switch    — high-friction Lock / Unlock that revokes the
//                                     athlete's vault session server-side.
//
// Every read/write goes through the token-gated bbf-admin-roster edge function
// (service-role, X-BBF-Admin-Token); the browser never touches bbf_users directly
// (CLAUDE.md §7). The tier allowlist + akeem safety nets live in the DB RPCs, so
// this surface is a thin, honest driver of that single source of truth.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  rosterCall,
  toErrorMessage,
  fetchTiers,
  reassignTier,
  setAccessStatus,
  accountStatusMeta,
} from '../../lib/rosterApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './founderfive.css';
import './accessControl.css';

// Human labels for the bbf_tiers.category buckets (dropdown optgroups).
const CATEGORY_LABEL = {
  fitness: 'Fitness',
  nutrition: 'Fuel · Nutrition',
  youth: 'Youth Athlete',
  hybrid_6wk: 'Hybrid · 6-Week',
  hybrid_8wk: 'Hybrid · 8-Week',
  hybrid_12wk: 'Hybrid · 12-Week',
};

export default function AccessControl() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeUid, setActiveUid] = useState(null);
  const [filter, setFilter] = useState('');

  const fetchRoster = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const body = await rosterCall('roster');
      setClients(Array.isArray(body.clients) ? body.clients : []);
    } catch (e) {
      setError(toErrorMessage(e));
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTiers = useCallback(async () => {
    try {
      const body = await fetchTiers();
      setTiers(Array.isArray(body.tiers) ? body.tiers : []);
    } catch {
      /* non-fatal — the dropdown degrades to the athlete's current tier only */
    }
  }, []);

  // Auto-load on mount (admin token already hydrated by the Command Center gate).
  // Microtask-deferred so the initial setState lands outside the synchronous effect
  // body (mirrors ClientHub — satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      fetchRoster();
      loadTiers();
    });
    return () => { cancelled = true; };
  }, [fetchRoster, loadTiers]);

  const active = clients.find((c) => c.uid === activeUid) || null;

  // Live, real stats from the roster payload — no fabricated numbers.
  const total = clients.length;
  const lockedCount = clients.filter((c) => c.account_status === 'locked').length;
  const delinquentCount = clients.filter((c) => c.account_status === 'delinquent').length;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name || ''} ${c.uid || ''} ${c.email || ''} ${c.subscription_tier || ''} ${c.account_status || ''}`
        .toLowerCase()
        .includes(q));
  }, [clients, filter]);

  // slug → display name resolver (from bbf_tiers); legacy slugs humanize gracefully.
  const tierLabel = useMemo(() => {
    const m = new Map(tiers.map((t) => [t.slug, t.display_name]));
    return (slug) => m.get(slug) || (slug ? String(slug).replace(/_/g, ' ').toUpperCase() : '—');
  }, [tiers]);

  const execName = (user?.displayName || user?.username || 'Sovereign').toUpperCase();

  return (
    <div className="ff ac">
      <header className="ff-hub-head">
        <div className="ff-exec-kicker">◈ {execName}&apos;s Access Control</div>
        <div className="ff-hub-row">
          <div className="ff-hub-titlewrap">
            <h2 className="ff-hub-title">⊟ Revenue Roster</h2>
            <p className="ff-lede">
              Master control for subscription tier and Vault access. Reassign tiers for
              comps and manual adjustments, and lock or unlock any account in one move —
              a lock instantly revokes the athlete&apos;s live session.
            </p>
          </div>
          <div className="ff-stats">
            <div className="ff-stat">
              <span className="ff-stat-label">Registered</span>
              <span className="ff-stat-val">{isLoading ? '—' : total}<em> Athletes</em></span>
            </div>
            <div className="ff-stat ac-stat--amber">
              <span className="ff-stat-label">Delinquent</span>
              <span className="ff-stat-val ac-val--amber">{isLoading ? '—' : delinquentCount}</span>
            </div>
            <div className="ff-stat ac-stat--red">
              <span className="ff-stat-label">Locked</span>
              <span className="ff-stat-val ac-val--red">{isLoading ? '—' : lockedCount}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="ff-grid">
        {/* ── MASTER: every registered athlete ── */}
        <aside className="ff-master" aria-label="Access control roster">
          <div className="ff-roster-kicker">● Registered Athletes</div>
          <input
            className="ff-filter"
            type="search"
            placeholder="Filter by name, tier, status…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter athletes"
          />
          <div className="ff-toolbar">
            <span className="ff-count">
              {isLoading ? 'Loading…' : `${filtered.length} of ${total} athlete${total === 1 ? '' : 's'}`}
            </span>
            <button type="button" className="ff-refresh" onClick={fetchRoster} disabled={isLoading}>
              ↻ Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="ff-state" role="status" aria-live="polite">
              <span className="ff-dot" /> Loading roster…
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="ff-error" role="alert">
              <div className="ff-error-title">Roster fetch failed</div>
              <div className="ff-error-msg">{error}</div>
              <button type="button" className="ff-retry" onClick={fetchRoster}>Retry</button>
            </div>
          ) : null}

          {!isLoading && !error && total === 0 ? (
            <div className="ff-state">No registered athletes yet.</div>
          ) : null}

          {!isLoading && !error && total > 0 && filtered.length === 0 ? (
            <div className="ff-state">No athletes match “{filter}”.</div>
          ) : null}

          {!isLoading && !error && filtered.length > 0 ? (
            <ul className="ff-list">
              {filtered.map((c) => (
                <RosterRow
                  key={c.uid ?? c.id ?? c.email}
                  client={c}
                  tierLabel={tierLabel}
                  active={c.uid === activeUid}
                  onSelect={() => setActiveUid(c.uid)}
                />
              ))}
            </ul>
          ) : null}
        </aside>

        {/* ── DETAIL: executive override console ── */}
        <section className={`ff-detail${active ? ' is-open' : ''}`} aria-label="Executive override console">
          {active ? (
            <OverrideConsole
              key={active.uid}
              client={active}
              tiers={tiers}
              tierLabel={tierLabel}
              onChanged={fetchRoster}
            />
          ) : (
            <div className="ff-placeholder">
              <span className="ff-placeholder-mark" aria-hidden="true">⊟</span>
              <div className="ff-placeholder-title">No athlete selected</div>
              <div className="ff-placeholder-note">
                Choose an athlete from the roster to reassign their tier or trigger the
                account kill switch.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── One roster row — name, tier badge, account-status badge. ─────────────────────
function RosterRow({ client, tierLabel, active, onSelect }) {
  const name = client.name || client.uid || 'Unnamed';
  const meta = accountStatusMeta(client.account_status);
  return (
    <li>
      <button
        type="button"
        className={`ff-row${active ? ' is-active' : ''}`}
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`Open access controls for ${name}`}
      >
        <span className="ff-avatar" style={{ borderColor: meta.color }}>{initials(name)}</span>
        <span className="ff-row-main">
          <span className="ff-row-name">{name}</span>
          <span className="ff-row-sub">@{client.uid || '—'}</span>
        </span>
        <span className="ff-row-meta">
          <span className="ff-badge ac-tier-badge">{tierLabel(client.subscription_tier)}</span>
          <span className="ac-status" style={{ color: meta.color, borderColor: meta.color }}>
            <span className="ac-status-dot" style={{ background: meta.color }} />
            {meta.label}
          </span>
        </span>
      </button>
    </li>
  );
}

// ── Executive override console (detail pane) ─────────────────────────────────────
// Keyed by client.uid in the parent, so selecting a new athlete remounts this and
// the local form state resets cleanly (no stale tier / confirmation carryover).
function OverrideConsole({ client, tiers, tierLabel, onChanged }) {
  const isAkeem = String(client.uid || '').toLowerCase() === 'akeem';
  const isLocked = client.account_status === 'locked';
  const meta = accountStatusMeta(client.account_status);

  const [tier, setTier] = useState(client.subscription_tier || '');
  const [tierBusy, setTierBusy] = useState(false);
  const [tierMsg, setTierMsg] = useState(null); // { kind:'ok'|'err', text }

  const [confirm, setConfirm] = useState('');
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMsg, setLockMsg] = useState(null); // { kind:'ok'|'lock'|'err', text }

  const grouped = useMemo(() => {
    const g = {};
    for (const t of tiers) { (g[t.category] = g[t.category] || []).push(t); }
    return g;
  }, [tiers]);
  const currentKnown = tiers.some((t) => t.slug === client.subscription_tier);
  const tierUnchanged = tier === (client.subscription_tier || '');

  async function onReassign() {
    if (tierBusy || isAkeem || tierUnchanged) return;
    setTierBusy(true);
    setTierMsg(null);
    try {
      await reassignTier(client.uid, tier);
      setTierMsg({ kind: 'ok', text: `Tier set to ${tierLabel(tier)}.` });
      onChanged();
    } catch (e) {
      setTierMsg({ kind: 'err', text: toErrorMessage(e) });
    } finally {
      setTierBusy(false);
    }
  }

  // Kill switch: locking requires typing the exact @uid (high-friction). Unlocking
  // is a single confirmed click.
  const confirmMatches = confirm.trim().toLowerCase() === String(client.uid || '').toLowerCase();
  const canLock = !isAkeem && !lockBusy && (isLocked || confirmMatches);

  async function onToggleLock() {
    if (!canLock) return;
    const next = isLocked ? 'unlocked' : 'locked';
    setLockBusy(true);
    setLockMsg(null);
    try {
      const res = await setAccessStatus(client.uid, next);
      setLockMsg(next === 'locked'
        ? { kind: 'lock', text: `Account LOCKED. ${res.sessions_revoked || 0} live session(s) revoked — the athlete is being ejected to the login screen.` }
        : { kind: 'ok', text: 'Account unlocked. The athlete can sign in again.' });
      setConfirm('');
      onChanged();
    } catch (e) {
      setLockMsg({ kind: 'err', text: toErrorMessage(e) });
    } finally {
      setLockBusy(false);
    }
  }

  return (
    <div className="ac-console">
      <div className="ac-console-head">
        <div className="ac-console-id">
          <h3 className="ac-console-name">{client.name || client.uid}</h3>
          <div className="ac-console-sub">@{client.uid}{client.email ? ` · ${client.email}` : ''}</div>
        </div>
        <span className="ac-status ac-status--lg" style={{ color: meta.color, borderColor: meta.color }}>
          <span className="ac-status-dot" style={{ background: meta.color }} />
          {meta.label}
        </span>
      </div>

      {/* ── Tier Reassignment ── */}
      <section className="ac-block">
        <div className="ac-block-kicker">◆ Tier Reassignment</div>
        <p className="ac-block-note">
          Manual comp, upgrade, or downgrade — applied directly, bypassing Stripe.
        </p>
        <div className="ac-row">
          <select
            className="ac-select"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            disabled={isAkeem || tierBusy}
            aria-label="Subscription tier"
          >
            {!currentKnown && client.subscription_tier ? (
              <option value={client.subscription_tier}>{tierLabel(client.subscription_tier)} (current)</option>
            ) : null}
            {!client.subscription_tier ? <option value="">— unassigned —</option> : null}
            {Object.keys(grouped).map((cat) => (
              <optgroup key={cat} label={CATEGORY_LABEL[cat] || cat}>
                {grouped[cat].map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.display_name} — {formatPrice(t)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            className="ac-btn ac-btn--gold"
            onClick={onReassign}
            disabled={isAkeem || tierBusy || tierUnchanged}
          >
            {tierBusy ? 'Saving…' : 'Reassign Tier'}
          </button>
        </div>
        {isAkeem ? (
          <div className="ac-msg ac-msg--note">Founder account is permanently set to Sovereign.</div>
        ) : null}
        {tierMsg ? (
          <div className={`ac-msg ${tierMsg.kind === 'err' ? 'ac-msg--err' : 'ac-msg--ok'}`} role="status">
            {tierMsg.text}
          </div>
        ) : null}
      </section>

      {/* ── The Kill Switch ── */}
      <section className={`ac-block ac-danger${isLocked ? ' is-locked' : ''}`}>
        <div className="ac-block-kicker ac-danger-kicker">⚠ Account Kill Switch</div>
        {isAkeem ? (
          <p className="ac-block-note">
            The founder account cannot be locked — the kill switch is disabled for this user.
          </p>
        ) : isLocked ? (
          <>
            <p className="ac-block-note">
              This account is <b>locked</b>. The athlete cannot sign in and has no Vault access.
              Unlocking restores their access immediately.
            </p>
            <button type="button" className="ac-btn ac-btn--unlock" onClick={onToggleLock} disabled={lockBusy}>
              {lockBusy ? 'Unlocking…' : '⊞ Unlock Account'}
            </button>
          </>
        ) : (
          <>
            <p className="ac-block-note">
              Locking <b>instantly revokes this athlete&apos;s live session</b>, throws them back to
              the public login, and blocks re-entry until you unlock. To confirm, type their
              handle <code className="ac-code">@{client.uid}</code> below.
            </p>
            <div className="ac-row">
              <input
                className="ac-confirm"
                type="text"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={`type @${client.uid} to arm`}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-label="Type the athlete handle to confirm lock"
              />
              <button
                type="button"
                className="ac-btn ac-btn--lock"
                onClick={onToggleLock}
                disabled={!canLock}
              >
                {lockBusy ? 'Locking…' : '⛔ Lock Account'}
              </button>
            </div>
          </>
        )}
        {lockMsg ? (
          <div
            className={`ac-msg ${lockMsg.kind === 'err' ? 'ac-msg--err' : lockMsg.kind === 'lock' ? 'ac-msg--lock' : 'ac-msg--ok'}`}
            role="alert"
          >
            {lockMsg.text}
          </div>
        ) : null}
      </section>
    </div>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '—';
}

function formatPrice(t) {
  const dollars = (Number(t?.price_cents) || 0) / 100;
  const amount = `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
  return t?.billing_type === 'recurring' ? `${amount}/mo` : amount;
}
