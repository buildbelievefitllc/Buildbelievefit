# BBF Warheads — Context Passover

> **Status as of commit `a3caf5b` + Supabase deploy `version 1 ACTIVE`**
>
> **Warhead 1 — Pathfinder Sales Comlink** is SHIPPED and DEPLOYED to production.
> **Warheads 2 + 3** are pending and described in full below.
>
> The next Claude session should read this doc first, then read the prompt at the bottom, then fire.

---

## Repository orientation

- **Repo**: `buildbelievefitllc/Buildbelievefit` (working tree at `/home/user/Buildbelievefit`)
- **Branch**: `main` (direct commits, no PR gating for solo dev velocity)
- **Public site**: `index.html` (~4,600 lines after Warhead 1)
- **Client app (PWA)**: `bbf-app.html` (~18,400 lines — single-page app)
- **Supabase project**: `ihclbceghxpuawymlvgi` (`https://ihclbceghxpuawymlvgi.supabase.co`)
- **Publishable key**: `sb_publishable_QgvJzz4pVy7TzIIyg4RcSg_Tydy_nxU` (in `env.js`)
- **Service worker**: `sw.js` — current cache `bbf-v185`. Bump on any HTML/JS/CSS change.
- **Brand palette**: gold `#f5c800` (`--yel`), purple `#6a0dad` (`--pur`), black `#060606` (`--blk`), white `#f9f5ff` (`--wht`), cyan `#22d3ee` for kickers
- **Fonts**: Bebas Neue (headlines) + Barlow Condensed (body) — already loaded in both HTML files

## Supabase MCP — fully available

The next session has direct Supabase MCP access (CEO already upgraded permissions). Use these tools:

- `mcp__Supabase__deploy_edge_function` — deploy edge functions directly (no CLI needed)
- `mcp__Supabase__list_edge_functions` — verify deployments
- `mcp__Supabase__get_logs` — `service: 'edge-function'` for runtime debug
- `mcp__Supabase__list_tables` — schema recon (use BEFORE schema changes)
- `mcp__Supabase__apply_migration` — for DB schema changes
- `mcp__Supabase__execute_sql` — for one-off SQL queries / lookups

**Deploy convention**: All public-facing agentic fns are deployed with `verify_jwt: false` (the apikey gate still applies; the widget passes `apikey` + `Authorization: Bearer <publishable key>` headers but the publishable key is NOT a JWT so JWT verification would fail).

---

## Warhead 1 (DONE) — Pathfinder Sales Comlink

**Status**: Shipped + deployed. Commit `a3caf5b`. Edge function `bbf-agentic-pathfinder` version 1 ACTIVE.

**What it does**: Floating "🗝️ Access the Vault" FAB on every page of `index.html`. Opens a chat panel that triages leads via Claude Opus 4.7 in ≤4 exchanges. Calculates TDEE inline. Recommends Gateway / Architect Hybrid / Sovereign via a `[[RECOMMEND:<tier>]]` marker → renders a clickable tier card that fires `selectTier(tier_key)` (the existing site-wide funnel).

**Files**:
- `index.html` — widget HTML/CSS/JS appended before `</body>` (~280 lines)
- `supabase/functions/bbf-agentic-pathfinder/index.ts` — Deno edge fn (~280 lines)

**Smoke test**: Visit `buildbelievefit.fitness` → see gold FAB bottom-right → click → chat opens → answer a question → agent triages → tier card appears → CTA routes through `selectTier()`. CEO should validate live.

---

## Warhead 2 (PENDING) — Positional Intelligence Comlink

> **Target**: `bbf-app.html` (inside the athlete's portal)
>
> **UI**: Integrate a dynamic query input within the existing "Explore Your Position" database section.
>
> **Logic**: Update the `bbf-agentic-comlink` Edge Function. When an athlete asks for a specific athletic improvement (e.g., "I need a faster first step"), the agent must query the BBF database, locate the specific founder-verified drill (e.g., *Salto Lateral a Sprint*), and dynamically render it onto their screen.

### Critical recon the next session must do FIRST

`grep "Explore Your Position"` returned **ZERO hits** during Warhead 1 recon. This section either:
1. Lives under a different name in `bbf-app.html` (search alternatives: "position", "discover", "library", "athlete portal")
2. Doesn't exist yet and needs to be created from scratch
3. Lives in a DB table that needs schema recon via `mcp__Supabase__list_tables`

**Founder-verified drill catalog** — likely lives in a DB table (search: `founder_drills`, `bbf_drills`, `athletic_drills`, `positional_drills`). Use `mcp__Supabase__list_tables` to find. If not in DB, may be a hardcoded constant in `bbf-data.js` — grep for Spanish drill names like "Salto Lateral" first.

### Architecture pattern

Reference: `supabase/functions/bbf-agentic-comlink/index.ts` — already exists, this warhead UPDATES it.

The existing comlink already handles "athlete in mid-workout asks for a constraint" (e.g., "I only have 20 min"). Warhead 2 extends it to also handle "athletic-improvement queries" — when the user message indicates they want to DEVELOP a specific capability (first step, vertical jump, hip mobility, etc.), the agent:
1. Detects intent (improvement query vs constraint)
2. Queries the founder-drill table
3. Returns the best-fit drill object
4. Frontend renders the drill card

### Frontend integration

The existing BBF_COMLINK_DISPATCH IIFE in `bbf-app.html` (search for `BBF_COMLINK_DISPATCH`) — that's the admin-side dispatch tool. There's also `BBF_COMLINK` (the user-facing gold FAB). Warhead 2 likely needs a NEW UI surface specifically inside the athlete portal's "Explore Your Position" section, not the FAB.

### Sample drill data (from CEO directive)

> *Salto Lateral a Sprint* — lateral hop into sprint acceleration. Develops first-step explosive power. Likely categorized under "first_step" or "acceleration".

The drill catalog likely has fields: name (trilingual), category (first_step / vertical / lateral / etc.), description, video_url, sets/reps prescription.

---

## Warhead 3 (PENDING) — Live O.T. Friction Scanner

> **Target**: `bbf-app.html` (Workout / Prehab Tab)
>
> **UI**: Enhance the existing Comlink FAB (the gold microphone) to accept text/voice regarding acute pain or fatigue.
>
> **Logic**: The `bbf-agentic-prehab` function must be given the authority to execute live protocol overrides. If a user reports heavy CNS fatigue or lower back friction, the agent must automatically rewrite today's heavy compound lifts into an Occupational Therapy-informed decompression and mobility protocol.

### Existing infrastructure to extend

- **Gold mic FAB**: CSS class `.sovereign-comlink-fab` in `bbf-app.html` (around L592). Already wired to voice input + the `bbf-agentic-comlink` function for the "workout constraint" flow (the BBF_COMLINK IIFE).
- **Prehab function**: `supabase/functions/bbf-agentic-prehab/index.ts` — already deployed, currently returns a "recovery matrix" of 3 mobility protocols. This warhead extends its scope to also REWRITE the day's workout when CNS fatigue / friction is detected.
- **Workout day mutation**: `bbf-app.html` has `PLAN[SDAY].exercises` as the in-memory workout array. The comlink already mutates this for time-based overrides. The friction override extends the same mutation pattern.

### Key architectural decision

The CEO's directive places this on the EXISTING FAB (the gold mic). The FAB currently routes voice transcripts to `bbf-agentic-comlink`. Two implementation options:

1. **Single-fn router**: Keep one FAB → one function (`bbf-agentic-comlink`) that detects intent and routes internally (constraint vs friction vs positional). Heaviest backend prompt, simplest frontend.
2. **Multi-fn fan-out**: FAB tests the transcript for pain/fatigue keywords client-side and routes to either `bbf-agentic-comlink` (constraint) or `bbf-agentic-prehab` (friction). Cleaner backend, more complex frontend.

**Recommendation**: Option 1 — let Claude do the intent routing inside one fn. Simpler, matches BBF's single-comlink mental model.

### What the friction protocol should look like

When user says: *"My lower back is fried"* or *"I have CNS fatigue"*:
- Agent rewrites today's PLAN[SDAY].exercises to swap heavy compound lifts (squats / deadlifts / bench / OHP) for:
  - Spinal decompression positions (90/90 breathing, dead hangs, cat-cow)
  - Joint mobility (hip CARs, thoracic rotations)
  - Low-load nervous-system-friendly movements (Z-press, banded face pulls, light bodyweight)
- OT-informed framing: prioritize joint health + sympathetic-to-parasympathetic shift over training stimulus

### Existing pattern to mirror

`bbf-agentic-comlink`'s response shape:
```json
{
  "comlink_verdict": "Friction registered. Today shifts to decompression. Heavy compounds are off — recovery is the gain.",
  "updated_workout": [
    { "name": "90/90 Breathing", "sets": 1, "reps": "5 minutes", "notes": "..." },
    ...
  ]
}
```

The friction-override path returns the same shape — just with mobility-class exercises and a different verdict tone.

---

## Critical patterns established during this session

### CORS pattern (use exact)
```ts
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};
```
**Critical**: `apikey` must be in `Access-Control-Allow-Headers` or browser preflight will fail. CEO explicitly called this out.

### Frontend fetch pattern (use exact)
```js
fetch(window.ENV_SUPABASE_URL + '/functions/v1/<fn-name>', {
  method: 'POST',
  headers: {
    'Content-Type':  'application/json',
    'apikey':        window.ENV_SUPABASE_KEY,
    'Authorization': 'Bearer ' + window.ENV_SUPABASE_KEY
  },
  body: JSON.stringify({ ... })
})
```

### Edge function failure posture
Always return HTTP 200 with a graceful fallback object. Never 4xx/5xx (except 405 for wrong method). Widgets handle ONE shape — the `{ reply, recommendation }` JSON. Errors surface as `reply: "the system is offline..."`.

### Env vars on Supabase
- `ANTHROPIC_API_KEY` — set, used by every agentic fn
- (Don't need to set anything new for Warheads 2/3)

### Service Worker version bump
Bump `sw.js` CACHE constant by 1 on EVERY commit that touches `bbf-app.html`, `index.html`, or any `.js`/`.css` in the public path. Current: `bbf-v185` → next bump should be `bbf-v186`.

### Brand voice (Sovereign)
- Clinical precision, no hype
- No exclamation marks
- No emoji except sparingly (🎯 for verdicts, never 🔥💪🚀 style)
- Brevity is dominance — max 4 sentences per agent turn
- Address what the user shared, never generic

### XSS safety
Every interpolation into `innerHTML` must go through `escapeHtml()`. Jules ran a comprehensive XSS audit (PR #192 commit area) — don't undo that work.

---

## What NOT to repeat

- **Don't try V3 (Three.js + Mixamo) again** for body rendering. CEO parked it; revival was attempted; doesn't work. KFH stays as V2 wireframes.
- **Don't hand-author anatomical SVG paths**. Done multiple times this session, always produces wonky proportions. The right move for "real body" rendering is the coach-video pipeline — CEO will film later, not in scope now.
- **Don't bump SW or run agentic deploys without telling the CEO** — but DO deploy via MCP when shipping new fns (you have permissions now).
- **Don't create `*.md` files** unless explicitly asked. This passover doc IS the exception per CEO request.

---

## Smoke test status (handoff record)

| Item | Status |
|---|---|
| Warhead 1 widget visible on index.html | ✓ Code shipped, awaiting CEO live smoke test |
| Edge fn `bbf-agentic-pathfinder` deployed | ✓ Version 1 ACTIVE in Supabase |
| ANTHROPIC_API_KEY set | ✓ (sibling fns work, key is set) |
| Selectier funnel reuse | ✓ Code path verified — fires `window.selectTier(tier_key)` |
| CSP allowance for fn call | ✓ `_headers` already permits `*.supabase.co` connect-src (Jules PR #192) |
| Mobile responsive | ✓ `@media (max-width:520px)` panel goes full-bleed |
| localStorage TTL | ✓ 24h, key `bbf_pathfinder_session_v1` |

CEO will smoke test Warhead 1 on the live site. If issues surface, the fix path is:
- **Widget not visible**: Hard refresh; the public site doesn't have an SW cache for `index.html`.
- **Chat not responding**: Check `mcp__Supabase__get_logs --service edge-function` for the function's runtime errors.
- **Tier CTA not firing**: Verify `window.selectTier` is defined in `index.html` (it is — search for `function selectTier`).

---

End of passover.
