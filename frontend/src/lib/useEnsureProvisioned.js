// src/lib/useEnsureProvisioned.js
// ─────────────────────────────────────────────────────────────────────────────
// The vault-landing provisioning guard hook. Fires bbf_ensure_provisioned ONCE on
// mount; reports { ready, provisioned }. `ready` gates the Hub shell (ProvisionGate)
// — no athlete reaches the Client Hub until their athlete_profiles +
// athlete_nutrition_targets_daily rows are confirmed present.
//
// FAIL-OPEN FLOOR (CEO doctrine — never padlock a payer): a soft RPC failure, a
// definitive not-ready after one retry, OR a >6s stall all resolve `ready` so the
// athlete falls through to the (still safe) degraded Hub. The guard can only IMPROVE
// provisioning; it never worsens the "No Empty Dashboards" floor.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchEnsureProvisioned } from './ensureProvisionedApi.js';

const MAX_WAIT_MS = 6000; // hard fallback — a provisioning hiccup never locks anyone out

export function useEnsureProvisioned() {
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';
  const [state, setState] = useState({ ready: false, provisioned: false });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let settled = false;
    const settle = (provisioned = false) => {
      if (settled || !alive.current) return;
      settled = true;
      setState({ ready: true, provisioned });
    };
    const timer = setTimeout(() => settle(false), MAX_WAIT_MS);

    (async () => {
      const r = await fetchEnsureProvisioned(uid);
      if (r === null) return settle(false);          // soft error → fail-open floor
      if (r.ready) return settle(r.provisioned);      // provisioned (or already was)
      // ready:false → the seed may still be committing; one retry, then fall through.
      const r2 = await fetchEnsureProvisioned(uid);
      settle(Boolean(r2?.provisioned || r.provisioned));
    })();

    return () => { alive.current = false; clearTimeout(timer); };
  }, [uid]);

  return state;
}
