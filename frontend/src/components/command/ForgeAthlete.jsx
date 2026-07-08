// src/components/command/ForgeAthlete.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE HARDWIRE GATEWAY — "Forge Athlete" modal (Founder Five roster action).
//
// God-mode onboarding bypass with ENFORCED clinical profiling: one single-view
// command interface collecting typology, baseline stats, the biomechanical
// profile (injuries · joint limitations · surgeries as chips), the metabolic
// profile (allergens · intolerances · dietary preference), and the initial
// protocol assignment (macros + starting phase).
//
// On forge:
//   • buildSportsProtocol (youth) runs through applyBiomechExclusions so the
//     joint limitations strip contraindicated movements BEFORE the protocol is
//     ever stored — the system knows what to exclude from day zero.
//   • buildMealPlan runs with the allergen safety net, so a flagged allergen
//     meal never enters the forged 7-day plan.
//   • bbf_admin_forge_athlete executes the atomic master INSERT (zero orphans).
//   • The returned roster row is optimistically injected into the hub list and
//     the one-time credentials (uid + PIN) are surfaced for hand-off.

import { useEffect, useMemo, useState } from 'react';
import { fetchTiers } from '../../lib/rosterApi.js';
import { buildSportsProtocol } from '../../lib/sportsEngine.js';
import { buildMealPlan } from '../../lib/nutritionEngine.js';
import { forgeAthlete, applyBiomechExclusions, forgeErrorMessage } from '../../lib/forgeAthleteApi.js';

const SPORTS = [['general', 'General'], ['basketball', 'Basketball'], ['football', 'Football'], ['soccer', 'Soccer'], ['track', 'Track & Field'], ['baseball', 'Baseball / Softball']];
const PHASES = [[1, 'Phase 1 — Foundation'], [2, 'Phase 2 — Development'], [3, 'Phase 3 — Peak']];
const DIETS = ['Omnivore', 'Vegetarian', 'Vegan'];
const GENDERS = [['', '—'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other']];
const JOINT_PRESETS = ['Knee', 'Shoulder', 'Lower Back', 'Ankle', 'Hip', 'Elbow', 'Wrist'];
// peanut/dairy/gluten are the engine-filtered canonical keys; the rest persist
// on the profile for the coach + future engine coverage.
const ALLERGEN_PRESETS = ['peanut', 'dairy', 'gluten', 'shellfish', 'egg', 'soy'];

// ── Chip array input — type + Enter or tap a preset; × removes. ──────────────
function ChipInput({ label, hint, value, onChange, presets = [], disabled, testId }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const v = String(raw || '').trim();
    if (!v || value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
  };
  return (
    <div className="fg-field fg-field--wide">
      <span className="fg-label">{label}{hint ? <em className="fg-hint"> · {hint}</em> : null}</span>
      <div className="fg-chiprow">
        {value.map((v) => (
          <span key={v} className="fg-chip is-set">
            {v}
            <button type="button" className="fg-chip-x" aria-label={`Remove ${v}`} disabled={disabled}
              onClick={() => onChange(value.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        <input
          className="fg-chip-input"
          type="text"
          placeholder="Type + Enter…"
          value={draft}
          disabled={disabled}
          data-testid={testId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); setDraft(''); } }}
        />
      </div>
      {presets.length ? (
        <div className="fg-presets">
          {presets.filter((p) => !value.some((x) => x.toLowerCase() === p.toLowerCase())).map((p) => (
            <button key={p} type="button" className="fg-chip" disabled={disabled} onClick={() => add(p)}>+ {p}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="fg-field">
      <span className="fg-label">{label}</span>
      {children}
    </label>
  );
}

export default function ForgeAthlete({ onClose, onForged }) {
  const [typology, setTypology] = useState('general');
  const [form, setForm] = useState({
    name: '', age: '', gender: '', weight: '', height: '', tier: '', email: '', language: 'en',
    sport: 'general', position: '', phase: 1,
    dietary_profile: 'Omnivore', tdee_target: '', macro_p: '', macro_c: '', macro_f: '',
  });
  const [injuries, setInjuries] = useState([]);
  const [joints, setJoints] = useState([]);
  const [surgeries, setSurgeries] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [intolerances, setIntolerances] = useState([]);
  const [dislikes, setDislikes] = useState([]);

  const [tiers, setTiers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [forged, setForged] = useState(null); // { credentials, client }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      fetchTiers()
        .then((b) => { if (!cancelled) setTiers(Array.isArray(b.tiers) ? b.tiers : []); })
        .catch(() => { /* dropdown degrades to unassigned */ });
    });
    return () => { cancelled = true; };
  }, []);

  // Live preview of the clinical exclusions the forged protocol will carry.
  const exclusionPreview = useMemo(() => {
    if (typology !== 'youth') return null;
    const proto = buildSportsProtocol({ sport: form.sport, age: Number(form.age) || undefined, experience: 'intermediate', targetPhase: Number(form.phase) || 1 });
    const filtered = applyBiomechExclusions(proto, { injuries, joint_limitations: joints, surgeries });
    return filtered.contraindications || [];
  }, [typology, form.sport, form.age, form.phase, injuries, joints, surgeries]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // 1 · Initialize the protocol client-side with the SAME deterministic
      //     engines the funnel runs — clinical data injected before storage.
      let sports_protocol = null;
      if (typology === 'youth') {
        const proto = buildSportsProtocol({
          sport: form.sport,
          age: Number(form.age) || undefined,
          experience: 'intermediate',
          targetPhase: Number(form.phase) || 1,
        });
        sports_protocol = applyBiomechExclusions(proto, { injuries, joint_limitations: joints, surgeries });
      }
      const tdee = Number(form.tdee_target) || 0;
      const meal_plan = tdee > 0
        ? buildMealPlan({ tdee, dietary_profile: form.dietary_profile, fasting_window: 'none', allergens })
        : null;

      // 2 · The atomic master INSERT.
      const res = await forgeAthlete({
        typology,
        name: form.name,
        age: form.age || null,
        gender: form.gender || null,
        weight: form.weight || null,
        height: form.height || null,
        tier: form.tier || null,
        email: form.email || null,
        language: form.language,
        sport: typology === 'youth' ? form.sport : null,
        position: typology === 'youth' ? form.position : null,
        dietary_profile: form.dietary_profile,
        tdee_target: form.tdee_target || null,
        macro_p: form.macro_p || null,
        macro_c: form.macro_c || null,
        macro_f: form.macro_f || null,
        injuries,
        joint_limitations: joints,
        surgeries,
        allergens,
        intolerances,
        food_dislikes: dislikes,
        sports_protocol,
        meal_plan,
      });

      setForged(res);
      onForged?.(res.client); // optimistic roster injection (instant row)
    } catch (err) {
      setError(forgeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fg-overlay" role="dialog" aria-modal="true" aria-label="Forge Athlete" data-testid="forge-modal">
      <div className="fg-modal">
        <header className="fg-head">
          <div>
            <div className="fg-kicker">⚒ The Hardwire Gateway</div>
            <h3 className="fg-title">Forge Athlete</h3>
            <p className="fg-sub">Onboarding bypass with enforced clinical profiling — one atomic insert, zero orphans.</p>
          </div>
          <button type="button" className="fg-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {forged ? (
          /* ── FORGED: one-time credential hand-off ── */
          <div className="fg-done" data-testid="forge-done">
            <div className="fg-done-mark" aria-hidden="true">⚡</div>
            <div className="fg-done-title">{forged.client?.name} is on the roster.</div>
            <p className="fg-done-note">
              Hand these credentials to the athlete — the PIN is shown <strong>once</strong> and stored only as a hash.
            </p>
            <div className="fg-creds">
              <div className="fg-cred"><span className="fg-label">Username</span><code className="fg-cred-v" data-testid="forge-cred-uid">{forged.credentials?.uid}</code></div>
              <div className="fg-cred"><span className="fg-label">PIN</span><code className="fg-cred-v" data-testid="forge-cred-pin">{forged.credentials?.pin}</code></div>
            </div>
            <button type="button" className="fg-submit" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className="fg-form" onSubmit={submit}>
            {/* ── Typology ── */}
            <div className="fg-seg" role="radiogroup" aria-label="Profile typology">
              {[['general', 'General Client'], ['youth', 'Youth Athlete']].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={typology === v}
                  className={`fg-seg-btn${typology === v ? ' is-on' : ''}`}
                  disabled={busy} onClick={() => setTypology(v)} data-testid={`forge-typology-${v}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── Baseline stats ── */}
            <div className="fg-section">Baseline</div>
            <div className="fg-grid">
              <Field label="Full Name *"><input className="fg-input" required value={form.name} disabled={busy} onChange={set('name')} data-testid="forge-name" /></Field>
              <Field label={typology === 'youth' ? 'Age *' : 'Age'}><input className="fg-input" type="number" min="5" max="100" required={typology === 'youth'} value={form.age} disabled={busy} onChange={set('age')} data-testid="forge-age" /></Field>
              <Field label="Gender">
                <select className="fg-input" value={form.gender} disabled={busy} onChange={set('gender')}>
                  {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Weight"><input className="fg-input" placeholder="185 lb" value={form.weight} disabled={busy} onChange={set('weight')} /></Field>
              <Field label="Height"><input className="fg-input" placeholder={`5'11"`} value={form.height} disabled={busy} onChange={set('height')} /></Field>
              <Field label="Tier Assignment">
                <select className="fg-input" value={form.tier} disabled={busy} onChange={set('tier')} data-testid="forge-tier">
                  <option value="">— unassigned —</option>
                  {tiers.map((t) => <option key={t.slug} value={t.slug}>{t.display_name}</option>)}
                </select>
              </Field>
              <Field label="Email (optional)"><input className="fg-input" type="email" placeholder="forge alias if empty" value={form.email} disabled={busy} onChange={set('email')} /></Field>
              <Field label="Language">
                <select className="fg-input" value={form.language} disabled={busy} onChange={set('language')}>
                  <option value="en">English</option><option value="es">Español</option><option value="pt">Português</option>
                </select>
              </Field>
            </div>

            {/* ── Youth protocol assignment ── */}
            {typology === 'youth' ? (
              <>
                <div className="fg-section">Sport Protocol</div>
                <div className="fg-grid">
                  <Field label="Sport">
                    <select className="fg-input" value={form.sport} disabled={busy} onChange={set('sport')} data-testid="forge-sport">
                      {SPORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Position"><input className="fg-input" value={form.position} disabled={busy} onChange={set('position')} /></Field>
                  <Field label="Starting Phase">
                    <select className="fg-input" value={form.phase} disabled={busy} onChange={set('phase')} data-testid="forge-phase">
                      {PHASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            ) : null}

            {/* ── Biomechanical profile ── */}
            <div className="fg-section">Biomechanical Profile</div>
            <ChipInput label="Injury History" hint="e.g. ACL tear 2023" value={injuries} onChange={setInjuries} disabled={busy} testId="forge-injuries" />
            <ChipInput label="Joint Limitations" hint="strips contraindicated movements" value={joints} onChange={setJoints} presets={JOINT_PRESETS} disabled={busy} testId="forge-joints" />
            <ChipInput label="Past Surgeries" value={surgeries} onChange={setSurgeries} disabled={busy} testId="forge-surgeries" />
            {exclusionPreview?.length ? (
              <div className="fg-exclusions" data-testid="forge-exclusions" role="status">
                🛡 Clinical guard armed — {exclusionPreview.length} movement{exclusionPreview.length === 1 ? '' : 's'} will be stripped: {exclusionPreview.join(' · ')}
              </div>
            ) : null}

            {/* ── Metabolic profile ── */}
            <div className="fg-section">Metabolic Profile</div>
            <ChipInput label="Food Allergies" hint="peanut / dairy / gluten filter the meal engine" value={allergens} onChange={setAllergens} presets={ALLERGEN_PRESETS} disabled={busy} testId="forge-allergens" />
            <ChipInput label="Intolerances" value={intolerances} onChange={setIntolerances} disabled={busy} testId="forge-intolerances" />
            <ChipInput label="Dislikes" value={dislikes} onChange={setDislikes} disabled={busy} testId="forge-dislikes" />
            <div className="fg-grid">
              <Field label="Dietary Preference">
                <select className="fg-input" value={form.dietary_profile} disabled={busy} onChange={set('dietary_profile')}>
                  {DIETS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>

            {/* ── Protocol assignment (macros) ── */}
            <div className="fg-section">Protocol Assignment</div>
            <div className="fg-grid">
              <Field label="Calories (kcal)"><input className="fg-input" type="number" min="0" max="20000" value={form.tdee_target} disabled={busy} onChange={set('tdee_target')} data-testid="forge-tdee" /></Field>
              <Field label="Protein (g)"><input className="fg-input" type="number" min="0" value={form.macro_p} disabled={busy} onChange={set('macro_p')} /></Field>
              <Field label="Carbs (g)"><input className="fg-input" type="number" min="0" value={form.macro_c} disabled={busy} onChange={set('macro_c')} /></Field>
              <Field label="Fats (g)"><input className="fg-input" type="number" min="0" value={form.macro_f} disabled={busy} onChange={set('macro_f')} /></Field>
            </div>
            <p className="fg-note">
              A calorie target auto-initializes the 7-day meal plan (allergen-filtered).
              {typology === 'youth' ? ' The sport protocol initializes with the clinical exclusions above baked in.' : ''}
            </p>

            {error ? <div className="fg-error" role="alert">⚠ {error}</div> : null}

            <footer className="fg-foot">
              <button type="button" className="fg-cancel" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="fg-submit" disabled={busy || !form.name.trim()} data-testid="forge-submit">
                {busy ? '⚒ Forging…' : '⚒ Forge Athlete'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
