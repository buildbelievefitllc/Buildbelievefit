// src/components/vault/UpgradeOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Vault Upsell Funnel padlock screen — rendered IN PLACE of a tool the
// athlete's tier doesn't unlock. "Visibility as a sales tool": it names the locked
// feature, shows the lock, and drops a dominant Victory-Gold CTA into checkout.
//
// CHECKOUT IS SCREENING-GATED (CEO mandate): single-SKU upgrades no longer link to a
// raw buy.stripe.com Payment Link. The CTA mints a Stripe Checkout Session SERVER-
// SIDE via bbf-create-checkout, authenticated by the athlete's server-revocable
// vault_token (a provisioned account is itself proof of original screening). Only the
// multi-option Hybrid path still routes to the in-app pricing matrix (which funnels
// through the Pathfinder screening before checkout).
//
//   `target`          — from upgradeTargetForPath(): { tierName, price, priceId } for
//                       single-SKU, or { tierName, price, href, external } for Hybrid.
//   `featureLabelKey` — i18n key for the locked feature's name (preferred, trilingual).
//   `featureLabel`    — literal fallback when no key is supplied.
//
// Brand-locked (CLAUDE.md §2): BBF Purple structure, Victory-Gold CTA, matte-black
// canvas. Trilingual chrome via useLang (EN / ES / PT is structural, §1).

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { createUpgradeCheckout } from '../../lib/checkoutApi.js';
import { isNativePlatform } from '../../native/platform.js';
import './upgradeOverlay.css';

const NATIVE = isNativePlatform();

export default function UpgradeOverlay({
  featureLabelKey,
  featureLabel,
  target,
  testId = 'upgrade-overlay',
}) {
  const { t } = useLang();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const feature = featureLabelKey ? t(featureLabelKey) : (featureLabel || '');
  const tierName = target?.tierName || t('uplock-generic-tier');
  const price = target?.price || '';
  const priceId = target?.priceId || '';
  const href = target?.href || '/#programs';

  const ctaLabel = (
    <>{t('uplock-cta')} {tierName}{price ? ` · ${price}` : ''} <span aria-hidden="true">→</span></>
  );

  async function startUpgrade() {
    setErr(null);
    setBusy(true);
    try {
      // GATED: the edge function authorizes via vault_token server-side and mints the
      // Stripe session — the client never holds a raw payment link.
      const url = await createUpgradeCheckout(session?.vaultToken || '', priceId);
      window.location.href = url;
    } catch (e) {
      setErr(e?.message || 'Could not open checkout. Please try again.');
      setBusy(false);
    }
  }

  return (
    <section
      className="uplock"
      role="region"
      aria-label={t('uplock-aria')}
      data-testid={testId}
    >
      <div className="uplock__card">
        <div className="uplock__icon" aria-hidden="true">🔒</div>
        <div className="uplock__kicker">{t('uplock-kicker')}</div>
        <h2 className="uplock__feature">{feature}</h2>
        <p className="uplock__body">
          {t('uplock-body-pre')}{' '}
          <strong className="uplock__tier">{tierName}</strong>
          {t('uplock-body-post')}
        </p>
        {NATIVE ? (
          // Apple anti-steering guardrail (guideline 3.1.3): no checkout button and
          // no link back to the marketing/pricing surface from inside the native
          // app — pure text only. Plan changes happen on the web.
          <p className="uplock__native-notice" data-testid="upgrade-overlay-native-notice">
            Plan upgrades are managed via buildbelievefit.fitness.
          </p>
        ) : priceId ? (
          <button
            type="button"
            className="uplock__cta"
            style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}
            disabled={busy}
            onClick={startUpgrade}
            data-testid="upgrade-overlay-cta"
          >
            {busy ? t('pf-checkout-loading') : ctaLabel}
          </button>
        ) : (
          <a className="uplock__cta" href={href} data-testid="upgrade-overlay-cta">
            {ctaLabel}
          </a>
        )}
        {err ? (
          <div className="uplock__err" role="alert" style={{ color: '#ef4444', fontWeight: 700, marginTop: '.6rem' }}>{err}</div>
        ) : null}
        {NATIVE ? null : (
          <a className="uplock__compare" href="/#programs">{t('uplock-compare')}</a>
        )}
      </div>
    </section>
  );
}
