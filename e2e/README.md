# BBF E2E — Playwright Browser-Drone Suite (Terminal 4 lane)

End-to-end browser automation for the Build Believe Fit funnel. **Self-contained:**
this directory has its own `package.json` and never imports from — or modifies —
the backend (`index.js`, `api/`), the Supabase edge functions, or the frontend
source. The only thing it depends on is the *served output* of the static PWA.

## What it covers

`tests/sales-funnel.spec.ts` — the autonomous acquisition flow on `index.html`:

1. **Landing & CTA** — hero "Start My Path" CTA, the `#pathfinder` intake
   section, premium pricing tiers, and the Phase 19 chatbox launcher all render.
2. **Phase 19 AI Chatbox ("Pathfinder Comlink")** — opens the Comlink, sends a
   training goal, receives a triage reply, and confirms the recommendation card's
   in-chatbox "Apply" CTA wires back into `selectTier()` (the checkout funnel).
3. **Premium tier → Stripe checkout** — for the premium tiers (`architect`,
   `sovereign`): select the tier, complete the 4-step intake wizard, submit, and
   assert a successful navigation to the correct Stripe Payment Link with the
   `client_reference_id` stamped.

### Hermetic by design

Every third-party dependency is intercepted at the network layer via
`page.route()`:

| Call | Stubbed with |
|---|---|
| `…/functions/v1/bbf-agentic-pathfinder` (Anthropic brain) | canned reply + recommendation |
| `…/functions/v1/bbf-lead-capture` | `200 {ok:true}` (gates the redirect) |
| `buildbelievefit.onrender.com/process` (Vault Engine) | `200` (fire-and-forget) |
| Cloudflare Turnstile (`bbfGetTurnstileToken`) | resolved fake token |
| `buy.stripe.com/**` | local HTML stub — **never hits live checkout** |

The suite spends **no AI tokens**, writes **no real lead**, and creates **no
Stripe session**. Safe to run in CI and locally.

## Setup

```bash
cd e2e
npm install
npm run install:browsers   # downloads the Chromium runtime (needs network)
```

## Run

```bash
# Against a local static server over the repo root (auto-started by Playwright):
npm test

# Just the funnel spec, headed (watch the drone work):
npm run test:funnel -- --headed

# Against a deployed surface (skips the local server):
BBF_BASE_URL=https://buildbelievefit.fitness npm test

# Open the last HTML report:
npm run report
```

### Target resolution

- **Unset `BBF_BASE_URL`** → Playwright serves the repo root with
  `python3 -m http.server 4173` and tests hit `http://127.0.0.1:4173/index.html`.
  No build step — the PWA ships as static HTML/JS.
- **Set `BBF_BASE_URL`** → tests run against that origin and the local server is
  skipped. Note: a live origin enforces CSP/Turnstile; the network stubs above
  keep the run hermetic regardless.

## Conventions

- TypeScript specs under `tests/`, one flow per `describe`.
- Selectors are pinned to stable `id`s (`#bbf-pf-*`, `#f-*`) and the tiers'
  `onclick="selectTier('…')"` hooks. If the frontend renames these, update the
  `SEL` / `STRIPE_LINKS` maps at the top of the spec.
- New flows: add a `*.spec.ts` file; reuse the `stubFunnelBackends` /
  `stubTurnstile` helpers pattern so runs stay hermetic.
