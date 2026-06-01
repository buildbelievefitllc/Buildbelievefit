// src/components/vault/Program.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 — Client Vault · Program. The athlete's assigned training protocol.
//
// Source: session.plans.workout_plan, delivered by Supabase at sign-in via the
// bbf_verify_user_pin RPC and normalized by vaultApi.selectPlans(). Rendered as
// pre-wrapped text so the coach-authored protocol keeps its line structure
// without pulling in a markdown engine. A profile streak line gives live
// context from the same fetch the Hub uses.

import { Badge, Empty } from '../command/primitives.jsx';

function formatStamp(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Program({ plans, profile }) {
  const protocol = plans?.workoutPlan || '';
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

      {stamp ? <div style={styles.meta}>Generated {stamp}</div> : null}

      {protocol ? (
        <pre style={styles.protocol}>{protocol}</pre>
      ) : (
        <Empty>
          No training protocol assigned yet — your coach is building it. It will
          appear here automatically the next time you sign in.
        </Empty>
      )}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '.4rem',
  },
  head: {
    fontFamily: 'var(--display)',
    fontSize: '1.5rem',
    letterSpacing: '.5px',
    margin: 0,
  },
  meta: {
    fontFamily: 'var(--bd)',
    fontSize: '.8rem',
    fontWeight: 600,
    color: 'var(--mut)',
    marginBottom: '1rem',
  },
  protocol: {
    fontFamily: 'var(--bd)',
    fontSize: '1rem',
    lineHeight: 1.6,
    color: 'var(--wht)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: 'var(--gry)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: '1.2rem',
    margin: 0,
  },
};
