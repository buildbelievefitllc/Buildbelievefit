// src/components/vault/SovereignPrepButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The "SOVEREIGN PREP" action — sits beside "Open Program" in the Active Directive
// card. On click it resolves the athlete's T-Zero (today) + T-minus-1 (yesterday)
// muscle loads from the rotated plan queue, POSTs to bbf-agentic-recovery, and
// opens the 3-Phase overlay. The overlay chunk is lazy — only pulled when the
// athlete actually triggers a prep, so it never weighs on the header's first paint.

import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { parseWorkoutPlan } from '../../lib/vaultApi.js';
import { getProgram } from './programData.js';
import { resolvePrepLoads, generateSovereignPrep } from '../../lib/sovereignPrep.js';

const SovereignPrepOverlay = lazy(() => import('./SovereignPrepOverlay.jsx'));

export default function SovereignPrepButton({ plans = null, programKey = '', uid = '' }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // The same queue resolution the Active Directive uses: server plan wins, else
  // the authorized persona catalog. today = head, yesterday = tail (rotation).
  const loads = useMemo(() => {
    const assigned = parseWorkoutPlan(plans?.workoutPlan || '');
    const plan = Array.isArray(assigned) && assigned.length ? assigned : getProgram(programKey);
    return resolvePrepLoads(plan);
  }, [plans?.workoutPlan, programKey]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateSovereignPrep({ uid, today: loads.today, yesterday: loads.yesterday });
      setData(res);
    } catch (e) {
      setError((e && e.message) || 'Could not generate your prep.');
    } finally {
      setLoading(false);
    }
  }, [uid, loads]);

  const onClick = useCallback(() => {
    setOpen(true);
    // Re-fetch on each open only if we don't already have a result (cheap + fresh
    // enough — the plan rarely changes mid-session). Always (re)run if a prior
    // attempt errored.
    if (!data || error) run();
  }, [data, error, run]);

  const onRetry = useCallback(() => run(), [run]);
  const onClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className="cv-directive-prep"
        onClick={onClick}
        data-testid="vh-directive-prep"
      >
        {t('sp-cta')}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <SovereignPrepOverlay
            open={open}
            loading={loading}
            error={error}
            data={data}
            onClose={onClose}
            onRetry={onRetry}
          />
        </Suspense>
      ) : null}
    </>
  );
}
