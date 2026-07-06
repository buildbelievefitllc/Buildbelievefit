// src/components/vault/ProvisionGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Client Hub provisioning gate. Wraps the vault shell: the athlete does not
// reach the Hub until useEnsureProvisioned confirms their athlete_profiles +
// today's athlete_nutrition_targets_daily rows exist (seeding baseline rows first
// if a legacy / tier-change account is missing them).
//
// UX: a 400ms grace before the "Setting up your plan…" screen paints, so an
// already-provisioned athlete (the fast path — a sub-second RPC) never sees a flash.
// Brand-locked (CLAUDE.md §2): BBF Purple → gold, matte-black canvas, Bebas header.
// Trilingual (§1). Fail-open lives in the hook — this component just renders the
// gate; when `ready` (including every fail-open path) it renders the shell.

import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useEnsureProvisioned } from '../../lib/useEnsureProvisioned.js';

const STR = {
  en: { kicker: 'Sovereign Vault', title: 'Setting up your plan…', sub: 'Calibrating your personalized targets — this only takes a moment.' },
  es: { kicker: 'Bóveda Soberana', title: 'Preparando tu plan…', sub: 'Calibrando tus objetivos personalizados — solo toma un momento.' },
  pt: { kicker: 'Cofre Soberano', title: 'Preparando seu plano…', sub: 'Calibrando suas metas personalizadas — leva só um instante.' },
};

export default function ProvisionGate({ children }) {
  const { ready } = useEnsureProvisioned();
  const { lang } = useLang();
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    const t = setTimeout(() => setShowSetup(true), 400); // grace — no flash for provisioned athletes
    return () => clearTimeout(t);
  }, [ready]);

  if (ready) return children;
  if (!showSetup) return null; // brief grace window — blank, avoids a sub-second flash

  const s = STR[lang] || STR.en;
  return (
    <div
      data-testid="provision-gate"
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(120% 90% at 50% 0%, rgba(106,13,173,.35), #090909 70%)', padding: 24,
      }}
    >
      <style>{'@keyframes bbf-provision-spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div
          aria-hidden="true"
          style={{
            width: 46, height: 46, margin: '0 auto 18px', borderRadius: '50%',
            border: '3px solid rgba(245,200,0,.22)', borderTopColor: '#f5c800',
            animation: 'bbf-provision-spin 0.9s linear infinite',
          }}
        />
        <div style={{ fontFamily: 'var(--hb,"Barlow Condensed")', fontSize: '.7rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#f5c800', marginBottom: 8 }}>
          ◆ {s.kicker}
        </div>
        <h2 style={{ fontFamily: 'var(--display,"Bebas Neue")', fontSize: '2rem', letterSpacing: '.5px', color: '#fff', margin: '0 0 8px' }}>
          {s.title}
        </h2>
        <p style={{ fontFamily: 'var(--bd,"Barlow Condensed")', fontSize: '1rem', lineHeight: 1.5, color: 'rgba(244,238,251,.82)', margin: 0 }}>
          {s.sub}
        </p>
      </div>
    </div>
  );
}
