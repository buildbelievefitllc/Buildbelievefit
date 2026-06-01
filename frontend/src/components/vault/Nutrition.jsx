// src/components/vault/Nutrition.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 — Client Vault · Nutrition. The athlete's assigned fueling plan.
//
// Source: session.plans.meal_plan, delivered by Supabase at sign-in via the
// bbf_verify_user_pin RPC and normalized by vaultApi.selectPlans(). (The Phase
// 10 bbf_users.nutrition_plan jsonb rotator envelope is a future enrichment —
// it is not part of the auth payload, so the meal_plan text is the runtime
// source of record here.) Rendered as pre-wrapped text, mirroring Program.

import { Empty } from '../command/primitives.jsx';

function formatStamp(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Nutrition({ plans }) {
  const mealPlan = plans?.mealPlan || '';
  const stamp = formatStamp(plans?.generatedAt);

  return (
    <div>
      <h2 style={styles.head}>Fueling Plan</h2>
      {stamp ? <div style={styles.meta}>Generated {stamp}</div> : null}

      {mealPlan ? (
        <pre style={styles.plan}>{mealPlan}</pre>
      ) : (
        <Empty>
          No fueling plan assigned yet — your coach is dialing in your macros. It
          will appear here automatically the next time you sign in.
        </Empty>
      )}
    </div>
  );
}

const styles = {
  head: {
    fontFamily: 'var(--display)',
    fontSize: '1.5rem',
    letterSpacing: '.5px',
    margin: '0 0 .4rem',
  },
  meta: {
    fontFamily: 'var(--bd)',
    fontSize: '.8rem',
    fontWeight: 600,
    color: 'var(--mut)',
    marginBottom: '1rem',
  },
  plan: {
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
