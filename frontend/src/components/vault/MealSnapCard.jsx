// src/components/vault/MealSnapCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// FUEL COMPANION · Meal Snap — point the camera at the plate; the Lab logs it.
//
// The nutrition mirror of the Kinematic Form HUD: photo → bbf-fuel-companion
// (Sonnet vision, session-token gated) → macro estimate + a coaching note
// written against the athlete's fasting pace and today's readiness score.
// The photo is EPHEMERAL (vision-call memory only — never stored); only the
// numeric estimate persists (bbf_meal_snaps). Deterministic macro validation
// happens server-side — AI proposes, native math disposes.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react';
import { useAuth, getStoredVaultToken } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../../lib/supabaseClient.js';
import { useDailyReadiness } from '../../lib/useDailyReadiness.js';

const T = {
  en: { cta: '📸 Snap My Meal', busy: 'Reading your plate…', confidence: 'confidence', retry: 'Snap another', err: 'Could not read that plate — better light, straight above the food, then retry.' },
  es: { cta: '📸 Foto de Mi Comida', busy: 'Leyendo tu plato…', confidence: 'confianza', retry: 'Otra foto', err: 'No se pudo leer el plato — mejor luz, foto desde arriba, e intenta de nuevo.' },
  pt: { cta: '📸 Foto da Minha Refeição', busy: 'Lendo seu prato…', confidence: 'confiança', retry: 'Outra foto', err: 'Não foi possível ler o prato — melhore a luz, foto de cima, e tente de novo.' },
};

export default function MealSnapCard({ fasting, paceId }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const { data: readiness } = useDailyReadiness();
  const tr = T[lang] || T.en;
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setError(false);
    setResult(null);
    try {
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const headers = { 'Content-Type': 'application/json' };
      if (SUPABASE_ANON_KEY) {
        headers.apikey = SUPABASE_ANON_KEY;
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }
      const res = await fetch(`${FUNCTIONS_BASE}/bbf-fuel-companion`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid: user?.uid || '',
          session_token: getStoredVaultToken() || '',
          image_base64: b64,
          mime_type: file.type || 'image/jpeg',
          fasting: fasting
            ? { pace: paceId || null, window_label: `${fasting.fast}:${fasting.eat}` }
            : { pace: 'off' },
          readiness_score: readiness?.score ?? null,
          locale: lang,
        }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.ok) setResult(data);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="nl-mealsnap" data-testid="nl-mealsnap" style={{ marginTop: 14 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onFile}
        data-testid="nl-mealsnap-input"
      />
      <button
        type="button"
        className="nl-pace-chip"
        style={{ width: '100%' }}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        data-testid="nl-mealsnap-cta"
      >
        <span className="nl-pace-ratio">{busy ? tr.busy : result ? tr.retry : tr.cta}</span>
      </button>

      {error ? <p className="nl-pace-desc" style={{ marginTop: 8 }}>{tr.err}</p> : null}

      {result ? (
        <div className="nl-mealsnap-result" data-testid="nl-mealsnap-result" style={{ marginTop: 10 }}>
          <strong>{result.meal_name}</strong>
          <p className="nl-pace-desc" style={{ margin: '6px 0' }}>
            {result.macros.kcal} kcal · P {result.macros.protein_g}g · C {result.macros.carbs_g}g · F {result.macros.fat_g}g
            {' · '}{Math.round((result.confidence || 0) * 100)}% {tr.confidence}
          </p>
          {result.coaching_note ? <p className="nl-pace-desc">{result.coaching_note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
