# BBF Frontend — React Migration (Phase 1: Scaffolding)

Vite + React app that will progressively receive the Sovereign surfaces migrated
out of the `bbf-app.html` monolith. **Phase 1 is foundation only** — no monolith
HTML/CSS or edge functions have been ported yet.

## Why it lives in `/frontend`
The repository root hosts the live **Express/WS backend** (`package.json` →
`bbf-vault-webhook`, `main: index.js`, deployed to Render). This React app is
isolated in `/frontend` so the backend toolchain and its Render auto-deploy are
never touched.

## Stack
- **Vite** + **React 19**
- **react-router-dom** — routing
- **@supabase/supabase-js** — data/auth client (`src/lib/supabaseClient.js`)

## Structure
```
frontend/
├── src/
│   ├── components/   UI elements        (PlaceholderCard.jsx)
│   ├── pages/        top-level views    (Dashboard.jsx)
│   ├── lib/          Supabase client    (supabaseClient.js)
│   ├── context/      global state       (AuthContext.jsx)
│   ├── App.jsx       router
│   └── main.jsx      entry (Router + AuthProvider)
└── .env.example      copy → .env, set VITE_SUPABASE_ANON_KEY
```

## Local dev
```bash
cd frontend
cp .env.example .env      # set VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
npm run build             # production build → dist/
npm run lint
```

## Security
The anon/publishable key is safe in the client bundle — RLS is the boundary.
Privileged admin reads (e.g. the Client Hub roster) go through the token-gated
`bbf-admin-roster` edge function, **never** the anon key directly.

## Not in scope for Phase 1
Porting monolith markup/CSS, edge functions, the service worker, or deployment
wiring. Those are later phases.
