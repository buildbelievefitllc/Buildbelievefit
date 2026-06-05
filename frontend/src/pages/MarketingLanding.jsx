// src/pages/MarketingLanding.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 — the Build Believe Fit marketing site, restored into React.
//
// Faithful rebuild of the legacy index.html landing — copy, tiers, pricing,
// founder positioning, and media taken VERBATIM from the source (no invented
// figures). Responsive via clamp() typography + auto-fit grids (no media queries).
// The Phase 13 lead engine is embedded as <PathfinderForm> at #pathfinder.
//
// Deferred (interactive engines, follow-up phases): live TDEE calculator, the AI
// "Interrogator" quiz, the 4-step Pathfinder wizard, trilingual i18n, Stripe tier
// checkout (tier CTAs route to the application form). The brand surface + funnel
// are restored.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PathfinderForm from '../components/PathfinderForm.jsx';
import Interrogator from '../components/Interrogator.jsx';
import TDEECalculator from '../components/TDEECalculator.jsx';
import BBFChatbox from '../components/BBFChatbox.jsx';
import PositionalBlueprints from '../components/PositionalBlueprints.jsx';
import ScienceHub from '../components/ScienceHub.jsx';
import { useLang } from '../context/LangContext.jsx';
import LangToggle from '../components/LangToggle.jsx';
// Live Stripe pricing (the Revenue Matrix) — single source of truth shared with
// the in-Vault UpgradeOverlay so the checkout URLs can't drift between surfaces.
import { PRICING, MATRIX_TABS } from '../lib/pricingMatrix.js';

// ── True legacy palette (verbatim from styles/bbf-tokens.css) ───────────────────
// Victory Gold is RESERVED for primary CTAs only (scarcity = value). Purple is the
// load-bearing brand color; gold accents are the laboratory/soft golds.
const GOLD = '#F5C800';        // Victory Gold — primary CTAs ONLY
const GOLD_LAB = '#D4AF37';    // laboratory gold — accents/borders
const GOLD_SOFT = '#F5CF60';
const PUR = '#6A0DAD';         // brand purple
const PURL = '#9D27C9';        // electric royal — kickers, hero badge
const PURX = '#1E0340';        // near-black eggplant (section gradients)
const PURP = '#110128';        // deepest
const BODY = "'Barlow Condensed',sans-serif";
const HEAD = "'Bebas Neue',sans-serif";
const DISPLAY = "'Anton',sans-serif";

// Translation-key pairs (resolved through t() at render so they switch with lang).
const SERVICE_KEYS = [
  ['svc-n1', 'svc-d1'], ['svc-n2', 'svc-d2'], ['svc-n3', 'svc-d3'],
  ['svc-n4', 'svc-d4'], ['svc-n5', 'svc-d5'], ['svc-n6', 'svc-d6'],
];
const CRED_KEYS = [
  ['cred-t1', 'cred-s1'], ['cred-t2', 'cred-s2'], ['cred-t3', 'cred-s3'],
  ['cred-t4', 'cred-s4'], ['cred-t5', 'cred-s5'],
];
const ORIGIN_KEYS = ['origin-n1', 'origin-n2', 'origin-n3'];

// Phase 15 — Revenue Matrix. PRICING + MATRIX_TABS were hoisted to
// lib/pricingMatrix.js (single source of truth, shared with the in-Vault
// UpgradeOverlay so the live Stripe Payment Links can never drift). Imported above.

// Landing-only responsive layer. The page is otherwise inline-styled (clamp() +
// auto-fit, per this file's no-media-query philosophy); these few real rules keep
// the vertical narrative tight on phones — every section clears the sticky nav on a
// smooth-scroll jump, and the Hybrid price options collapse to a single column on
// the narrowest screens so nothing stacks awkwardly or clips text.
const LANDING_CSS = `
html { scroll-behavior: smooth; }
.bbf-landing section { scroll-margin-top: 72px; }
.bbf-landing .lp-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 420px) {
  .bbf-landing .lp-opts { grid-template-columns: 1fr; }
}
`;

export default function MarketingLanding() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { user } = useAuth();

  // Authed visitors are NEVER auto-redirected here — App routes "/" to this page
  // unconditionally. The navbar Sign-In and the hero doors take them INTO the Vault
  // on demand (/vault); guests go to the login gate. One helper, used everywhere a
  // "way in" is offered, so the manual path is consistent.
  const enter = () => navigate(user ? '/vault' : '/login');

  // ── Conversion narrative — vertical scroll, mobile-first ───────────────────────
  // The page reads top-to-bottom as a six-step funnel: Hero → Playbooks → Fuel Target
  // → Coach Legacy → Pathfinder → Four Paths pricing. The supporting modules (Science
  // · Interrogator · App) are KEPT but parked at the very bottom, below the funnel.
  // In-page funnels smooth-scroll to a section by id; the sticky-nav offset is handled
  // by `scroll-margin-top` on every section (see LANDING_CSS).
  const scrollToId = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goToPathfinder = () => scrollToId('pathfinder');

  return (
    <div className="bbf-landing" style={s.page}>
      <style>{LANDING_CSS}</style>
      {/* ── NAV ── */}
      <nav style={s.nav}>
        <a href="#hero" style={s.navLogo}>BUILD BELIEVE <span style={{ color: GOLD }}>FIT</span></a>
        <div style={s.navLinks}>
          {/* In-page jumps — smooth-scroll to the section by id. */}
          <button type="button" style={s.navSignIn} onClick={() => scrollToId('services')}>{t('nav-services')}</button>
          <button type="button" style={s.navSignIn} onClick={() => scrollToId('programs')}>{t('nav-programs')}</button>
          <a href="#science" style={s.navLink}>Science</a>
          <a href="#interrogator" style={s.navLink}>{t('nav-audit')}</a>
          <button type="button" style={s.navSignIn} onClick={() => scrollToId('founder')}>{t('nav-about')}</button>
          <button type="button" style={s.navSignIn} onClick={enter}>{t('nav-signin')}</button>
          <button type="button" style={s.navCta} onClick={goToPathfinder}>{t('nav-start')}</button>
          <LangToggle />
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="hero" style={s.hero}>
        <div style={s.heroText}>
          <div style={s.heroBadge}>⚡ {t('hero-badge')}</div>
          <h1 style={s.heroStack} aria-label="Build Believe Fit">
            <span style={s.hsBuild}>BUILD</span>
            <span style={s.hsBelieve}>BELIEVE</span>
            <span style={s.hsFit}>FIT</span>
          </h1>
          <p style={s.heroSub}>{t('hero-sub')}</p>
          <button type="button" style={s.heroCta} onClick={goToPathfinder}>{t('hero-cta')}</button>
          <div style={s.doors}>
            <button type="button" style={s.door} onClick={enter}>
              <span style={s.doorKicker}>{t('door-adults')}</span>
              <span style={s.doorTitle}>{t('door-vault')}</span>
              <span style={s.doorSub}>{t('door-vault-sub')}</span>
            </button>
            <button type="button" style={s.door} onClick={enter}>
              <span style={s.doorKicker}>{t('door-youth')}</span>
              <span style={s.doorTitle}>{t('door-athlete')}</span>
              <span style={s.doorSub}>{t('door-athlete-sub')}</span>
            </button>
          </div>
          <div style={s.stats}>
            <Stat n="2021" l={t('stat-founded')} />
            <Stat n="🛡" l={t('stat-cert')} />
            <Stat n="100%" l={t('stat-plans-2')} />
          </div>
        </div>
        <div style={s.heroImgWrap}>
          <img src="/media/bbf-photo.jpg" alt="Akeem Brown — Build Believe Fit" loading="eager" style={s.heroImg} />
        </div>
      </section>

      {/* ═══ CONVERSION NARRATIVE — vertical stack (mobile-first) ════════════════
          Brand identity + tools lead the scroll; the Four Paths pricing matrix is
          the closing CTA at the very bottom (rendered below the App band). Order:
          Playbooks → Fuel Target → Coach Legacy → Pathfinder → Science · Audit ·
          App → Pricing. Every child engine is unchanged — only the order moved
          (tabbed deck → vertical funnel) so cost is shown last. */}

      {/* ── PLAYBOOKS — Six Pillars + Positional Sport Blueprints ── */}
      <section id="services" style={s.section}>
        <div style={s.secLbl}>{t('svc-lbl')}</div>
        <h2 style={s.secH}>{t('svc-h')}</h2>
        <div style={s.svcGrid}>
          {SERVICE_KEYS.map(([nk, dk]) => (
            <article key={nk} style={s.svcCard}>
              <div style={s.svcName}>{t(nk)}</div>
              <p style={s.svcDesc}>{t(dk)}</p>
            </article>
          ))}
        </div>
      </section>
      {/* "Elite Position. Your Playbook." (5 sports · 25 positions) */}
      <PositionalBlueprints />

      <Divider />

      {/* ── FUEL TARGET — interactive TDEE calculator (build engagement early) ── */}
      <section id="tdee" style={s.sectionWide}>
        <TDEECalculator onUseResults={goToPathfinder} />
      </section>

      <Divider />

      {/* ── COACH LEGACY — the story behind BBF (credentials + father + origin) ── */}
      <section id="founder" style={s.sectionPurple}>
        <div style={s.section}>
          <div style={s.secLbl}>{t('founder-lbl')}</div>
          <h2 style={s.secH}>{t('founder-h')}</h2>
          <div style={s.founderGrid}>
            <div>
              <img src="/media/akeem-nasm.jpg" alt="Akeem Brown" loading="lazy" style={s.founderImg} />
              <div style={s.credCard}>
                {CRED_KEYS.map(([tk, sk]) => (
                  <div key={tk} style={s.cred}>
                    <div style={s.credT}>{t(tk)}</div>
                    <div style={s.credS}>{t(sk)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p style={s.story}>{t('founder-p1')}</p>
              <p style={s.story}>{t('founder-p2')}</p>
              <p style={s.story}>{t('founder-p3')}</p>
              <div style={s.sig}>{t('founder-sig-name')}<br /><span style={s.sigSmall}>{t('founder-sig-sub')}</span></div>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* Origin transformation proof — part of the legacy story */}
      <section id="origin" style={s.section}>
        <div style={s.secLbl}>{t('origin-lbl')}</div>
        <h2 style={s.secH}>{t('origin-h')}</h2>
        <p style={s.secSub}>{t('origin-sub')}</p>
        <div style={s.proofGrid}>
          <figure style={s.proofFig}>
            <img src="/media/akeem-before.png" alt="Before" loading="lazy" style={s.proofImg} />
            <figcaption style={s.proofCap}>{t('origin-cap-before')}</figcaption>
          </figure>
          <figure style={s.proofFig}>
            <img src="/media/akeem-after.png" alt="After" loading="lazy" style={s.proofImg} />
            <figcaption style={{ ...s.proofCap, color: GOLD }}>{t('origin-cap-after')}</figcaption>
          </figure>
        </div>
        <div style={s.originGrid}>
          {ORIGIN_KEYS.map((k, i) => (
            <div key={k} style={s.originCard}>
              <div style={s.originStep}>0{i + 1}</div>
              <p style={s.originQ}>{t(k)}</p>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── PATHFINDER — active tier focus + occupation-based intake (PAR-Q) ── */}
      <section id="pathfinder" style={s.sectionWide}>
        <div style={s.secLbl}>{t('pf-lbl')}</div>
        <h2 style={s.secH}>{t('pf-h')}</h2>
        <p style={s.secSub}>{t('pf-sub')}</p>
        <div style={{ marginTop: '2rem' }}><PathfinderForm /></div>
      </section>

      <Divider />

      {/* ── 6 · FOUR PATHS — the pricing matrix (closes the core six-step funnel) ──
          Catalyst · Momentum · Autonomous · Fuel. The funnel ends here; the
          supporting modules (Science · Interrogator · App) follow below. */}
      <section id="programs" style={s.sectionWide}>
        <div style={s.secLbl}>{t('prog-lbl')}</div>
        <h2 style={s.secH}>{t('prog-h')}</h2>
        <p style={s.secSub}>{t('prog-sub')}</p>
        <PricingMatrix />

        {/* Local Weekly Ongoing Training — custom-quote call-out (mailto) */}
        <div style={s.localCallout}>
          <div style={s.localKicker}>Local · In-Person · Ongoing</div>
          <h3 style={s.localH}>Local Weekly Ongoing Training</h3>
          <p style={s.localP}>
            Hands-on weekly training built around your schedule, goals, and capacity —
            priced per athlete. Tell us what you&rsquo;re after and we&rsquo;ll send a custom quote.
          </p>
          <a
            href="mailto:buildbelievefitllc@buildbelievefit.fitness?subject=Local%20Weekly%20Ongoing%20Training%20%E2%80%94%20Custom%20Quote%20Request"
            style={s.localBtn}
          >
            Request a Custom Quote →
          </a>
        </div>
        <div style={s.promise}>
          <div style={s.promiseLbl}>{t('promise-lbl')}</div>
          <p style={s.promiseText}>
            “{t('promise-text')}” <span style={{ color: GOLD }}>{t('founder-sig-name')}</span>
          </p>
        </div>
      </section>

      <Divider />

      {/* ═══ SUPPORTING MODULES — parked below the core funnel (KEPT, not deleted) ══
          Science Hub, the Routine Interrogator, and the App-Install band. Not part of
          the 6-step funnel, so they live at the very bottom of the page sequence. */}

      {/* ── SCIENCE HUB — clinical-studies library (peer-reviewed authority asset) ── */}
      <ScienceHub />

      {/* ── THE INTERROGATOR (BBF Chatbox) — interactive audit → tier guidance ── */}
      <Interrogator onChooseTier={goToPathfinder} />

      <Divider />

      {/* ── COMPANION APP (Google Play funnel + PWA direct install) ── */}
      <section id="app" style={s.appBand}>
        <div style={s.appTop}>
          <div style={s.appText}>
            <div style={s.secLbl}>Google Play</div>
            <h2 style={s.secH}>{t('app-band-h')}</h2>
            <p style={s.secSub}>{t('app-band-sub')}</p>
          </div>
          <a
            href="https://play.google.com/store/apps/details?id=com.buildbelievefit.app"
            target="_blank"
            rel="noopener noreferrer"
            style={s.appBadge}
            aria-label={t('app-badge-alt')}
          >
            <img
              src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
              alt={t('app-badge-alt')}
              style={{ height: '64px', width: 'auto', display: 'block' }}
              loading="lazy"
            />
          </a>
        </div>

        {/* Direct Web App (PWA) install — store-free alternative for iOS + Android */}
        <div style={s.pwaBlock}>
          <div style={s.pwaHead}>
            <span style={s.pwaTag}>{t('app-pwa-tag')}</span>
            <h3 style={s.pwaH}>{t('app-pwa-h')}</h3>
            <p style={s.pwaSub}>{t('app-pwa-sub')}</p>
          </div>
          <div style={s.pwaCols}>
            <PwaCard
              platform=""
              title={t('app-ios-h')}
              steps={[t('app-ios-1'), t('app-ios-2'), t('app-ios-3')]}
            />
            <PwaCard
              platform="🤖"
              title={t('app-android-h')}
              steps={[t('app-android-1'), t('app-android-2'), t('app-android-3')]}
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footLogo}>BUILD BELIEVE <span style={{ color: GOLD }}>FIT</span></div>
        <p style={s.footTag}>{t('foot-tag')}</p>
        <div style={s.footLinks}>
          <button type="button" style={s.footLink} onClick={enter}>{t('nav-signin')}</button>
          <a style={s.footLink} href="mailto:buildbelievefit@gmail.com">{t('foot-contact')}</a>
          <a style={s.footLink} href="/privacy.html">{t('foot-privacy')}</a>
          <a style={s.footLink} href="/terms.html">{t('foot-terms')}</a>
        </div>
        <p style={s.footCopy}>© 2021–{new Date().getFullYear()} Build Believe Fit LLC · buildbelievefit.fitness · All rights reserved.</p>
      </footer>

      {/* ── BBF CHATBOX (floating assistant) — CTAs route to TDEE / Pathfinder ── */}
      <BBFChatbox onCta={(target) => scrollToId(target === 'tdee' ? 'tdee' : 'pathfinder')} />
    </div>
  );
}

// ── PRICING MATRIX — four category tabs → live Stripe Payment Links ──────────────
// Each card's purchase button is an <a> to a real buy.stripe.com link (opens in a new
// tab → Stripe-hosted checkout). Recurring tiers (Cat 1–3) carry one button; the
// one-time Hybrid protocols carry two (3×/4× per week), each its own price/link.
function PricingMatrix() {
  const [tab, setTab] = useState('fitness');
  const active = PRICING[tab];
  return (
    <div style={s.matrix}>
      <div style={s.matrixTabs} role="tablist" aria-label="Pricing categories">
        {MATRIX_TABS.map((mt) => (
          <button
            key={mt.key}
            type="button"
            role="tab"
            aria-selected={tab === mt.key}
            onClick={() => setTab(mt.key)}
            style={{ ...s.matrixTab, ...(tab === mt.key ? s.matrixTabActive : null) }}
          >
            {mt.label}
          </button>
        ))}
      </div>
      <div style={s.matrixNote}>{active.note}</div>
      <div style={s.matrixGrid}>
        {active.tiers.map((tier) => (
          <article key={tier.name} style={{ ...s.matrixCard, ...(tier.featured ? s.matrixCardFeatured : null) }}>
            {tier.badge ? <div style={s.matrixBadge}>{tier.badge}</div> : null}
            <div style={s.matrixCardName}>{tier.name}</div>
            {tier.span ? <div style={s.matrixCardSpan}>{tier.span}</div> : null}
            {tier.price ? (
              <div style={s.matrixPrice}>{tier.price}<span style={s.matrixPer}>{tier.per}</span></div>
            ) : null}
            <ul style={s.matrixFeats}>
              {tier.feats.map((f) => <li key={f} style={s.matrixFeat}>✓ {f}</li>)}
            </ul>
            {tier.options ? (
              <div className="lp-opts">
                {tier.options.map((o) => (
                  <a key={o.label} href={o.link} target="_blank" rel="noopener noreferrer" style={s.matrixOptBtn}>
                    <span style={s.matrixOptLbl}>{o.label}</span>
                    <span style={s.matrixOptPrice}>{o.price}</span>
                  </a>
                ))}
              </div>
            ) : (
              <a href={tier.link} target="_blank" rel="noopener noreferrer" style={s.matrixBuy}>
                Subscribe →
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return <div style={{ textAlign: 'center' }}><div style={s.statN}>{n}</div><div style={s.statL}>{l}</div></div>;
}
function Divider() { return <div style={s.divider} />; }

// PWA install card — one platform, three numbered steps (brutalist step list).
function PwaCard({ platform, title, steps }) {
  return (
    <div style={s.pwaCard}>
      <div style={s.pwaCardHead}>
        <span style={s.pwaIcon} aria-hidden="true">{platform}</span>
        <span style={s.pwaCardTitle}>{title}</span>
      </div>
      <ol style={s.pwaSteps}>
        {steps.map((step, i) => (
          <li key={i} style={s.pwaStep}>
            <span style={s.pwaStepNum}>{i + 1}</span>
            <span style={s.pwaStepTxt}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const s = {
  // Purple atmospheric floor — the brand's load-bearing color (legacy body/--purx).
  page: { background: `radial-gradient(1200px 600px at 50% -5%, rgba(106,13,173,.22), transparent 60%), linear-gradient(180deg, ${PURP} 0%, #060507 30%)`, color: '#fff', minHeight: '100%', overflowX: 'hidden' },

  nav: { position: 'sticky', top: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(16px,4vw,40px)', height: 64, background: 'rgba(17,1,40,.72)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)', borderBottom: `1px solid rgba(157,39,201,.25)`, flexWrap: 'wrap', gap: '8px' },
  navLogo: { fontFamily: HEAD, fontSize: '1.4rem', letterSpacing: '2px', color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap' },
  navLinks: { display: 'flex', alignItems: 'center', gap: 'clamp(8px,2vw,22px)', flexWrap: 'wrap' },
  navLink: { fontFamily: BODY, fontSize: '.92rem', letterSpacing: '1px', color: 'rgba(255,255,255,.82)', textDecoration: 'none', textTransform: 'uppercase', fontWeight: 600 },
  navSignIn: { fontFamily: BODY, fontSize: '.92rem', letterSpacing: '1px', color: 'rgba(255,255,255,.82)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 600, padding: 0 },
  navCta: { fontFamily: BODY, fontSize: '.88rem', letterSpacing: '1px', padding: '8px 18px', background: GOLD, color: '#090909', borderRadius: 6, textDecoration: 'none', textTransform: 'uppercase', fontWeight: 700, boxShadow: `0 4px 18px rgba(245,200,0,.25)` },

  hero: { position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(24px,5vw,56px)', alignItems: 'center', maxWidth: 1200, margin: '0 auto', padding: 'clamp(40px,7vw,80px) clamp(16px,4vw,40px)' },
  heroText: {},
  // Purple badge — legacy .hero-badge is purple, NOT gold.
  heroBadge: { display: 'inline-block', fontFamily: BODY, fontSize: '.8rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: PURL, background: 'rgba(106,13,173,.22)', border: `1px solid rgba(106,13,173,.5)`, borderRadius: 99, padding: '6px 16px', marginBottom: 20 },
  // Legacy hero lockup (bbf-hero.css): BELIEVE is dramatically larger + gold with a
  // glow; BUILD/FIT white at 95% opacity, smaller; tight .82 line-height stack.
  heroStack: { display: 'flex', flexDirection: 'column', lineHeight: .82, margin: '0 0 1.5rem' },
  hsBuild: { fontFamily: DISPLAY, textTransform: 'uppercase', letterSpacing: '1px', fontSize: 'clamp(3.2rem,8vw,6.5rem)', color: '#fff', opacity: .95 },
  hsBelieve: { fontFamily: DISPLAY, textTransform: 'uppercase', letterSpacing: '1px', fontSize: 'clamp(4.2rem,11vw,9rem)', color: GOLD, margin: '-.05em 0', textShadow: '0 0 40px rgba(245,200,0,.3)' },
  hsFit: { fontFamily: DISPLAY, textTransform: 'uppercase', letterSpacing: '1px', fontSize: 'clamp(3.2rem,8vw,6.5rem)', color: '#fff', opacity: .95 },
  heroSub: { fontFamily: BODY, fontSize: 'clamp(1rem,2vw,1.2rem)', lineHeight: 1.6, color: 'rgba(255,255,255,.7)', margin: '0 0 28px', maxWidth: '52ch' },
  heroCta: { display: 'inline-block', fontFamily: HEAD, fontSize: '1.2rem', letterSpacing: '2px', padding: '14px 40px', background: GOLD, color: '#090909', borderRadius: 8, textDecoration: 'none', boxShadow: `0 8px 28px rgba(245,200,0,.3)` },
  doors: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 12, margin: '28px 0' },
  // Doors use the legacy purple glass treatment + purple accent edge.
  door: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', background: `linear-gradient(145deg, rgba(30,3,56,.78) 0%, rgba(10,8,28,.82) 100%)`, border: `1px solid rgba(157,39,201,.4)`, borderLeft: `3px solid ${PURL}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' },
  doorKicker: { fontFamily: BODY, fontSize: '.7rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: PURL },
  doorTitle: { fontFamily: HEAD, fontSize: '1.15rem', letterSpacing: '1px', color: '#fff' },
  doorSub: { fontFamily: BODY, fontSize: '.82rem', fontWeight: 600, color: GOLD_SOFT },
  stats: { display: 'flex', gap: 'clamp(16px,4vw,40px)', flexWrap: 'wrap' },
  statN: { fontFamily: HEAD, fontSize: '1.8rem', color: GOLD_SOFT, letterSpacing: '1px' },
  statL: { fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' },
  heroImgWrap: { display: 'flex', justifyContent: 'center' },
  heroImg: { width: '100%', maxWidth: 460, borderRadius: 20, border: `2px solid rgba(106,13,173,.45)`, boxShadow: `0 0 50px rgba(106,13,173,.3)`, objectFit: 'cover' },

  // (Former Brand Engine tab-deck styles removed — the landing is a vertical
  //  narrative again; section wrappers below + LANDING_CSS carry the layout.)

  section: { maxWidth: 1100, margin: '0 auto', padding: 'clamp(40px,7vw,80px) clamp(16px,4vw,40px)' },
  sectionWide: { maxWidth: 1240, margin: '0 auto', padding: 'clamp(40px,7vw,80px) clamp(16px,4vw,40px)' },
  // Purple section atmosphere for Founder/Origin (legacy #founder is purple-gradient).
  sectionPurple: { position: 'relative', background: `linear-gradient(135deg, ${PURX} 0%, ${PURP} 100%)`, borderTop: `1px solid rgba(106,13,173,.25)`, borderBottom: `1px solid rgba(106,13,173,.25)` },
  // Section kicker is PURPLE (legacy .sec-lbl color:var(--purl)), not gold.
  secLbl: { textAlign: 'center', fontFamily: BODY, fontSize: '.78rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PURL, marginBottom: 10 },
  secH: { fontFamily: HEAD, fontSize: 'clamp(2rem,5vw,3.4rem)', letterSpacing: '1px', color: '#fff', textAlign: 'center', margin: '0 0 12px' },
  secSub: { textAlign: 'center', color: 'rgba(255,255,255,.6)', fontFamily: BODY, fontSize: '1.02rem', lineHeight: 1.5, margin: '0 auto 40px', maxWidth: '64ch' },
  // Divider is purple→gold→purple (the brand sweep), not flat gold.
  divider: { maxWidth: 900, margin: '0 auto', height: 1, background: `linear-gradient(90deg, transparent, ${PUR} 30%, ${GOLD_LAB} 50%, ${PUR} 70%, transparent)`, opacity: .5 },

  svcGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 20 },
  // Service cards: purple→royal top accent bar (legacy .svc-c::before).
  svcCard: { position: 'relative', background: 'rgba(20,12,32,.7)', border: `1px solid rgba(157,39,201,.18)`, borderTop: `3px solid transparent`, borderImage: `linear-gradient(90deg, ${PUR}, ${PURL}) 1`, borderRadius: 14, padding: 26 },
  svcName: { fontFamily: HEAD, fontSize: '1.4rem', letterSpacing: '1px', color: GOLD_SOFT, marginBottom: 10 },
  svcDesc: { fontFamily: BODY, fontSize: '.98rem', lineHeight: 1.55, color: 'rgba(255,255,255,.66)', margin: 0 },

  progGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,440px))', gap: 24, justifyContent: 'center' },
  // Autonomous tier card carries a purple identity; the featured Sovereign card a gold rim.
  progCard: { position: 'relative', background: `linear-gradient(160deg, rgba(30,3,64,.6) 0%, rgba(13,1,26,.92) 100%)`, border: `1px solid rgba(157,39,201,.3)`, borderTop: `4px solid ${PUR}`, borderRadius: 16, padding: 26, display: 'flex', flexDirection: 'column' },
  progCardFeatured: { border: `1px solid rgba(245,200,0,.45)`, borderTop: `4px solid ${GOLD}`, boxShadow: `0 0 40px rgba(245,200,0,.12), 0 0 0 1px rgba(212,175,55,.2)` },
  progBadge: { position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_LAB} 100%)`, color: '#1B1106', fontFamily: HEAD, fontSize: '.7rem', letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 14px', borderRadius: 99, whiteSpace: 'nowrap', boxShadow: `0 6px 18px rgba(245,200,0,.4)` },
  progTag: { fontFamily: BODY, fontSize: '.68rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 },
  progName: { fontFamily: HEAD, fontSize: '1.7rem', letterSpacing: '1px', color: '#fff' },
  progPrice: { fontFamily: HEAD, fontSize: '2.2rem', color: GOLD_SOFT, margin: '4px 0' },
  progPer: { fontFamily: BODY, fontSize: '.78rem', fontWeight: 600, color: 'rgba(255,255,255,.5)' },
  progBlurb: { fontFamily: BODY, fontSize: '.82rem', fontWeight: 700, marginBottom: 14 },
  progFeats: { listStyle: 'none', margin: '0 0 18px', padding: 0, flex: 1 },
  progFeat: { fontFamily: BODY, fontSize: '.9rem', color: 'rgba(255,255,255,.72)', padding: '5px 0', lineHeight: 1.4 },
  // Non-featured CTA: purple outline. Featured CTA overrides to Victory Gold fill inline.
  progCta: { display: 'block', textAlign: 'center', fontFamily: HEAD, fontSize: '.95rem', letterSpacing: '2px', textTransform: 'uppercase', padding: '12px', borderRadius: 8, textDecoration: 'none', color: '#fff', background: `linear-gradient(180deg, ${PURL}, ${PUR})`, border: `1px solid rgba(157,39,201,.6)` },
  promise: { maxWidth: 760, margin: '40px auto 0', textAlign: 'center', background: 'rgba(106,13,173,.06)', border: '1px solid rgba(106,13,173,.18)', borderRadius: 14, padding: 24 },
  promiseLbl: { fontFamily: BODY, fontSize: '.66rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PURL, marginBottom: 8 },
  promiseText: { fontFamily: BODY, fontSize: '.95rem', fontWeight: 600, lineHeight: 1.65, color: 'rgba(255,255,255,.68)', margin: 0 },

  // ── Pricing matrix (Phase 15 — Stripe) — brutalist: square edges, thick borders,
  // matte-black card surfaces, purple structure, Victory-Gold purchase buttons. ──
  matrix: { marginTop: 8 },
  matrixTabs: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 880, margin: '0 auto', border: `1px solid rgba(157,39,201,.45)` },
  matrixTab: { flex: '1 1 auto', fontFamily: HEAD, fontSize: 'clamp(.78rem,1.6vw,1rem)', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', background: 'rgba(9,9,9,.7)', border: 'none', borderRight: `1px solid rgba(157,39,201,.25)`, padding: '14px 16px', cursor: 'pointer', whiteSpace: 'nowrap' },
  matrixTabActive: { background: PUR, color: GOLD },
  matrixNote: { textAlign: 'center', fontFamily: BODY, fontSize: '.78rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', margin: '18px 0 26px' },
  matrixGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),360px))', gap: 18, justifyContent: 'center' },
  matrixCard: { position: 'relative', background: '#090909', border: `1px solid rgba(157,39,201,.35)`, borderTop: `4px solid ${PUR}`, padding: '28px 22px', display: 'flex', flexDirection: 'column' },
  matrixCardFeatured: { borderColor: 'rgba(245,200,0,.5)', borderTop: `4px solid ${GOLD}`, boxShadow: `0 0 0 1px rgba(245,200,0,.25), 0 0 36px rgba(245,200,0,.1)` },
  matrixBadge: { position: 'absolute', top: -1, right: -1, background: GOLD, color: '#090909', fontFamily: HEAD, fontSize: '.66rem', letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 12px' },
  matrixCardName: { fontFamily: DISPLAY, fontSize: '1.7rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#fff', lineHeight: 1 },
  matrixCardSpan: { fontFamily: BODY, fontSize: '.76rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: PURL, marginTop: 6 },
  matrixPrice: { fontFamily: DISPLAY, fontSize: '2.6rem', color: GOLD, margin: '12px 0 4px', lineHeight: 1 },
  matrixPer: { fontFamily: BODY, fontSize: '.9rem', fontWeight: 600, letterSpacing: '1px', color: 'rgba(255,255,255,.5)' },
  matrixFeats: { listStyle: 'none', margin: '14px 0 22px', padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 9 },
  matrixFeat: { fontFamily: BODY, fontSize: '.92rem', fontWeight: 600, color: 'rgba(255,255,255,.74)', lineHeight: 1.35, borderBottom: '1px solid rgba(255,255,255,.06)', paddingBottom: 8 },
  matrixBuy: { display: 'block', textAlign: 'center', fontFamily: HEAD, fontSize: '1rem', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 900, color: '#090909', background: GOLD, border: 'none', padding: '14px', textDecoration: 'none' },
  // matrixOpts grid lives in LANDING_CSS (.lp-opts) so a media query can collapse
  // the 3×/4× Hybrid buttons to one column on the narrowest phones.
  matrixOptBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: '#090909', background: GOLD, padding: '10px 8px', textDecoration: 'none' },
  matrixOptLbl: { fontFamily: HEAD, fontSize: '.72rem', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700 },
  matrixOptPrice: { fontFamily: DISPLAY, fontSize: '1.25rem', letterSpacing: '.5px' },

  // ── Local weekly ongoing training — custom-quote call-out (mailto) ──
  localCallout: { maxWidth: 760, margin: '44px auto 0', textAlign: 'center', background: `linear-gradient(135deg, rgba(106,13,173,.2), rgba(9,9,9,.55))`, border: `1px solid rgba(157,39,201,.4)`, borderLeft: `4px solid ${GOLD}`, padding: '28px 24px' },
  localKicker: { fontFamily: BODY, fontSize: '.7rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PURL, marginBottom: 8 },
  localH: { fontFamily: DISPLAY, fontSize: 'clamp(1.6rem,3.5vw,2.4rem)', letterSpacing: '1px', textTransform: 'uppercase', color: '#fff', margin: '0 0 10px' },
  localP: { fontFamily: BODY, fontSize: '1rem', fontWeight: 600, lineHeight: 1.55, color: 'rgba(255,255,255,.7)', maxWidth: '52ch', margin: '0 auto 20px' },
  localBtn: { display: 'inline-block', fontFamily: HEAD, fontSize: '.95rem', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, color: GOLD, background: 'transparent', border: `2px solid ${GOLD}`, padding: '12px 28px', textDecoration: 'none' },

  founderGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 36, alignItems: 'start' },
  founderImg: { width: '100%', borderRadius: 16, border: `2px solid rgba(106,13,173,.45)`, boxShadow: `0 0 40px rgba(106,13,173,.25)`, display: 'block', marginBottom: 16 },
  credCard: { background: 'rgba(13,1,26,.6)', border: `1px solid rgba(157,39,201,.3)`, borderRadius: 14, padding: 18 },
  cred: { padding: '8px 0', borderBottom: '1px dotted rgba(255,255,255,.08)' },
  credT: { fontFamily: HEAD, fontSize: '.95rem', letterSpacing: '1px', color: '#fff' },
  credS: { fontFamily: BODY, fontSize: '.8rem', color: 'rgba(255,255,255,.55)' },
  story: { fontFamily: BODY, fontSize: '1.1rem', lineHeight: 1.7, color: 'rgba(255,255,255,.84)', marginBottom: 18 },
  sig: { fontFamily: HEAD, fontSize: '1.2rem', letterSpacing: '1px', color: GOLD, marginTop: 8 },
  sigSmall: { fontFamily: BODY, fontSize: '.78rem', fontWeight: 600, letterSpacing: '.5px', color: 'rgba(255,255,255,.5)', textTransform: 'none' },

  proofGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 20, maxWidth: 600, margin: '0 auto 40px' },
  proofFig: { margin: 0 },
  proofImg: { width: '100%', borderRadius: 14, border: `1px solid rgba(106,13,173,.4)`, display: 'block', objectFit: 'cover' },
  proofCap: { fontFamily: HEAD, fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', textAlign: 'center', marginTop: 10 },
  originGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 20 },
  originCard: { background: 'rgba(13,1,26,.55)', border: `1px solid rgba(157,39,201,.22)`, borderRadius: 14, padding: 24 },
  originStep: { fontFamily: BODY, fontSize: '.7rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: GOLD, marginBottom: 8 },
  originT: { fontFamily: HEAD, fontSize: '1.3rem', letterSpacing: '1px', color: '#fff', marginBottom: 10 },
  originQ: { fontFamily: BODY, fontSize: '.98rem', lineHeight: 1.55, fontStyle: 'italic', color: 'rgba(255,255,255,.68)', margin: 0 },

  appBand: {
    display: 'flex', flexDirection: 'column', gap: 'clamp(28px,4vw,44px)',
    padding: 'clamp(28px,5vw,52px) clamp(16px,4vw,40px)',
    background: `linear-gradient(135deg, rgba(106,13,173,.18), rgba(9,9,9,.4))`,
    borderTop: `1px solid rgba(157,39,201,.22)`, borderBottom: `1px solid rgba(157,39,201,.22)`,
  },
  appTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 'clamp(20px,4vw,48px)', flexWrap: 'wrap',
  },
  appText: { flex: '1 1 320px', maxWidth: 640 },
  appBadge: { display: 'inline-flex', flex: '0 0 auto', borderRadius: 8, transition: 'transform .15s ease' },

  // Direct Web App (PWA) install — store-free alternative.
  pwaBlock: { borderTop: `1px dashed rgba(157,39,201,.3)`, paddingTop: 'clamp(24px,3.5vw,36px)' },
  pwaHead: { marginBottom: 'clamp(18px,2.5vw,26px)' },
  pwaTag: { fontFamily: HEAD, fontSize: '.72rem', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: GOLD },
  pwaH: { fontFamily: HEAD, fontSize: 'clamp(1.5rem,3vw,2rem)', letterSpacing: '1px', color: '#fff', margin: '8px 0 6px' },
  pwaSub: { fontFamily: BODY, fontSize: '.95rem', lineHeight: 1.55, color: 'rgba(255,255,255,.62)', maxWidth: 640, margin: 0 },
  pwaCols: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px), 1fr))', gap: 'clamp(14px,2vw,22px)' },
  pwaCard: { background: 'rgba(9,9,9,.55)', border: `1px solid rgba(157,39,201,.28)`, borderRadius: 14, padding: 'clamp(18px,2.5vw,26px)' },
  pwaCardHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid rgba(157,39,201,.2)` },
  pwaIcon: { fontSize: '1.5rem', lineHeight: 1 },
  pwaCardTitle: { fontFamily: HEAD, fontSize: '1.15rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#fff' },
  pwaSteps: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  pwaStep: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  pwaStepNum: {
    flex: '0 0 auto', width: 28, height: 28, borderRadius: 8, background: GOLD, color: '#090909',
    fontFamily: HEAD, fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pwaStepTxt: { fontFamily: BODY, fontSize: '.96rem', lineHeight: 1.5, color: 'rgba(255,255,255,.85)', paddingTop: 3 },

  footer: { borderTop: `1px solid rgba(106,13,173,.25)`, padding: 'clamp(32px,6vw,56px) clamp(16px,4vw,40px)', textAlign: 'center', background: `linear-gradient(180deg, #060507, ${PURP})` },
  footLogo: { fontFamily: HEAD, fontSize: '1.6rem', letterSpacing: '2px', color: '#fff', marginBottom: 10 },
  footTag: { fontFamily: BODY, fontSize: '.88rem', letterSpacing: '1px', color: 'rgba(255,255,255,.5)', margin: '0 0 18px' },
  footLinks: { display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 },
  footLink: { fontFamily: HEAD, fontSize: '.78rem', letterSpacing: '2px', textTransform: 'uppercase', color: GOLD, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none' },
  footCopy: { fontFamily: BODY, fontSize: '.78rem', letterSpacing: '.5px', color: 'rgba(255,255,255,.35)', margin: 0 },
};
