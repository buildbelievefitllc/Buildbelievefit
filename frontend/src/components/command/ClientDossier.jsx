// src/components/command/ClientDossier.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — Client Detail Dossier. The drill-in from a Roster card.
//
// Data path (shared with the Roster via lib/rosterApi.rosterCall — IDENTICAL
// gateway + admin auth):
//
//   POST {FUNCTIONS_BASE}/bbf-admin-roster  { action:'detail', id }
//   200 → { ok:true, client:{ id, uid, name, email, role, metabolic_tier,
//           subscription_tier, dietary_profile, allergens[], food_likes[],
//           food_dislikes[], tdee_target, macro_p, macro_c, macro_f,
//           block_priority, baseline_status, cardiac_clearance, nutrition_plan,
//           nutrition_plan_updated_at, workout_plan, meal_plan, plans_generated_at,
//           workout_blacklist_hits, current_streak, updated_at } }
//
// ⚠️ CONTRACT NOTE: the edge function reads `id` (the bbf_users PK), NOT `uid` —
// it 400s with `missing_id` otherwise (index.ts L227-228). The roster row carries
// both, so the parent hands us the whole row and we drill in by `client.id`.
//
// State contract: { data, isLoading, error } — no silent failures, no infinite
// spinners. The BACK control is ALWAYS rendered so the coach is never trapped.

import { useCallback, useEffect, useState } from 'react';
import { rosterCall, toErrorMessage } from '../../lib/rosterApi.js';
import CommandSurface from './CommandSurface.jsx';

export default function ClientDossier({ client, onBack }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Drill in by the real PK (`id`), never `uid` — see contract note above.
      const body = await rosterCall('detail', { id: client.id });
      setData(body.client ?? null);
    } catch (e) {
      setError(toErrorMessage(e));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [client.id]);

  // Auto-load on mount. Deferred via microtask so the initial setState lands
  // outside the synchronous effect body (satisfies react-hooks/set-state-in-effect)
  // and StrictMode's double-mount is cancelled cleanly.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) fetchDetail(); });
    return () => { cancelled = true; };
  }, [fetchDetail]);

  // Fall back to the roster row's fields while the detail request is in flight, so
  // the header has context immediately instead of a contextless spinner.
  const head = data ?? client;
  const name = head.name || head.uid || 'Unnamed';
  const tier = head.subscription_tier || null;

  return (
    <div>
      <button type="button" style={styles.back} onClick={onBack}>← Back to Roster</button>

      <CommandSurface
        kicker={`Dossier · ${head.uid || head.id || 'client'}`}
        title={name}
        lede={head.email || '—'}
      >
        <div style={styles.badgeStrip}>
          <Badge label={head.role || 'client'} color={tierColor(tier)} />
          {tier ? <Badge label={tier} color={tierColor(tier)} /> : null}
          {head.metabolic_tier ? <Badge label={head.metabolic_tier} color="var(--gold-soft)" /> : null}
          {data?.current_streak ? <Badge label={`Streak · ${data.current_streak}`} color="var(--grn)" /> : null}
        </div>

        {isLoading ? <Loading /> : null}

        {!isLoading && error ? (
          <div style={styles.errorBox} role="alert">
            <div style={styles.errorTitle}>Dossier fetch failed</div>
            <div style={styles.errorMsg}>{error}</div>
            <div style={styles.errorActions}>
              <button type="button" style={styles.retry} onClick={fetchDetail}>Retry</button>
              <button type="button" style={styles.retry} onClick={onBack}>Back to Roster</button>
            </div>
          </div>
        ) : null}

        {!isLoading && !error && data ? <DossierBody c={data} /> : null}
      </CommandSurface>
    </div>
  );
}

// ── The full dossier once detail data has loaded. ──────────────────────────────
function DossierBody({ c }) {
  const workoutDays = asArray(c.workout_plan);
  const workoutText = !workoutDays && typeof c.workout_plan === 'string' ? c.workout_plan.trim() : '';
  const mealDays = asMealDays(c.meal_plan);
  const mealText = !mealDays && typeof c.meal_plan === 'string' ? c.meal_plan.trim() : '';
  const nutritionText = typeof c.nutrition_plan === 'string' ? c.nutrition_plan.trim() : '';

  return (
    <div style={styles.body}>
      {/* ── Macro targets — the headline numbers. ── */}
      <Section title="Macro Targets">
        <div style={styles.tiles}>
          <Tile label="Calories" value={c.tdee_target} unit="kcal" accent="var(--yel)" />
          <Tile label="Protein" value={c.macro_p} unit="g" accent="var(--grn)" />
          <Tile label="Carbs" value={c.macro_c} unit="g" accent="var(--blu)" />
          <Tile label="Fat" value={c.macro_f} unit="g" accent="var(--orn)" />
        </div>
      </Section>

      {/* ── Training & medical profile — the metabolic-tier details. ── */}
      <Section title="Training & Medical Profile">
        <div style={styles.kv}>
          <Field label="Metabolic Tier" value={c.metabolic_tier} />
          <Field label="Block Priority" value={c.block_priority} />
          <Field label="Baseline Status" value={c.baseline_status} color={baselineColor(c.baseline_status)} />
          <Field label="Cardiac Clearance" value={c.cardiac_clearance} color={cardiacColor(c.cardiac_clearance)} />
        </div>
      </Section>

      {/* ── Dietary profile. ── */}
      {(c.dietary_profile || hasItems(c.allergens) || hasItems(c.food_likes) || hasItems(c.food_dislikes)) ? (
        <Section title="Dietary Profile">
          {c.dietary_profile ? <Field label="Profile" value={c.dietary_profile} /> : null}
          <Chips label="Allergens" items={c.allergens} tone="var(--red)" />
          <Chips label="Likes" items={c.food_likes} tone="var(--grn)" />
          <Chips label="Dislikes" items={c.food_dislikes} tone="var(--mut)" />
        </Section>
      ) : null}

      {/* ── Active training plan. ── */}
      <Section title="Active Training Plan" meta={fmtDate(c.plans_generated_at)}>
        {c.workout_blacklist_hits > 0 ? (
          <div style={styles.guardNote}>
            {c.workout_blacklist_hits} contraindicated movement{c.workout_blacklist_hits === 1 ? '' : 's'} stripped by the BBF guard.
          </div>
        ) : null}
        {workoutDays ? (
          <div style={styles.plan}>
            {workoutDays.map((day, i) => (
              <WorkoutDay key={i} day={day} index={i} />
            ))}
          </div>
        ) : workoutText ? (
          <pre style={styles.pre}>{workoutText}</pre>
        ) : (
          <Empty>No active training plan on file.</Empty>
        )}
      </Section>

      {/* ── Nutrition plan. ── */}
      <Section title="Nutrition" meta={fmtDate(c.nutrition_plan_updated_at)}>
        {nutritionText ? <pre style={styles.pre}>{nutritionText}</pre> : null}
        {mealDays ? (
          <div style={styles.plan}>
            {mealDays.map((day, i) => (
              <div key={i} style={styles.mealDay}>
                <span style={styles.dayLabel}>{dayLabel(day, i)}</span>
                <span style={styles.rowSub}>
                  {Array.isArray(day.meals) ? `${day.meals.length} meal${day.meals.length === 1 ? '' : 's'}` : ''}
                  {day.calories ? ` · ${day.calories} kcal` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : mealText ? (
          <pre style={styles.pre}>{mealText}</pre>
        ) : null}
        {!nutritionText && !mealDays && !mealText ? <Empty>No nutrition plan on file.</Empty> : null}
      </Section>

      <div style={styles.footer}>Last updated {fmtDate(c.updated_at) || '—'}</div>
    </div>
  );
}

// ── One workout day from the structured plan. ─────────────────────────────────
function WorkoutDay({ day, index }) {
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
  return (
    <div style={styles.workoutDay}>
      <div style={styles.dayHead}>{dayLabel(day, index)}</div>
      {exercises.length ? (
        <ul style={styles.exList}>
          {exercises.map((ex, i) => (
            <li key={i} style={styles.exItem}>
              <span style={styles.exName}>{ex?.name || 'Exercise'}</span>
              {exMeta(ex) ? <span style={styles.exMeta}>{exMeta(ex)}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <span style={styles.rowSub}>Rest / no exercises listed.</span>
      )}
    </div>
  );
}

// ── Small presentational pieces ────────────────────────────────────────────────
function Section({ title, meta, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHead}>
        <span style={styles.sectionTitle}>{title}</span>
        {meta ? <span style={styles.sectionMeta}>{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}
function Tile({ label, value, unit, accent }) {
  const has = value !== null && value !== undefined && value !== '';
  return (
    <div style={{ ...styles.tile, borderTopColor: accent }}>
      <span style={styles.tileLabel}>{label}</span>
      <span style={styles.tileValue}>{has ? Number(value).toLocaleString() : '—'}</span>
      <span style={styles.tileUnit}>{has ? unit : ''}</span>
    </div>
  );
}
function Field({ label, value, color }) {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={{ ...styles.fieldValue, color: color || 'var(--wht)' }}>{value || '—'}</span>
    </div>
  );
}
function Chips({ label, items, tone }) {
  if (!hasItems(items)) return null;
  return (
    <div style={styles.chipsRow}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={styles.chips}>
        {items.map((it, i) => (
          <span key={i} style={{ ...styles.chip, borderColor: tone, color: tone }}>{String(it)}</span>
        ))}
      </span>
    </div>
  );
}
function Badge({ label, color }) {
  return <span style={{ ...styles.badge, color, borderColor: color }}>{label}</span>;
}
function Loading() {
  return (
    <div style={styles.loading} role="status" aria-live="polite">
      <span style={styles.spinnerDot} />
      Loading dossier…
    </div>
  );
}
function Empty({ children }) {
  return <div style={styles.empty}>{children}</div>;
}

// ── Pure helpers ────────────────────────────────────────────────────────────────
function asArray(v) {
  if (Array.isArray(v)) return v.length ? v : null;
  if (typeof v === 'string' && v.trim()) {
    try { const p = JSON.parse(v); return Array.isArray(p) && p.length ? p : null; } catch { return null; }
  }
  return null;
}
function asMealDays(v) {
  let o = v;
  if (typeof v === 'string' && v.trim()) { try { o = JSON.parse(v); } catch { return null; } }
  if (o && Array.isArray(o.days) && o.days.length) return o.days;
  return null;
}
function hasItems(v) { return Array.isArray(v) && v.length > 0; }
function dayLabel(day, i) {
  return day?.day || day?.title || day?.focus || day?.name || day?.label || `Day ${i + 1}`;
}
function exMeta(ex) {
  const bits = [];
  if (ex?.sets && ex?.reps) bits.push(`${ex.sets}×${ex.reps}`);
  else if (ex?.reps) bits.push(`${ex.reps} reps`);
  if (ex?.rpe) bits.push(`RPE ${ex.rpe}`);
  if (ex?.tempo) bits.push(`tempo ${ex.tempo}`);
  if (ex?.rest) bits.push(`rest ${ex.rest}`);
  return bits.join(' · ');
}
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function tierColor(tier) {
  const map = { platinum: 'var(--yel)', essentials: 'var(--grn)', sovereign: 'var(--purl)' };
  return map[String(tier || '').toLowerCase()] || 'var(--mut)';
}
function baselineColor(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'valid') return 'var(--grn)';
  if (v === 'building') return 'var(--gold-soft)';
  return 'var(--mut)';
}
function cardiacColor(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'provider_cleared') return 'var(--grn)';
  if (v === 'restricted') return 'var(--orn)';
  if (v === 'contraindicated') return 'var(--red)';
  return 'var(--mut)';
}

const styles = {
  back: {
    fontFamily: 'var(--hb)', fontSize: '.78rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'none', border: '1px solid rgba(245,200,0,.35)',
    borderRadius: 8, padding: '.55rem 1rem', cursor: 'pointer', marginBottom: '1.25rem',
  },
  badgeStrip: { display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.5rem' },
  badge: {
    fontFamily: 'var(--hb)', fontSize: '.68rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    border: '1px solid var(--mut)', borderRadius: 6, padding: '.28rem .6rem', whiteSpace: 'nowrap',
  },

  body: { display: 'flex', flexDirection: 'column', gap: '1.6rem', marginTop: '1.4rem' },
  section: { borderTop: '1px solid var(--line)', paddingTop: '1.1rem' },
  sectionHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '.9rem' },
  sectionTitle: { fontFamily: 'var(--hb)', fontSize: '.92rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--wht)' },
  sectionMeta: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)' },

  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.7rem' },
  tile: {
    background: 'var(--gry)', border: '1px solid var(--line)', borderTop: '3px solid var(--mut)',
    borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  },
  tileLabel: { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)' },
  tileValue: { fontFamily: 'var(--display)', fontSize: '2rem', lineHeight: 1.1, color: 'var(--wht)', margin: '.25rem 0 0' },
  tileUnit: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)' },

  kv: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.7rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '.2rem' },
  fieldLabel: { fontFamily: 'var(--hb)', fontSize: '.64rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)' },
  fieldValue: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 700, color: 'var(--wht)', textTransform: 'capitalize' },

  chipsRow: { display: 'flex', flexDirection: 'column', gap: '.35rem', marginTop: '.7rem' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '.4rem' },
  chip: {
    fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 700, letterSpacing: '.3px',
    border: '1px solid var(--mut)', borderRadius: 6, padding: '.2rem .5rem',
  },

  guardNote: {
    fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 700, color: 'var(--orn)',
    border: '1px solid var(--orn)', borderRadius: 8, padding: '.5rem .75rem', marginBottom: '.8rem',
  },
  plan: { display: 'flex', flexDirection: 'column', gap: '.7rem' },
  workoutDay: { background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 12, padding: '.9rem 1.1rem' },
  dayHead: { fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-soft)', marginBottom: '.6rem' },
  exList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' },
  exItem: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' },
  exName: { fontFamily: 'var(--bd)', fontSize: '.95rem', fontWeight: 700, color: 'var(--wht)' },
  exMeta: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'var(--mut)', whiteSpace: 'nowrap' },

  mealDay: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem',
    background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 10, padding: '.6rem .9rem',
  },
  dayLabel: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--wht)' },

  pre: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '.82rem', lineHeight: 1.5,
    color: 'var(--wht)', background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 10,
    padding: '.9rem 1.1rem', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    maxHeight: 320, overflow: 'auto',
  },
  rowSub: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'var(--mut)' },
  empty: { fontFamily: 'var(--bd)', fontSize: '.92rem', fontWeight: 600, color: 'var(--mut)', padding: '.4rem 0' },
  footer: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)', borderTop: '1px solid var(--line)', paddingTop: '.9rem' },

  loading: { display: 'flex', alignItems: 'center', gap: '.6rem', padding: '1.5rem .2rem', color: 'var(--mut)', fontFamily: 'var(--bd)', letterSpacing: '.5px' },
  spinnerDot: { width: 10, height: 10, borderRadius: '50%', background: 'var(--yel)', boxShadow: '0 0 12px rgba(245,200,0,.6)' },

  errorBox: { border: '1px solid var(--red)', borderRadius: 12, padding: '1rem 1.2rem', background: 'rgba(239,68,68,.06)', marginTop: '1rem' },
  errorTitle: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '.35rem' },
  errorMsg: { fontFamily: 'var(--bd)', fontSize: '.95rem', color: 'var(--red)', wordBreak: 'break-word' },
  errorActions: { display: 'flex', gap: '.6rem', marginTop: '.8rem' },
  retry: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 8, padding: '.45rem .9rem', cursor: 'pointer',
  },
};
