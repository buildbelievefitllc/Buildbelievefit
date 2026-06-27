import { test, expect, type Page } from '@playwright/test';

/**
 * BBF Sales Funnel — Phase 19 → Checkout (Terminal 4 E2E lane)
 * ============================================================
 * Browser-drone coverage of the autonomous acquisition flow on the public
 * landing page (`index.html`):
 *
 *   1. Landing renders the Pathfinder CTA + premium pricing tiers.
 *   2. Phase 19 AI Chatbox ("Pathfinder Comlink") opens, accepts a goal,
 *      returns a triage reply, and surfaces a tier recommendation whose CTA
 *      wires back into the checkout funnel.
 *   3. A premium tier selection drives the 4-step intake to a successful
 *      navigation to the correct Stripe Payment Link.
 *
 * HERMETIC BY DESIGN: every third-party dependency is intercepted at the
 * network layer — the live Anthropic brain (`bbf-agentic-pathfinder`), the
 * lead-capture Edge Function, the Render Vault Engine, Cloudflare Turnstile,
 * and Stripe itself. The suite never spends AI tokens, writes a real lead,
 * or hits live Stripe checkout. Safe for CI and local runs.
 *
 * Selectors and flow verified against index.html (Phase 19/20) — see the
 * funnel internals: selectTier() @ ~2929, doSubmit() @ ~3161, the chatbox
 * IIFE @ ~4838-4966, and BBF_STRIPE_BY_TIER @ ~2916.
 */

const LANDING = '/index.html';

// Mirror of BBF_STRIPE_BY_TIER (index.html ~2916). The two high-ticket,
// flat-fee protocols are the "premium" tiers this funnel test drives.
const STRIPE_LINKS = {
  gateway: 'https://buy.stripe.com/14A7sNb7143x1F02AFaZi0c',
  youth_athlete: 'https://buy.stripe.com/cNieVf8YT6bF2J42AFaZi0f',
  architect: 'https://buy.stripe.com/14A5kF7UP8jN5Vg7UZaZi0i',
  sovereign: 'https://buy.stripe.com/00wdRb5MHdE73N80sxZaZi0j',
} as const;

type PremiumSlug = 'architect' | 'sovereign';

const PREMIUM_TIERS: Array<{ slug: PremiumSlug; label: string; cta: string }> = [
  { slug: 'architect', label: 'Architect Hybrid', cta: 'Start Architect Hybrid' },
  { slug: 'sovereign', label: 'Sovereign', cta: 'Apply for Sovereign' },
];

const SEL = {
  fab: '#bbf-pf-fab',
  panel: '#bbf-pf-panel',
  title: '#bbf-pf-title',
  input: '#bbf-pf-input',
  send: '#bbf-pf-send',
  thread: '#bbf-pf-thread',
  userMsg: '#bbf-pf-thread .bbf-pf-msg--user',
  agentMsg: '#bbf-pf-thread .bbf-pf-msg--agent',
  rec: '#bbf-pf-thread .bbf-pf-rec',
  recCta: '#bbf-pf-thread .bbf-pf-rec-cta',
  tierInput: '#f-tier',
};

interface Captured {
  pathfinderBodies: unknown[];
  leadCaptureBodies: unknown[];
}

/**
 * Intercept all of the funnel's outbound calls so the test is deterministic
 * and never touches production. Returns captured request bodies for
 * round-trip assertions. Routes must be installed BEFORE page.goto().
 */
async function stubFunnelBackends(
  page: Page,
  opts: { pathfinderReply?: string; recommendation?: Record<string, unknown> } = {},
): Promise<Captured> {
  const reply = opts.pathfinderReply ?? 'Acknowledged. Standby for triage.';
  const captured: Captured = { pathfinderBodies: [], leadCaptureBodies: [] };

  // Phase 19 AI Chatbox brain — deterministic stub (no live Anthropic spend).
  await page.route('**/functions/v1/bbf-agentic-pathfinder', async (route) => {
    try {
      captured.pathfinderBodies.push(JSON.parse(route.request().postData() || '{}'));
    } catch {
      /* non-JSON body — ignore for capture */
    }
    const body: Record<string, unknown> = { reply };
    if (opts.recommendation) body.recommendation = opts.recommendation;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  // Lead-capture is the redirect-gating call in doSubmit(): a 200 lets the
  // flow proceed to the Stripe hand-off.
  await page.route('**/functions/v1/bbf-lead-capture', async (route) => {
    try {
      captured.leadCaptureBodies.push(JSON.parse(route.request().postData() || '{}'));
    } catch {
      /* ignore */
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Fire-and-forget Render Vault Engine call — keep the run hermetic.
  await page.route('**buildbelievefit.onrender.com/process', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );

  // Stripe — intercept the redirect target so we verify the hand-off WITHOUT
  // navigating out to live checkout. page.url() will reflect the attempted URL.
  await page.route('https://buy.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head><title>Stripe Checkout (E2E stub)</title></head><body><h1>BBF E2E — Stripe hand-off stub</h1></body></html>',
    }),
  );

  return captured;
}

/**
 * The real page wraps submission in an invisible Cloudflare Turnstile
 * challenge (window.bbfGetTurnstileToken). Turnstile can't run headless, so
 * we replace it post-load with a resolved fake token. Must be called AFTER
 * page.goto() (the page defines the real fn during parse).
 */
async function stubTurnstile(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { bbfGetTurnstileToken: () => Promise<string> }).bbfGetTurnstileToken =
      () => Promise.resolve('e2e-turnstile-token');
  });
}

/**
 * Populate the 4-step Pathfinder intake wizard. The steps are CSS-gated
 * (.fs{display:none}/.fs.on{display:block}); reveal them all so every field
 * is actionable, then drive real fills/selects. "Allergens" is the one hard
 * gate in doSubmit() — "None" satisfies it.
 */
async function fillPathfinderIntake(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('#pathfinder .fs').forEach((s) => s.classList.add('on'));
  });
  await page.fill('#f-fn', 'E2E');
  await page.fill('#f-ln', 'Drone');
  await page.fill('#f-em', 'e2e-drone@buildbelievefit.test');
  await page.fill('#f-ph', '6025550100');
  await page.fill('#f-age', '30');
  await page.selectOption('#f-sex', 'male');
  await page.fill('#f-wt', '185');
  await page.fill('#f-ft', '5');
  await page.fill('#f-in', '10');
  await page.selectOption('#f-act', '1.55');
  await page.selectOption('#f-prog', 'elite');
  await page.click('#ac .chip[data-v=""]'); // "None" — required dietary pick
}

test.describe('BBF Sales Funnel — landing & Pathfinder CTA', () => {
  test('renders the hero Pathfinder CTA, intake section, and premium tiers', async ({ page }) => {
    await page.goto(LANDING);

    // Hero "Start My Path" CTA wired to the intake anchor.
    await expect(page.locator('a[href="#pathfinder"]').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Start My Path/i }).first()).toBeVisible();

    // The Pathfinder intake section + heading.
    await expect(page.locator('#pathfinder')).toHaveCount(1);
    await expect(page.locator('#path-h')).toContainText('Pathfinder');

    // Premium tier CTAs present with the expected copy.
    for (const tier of PREMIUM_TIERS) {
      await expect(
        page.locator(`.prog-cta[onclick*="selectTier('${tier.slug}')"]`),
      ).toContainText(tier.cta);
    }

    // Phase 19 chatbox launcher present.
    await expect(page.locator(SEL.fab)).toBeVisible();
  });
});

test.describe('BBF Sales Funnel — Phase 19 AI Chatbox (Pathfinder Comlink)', () => {
  test('opens the Comlink, triages a goal, and the recommendation CTA wires to checkout', async ({
    page,
  }) => {
    const reply =
      'Given ~4 hrs/week with a hypertrophy goal, the Architect Hybrid (12-week) protocol is your highest-ROI fit.';
    const captured = await stubFunnelBackends(page, {
      pathfinderReply: reply,
      recommendation: {
        tier: 'architect',
        name: 'Architect Hybrid',
        price: '$697 / 12-Week',
        headline: 'Most popular — In-person + App sync.',
        fit: 'Matches your weekly availability and strength goal.',
      },
    });
    await page.goto(LANDING);

    // Open the chatbox.
    await page.click(SEL.fab);
    await expect(page.locator(SEL.panel)).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator(SEL.title)).toHaveText('Pathfinder Comlink');
    await expect(page.locator(SEL.agentMsg).first()).toContainText('Welcome to BBF Pathfinder');

    // Send a training goal.
    const goal = 'I have about 4 hours a week and want to build muscle';
    await page.fill(SEL.input, goal);
    await page.click(SEL.send);

    // User bubble + agent triage reply (mocked brain) render.
    await expect(page.locator(SEL.userMsg).filter({ hasText: goal })).toBeVisible();
    await expect(page.locator(SEL.agentMsg).filter({ hasText: 'Architect Hybrid' })).toBeVisible();

    // The brain actually received the typed message.
    expect(captured.pathfinderBodies.length).toBeGreaterThan(0);
    expect(JSON.stringify(captured.pathfinderBodies.at(-1))).toContain(goal);

    // The recommendation card + its in-chatbox "Apply" CTA appear...
    await expect(page.locator(`${SEL.rec}[data-tier="architect"]`)).toBeVisible();
    await expect(page.locator(SEL.recCta)).toContainText('Apply for Architect Hybrid');

    // ...and clicking it drives selectTier() — stamping the checkout tier.
    await page.click(SEL.recCta);
    await expect(page.locator(SEL.tierInput)).toHaveValue('architect');
  });
});

test.describe('BBF Sales Funnel — premium tier → Stripe checkout', () => {
  for (const tier of PREMIUM_TIERS) {
    test(`"${tier.label}" intake completes and navigates to the Stripe Payment Link`, async ({
      page,
    }) => {
      await stubFunnelBackends(page);
      await page.goto(LANDING);
      await stubTurnstile(page);

      // 1) Select the premium tier — selectTier() stamps #f-tier + scrolls.
      await page.click(`.prog-cta[onclick*="selectTier('${tier.slug}')"]`);
      await expect(page.locator(SEL.tierInput)).toHaveValue(tier.slug);

      // 2) Complete the intake wizard.
      await fillPathfinderIntake(page);

      // 3) Submit — turnstile(stub) → lead-capture(stub 200) → Stripe redirect.
      await page.click('#sbtn');
      await page.waitForURL(/buy\.stripe\.com/, { timeout: 15_000 });

      // 4) Verify the correct premium Payment Link + client_reference_id.
      const url = page.url();
      expect(url.startsWith(STRIPE_LINKS[tier.slug])).toBeTruthy();
      expect(url).toContain(`client_reference_id=${tier.slug}`);
    });
  }
});
