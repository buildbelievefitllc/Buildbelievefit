// src/components/vault/Program.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 → 18.1 — Client Vault · Program.
//
// Primary surface is now the dense, clinical 7-day <ProgramGrid> reconstructed
// from the legacy monolith (day pills → exercise tables → per-set weight
// tracking with server autoregulation). Exercises render STRICTLY from the
// authorized program catalog — see components/vault/programData.js.
//
// The AI-generated text protocol delivered at sign-in (session.plans.workout_plan,
// Phase 18 data wiring) is preserved below the grid as a collapsible reference so
// nothing from the auth payload is lost.

import { useAuth } from '../../context/AuthContext.jsx';
import { Badge } from '../command/primitives.jsx';
import ProgramGrid from './ProgramGrid.jsx';

function formatStamp(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Program({ plans, profile }) {
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';
  const textPlan = plans?.workoutPlan || '';
  const stamp = formatStamp(plans?.generatedAt);

  return (
    <div>
      <div style={styles.bar}>
        <h2 style={styles.head}>Training Protocol</h2>
        {profile ? (
          <Badge
            label={`${profile.currentStreak}-day streak`}
            color={profile.currentStreak > 0 ? 'var(--grn)' : 'var(--mut)'}
          />
        ) : null}
      </div>

      <ProgramGrid uid={uid} programKey={user?.programKey} />

      {textPlan ? (
        <details style={styles.details}>
          <summary style={styles.summary}>
            Coach&apos;s written protocol{stamp ? ` · ${stamp}` : ''}
          </summary>
          <pre style={styles.protocol}>{textPlan}</pre>
        </details>
      ) : null}
    </div>
  );
}

const styles = {
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' },
  head: { fontFamily: 'var(--display)', fontSize: '1.5rem', letterSpacing: '.5px', margin: 0 },
  details: {
    marginTop: '1.4rem',
    background: 'var(--gry)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: '.4rem .9rem',
  },
  summary: {
    fontFamily: 'var(--hb)',
    fontSize: '.78rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'var(--gold-soft)',
    cursor: 'pointer',
    padding: '.6rem 0',
  },
  protocol: {
    fontFamily: 'var(--bd)',
    fontSize: '1rem',
    lineHeight: 1.6,
    color: 'var(--wht)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: '.4rem 0 .6rem',
  },
};
