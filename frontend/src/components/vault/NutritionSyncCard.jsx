// src/components/vault/NutritionSyncCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Nutrition "Complete & Sync Protocol" — the daily fueling commit ritual.
//
// Parity with the workout / cardio "Complete & Sync Protocol" moment. Meal cards
// tap-to-log silently per card; THIS is the deliberate "the day is done" commit:
// it finalizes today's fueling adherence to the athlete's history and fires the
// shared PROTOCOL_UPDATED broadcast so every readiness surface rehydrates.
//
// Server-authoritative: syncNutritionAdherence() recomputes adherence from the
// logged intake vs the canonical daily target (never the optimistic client view),
// so the committed verdict is the source of truth. No live API cost — a plain RPC.
//
// Brand-locked (§2): matte canvas · BBF Purple→Gold · Bebas/Barlow. Trilingual.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { syncNutritionAdherence } from '../../lib/mealLogApi.js';

const STR = {
  en: {
    eyebrow: 'Coach Akeem · Fuel Sync',
    title: 'Complete & Sync Today’s Fuel',
    sub: 'Lock today’s fueling into your record. A program works when the fuel is on the board — sync it so your readiness picture stays honest.',
    meals: (d, t) => `${d} of ${t} meals logged`,
    button: 'Complete & Sync Protocol',
    syncing: 'Syncing…',
    synced: 'Protocol logged — synced to your history.',
    resync: 'Re-Sync Today',
    kcal: 'kcal',
    protein: 'protein',
    mealsChip: 'meals',
    err: 'Could not sync your fuel. Try again.',
  },
  es: {
    eyebrow: 'Coach Akeem · Sync de Fuel',
    title: 'Completa y Sincroniza el Fuel de Hoy',
    sub: 'Fija la alimentación de hoy en tu registro. Un programa funciona cuando el combustible está puesto — sincronízalo para que tu lectura de readiness sea honesta.',
    meals: (d, t) => `${d} de ${t} comidas registradas`,
    button: 'Completar y Sincronizar Protocolo',
    syncing: 'Sincronizando…',
    synced: 'Protocolo registrado — sincronizado con tu historial.',
    resync: 'Re-Sincronizar Hoy',
    kcal: 'kcal',
    protein: 'proteína',
    mealsChip: 'comidas',
    err: 'No se pudo sincronizar tu fuel. Inténtalo de nuevo.',
  },
  pt: {
    eyebrow: 'Coach Akeem · Sync de Fuel',
    title: 'Conclua e Sincronize o Fuel de Hoje',
    sub: 'Fixe a alimentação de hoje no seu registro. Um programa funciona quando o combustível está na mesa — sincronize para que sua leitura de readiness seja honesta.',
    meals: (d, t) => `${d} de ${t} refeições registradas`,
    button: 'Concluir e Sincronizar Protocolo',
    syncing: 'Sincronizando…',
    synced: 'Protocolo registrado — sincronizado com seu histórico.',
    resync: 'Ressincronizar Hoje',
    kcal: 'kcal',
    protein: 'proteína',
    mealsChip: 'refeições',
    err: 'Não foi possível sincronizar seu fuel. Tente novamente.',
  },
};

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

export default function NutritionSyncCard({ doneCount = 0, mealCount = 0 }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;

  const [status, setStatus] = useState('idle'); // idle | syncing | ok | error
  const [verdict, setVerdict] = useState(null);
  const busy = status === 'syncing';
  const done = status === 'ok';

  async function onSync() {
    if (busy) return;
    setStatus('syncing');
    try {
      const res = await syncNutritionAdherence();
      setVerdict(res);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="nl-sync" data-testid="nutrition-sync-card" data-state={status}>
      <div className="nl-sync-eyebrow">
        <span className="nl-sync-mic" aria-hidden="true">🎙</span>{tr.eyebrow}
      </div>
      <h3 className="nl-sync-title">{tr.title}</h3>
      <p className="nl-sync-sub">{tr.sub}</p>

      <div className="nl-sync-meta">{tr.meals(doneCount, mealCount)}</div>

      <button
        type="button"
        className="nl-sync-btn"
        onClick={onSync}
        disabled={busy}
        data-testid="nutrition-sync-btn"
      >
        {busy ? tr.syncing : done ? tr.resync : tr.button}
      </button>

      {done ? (
        <div className="nl-sync-result" role="status" data-testid="nutrition-sync-msg">
          <div className="nl-sync-ok">✓ {tr.synced}</div>
          {verdict ? (
            <div className="nl-sync-chips">
              <span className="nl-sync-chip"><b>{pct(verdict.kcal_pct)}</b> {tr.kcal}</span>
              <span className="nl-sync-chip"><b>{pct(verdict.protein_pct)}</b> {tr.protein}</span>
              <span className="nl-sync-chip"><b>{verdict.meals_logged ?? 0}</b> {tr.mealsChip}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="nl-sync-err" role="alert">{tr.err}</div>
      ) : null}
    </div>
  );
}
