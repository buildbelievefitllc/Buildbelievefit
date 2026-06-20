// src/components/vault/RecoveryPrescriptionCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Recovery Prescription card — the visible payoff of the Dynamic Prescription
// loop. Self-fetches the athlete's latest ACTIVE playlist (bbf-prescription-today)
// and renders it: the regress/maintain/progress verdict, the volume modifier, the
// 4 targeted movements, and the Champion's Mindset breathing finisher.
//
// Drop-in: <RecoveryPrescriptionCard refreshKey={n} />. Bump `refreshKey` after a
// check-in (e.g. from PostWorkoutCheckInModal's onSuccess) to refetch the freshly
// generated queue. Brand-locked (§2), trilingual EN/ES/PT (§1).

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { fetchTodaysPrescription } from '../../lib/prescriptionApi.js';
import './recoveryPrescription.css';

const STR = {
  en: {
    kicker: 'Your Recovery Prescription',
    loading: 'Loading your prescription…',
    empty: 'No active prescription yet. Log a post-workout check-in and the engine will build your next session.',
    retry: 'Retry',
    refresh: 'Refresh',
    volume: 'Volume',
    finisher: 'Champion’s Mindset',
    forLabel: 'For',
    actions: {
      regress: { label: 'Regress', note: 'Backing off to protect the joint.' },
      maintain: { label: 'Maintain', note: 'Holding steady — measured load.' },
      progress: { label: 'Progress', note: 'Cleared to push — earned it.' },
    },
    today: 'Today', tomorrow: 'Tomorrow',
    types: { strengthening: 'Strength', mobility: 'Mobility', prehab: 'Prehab', recovery: 'Recovery', mental_wellness: 'Mindset' },
    areas: { shoulder: 'Shoulder', lower_body: 'Lower Body', knee: 'Knee', neck: 'Neck', upper_body: 'Upper Body', full_body: 'Full Body', breathing_and_meditation: 'Breathwork' },
  },
  es: {
    kicker: 'Tu Prescripción de Recuperación',
    loading: 'Cargando tu prescripción…',
    empty: 'Aún no hay prescripción activa. Registra un check-in post-entrenamiento y el motor construirá tu próxima sesión.',
    retry: 'Reintentar',
    refresh: 'Actualizar',
    volume: 'Volumen',
    finisher: 'Mentalidad de Campeón',
    forLabel: 'Para',
    actions: {
      regress: { label: 'Regresión', note: 'Bajando la carga para proteger la articulación.' },
      maintain: { label: 'Mantener', note: 'Sin cambios — carga medida.' },
      progress: { label: 'Progresión', note: 'Listo para avanzar — te lo ganaste.' },
    },
    today: 'Hoy', tomorrow: 'Mañana',
    types: { strengthening: 'Fuerza', mobility: 'Movilidad', prehab: 'Prehab', recovery: 'Recuperación', mental_wellness: 'Mente' },
    areas: { shoulder: 'Hombro', lower_body: 'Tren Inferior', knee: 'Rodilla', neck: 'Cuello', upper_body: 'Tren Superior', full_body: 'Cuerpo Completo', breathing_and_meditation: 'Respiración' },
  },
  pt: {
    kicker: 'Sua Prescrição de Recuperação',
    loading: 'Carregando sua prescrição…',
    empty: 'Ainda não há prescrição ativa. Faça um check-in pós-treino e o motor montará sua próxima sessão.',
    retry: 'Tentar de novo',
    refresh: 'Atualizar',
    volume: 'Volume',
    finisher: 'Mentalidade de Campeão',
    forLabel: 'Para',
    actions: {
      regress: { label: 'Regressão', note: 'Reduzindo a carga para proteger a articulação.' },
      maintain: { label: 'Manter', note: 'Sem mudanças — carga medida.' },
      progress: { label: 'Progressão', note: 'Liberado para avançar — você mereceu.' },
    },
    today: 'Hoje', tomorrow: 'Amanhã',
    types: { strengthening: 'Força', mobility: 'Mobilidade', prehab: 'Prehab', recovery: 'Recuperação', mental_wellness: 'Mente' },
    areas: { shoulder: 'Ombro', lower_body: 'Inferiores', knee: 'Joelho', neck: 'Pescoço', upper_body: 'Superiores', full_body: 'Corpo Inteiro', breathing_and_meditation: 'Respiração' },
  },
};

function dayLabel(dateStr, lang, S) {
  if (!dateStr) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return S.today;
  if (diff === 1) return S.tomorrow;
  const locale = lang === 'es' ? 'es-ES' : lang === 'pt' ? 'pt-BR' : 'en-US';
  try { return target.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' }); }
  catch { return dateStr; }
}

export default function RecoveryPrescriptionCard({ refreshKey = 0 }) {
  const { lang } = useLang();
  const S = STR[lang] || STR.en;

  const [status, setStatus] = useState('loading'); // loading | loaded | error
  const [playlist, setPlaylist] = useState(null);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0); // manual-refresh trigger

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus('loading');
      setError('');
      try {
        const pl = await fetchTodaysPrescription();
        if (alive) { setPlaylist(pl); setStatus('loaded'); }
      } catch (e) {
        if (alive) { setError(e?.message || 'Could not load your prescription.'); setStatus('error'); }
      }
    })();
    return () => { alive = false; };
  }, [refreshKey, nonce]);

  const movements = Array.isArray(playlist?.exercises) ? playlist.exercises.filter((e) => e?.kind !== 'mental_wellness') : [];
  const finisher = Array.isArray(playlist?.exercises) ? playlist.exercises.find((e) => e?.kind === 'mental_wellness') : null;
  const action = playlist?.action && S.actions[playlist.action] ? playlist.action : null;
  const modifier = Number(playlist?.intensity_modifier);

  return (
    <section className="rxp" data-testid="recovery-prescription" data-action={action || 'none'}>
      <header className="rxp-head">
        <div className="rxp-head-copy">
          <span className="rxp-kicker">{S.kicker}</span>
          {status === 'loaded' && playlist ? (
            <span className="rxp-day">{dayLabel(playlist.scheduled_for, lang, S)}</span>
          ) : null}
        </div>
        {status === 'loaded' && action ? (
          <span className={`rxp-badge rxp-badge--${action}`}>{S.actions[action].label}</span>
        ) : null}
      </header>

      {status === 'loading' ? (
        <p className="rxp-state">{S.loading}</p>
      ) : status === 'error' ? (
        <div className="rxp-state rxp-state--error">
          <p>{error}</p>
          <button type="button" className="rxp-retry" onClick={refresh}>{S.retry}</button>
        </div>
      ) : !playlist ? (
        <p className="rxp-state rxp-empty">{S.empty}</p>
      ) : (
        <>
          <div className="rxp-meta">
            {action ? <span className="rxp-note">{S.actions[action].note}</span> : null}
            <span className="rxp-pills">
              <span className="rxp-chip rxp-chip--area">{S.forLabel} {S.areas[playlist.target_area] || playlist.target_area}</span>
              {Number.isFinite(modifier) ? (
                <span className="rxp-chip rxp-chip--vol">{S.volume} ×{modifier}</span>
              ) : null}
            </span>
          </div>

          <ol className="rxp-list">
            {movements.map((ex, i) => (
              <li key={ex.id || i} className="rxp-item">
                <span className="rxp-slot">{i + 1}</span>
                <span className="rxp-item-body">
                  <span className="rxp-name">{ex.name}</span>
                  <span className="rxp-type">{S.types[ex.type] || ex.type}</span>
                </span>
              </li>
            ))}
          </ol>

          {finisher ? (
            <div className="rxp-finisher">
              <span className="rxp-finisher-label">✦ {S.finisher}</span>
              <span className="rxp-finisher-name">{finisher.name}</span>
            </div>
          ) : null}

          <button type="button" className="rxp-refresh" onClick={refresh} aria-label={S.refresh}>↻ {S.refresh}</button>
        </>
      )}
    </section>
  );
}
