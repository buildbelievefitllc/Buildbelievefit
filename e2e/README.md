# BBF E2E — Playwright Browser-Drone Suite (Terminal 4 lane)

End-to-end browser automation for Build Believe Fit. **Self-contained:** this
directory has its own `package.json` and never imports from — or modifies — the
backend (`index.js`, `api/`), the Supabase edge functions, or the app source. It
only drives the *served output* of each surface.

Two surfaces, two configs:

| Suite | Surface | Config | Served by |
|---|---|---|---|
| `tests/sales-funnel.spec.ts` | Static root PWA (`index.html`) | `playwright.config.ts` | `python3 -m http.server` over the repo root |
| `tests/vault-logging.spec.ts` | React Sovereign Vault (`frontend/`) | `playwright.vault.config.ts` | `vite build` + `vite preview` of `frontend/dist` |

## What it covers

### 1 · Sales funnel — `sales-funnel.spec.ts`

1. **Landing & CTA** — hero "Start My Path" CTA, the `#pathfinder` intake
   section, premium pricing tiers, and the Phase 19 chatbox launcher all render.
2. **Phase 19 AI Chatbox ("Pathfinder Comlink")** — opens the Comlink, sends a
   training goal, receives a triage reply, and confirms the recommendation card's
   in-chatbox "Apply" CTA wires back into `selectTier()`.
3. **Premium tier → Stripe checkout** — for `architect` / `sovereign`: select the
   tier, complete the 4-step intake wizard, submit, and assert a successful
   navigation to the correct Stripe Payment Link with `client_reference_id`.

Intercepted (no live calls): the Anthropic brain (`bbf-agentic-pathfinder`),
`bbf-lead-capture`, the Render Vault Engine, Cloudflare Turnstile, and
`buy.stripe.com`. **No AI tokens, no real lead, no Stripe session.**

### 2 · Vault workout logging — `vault-logging.spec.ts`

A logged-in client logs a set in the React Vault:

1. **Auth** — seeds a client session into `localStorage['bbf.session.v1']` (the
   app uses PIN-RPC auth persisted to localStorage, not Supabase GoTrue), landing
   straight in the Vault.
2. **Today's Program** — opens the "Program" tab → today's training day
   (`jacque_plan` · Day 1).
3. **Expand** a collapsed exercise card.
4. **Log a set** (12 reps @ 160 lbs) and verify the inputs flip to the green
   `is-done` state with the focus ring rendered.
5. **Complete & Sync** — clicks the gold "☁ Complete & Sync Day" CTA and verifies
   the success state.

Intercepted (no live calls): every Supabase REST/RPC call —
`bbf_get_profile_metrics`, `bbf_get_last_weights`, `bbf_get_uid_map`, and the
`bbf_logs` / `bbf_sets` write transaction. The spec asserts the captured set
payload is correct **and** fails loudly if anything reaches the real project
host. **Nothing is written to the production database.**

## Setup

```bash
cd e2e
npm install
npm run install:browsers   # downloads the Chromium runtime (needs network)
```

## Run

```bash
# Funnel suite — local static server over the repo root (auto-started):
npm test

# Vault suite — builds ../frontend and serves it on :4174 (auto-started):
npm run test:vault

# Just the funnel spec, headed (watch the drone work):
npm run test:funnel -- --headed

# Against deployed surfaces (skips the matching local server):
BBF_BASE_URL=https://buildbelievefit.fitness npm test
BBF_VAULT_URL=https://app.buildbelievefit.fitness npm run test:vault

# Open the last HTML report:
npm run report
```

### Target resolution

- **`BBF_BASE_URL`** (funnel) — unset serves the repo root via
  `python3 -m http.server 4173`; set to run against a deployed origin.
- **`BBF_VAULT_URL`** (vault) — unset builds `../frontend` and serves
  `frontend/dist` via `vite preview` on `:4174`; set to run against a deployed
  Vault. The local build's `VITE_SUPABASE_URL` defaults to the preview origin so
  the spec's Supabase intercepts are same-origin (no CORS preflight); both VITE
  values are inert because every network call is mocked. CI may override them.

## Conventions

- TypeScript specs under `tests/`, one flow per `describe`; each config scopes to
  its own spec via `testMatch`.
- Selectors are pinned to stable hooks — funnel: `#bbf-pf-*` / `#f-*` /
  `selectTier('…')`; vault: `.cv-*` / `.pg-*` / `is-done` / `is-open`. If the app
  renames these, update the constant maps at the top of each spec.
- New flows: add a `*.spec.ts` file and reuse the `stub*Backends` helper pattern
  so runs stay hermetic (intercept every third-party + Supabase call).
```
