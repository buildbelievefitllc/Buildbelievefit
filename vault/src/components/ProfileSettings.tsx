// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/ProfileSettings.tsx
//
// Phase 4.3e · User biometrics + macro target editor · PASSOVER §5
// step (f) closeout. Writes to the LOCAL BBFPayload via
// `updateUserProfile` because anon RLS on `bbf_users` permits SELECT
// only · the cloud-sync RPC `bbf_update_profile` is queued for a
// future sprint (see the in-band `cloudPending` note rendered to the
// user so the contract is transparent rather than hidden).
//
// VISUAL CONTRACT (CEO directive · Phase 4.3 architecture)
//   · Intrinsic CSS Grid throughout · field grid uses auto-fit
//     `repeat(auto-fit, minmax(min(100%, 12rem), 1fr))` so 1-up on
//     phones and 2-up on wide monitors with zero @media branches.
//   · clamp() typography on every text scale · zero hardcoded font
//     sizes in the module.
//   · Strict text-input containment · every <input>/<select> gets
//     `width: 100%; max-width: 100%; min-width: 0; box-sizing:
//     border-box` so the native intrinsic widths (Chrome's 169px
//     default on bare <input>) never push past the grid cell.
//   · Submit button capped at `max-width: 400px; margin-inline: auto`.
//
// DOUBLE-SUBMIT SHIELD
// `submitting` boolean guards the save round-trip (which is local
// today but Promise-shaped for future cloud-sync compatibility) ·
// the button is `disabled={submitting}` + label flips to "Saving…"
// · early-return in the handler bounces spam-clicks.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react';
import {
  getActiveUid,
  getUserRecord,
  updateUserProfile,
  type ProfilePatch,
} from '../services/supabaseClient';
import styles from './ProfileSettings.module.css';

const DIETARY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '',           label: 'No preference set' },
  { value: 'omnivore',   label: 'Omnivore' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'pescatarian',label: 'Pescatarian' },
  { value: 'vegan',      label: 'Vegan' },
  { value: 'keto',       label: 'Keto / low-carb' },
  { value: 'paleo',      label: 'Paleo' },
];

interface FormState {
  name: string;
  email: string;
  tdee: string;
  macroP: string;
  macroC: string;
  macroF: string;
  dietary: string;
}

function emptyForm(): FormState {
  return { name: '', email: '', tdee: '', macroP: '', macroC: '', macroF: '', dietary: '' };
}

function hydrateForm(record: ReturnType<typeof getUserRecord> | null): FormState {
  if (!record) return emptyForm();
  return {
    name:    typeof record.name === 'string' ? record.name : '',
    email:   typeof record.email === 'string' ? record.email : '',
    tdee:    record.tdee_target != null ? String(record.tdee_target) : '',
    macroP:  record.macro_p != null ? String(record.macro_p) : '',
    macroC:  record.macro_c != null ? String(record.macro_c) : '',
    macroF:  record.macro_f != null ? String(record.macro_f) : '',
    dietary: typeof record.dietary_profile === 'string' ? record.dietary_profile : '',
  };
}

export interface ProfileSettingsProps {
  /** Optional override for the profile save · tests bypass the real path. */
  onSave?: (patch: ProfilePatch) => Promise<void> | void;
}

export default function ProfileSettings(props: ProfileSettingsProps) {
  const uid = getActiveUid();
  const [form, setForm] = useState<FormState>(() => hydrateForm(uid ? getUserRecord(uid) : null));
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const patch = useMemo<ProfilePatch>(() => {
    const out: ProfilePatch = {};
    if (form.name.trim())  out.name = form.name.trim();
    if (form.email.trim()) out.email = form.email.trim().toLowerCase();
    if (form.dietary)      out.dietary_profile = form.dietary;
    const tdee   = parseNumeric(form.tdee);
    const macroP = parseNumeric(form.macroP);
    const macroC = parseNumeric(form.macroC);
    const macroF = parseNumeric(form.macroF);
    if (tdee   !== null) out.tdee_target = tdee;
    if (macroP !== null) out.macro_p = macroP;
    if (macroC !== null) out.macro_c = macroC;
    if (macroF !== null) out.macro_f = macroF;
    return out;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setLastError(null);
    try {
      if (!uid) {
        setLastError('No active session · sign in to update your profile.');
        return;
      }
      if (Object.keys(patch).length === 0) {
        setLastError('No fields filled in · nothing to save.');
        return;
      }
      if (props.onSave) {
        await props.onSave(patch);
        setLastSavedAt(new Date().toISOString());
      } else {
        const result = await updateUserProfile(uid, patch);
        if (result.ok) {
          setLastSavedAt(new Date().toISOString());
        } else {
          setLastError(result.error);
        }
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, uid, patch, props]);

  return (
    <section className={styles.root} aria-labelledby="profile-settings-title">
      <header className={styles.header}>
        <div className={styles.headerKicker}>Phase 4.3 Stage 2</div>
        <h2 id="profile-settings-title" className={styles.headerTitle}>Profile &amp; Targets</h2>
        <div className={styles.headerSub}>
          Identity, daily energy target, and macro splits · drives the Nutrition tab's
          spin wheel and the coach's daily brief.
        </div>
      </header>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Identity</div>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="profile-name" className={styles.fieldLabel}>Display name</label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={styles.input}
              placeholder="e.g. Akeem"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="profile-email" className={styles.fieldLabel}>Email</label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className={styles.input}
              placeholder="you@buildbelievefit.fitness"
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Energy target</div>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="profile-tdee" className={styles.fieldLabel}>TDEE target (kcal/day)</label>
            <input
              id="profile-tdee"
              type="number"
              inputMode="numeric"
              min={1000}
              max={6000}
              step={10}
              value={form.tdee}
              onChange={(e) => set('tdee', e.target.value)}
              className={`${styles.input} ${styles.inputNumeric}`}
              placeholder="2400"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="profile-dietary" className={styles.fieldLabel}>Dietary profile</label>
            <select
              id="profile-dietary"
              value={form.dietary}
              onChange={(e) => set('dietary', e.target.value)}
              className={styles.select}
            >
              {DIETARY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Macro split (grams)</div>
        <div className={styles.macrosGrid}>
          <div className={styles.field}>
            <label htmlFor="profile-macro-p" className={styles.fieldLabel}>Protein</label>
            <input
              id="profile-macro-p"
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              step={5}
              value={form.macroP}
              onChange={(e) => set('macroP', e.target.value)}
              className={`${styles.input} ${styles.inputNumeric}`}
              placeholder="180"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="profile-macro-c" className={styles.fieldLabel}>Carbs</label>
            <input
              id="profile-macro-c"
              type="number"
              inputMode="numeric"
              min={0}
              max={800}
              step={5}
              value={form.macroC}
              onChange={(e) => set('macroC', e.target.value)}
              className={`${styles.input} ${styles.inputNumeric}`}
              placeholder="280"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="profile-macro-f" className={styles.fieldLabel}>Fat</label>
            <input
              id="profile-macro-f"
              type="number"
              inputMode="numeric"
              min={0}
              max={300}
              step={5}
              value={form.macroF}
              onChange={(e) => set('macroF', e.target.value)}
              className={`${styles.input} ${styles.inputNumeric}`}
              placeholder="70"
            />
          </div>
        </div>
      </div>

      <div className={styles.submitWrap}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={styles.submit}
        >
          {submitting ? 'Saving…' : 'Save profile'}
        </button>
      </div>

      {lastError && <div className={styles.errorBanner} role="alert">{lastError}</div>}

      <div className={styles.cloudPending}>
        Saves to local storage today · the cloud-sync RPC for bbf_users updates is queued
        for the next sprint. Your changes flow through to the Nutrition + Home tabs immediately.
      </div>

      <div className={styles.submitNote}>
        {lastSavedAt
          ? `Saved locally at ${formatTime(lastSavedAt)}`
          : uid
            ? `Editing profile for ${uid}`
            : 'Sign in to edit your profile.'}
      </div>
    </section>
  );
}

function parseNumeric(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!isFinite(n)) return null;
  return Math.round(n);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (!isFinite(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
