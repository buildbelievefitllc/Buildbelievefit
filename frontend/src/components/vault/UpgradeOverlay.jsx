// src/components/vault/UpgradeOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Vault Upsell Funnel padlock screen — rendered IN PLACE of a tool the
// athlete's tier doesn't unlock. "Visibility as a sales tool": it names the locked
// feature, shows the lock, and drops a dominant Victory-Gold CTA straight into the
// Stripe checkout for the tier that unlocks it.
//
//   `target`          — from upgradeTargetForPath(): { tierName, price, href, external }.
//                       A real buy.stripe.com link (external) for single-SKU paths,
//                       or the '/#programs' pricing matrix for the multi-option Hybrid.
//   `featureLabelKey` — i18n key for the locked feature's name (preferred, trilingual).
//   `featureLabel`    — literal fallback when no key is supplied.
//
// Brand-locked (CLAUDE.md §2): BBF Purple structure, Victory-Gold CTA, matte-black
// canvas. Trilingual chrome via useLang (EN / ES / PT is structural, §1).

import { useLang } from '../../context/LangContext.jsx';
import './upgradeOverlay.css';

export default function UpgradeOverlay({
  featureLabelKey,
  featureLabel,
  target,
  testId = 'upgrade-overlay',
}) {
  const { t } = useLang();

  const feature = featureLabelKey ? t(featureLabelKey) : (featureLabel || '');
  const tierName = target?.tierName || t('uplock-generic-tier');
  const price = target?.price || '';
  const href = target?.href || '/#programs';
  const external = Boolean(target?.external);

  const ctaProps = external
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { href };

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
        <a className="uplock__cta" {...ctaProps} data-testid="upgrade-overlay-cta">
          {t('uplock-cta')} {tierName}{price ? ` · ${price}` : ''}{' '}
          <span aria-hidden="true">→</span>
        </a>
        <a className="uplock__compare" href="/#programs">{t('uplock-compare')}</a>
      </div>
    </section>
  );
}
