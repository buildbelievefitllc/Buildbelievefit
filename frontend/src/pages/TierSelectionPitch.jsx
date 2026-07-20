// src/pages/TierSelectionPitch.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Upsell Bridge — sits between the /burn Metabolic Gateway and the Pathfinder
// intake. A standalone /select-tier surface that presents three Online Fitness
// tiers using the LOCKED tab-deck design system (CLAUDE.md §10): a numbered tab
// bar (01/02/03) over a single active panel — never a vertical price stack.
//
// Price anchor: the tabs are ordered Autonomous → Momentum → Catalyst and the
// deck loads on AUTONOMOUS ($49.99, badged "Vanguard"), so the premium price is
// the first thing seen and frames the cheaper tiers beneath it. Every tab tag
// carries its price, so all three anchors ($49.99 / $19.99 / $9.99) are visible
// at once in the rail.
//
// Data: tiers come straight from pricingMatrix.js (single source of truth) — no
// duplicated price/priceId here. The biometrics handed in from /burn ride through
// in location state and are forwarded UNTOUCHED to /pathfinder, alongside the
// `checkout` object ({ priceId, tierName, price }) the Pathfinder needs to surface
// its screening-gated Stripe handoff on submit.
//
// SCREENING COMPLETE (closes the /protocol-init seam): a visitor who just
// finished the Explorer funnel's Protocol Initialization arrives here with
// `location.state.screening = { complete, email, fullName }` — a Pathfinder
// screening record already exists under that exact (normalized) email. Select
// Plan then skips the intake entirely and mints the Stripe Checkout Session
// directly via createCheckoutSession(email, priceId), the SAME gated call
// PathfinderForm's own post-submit success card uses. No screening on file
// (a direct /select-tier visit, or the legacy /burn → /select-tier path) →
// unchanged behavior: Select Plan still carries the tier into /pathfinder
// first.
//
// SELF-HEALING ON A STALE RECORD: the "Screening Complete" flag is trusted
// client-side state — if the server disagrees (bbf-create-checkout still
// replies 403 screening_required, e.g. the record expired or was scrubbed),
// checkoutApi surfaces that as `err.code`. On that specific code, the fast
// path is locally invalidated (screeningExpired) and the button/badge revert
// to the legacy look, while a dedicated re-screen callout offers a single-tap
// recovery: straight into /pathfinder carrying the SAME tier's checkout
// object, so the one extra intake pass ends with them paying for the plan
// they actually picked — not stranded on a dead error message.

import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { PRICING } from '../lib/pricingMatrix.js';
import { createCheckoutSession } from '../lib/checkoutApi.js';
import { useLang } from '../context/LangContext.jsx';

const GOLD = '#F5C800';
const GOLD_LAB = '#D4AF37';
const GOLD_SOFT = '#F5CF60';
const PUR = '#6A0DAD';
const PURL = '#9D27C9';
const PURX = '#1E0340';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";
const DISPLAY = "'Anton',sans-serif";

// The three Online Fitness SKUs, ordered for the price anchor (premium first).
const byName = (name) => PRICING.fitness.tiers.find((tx) => tx.name === name);
const TIERS = [
  { ...byName('BBF Autonomous'), idx: '01', vanguard: true },
  { ...byName('BBF Momentum'), idx: '02' },
  { ...byName('BBF Catalyst'), idx: '03' },
].filter((tx) => tx.priceId); // defensive: drop any that failed to resolve

// ── Smart tier highlighting — read the staged intake (set by the /assessment
// wizard, before PendingIntakeSync clears it) and recommend an access depth from
// the athlete's goals/biometrics. Read SYNCHRONOUSLY at first render so it wins
// the race with the async localStorage purge. Recommendation only PRE-SELECTS +
// highlights — it never forces checkout or hides the other tiers.
function readPendingIntake() {
  try {
    const raw = localStorage.getItem('bbf_pending_intake');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.answers ? parsed.answers : null;
  } catch { return null; }
}
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
// Tiers are same-standard, depth-of-access. Aggressive goals / injuries / a large
// body-recomp target → the fullest tier (Autonomous); light general fitness →
// Catalyst; everything else → the balanced Momentum.
function recommendTierName(a) {
  if (!a) return null;
  const injuries = Array.isArray(a.injuries) ? a.injuries.filter((i) => i && i !== 'none') : [];
  const w = toNum(a.weight);
  const tw = toNum(a.targetWeight);
  const bigDelta = w != null && tw != null && Math.abs(w - tw) >= (a.units === 'metric' ? 9 : 20);
  if (['strength', 'lean_muscle', 'recomp'].includes(a.focus) || injuries.length > 0 || bigDelta) return 'BBF Autonomous';
  if (a.focus === 'general' && injuries.length === 0 && !bigDelta) return 'BBF Catalyst';
  return 'BBF Momentum';
}

export default function TierSelectionPitch() {
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  // Biometrics inherited from the /burn or /protocol-init handoff (may be
  // absent on a direct visit).
  const prefill = location.state?.prefill || null;
  // Screening Complete — a Pathfinder screening record already exists under
  // this exact (normalized) email; see the file-header note above.
  const screening = location.state?.screening || null;
  const screeningComplete = Boolean(screening?.complete && screening?.email);

  // Intake-driven recommendation (read once, synchronously). Absent on a direct
  // visit → falls back to the premium Vanguard anchor (unchanged behavior).
  const [pendingIntake] = useState(readPendingIntake);
  const recName = recommendTierName(pendingIntake);
  const recommended = (recName && TIERS.find((tx) => tx.name === recName)) || null;
  const recommendedPriceId = recommended?.priceId || '';

  // Default-active = the recommended tier when we have intake, else the premium
  // Vanguard tier (price anchor loads first).
  const [active, setActive] = useState(recommendedPriceId || TIERS[0]?.priceId || '');
  const tier = TIERS.find((tx) => tx.priceId === active) || TIERS[0];
  // Fast-track checkout in flight (Screening Complete path only).
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutErr, setCheckoutErr] = useState(null);
  // Flips true ONLY on a server-confirmed 403 screening_required — the local
  // "Screening Complete" flag was stale (expired/scrubbed record). Downgrades
  // the whole fast-track UI back to legacy for the rest of this visit.
  const [screeningExpired, setScreeningExpired] = useState(false);
  const screeningValid = screeningComplete && !screeningExpired;

  // The Pathfinder `checkout` object a given tier hands off — shared by the
  // legacy branch below AND the re-screen recovery CTA, so a stale-record
  // visitor lands back on the EXACT tier they picked, not a blank slate.
  const checkoutFor = (tx) => ({
    priceId: tx.priceId,
    tierName: tx.name,
    price: tx.per ? `${tx.price}${tx.per}` : tx.price,
  });

  // Select Plan — two paths:
  //  · Screening Complete (and still valid): skip the intake entirely, mint
  //    the Stripe session directly against the already-screened email, and
  //    redirect.
  //  · Legacy (no screening on file, or it just turned out to be stale): carry
  //    the chosen tier + the inherited biometrics into the screening intake.
  async function selectPlan(tx) {
    if (screeningValid) {
      setCheckoutErr(null);
      setCheckingOut(true);
      try {
        const url = await createCheckoutSession(screening.email, tx.priceId);
        window.location.href = url;
      } catch (err) {
        if (err?.code === 'screening_required') setScreeningExpired(true);
        setCheckoutErr(err?.message || 'Could not open checkout. Please try again.');
        setCheckingOut(false);
      }
      return;
    }
    navigate('/pathfinder', { state: { prefill, checkout: checkoutFor(tx) } });
  }

  return (
    <div style={st.screen}>
      <div style={st.shell}>
        <Link to="/burn" style={st.back}>← Back to your numbers</Link>

        <div style={st.head}>
          {screeningValid ? (
            <div style={st.screenedBadge} data-testid="tier-screening-complete">✓ {t('pf-checkout-title')}</div>
          ) : null}
          <div style={st.kicker}>Choose Your Access</div>
          <h1 style={st.h1}>Pick the Engine That Fits</h1>
          <p style={st.sub}>
            {screeningValid
              ? t('pf-checkout-body')
              : 'Every tier runs on the same Sovereign Gold Standard — the price reflects depth of access. Choose your plan, then complete a 60-second readiness screen before secure checkout.'}
          </p>
        </div>

        {/* ── LOCKED tab-deck: numbered rail + single active panel ── */}
        <div style={st.deckFrame}>
          <div style={st.deckInner}>
            <div style={st.tabBar} role="tablist" aria-label="Select a plan">
              {TIERS.map((tx) => {
                const on = tx.priceId === active;
                return (
                  <button
                    key={tx.priceId}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActive(tx.priceId)}
                    style={{ ...st.tab, ...(on ? st.tabActive : null) }}
                  >
                    <span style={{ ...st.tabIdx, ...(on ? st.tabIdxActive : null) }}>{tx.idx}</span>
                    <span style={st.tabLabel}>{tx.name.replace(/^BBF /, '')}</span>
                    <span style={{ ...st.tabTag, ...(on ? st.tabTagActive : null) }}>
                      {tx.price}{tx.per || ''}{tx.vanguard ? ' · Vanguard' : ''}
                    </span>
                    {tx.priceId === recommendedPriceId ? (
                      <span style={st.recTag} data-testid="tier-tab-recommended">★ {t('tier-for-you')}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Active panel — the selected tier's card. */}
            <div style={st.panel} role="tabpanel">
              <div style={{ ...st.card, ...(tier.vanguard ? st.cardVanguard : null) }}>
                {tier.vanguard ? <div style={st.vanguardBadge}>Vanguard · Most Complete</div> : null}
                {tier.priceId === recommendedPriceId ? (
                  <div style={st.recBadge} data-testid="tier-recommended">★ {t('tier-recommended')}</div>
                ) : null}
                <div style={st.cardName}>{tier.name}</div>
                <div style={st.priceRow}>
                  <span style={st.price}>{tier.price}</span>
                  <span style={st.per}>{tier.per}</span>
                </div>
                <ul style={st.feats}>
                  {(tier.feats || []).map((f) => (
                    <li key={f} style={st.feat}><span style={st.tick}>▹</span>{f}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  style={{
                    ...st.selectBtn,
                    ...(tier.vanguard ? st.selectBtnGold : st.selectBtnPurple),
                    ...(checkingOut ? st.selectBtnBusy : null),
                  }}
                  onClick={() => selectPlan(tier)}
                  disabled={checkingOut}
                  data-testid="tier-select-plan"
                >
                  {screeningValid ? (checkingOut ? t('pf-checkout-loading') : t('pf-checkout-cta')) : 'Select Plan →'}
                </button>

                {screeningExpired ? (
                  <div style={st.reScreenCallout} data-testid="tier-rescreen-callout">
                    <p style={st.reScreenBody}>
                      Your screening record couldn’t be verified — it may have expired. A 60-second
                      re-check clears it right back up.
                    </p>
                    <button
                      type="button"
                      style={st.reScreenBtn}
                      onClick={() => navigate('/pathfinder', { state: { prefill, checkout: checkoutFor(tier) } })}
                      data-testid="tier-rescreen-cta"
                    >
                      Re-Verify & Continue →
                    </button>
                  </div>
                ) : checkoutErr ? (
                  <div style={st.checkoutErr} role="alert">{checkoutErr}</div>
                ) : null}

                <div style={st.cardNote}>
                  {screeningValid ? t('pf-checkout-secured') : 'Cancel anytime · readiness screening required before payment'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const st = {
  // Checkout action panel — the Select Plan / secure-checkout CTAs sit inside this
  // screen, so the bottom pad rides above the iOS home-swipe indicator
  // (env safe-area-inset-bottom, 16px) and the top clears the notch / Dynamic
  // Island (env safe-area-inset-top, 20px). Native inertial scroll on the surface.
  screen: { minHeight: '100vh', width: '100%', boxSizing: 'border-box', background: 'radial-gradient(120% 80% at 50% 0%, rgba(30,3,64,.6), #090909 70%)', padding: 'calc(clamp(18px,4vw,48px) + env(safe-area-inset-top, 20px)) clamp(14px,4vw,24px) calc(clamp(18px,4vw,48px) + env(safe-area-inset-bottom, 16px))', display: 'flex', justifyContent: 'center', WebkitOverflowScrolling: 'touch' },
  shell: { width: '100%', maxWidth: 720 },
  back: { display: 'inline-block', fontFamily: BODY, fontSize: '.85rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', textDecoration: 'none', marginBottom: 'clamp(16px,3vw,26px)' },
  head: { textAlign: 'center', marginBottom: 24 },
  screenedBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: BODY, fontSize: '.74rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: GOLD, background: 'rgba(245,200,0,.08)', border: `1px solid rgba(245,200,0,.4)`, borderRadius: 999, padding: '.35rem .9rem', marginBottom: 10 },
  kicker: { fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: PURL },
  h1: { fontFamily: HEAD, fontSize: 'clamp(2rem,7vw,2.9rem)', letterSpacing: '1.5px', color: '#fff', margin: '.35rem 0 .55rem', lineHeight: 1 },
  sub: { fontFamily: BODY, fontSize: '.98rem', color: 'rgba(255,255,255,.62)', lineHeight: 1.5, margin: '0 auto', maxWidth: 480 },

  // Deck frame — gradient hairline border + inner eggplant gradient (matches the
  // Brand Engine deck in MarketingLanding).
  deckFrame: { padding: 2, borderRadius: 20, background: `linear-gradient(135deg, ${PUR} 0%, ${GOLD_LAB} 28%, ${PURL} 52%, ${GOLD} 74%, ${PUR} 100%)`, boxShadow: `0 0 60px rgba(106,13,173,.35), 0 0 0 1px rgba(245,200,0,.12)` },
  deckInner: { borderRadius: 18, background: `linear-gradient(180deg, ${PURX} 0%, #060507 100%)`, overflow: 'hidden' },
  tabBar: { display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid rgba(245,200,0,.22)`, background: 'rgba(9,9,9,.55)' },
  tab: { flex: '1 1 120px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: 'clamp(12px,1.6vw,18px) clamp(12px,1.8vw,22px)', cursor: 'pointer', background: 'transparent', border: 'none', borderRight: `1px solid rgba(157,39,201,.22)`, borderBottom: '3px solid transparent', textAlign: 'left', transition: 'background .18s ease, border-color .18s ease' },
  tabActive: { background: `linear-gradient(180deg, rgba(106,13,173,.32), rgba(9,9,9,.1))`, borderBottom: `3px solid ${GOLD}` },
  tabIdx: { fontFamily: DISPLAY, fontSize: '.78rem', letterSpacing: '1px', color: 'rgba(255,255,255,.35)', lineHeight: 1 },
  tabIdxActive: { color: GOLD },
  tabLabel: { fontFamily: HEAD, fontSize: 'clamp(1rem,1.9vw,1.3rem)', letterSpacing: '1px', textTransform: 'uppercase', color: '#fff', lineHeight: 1 },
  tabTag: { fontFamily: BODY, fontSize: '.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: PURL, border: `1px solid rgba(157,39,201,.45)`, borderRadius: 4, padding: '2px 6px', marginTop: 2 },
  tabTagActive: { color: GOLD, borderColor: 'rgba(245,200,0,.5)' },

  panel: { padding: 'clamp(22px,4vw,40px) clamp(16px,4vw,36px)' },
  card: { position: 'relative', background: 'rgba(8,2,18,.55)', border: `1px solid rgba(157,39,201,.3)`, borderRadius: 16, padding: 'clamp(22px,4vw,32px)', textAlign: 'center' },
  cardVanguard: { border: `1px solid rgba(245,200,0,.45)`, boxShadow: `0 0 40px rgba(245,200,0,.12)` },
  vanguardBadge: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_LAB} 100%)`, color: '#1B1106', fontFamily: HEAD, fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 16px', borderRadius: 99, whiteSpace: 'nowrap', boxShadow: `0 6px 18px rgba(245,200,0,.4)` },
  recBadge: { display: 'inline-block', fontFamily: BODY, fontSize: '.72rem', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#1B1106', background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_SOFT} 100%)`, borderRadius: 999, padding: '.28rem .85rem', marginBottom: 10, boxShadow: `0 6px 16px rgba(245,200,0,.3)` },
  recTag: { fontFamily: BODY, fontSize: '.56rem', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: GOLD, marginTop: 3 },
  cardName: { fontFamily: HEAD, fontSize: 'clamp(1.6rem,5vw,2.2rem)', letterSpacing: '1px', color: '#fff', marginTop: 6 },
  priceRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, margin: '.3rem 0 1.1rem' },
  price: { fontFamily: DISPLAY, fontSize: 'clamp(2.4rem,9vw,3.4rem)', color: GOLD_SOFT, lineHeight: 1 },
  per: { fontFamily: BODY, fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: '1px' },
  feats: { listStyle: 'none', padding: 0, margin: '0 auto 1.4rem', maxWidth: 380, textAlign: 'left' },
  feat: { display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: BODY, fontSize: '.96rem', fontWeight: 600, color: 'rgba(255,255,255,.78)', lineHeight: 1.4, padding: '.4rem 0' },
  tick: { color: GOLD, flexShrink: 0 },
  selectBtn: { width: '100%', maxWidth: 340, fontFamily: HEAD, fontSize: '1.15rem', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: 10, padding: '1rem 1.6rem', cursor: 'pointer' },
  selectBtnGold: { color: '#1B1106', background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_LAB} 100%)`, border: 'none', boxShadow: `0 10px 28px rgba(245,200,0,.35)` },
  selectBtnPurple: { color: '#fff', background: `linear-gradient(180deg, ${PURL}, ${PUR})`, border: `1px solid rgba(157,39,201,.6)` },
  selectBtnBusy: { opacity: .6, cursor: 'wait' },
  cardNote: { fontFamily: BODY, fontSize: '.78rem', fontWeight: 600, color: 'rgba(255,255,255,.45)', marginTop: 14, letterSpacing: '.3px' },
  checkoutErr: { fontFamily: BODY, fontSize: '.85rem', fontWeight: 700, color: '#ef4444', marginTop: 12 },
  reScreenCallout: { marginTop: 14, background: 'rgba(245,200,0,.06)', border: `1px solid rgba(245,200,0,.35)`, borderRadius: 12, padding: '.9rem 1rem', textAlign: 'left' },
  reScreenBody: { fontFamily: BODY, fontSize: '.85rem', fontWeight: 600, color: 'rgba(255,255,255,.78)', lineHeight: 1.5, margin: '0 0 .6rem' },
  reScreenBtn: { width: '100%', fontFamily: HEAD, fontSize: '.92rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#1B1106', background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_LAB} 100%)`, border: 'none', borderRadius: 8, padding: '.65rem 1rem', cursor: 'pointer' },
};
