# PREMIUM AUDIO MONETIZATION BLUEPRINT
## The Biometric Narration & Music Engine + Real-Time Interactive Mindset Coaching

> **Status:** Design blueprint — approved architecture, not yet implemented.
> **Owner surface:** Sovereign Vault mobile workspace (`frontend/src/pages/ClientVault.jsx`).
> **Doctrine compliance:** Zero-API-Bloat (cache-first, bake-once), LOCKED brand (§2 CLAUDE.md),
> model-router discipline (§4), voice-engine discipline (`_shared/bbf-voice-engine.ts`),
> RLS enabled+forced with service-role-only tables (house pattern), non-destructive rollout.

---

## 0 · Executive summary

Two net-new premium products, both layered **additively** on infrastructure that already exists
and is battle-tested in production:

| Product | What the client buys | ElevenLabs surface | Band |
|---|---|---|---|
| **P1 — Biometric Narration & Music Engine** | A daily, personally-programmed, coach-narrated workout audio track (Akeem voice over a generated motivational music bed) that *reacts to their live heart rate* | TTS (`eleven_multilingual_v2` bake) + **Music v2** (`/v1/music` with `composition_plan`) | Apex |
| **P2 — Live Mindset & Accountability Coach** | Real-time spoken conversation with the Akeem voice persona for accountability check-ins, mindset audits, and nutrition audits — natural interruptions, pauses, and turn-taking | **Agents platform (Conversational AI 2.0)** on `eleven_flash_v2_5` (~75 ms model latency), WebRTC transport | Apex (metered) |

The margin thesis: **everything expensive is generated once and shared or cached; everything
live is metered.** Music beds are cached by *workout shape*, not by user (one bed serves every
client on the same session archetype). Voice segments are cached by content hash, exactly like
`bbf_language_soundboard_audio` today. Only the live agent minutes burn per-user API spend, and
those ride the existing `bbf_voice_token_ledger` ceilings.

Codebase reconnaissance confirms **zero existing usage** of the Music API or the Agents
platform — both integrations are greenfield, with no legacy to migrate and no destructive
changes required. The current stack is exclusively `POST /v1/text-to-speech/{voice_id}`.

---

## 1 · Asset inventory — what we already own and reuse

Every design decision below leans on an existing, proven module. Nothing is reinvented.

| Existing asset | Location | Reused for |
|---|---|---|
| **Akeem PVC voice + physics** (`ZbKDEqxkr8Ub4psNm5XD`, stability 0.35 / similarity 0.85 / style 0.15, Dynamic Vocal States) | `supabase/functions/_shared/bbf-voice-engine.ts` | All narration + the live agent's TTS config |
| **Client-side gapless stitching** (virtual timeline, `gap_after_ms`, server never concatenates bytes) | `bbf-sovereign-stitch-router` + `_shared/stitch-core.ts` | P1 session manifest / play contract |
| **Fragment table pattern** (slot grammar, `variant_key`, locale, `storage_path`, `duration_ms`, `sha256`, `status`) | `sovereign_audio_fragments` (migration `20260702133000`) | P1 narration fragments incl. biometric inflection variants |
| **Bake-once → public bucket → manifest resolver** | `bbf-bake-coach-static`, `coach-static` bucket, `staticVoice.js` | P1 shared cue library |
| **Lock-screen-safe playback engine** (single reused `Audio` element, MediaSession API, silent-WAV spacers, `warmNext()` prefetch) | `frontend/src/lib/backgroundLessonAudio.js` | P1 client player foundation |
| **Biometric scenario grammar** (`{LANG}_{CNS}_{Sleep}_{Stress}_{Load}_{category}` subject lines, 84-entry matrix) | `bbf-biometric-audio-matrix.json` | P1 inflection-variant naming |
| **Live biometrics** (`readiness_score`, `hrv_ms`, `resting_hr`, strain/ACWR; Health Connect bridge) | `bbf_daily_protocols`, `bbf_wearable_readings`, `frontend/src/native/healthConnectBridge.js` | P1 inflection triggers, P2 agent context |
| **Voice metering** (Autonomous 150k / Apex 750k tokens/mo, God Mode unmetered) | `bbf_voice_session_precheck` / `bbf_voice_session_commit` RPCs, `bbf_voice_token_ledger` | P2 live-minute metering |
| **Entitlement ladder** (server fail-closed twin + client fail-open mirror) | `_shared/entitlement-gate.ts` + `frontend/src/lib/entitlements.js`, `TierGate.jsx` | Gating both products |
| **Tripwire pre-compute** (DB trigger → `net.http_post` fire-and-forget → cache warm before the user asks) | `bbf_daily_protocols` → `bbf-sovereign-briefing` | P1 nightly/morning track pre-bake |
| **Signed-URL private delivery** (Supabase Storage `createSignedUrl`, 1 h–7 d TTL) | `bbf-weekly-brief-scenario-engine`, `bbf-studio-directed-delivery` | P1 premium (paid) asset delivery |
| **Model router** | `_shared/model-router.ts` | New script-writing use-cases (§6.1) |
| **Mic + WebAudio session plumbing** (getUserMedia, ticket auth, session cap) | `frontend/src/lib/voiceSession.js`, `VoiceCoachButton.jsx` | P2 UX conventions (NOT its transport — see §3.2) |

---

## 2 · PRODUCT 1 — The Biometric Narration & Music Engine

### 2.1 Concept

At check-in (or via the nightly tripwire), the athlete's **daily programming parameters** —
exercises, sets, reps, rest targets from `session.plans.workoutPlan` (parsed by
`parseWorkoutPlan` in `frontend/src/lib/vaultApi.js`) — are compiled into a **timed audio
session**: Coach Akeem narrating every block (set calls, rep pacing, rest countdowns,
transitions) over a **generated instrumental music bed** whose sections are composed to match
the session's actual work/rest timeline. During playback, the client engine watches live heart
rate; when HR crosses the block's athletic threshold band, the engine **injects a pre-baked
inflection cue** at the next timeline seam (never mid-sentence).

### 2.2 Server-side generation pipeline

```
                         ┌────────────────────────────────────────────────┐
 vault token / tripwire  │  EDGE FN: bbf-premium-session-composer          │
 ───────────────────────▶│                                                │
                         │ 1. AUTH  requireEntitlement('premium_audio')   │
                         │ 2. PLAN  read workoutPlan + bbf_daily_protocols│
                         │ 3. HASH  plan_signature = sha256(shape)        │
                         │          user_track_key = sha256(plan|user|day)│
                         │ 4. CACHE bbf_premium_session_tracks hit? ──────┼──▶ return manifest
                         │ 5. SCRIPT Claude (router: premium_session_     │
                         │    script → SONNET) → segmented JSON script    │
                         │    (VOICE_DNA + floor_coach directive +        │
                         │    formatForState from bbf-voice-engine)       │
                         │ 6. VOICE  per-segment: sha256 dedupe against   │
                         │    bbf_premium_audio_fragments → synth ONLY    │
                         │    missing segments (TTS multilingual_v2)      │
                         │ 7. MUSIC  bbf_music_beds hit on plan_signature?│
                         │    miss → build composition_plan → POST        │
                         │    /v1/music → upload bed to bucket            │
                         │ 8. MANIFEST assemble virtual timeline          │
                         │    (voice layer + music layer + inflection     │
                         │    slots) → upsert tracks row → return         │
                         └────────────────────────────────────────────────┘
```

Design rules carried over from the house stitch architecture:

- **The server never concatenates audio bytes.** The deliverable is a *play contract*
  (manifest JSON): an ordered voice timeline with `gap_after_ms`, a music-bed URL with
  per-section duck/boost envelopes, and named inflection slots. The client mixes.
- **Segment-level dedupe.** A rest-countdown cue ("Ninety seconds. Breathe. Next set is the
  one that counts.") hashes identically across thousands of sessions → synthesized once,
  stored once, referenced forever. This is the soundboard cache pattern promoted from
  Postgres-inline base64 to Storage objects (segments are longer; Storage is the right home).
- **Music beds are user-agnostic.** `plan_signature` hashes only the session *shape*
  (block count, work/rest durations, intensity curve, category) — never identity. A
  4-block hypertrophy day with 90 s rests produces the same signature for every client,
  so one Music API call amortizes across the whole roster. This is the single biggest
  COGS lever in the design.

### 2.3 Script segmentation contract (Claude output shape)

The script-writer (SONNET via router) returns strict JSON — one entry per timeline slot:

```jsonc
{
  "session_title": "Pull Day — Week 3 Progression",
  "segments": [
    { "slot": "W0_INTRO",        "text": "...", "vocal_state": "architect",   "est_sec": 25 },
    { "slot": "B1_SETUP",        "text": "...", "vocal_state": "floor_coach", "est_sec": 15 },
    { "slot": "B1_S1_CALL",      "text": "...", "vocal_state": "floor_coach", "est_sec": 8  },
    { "slot": "B1_S1_REST",      "text": "...", "vocal_state": "floor_coach", "est_sec": 10 },
    // ... one CALL + REST pair per prescribed set, per block ...
    { "slot": "W9_COOLDOWN",     "text": "...", "vocal_state": "sanctuary",   "est_sec": 30 }
  ]
}
```

- Slot grammar extends the S0–S7 spine idea: `W0` intro / `B{n}` per-block / `W9` cooldown.
- `vocal_state` maps through `vocalStateForContext` semantics; `formatForState` post-processes
  every segment (exclamation-guard, sanctuary `<break>` injection) before synthesis.
- Heavy-lift override: segments for lat pull-down / rows / presses get `heavyLiftDirective()`
  prepended to the writer prompt (`isHeavyLiftMovement` from the voice engine).
- Rest segments are written to *undershoot* the rest target by ≥6 s so the countdown cue plus
  the potential inflection injection always fits inside the prescribed rest window.

### 2.4 Music v2 composition-plan builder

A deterministic (zero-LLM) TypeScript builder — `_shared/music-plan-builder.ts` — maps the
session timeline onto an ElevenLabs **composition plan** and calls `POST /v1/music`:

```jsonc
// POST https://api.elevenlabs.io/v1/music   (xi-api-key, Accept: audio/mpeg)
{
  "music_length_ms": 2640000_TOTAL_CLAMPED,          // 3 s – 10 min per API limits
  "composition_plan": {
    "positive_global_styles": ["cinematic hip-hop", "driving percussion",
                               "warm analog bass", "motivational", "instrumental", "94 BPM"],
    "negative_global_styles": ["vocals", "lyrics", "EDM drops", "lo-fi hiss"],
    "sections": [
      { "section_name": "warmup_rise",   "duration_ms": 60000,
        "positive_local_styles": ["sparse", "building", "filtered drums"],
        "negative_local_styles": ["full drop"], "lines": [] },
      { "section_name": "block1_work",   "duration_ms": 110000,
        "positive_local_styles": ["full groove", "aggressive drums", "forward energy"],
        "negative_local_styles": [], "lines": [] },
      { "section_name": "block1_rest",   "duration_ms": 90000,
        "positive_local_styles": ["stripped back", "airy pads", "heartbeat kick"],
        "negative_local_styles": ["dense percussion"], "lines": [] }
      // ... work/rest alternation mirrors the plan's actual set×rest timeline,
      //     each section clamped to the API's 3–120 s section bounds (long work
      //     blocks are split into repeated sections) ...
    ]
  }
}
```

Rules:

- **Instrumental always** (`negative_global_styles: ["vocals","lyrics"]`) — the Akeem voice
  layer owns all words; a lyric bed would fight the narration and the brand.
- Section boundaries land exactly on work/rest seams so the client's duck envelope and the
  music's own energy curve agree without DSP trickery.
- One 10-minute API ceiling per call: sessions longer than 10 min get a **looped bed** — the
  builder generates one work/rest "super-cycle" and the manifest instructs the client to loop
  it with a crossfade (`bed.loop = true`, `bed.crossfade_ms = 4000`). Cost stays flat no
  matter how long the workout runs. (`/v1/music/detailed` is available if we later want the
  returned metadata for beat-aligned cue placement — Phase 3 stretch, not required.)
- Style vocabulary is a fixed curated table keyed by session category × intensity
  (strength / hypertrophy / cardio / recovery × green / yellow / red readiness), stored in
  `_shared/music-plan-builder.ts` — no LLM in the music path at all.

### 2.5 Biometric inflection layer

**Principle: real-time *reaction*, pre-baked *audio*.** We never synthesize during a workout —
latency and cost both forbid it. Instead, every session manifest ships with a small set of
pre-baked inflection cues, and the client engine decides *if and when* to play them.

1. **Variant library.** New rows in the fragment table with variant keys following the
   established biometric grammar, per locale:
   - `INF_HR_LOW_{category}` — HR sagging below the block's lower band mid-work
     ("Heart rate says you've got more. Pick the pace up — this set is not a stroll.")
   - `INF_HR_HIGH_{category}` — HR above the ceiling entering a work block
     ("Hold up. Let that heart rate settle. Ten more seconds of air — then we go.")
   - `INF_ON_TARGET_{category}` — periodic affirmation when the athlete sits in the band.
   - `INF_REST_EXTEND` / `INF_REST_CUT` — rest-length adjustments.
   ~20 slugs × 3 locales, baked once via the existing `bbf-bake-coach-static` flow into the
   premium bucket. Total one-time cost, shared by every subscriber forever.
2. **Thresholds in the manifest.** The composer stamps each block with an HR band computed
   server-side from the athlete's profile (age-derived HRmax, tempered by today's
   `readiness_score` and `hrv_ms` from `bbf_daily_protocols` / `bbf_wearable_readings`):
   `{"hr_band": {"floor": 118, "ceiling": 162}, "inflection_slots": ["B2_S3_REST"]}`.
3. **Client rules engine** (`premiumSessionAudio.js`, §5): subscribes to the live HR stream
   (Health Connect bridge on Android; manual/BLE later), evaluates the band with 10 s
   hysteresis + a 60 s per-cue cooldown, and **queues the variant for the next seam** (rest
   start or set end). Seam-only injection keeps the mix musical — no cue ever talks over
   another cue, and the music duck envelope already opens at seams.
4. **Graceful degradation.** No wearable / no HR permission → inflection layer silently off;
   the track plays as authored. Identical posture to the existing wearable-sync dormancy.

### 2.6 P1 endpoints

| Endpoint | Method / auth | Purpose |
|---|---|---|
| `bbf-premium-session-composer` | POST, vault token + `requireEntitlement('premium_audio')`; also tripwire mode via `X-BBF-Premium-Secret` (config `premium_audio_secret`) | Compose/return today's session manifest (cache-first) |
| `bbf-premium-session-composer?status=1` | GET, admin token | Bake/cache stats |
| `bbf-bake-premium-inflections` | POST, `x-bbf-bake-secret` (reuses `bake` perimeter pattern) | One-shot bake of the inflection variant library |
| `bbf-premium-asset-sign` | POST, vault token + entitlement | Exchange manifest storage paths → short-TTL signed URLs (12 h), batch |

Response contract (`bbf-premium-session-composer`, success):

```jsonc
{
  "ok": true,
  "track": {
    "day": "2026-07-09", "locale": "en", "status": "ready",
    "total_duration_ms": 2640000,
    "music": { "path": "beds/<plan_signature>.mp3", "loop": false, "crossfade_ms": 0,
               "duck_db": -12, "duck_attack_ms": 250, "duck_release_ms": 900 },
    "timeline": [
      { "slot": "W0_INTRO", "path": "seg/<sha>.mp3", "start_ms": 0,
        "duration_ms": 24800, "gap_after_ms": 1200 },
      { "slot": "B1_S1_CALL", "path": "seg/<sha>.mp3", "start_ms": 86000, "...": "..." }
    ],
    "blocks": [
      { "id": "B1", "exercise": "Lateral Pull-Down", "sets": 4, "reps": "8–10",
        "rest_target_s": 90, "hr_band": { "floor": 118, "ceiling": 162 },
        "work_window_ms": [60000, 170000] }
    ],
    "inflections": {
      "hr_low":  { "path": "inf/INF_HR_LOW_strength-en.mp3",  "duration_ms": 7200 },
      "hr_high": { "path": "inf/INF_HR_HIGH_strength-en.mp3", "duration_ms": 8100 },
      "on_target": { "path": "inf/INF_ON_TARGET_strength-en.mp3", "duration_ms": 5400 },
      "policy": { "hysteresis_s": 10, "cooldown_s": 60, "inject_at": "seam_only" }
    }
  },
  "fallback": null   // or "yesterday_track" | "static_matrix" | "device_tts"
}
```

Fallback chain mirrors the stitch router: `fresh_track → yesterday_track → static biometric
matrix clip (sovereignManifest) → device_tts`. Never silence, never a hard error to the UI.

---

## 3 · PRODUCT 2 — Real-Time Interactive Mindset & Coaching Agent

### 3.1 Concept

A "Live Session" module inside the Vault's **Mindset** and **Nutrition** tabs: the client
taps *Start Check-In*, grants mic, and holds a natural spoken conversation with the Akeem
persona — accountability check-in, mindset audit, or nutrition audit. Conversational AI 2.0's
turn-taking model handles the human texture ("um", trailing pauses, mid-sentence
interruptions) natively; we do not build our own VAD/barge-in logic.

### 3.2 Why the Agents platform (and not the existing Gemini WS proxy)

The existing live path (`voiceSession.js` → Render WS proxy → Gemini native-audio) stays
untouched for the Program-tab Voice Coach. The new module uses ElevenLabs Agents because the
product requirements are exactly its feature set: **the Akeem PVC voice identity** (Gemini
cannot speak in our cloned voice — this is the brand moat), `eleven_flash_v2_5` TTS at ~75 ms
model latency, the ConvAI 2.0 turn-taking model, built-in ASR, WebRTC echo cancellation /
noise removal on mobile, and server-side conversation orchestration we don't have to host.
The two live surfaces coexist; deprecating the Gemini path is out of scope and NOT proposed.

### 3.3 Agent configuration (dashboard-defined, config-as-code mirrored in repo)

One agent per audit mode is unnecessary — **one agent, mode selected via dynamic variables**:

| Setting | Value |
|---|---|
| Agent | `BBF Sovereign Accountability Coach` (agent ID stored in `bbf_app_config.convai_agent_id`, never client-side) |
| Voice | Akeem PVC `ZbKDEqxkr8Ub4psNm5XD`, settings from `BBF_VOICE_SETTINGS` (stability 0.35 / similarity 0.85 / style 0.15 / speaker boost) |
| TTS model | `eleven_flash_v2_5` (latency tier; the PVC trades a little richness exactly as the existing `BBF_VOICE_MODEL_LOWLATENCY` doctrine already accepts for Floor Coach) |
| Turn-taking | ConvAI 2.0 default turn-taking model, interruptions **enabled** |
| Languages | en / es / pt (language override passed per session) |
| System prompt | `VOICE_DNA` + per-mode directive (mindset → `architect`-flavored; nutrition → `lounge_talk`-flavored) + the customer-facing internals gag from `AI_DIRECTIVES.md` §7 (never discuss backend/AI internals) |
| Dynamic variables | `{client_name, mode, streak_days, readiness_score, last_commitments, macro_targets, locale}` — injected server-side at session mint |
| Client tools | `log_commitment(text, due)`, `flag_wellbeing_concern()` (see escalation, §3.6) |
| Max duration | 10 min hard cap platform-side; client UI cap 8 min |
| Post-call webhook | → `bbf-convai-postcall` (§3.5) |

Agent config JSON is checked into `supabase/functions/_shared/convai-agent-config.json` as the
source-of-truth mirror (the dashboard is the runtime home; the repo copy is drift audit —
same doctrine as `api/supabase-schema-actual.sql`).

### 3.4 Session mint — auth, entitlement, metering

The client NEVER holds the ElevenLabs API key or raw agent access. New edge function:

```
POST bbf-convai-session        { vault_token, mode: "mindset"|"nutrition_audit", locale }
  1. requireEntitlement({ feature: 'mindset_live' })          // fail-closed, Apex band
  2. bbf_voice_session_precheck(uid, EST_TOKENS_PER_MIN * 8)  // reuse the live-voice ledger
  3. Build dynamic_variables from bbf_users / bbf_daily_protocols / prior commitments
  4. ElevenLabs: mint WebRTC conversation token (voice) —
     GET /v1/convai/conversation/token?agent_id=...           // signed-URL WS variant kept
                                                              // as fallback transport
  5. INSERT bbf_convai_sessions (status='minted', mode, locale, ttl)
  6. → { ok, conversation_token, session_id, expires_in }     // token valid 15 min to start
```

The mint is the paywall. Tokens are single-conversation, short-TTL, and the agent itself
requires auth — an unauthenticated client cannot start a session even with the agent ID.

### 3.5 Post-call settlement

`bbf-convai-postcall` (webhook receiver, HMAC-verified with the webhook secret):

- Marks the `bbf_convai_sessions` row `completed`, stores `duration_s`, transcript summary,
  and structured `commitments` extracted by the agent's `log_commitment` tool calls.
- Commits metering: `bbf_voice_session_commit(uid, tokens = duration_s * TOKENS_PER_SEC)` —
  the same ledger the Gemini coach and sovereign briefing already draw down, so one monthly
  ceiling governs ALL live voice regardless of provider.
- Surfaces commitments back into the Vault: next check-in's dynamic variables include
  `last_commitments`, closing the accountability loop ("Last Tuesday you committed to three
  fasted walks. Talk to me.").

### 3.6 Safety escalation (unchanged doctrine)

The agent's `flag_wellbeing_concern()` client tool fires the existing escalation path: the
postcall handler routes flagged transcripts through `routeAndLog('bbf-convai-postcall',
'wellbeing_escalation')` → **OPUS** — identical to the ED-triage posture elsewhere. The
low-latency agent never self-diagnoses; it flags and hands off.

### 3.7 Voice-tag script rendering engine (emotional resonance layer)

Audio tags (`[laughs]`, `[whispers]`, `[excited]`, `[sighs]`, CAPITALS for emphasis) are an
**`eleven_v3` rendering feature** — Flash v2.5 does not perform them. The architecture is
therefore honest about where tags execute:

- **Baked premium content (P1 intros/cooldowns, mindset drops, weekly briefs)** may render on
  `eleven_v3` with tags live, for maximum emotional resonance where latency is irrelevant.
- **Live agent (P2)** runs Flash: tags are stripped pre-synthesis, but the *writing style*
  they encode (emphasis capitals survive; punctuation/ellipsis cadence per the existing
  exclamation-guard doctrine) still shapes delivery.

New shared module — `supabase/functions/_shared/bbf-voice-tags.ts`:

```ts
export const BBF_VOICE_TAGS = ['laughs','whispers','excited','sighs','exhales',
  'curious','mischievously'] as const;                  // curated allow-list, brand-audited

export function sanitizeVoiceTags(text: string): string    // strip tags NOT on allow-list
export function stripVoiceTags(text: string): string       // for flash/turbo/multilingual_v2
export function tagsSupported(modelId: string): boolean    // true only for eleven_v3*
export function renderForModel(text: string, modelId: string): string
  // tagsSupported ? sanitizeVoiceTags : stripVoiceTags — the ONLY entry point callers use
```

This slots beside `formatForState` in the voice engine: script-writers are told the allowed
tag vocabulary in their system prompt (extending the vocal-state directives), and
`renderForModel` guarantees a tag never leaks into a model that would read it aloud as text.
**Gate:** Phase 5 opens with a one-day spike validating Akeem-PVC rendering quality on
`eleven_v3`; if the clone's v3 output fails the brand bar, tags stay confined to the writing
style layer and all synthesis remains on `multilingual_v2` — the module design is identical
either way, which is why the abstraction exists.

---

## 4 · Database schema (migrations, additive only)

All tables follow the house RLS posture: **RLS enabled + forced, zero anon/auth policies,
service-role only**, client access exclusively through edge functions or SECURITY DEFINER RPCs.

```sql
-- 2026xxxx_bbf_premium_audio_engine.sql

-- 1 · Isolated premium bucket (PRIVATE — paid content is never on a public bucket)
insert into storage.buckets (id, name, public) values
  ('premium-audio-vault', 'premium-audio-vault', false)
  on conflict (id) do nothing;
-- storage.objects policies: service_role ALL; no public read.
-- Delivery is exclusively short-TTL signed URLs via bbf-premium-asset-sign.

-- 2 · Narration fragments (segment cache + inflection variants)
create table public.bbf_premium_audio_fragments (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('segment','inflection','intro_outro')),
  variant_key     text not null,            -- 'B1_S1_REST' content-hash key or 'INF_HR_LOW_strength'
  locale          text not null check (locale in ('en','es','pt')),
  script_text     text not null,
  script_sha256   text not null,            -- dedupe key: sha256(voice|model|rendered_text)
  model_id        text not null,
  storage_path    text not null,            -- premium-audio-vault/seg/<sha>.mp3
  duration_ms     integer,
  status          text not null default 'active' check (status in ('active','retired')),
  created_at      timestamptz not null default now(),
  unique (script_sha256, locale)
);

-- 3 · Shared music beds (cached by workout SHAPE, user-agnostic — the margin engine)
create table public.bbf_music_beds (
  id               uuid primary key default gen_random_uuid(),
  plan_signature   text not null unique,    -- sha256(blocks|durations|category|intensity)
  composition_plan jsonb not null,          -- the exact /v1/music payload, for audit/regen
  storage_path     text not null,           -- premium-audio-vault/beds/<sig>.mp3
  duration_ms      integer not null,
  loopable         boolean not null default false,
  hit_count        bigint not null default 0,
  created_at       timestamptz not null default now()
);

-- 4 · Per-user daily session tracks (the play contracts)
create table public.bbf_premium_session_tracks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.bbf_users(id) on delete cascade,
  session_day       date not null,
  locale            text not null check (locale in ('en','es','pt')),
  plan_signature    text not null references public.bbf_music_beds(plan_signature),
  manifest          jsonb not null,          -- full play contract (§2.6)
  readiness_score   integer,                 -- stale-cache guard (sovereign_audio pattern)
  total_duration_ms integer,
  status            text not null default 'ready'
                    check (status in ('composing','ready','failed')),
  created_at        timestamptz not null default now(),
  unique (user_id, session_day, locale)
);
-- 14-day prune on write (briefing pattern); manifests are cheap, fragments/beds persist.

-- 5 · Live agent sessions (P2 ledger + accountability memory)
create table public.bbf_convai_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.bbf_users(id) on delete cascade,
  mode                text not null check (mode in ('mindset','nutrition_audit','checkin')),
  locale              text not null default 'en',
  conversation_id     text,                  -- ElevenLabs conversation id (from webhook)
  status              text not null default 'minted'
                      check (status in ('minted','active','completed','expired','failed')),
  duration_s          integer,
  tokens_charged      bigint,
  transcript_summary  text,
  commitments         jsonb not null default '[]'::jsonb,
  wellbeing_flag      boolean not null default false,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz
);
create index on public.bbf_convai_sessions (user_id, started_at desc);

-- 6 · Config keys (house pattern: bbf_app_config)
--   premium_audio_secret   — tripwire perimeter for the composer
--   convai_agent_id        — never shipped to the client
--   convai_webhook_secret  — HMAC for bbf-convai-postcall
```

**Entitlement additions** (both twins, lockstep — `_shared/entitlement-gate.ts` and
`frontend/src/lib/entitlements.js`):

```
FEATURE_ACCESS.premium_audio = APEX_BAND     // P1 — Biometric Narration & Music Engine
FEATURE_ACCESS.mindset_live  = APEX_BAND     // P2 — live agent (also metered by ledger)
```

Monetization wiring (existing rails, no new mechanism): optional dedicated add-on SKU
`sovereign_audio_addon` in `bbf_tiers` + `PRICE_INFO` (bbf-create-checkout) +
`PRICE_TO_TIER`/`ALLOWED_TIERS` (stripe-webhook), mapped to `GROUP.APEX` in `TIER_TO_GROUP`.
Decision default: launch inside Apex (raises Apex's value story); the add-on SKU is a lever
kept in the drawer, pre-wired by this schema, not shipped in Phase 1.

---

## 5 · Client-side audio context routing model

New engine `frontend/src/lib/premiumSessionAudio.js` — an evolution of
`backgroundLessonAudio.js`, keeping its lock-screen survival tricks and adding a two-layer mix:

```
                       ┌───────────────────────────────────────────────┐
                       │            premiumSessionAudio.js             │
                       │                                               │
  manifest ───────────▶│  LAYER A · MUSIC BED                          │
  (signed URLs)        │   one reused <audio> element (MediaSession    │
                       │   owner: title/artwork/seek/pause handlers)   │
                       │        │ createMediaElementSource             │
                       │        ▼                                      │
                       │   GainNode (duck envelope: -12 dB, 250 ms     │
                       │   attack / 900 ms release, driven by voice    │
                       │   layer activity + manifest seam map)         │
                       │        │                                      │
  live HR ────────────▶│  LAYER B · VOICE TIMELINE                     │
  (healthConnect       │   AudioContext + decodeAudioData buffers,     │
   bridge / BLE)       │   createBufferSource scheduled on the         │
                       │   virtual timeline (sample-accurate, the      │
                       │   stitch-router playback doctrine); next 2    │
                       │   segments prefetched (warmNext pattern)      │
                       │        │                                      │
                       │  INFLECTION GOVERNOR                          │
                       │   hr vs block band → hysteresis 10 s,         │
                       │   cooldown 60 s, seam-only queue → splice     │
                       │   variant buffer into layer B; shift          │
                       │   downstream gaps, never overlap              │
                       │        ▼                                      │
                       │   ctx.destination                             │
                       └───────────────────────────────────────────────┘
```

Implementation notes bound to known codebase constraints:

- **iOS unlock:** reuse `warmUpAudioPlayback()` (silent-WAV inside the tap gesture) AND resume
  the `AudioContext` in the same gesture — both unlocks are needed for the two-layer graph.
- **Lock-screen:** the music `<audio>` element is the MediaSession anchor (an element, not
  WebAudio, must own background playback); voice buffers ride the context. If the OS
  suspends the context (screen off on some Android builds), the engine degrades to
  element-sequenced playback with `gap_after_ms` timers — exactly `backgroundLessonAudio`'s
  proven mode — sacrificing sample-accuracy, never playback.
- **Signed-URL refresh:** URLs carry 12 h TTL; the engine re-signs via
  `bbf-premium-asset-sign` when a fetch 403s (single retry, then fallback chain).
- **SW rule:** signed premium URLs hit the Supabase dynamic-host bypass in
  `frontend/public/sw.js` already (never cached) — no SW change needed for delivery;
  the `CACHE = 'bbf-react-vNNN'` bump (`npm run bump-sw`) ships with every frontend phase.

New UI components (all inside existing tabs, all behind `TierGate`):

| Component | Home | Gate |
|---|---|---|
| `vault/PremiumSessionPlayer.jsx` | Program tab (below ProgramGrid) | `<TierGate feature="premium_audio">` — locked state renders the upsell overlay (visibility-as-sales, house doctrine) |
| `vault/LiveCheckinCoach.jsx` | Mindset tab + Nutrition tab | `<TierGate feature="mindset_live" render="hide">` for the FAB; overlay on the panel |
| `lib/premiumSessionApi.js` | — | composer + sign endpoints, decode helpers |
| `lib/convaiSession.js` | — | mint → `@elevenlabs/react` `useConversation` wrapper (WebRTC; WS fallback), 8-min UI cap, meter countdown à la `SESSION_SECONDS` |

`LiveCheckinCoach` renders the live transcript with the voice-tag styling contract: capitals
render as emphasis (never raw shouting-case in copy), tags render as subtle stage-direction
chips — the script engine's emotional markup becomes visible brand texture, purple/gold per §2.

---

## 6 · Cross-cutting wiring

### 6.1 Model-router additions (`_shared/model-router.ts`)

```ts
// UseCase additions                         → tier      rationale
'premium_session_script'                     → SONNET    // full-session narration plan; mid-complexity
'premium_inflection_scripts'                 → HAIKU     // short variant cues, low stakes
'convai_dynamic_brief'                       → HAIKU     // pre-session dynamic-variable packaging
// 'wellbeing_escalation' already OPUS — reused verbatim by bbf-convai-postcall
```

No inline model strings anywhere; every call emits the `routeAndLog` triple. The live agent's
own conversational LLM runs on the ElevenLabs platform side (their orchestration); our Claude
spend in P2 is only the brief/settlement edges.

### 6.2 Secrets & env

| Secret | Where | Notes |
|---|---|---|
| `ELEVENLABS_API_KEY` | already set (edge env) | gains Music + Agents scopes |
| `bbf_app_config.premium_audio_secret` | new config row | tripwire perimeter |
| `bbf_app_config.convai_agent_id` | new config row | server-side only |
| `bbf_app_config.convai_webhook_secret` | new config row | postcall HMAC |

Nothing new ships to the client bundle. The anon key + vault token remain the only
client-held credentials (existing posture).

### 6.3 Zero-API-Bloat scorecard

| Cost center | Mitigation | Expected steady-state |
|---|---|---|
| Music v2 generation | shared `bbf_music_beds` by plan shape; loop directive for >10 min; fixed style table (no LLM) | ~1 bed per session *archetype*, not per user — cache hit-rate compounds toward ~100% as the archetype space saturates |
| Narration TTS | `script_sha256` fragment dedupe; rest/count cues converge to a finite set; inflection library baked once | per-user spend collapses to the truly personal segments (intro w/ name, block calls w/ today's loads) |
| Claude scripting | SONNET once per user-day (cache-first, tripwire pre-warm); HAIKU for variants | 1 SONNET call/user/day ceiling |
| Live agent minutes | Apex-only + `bbf_voice_token_ledger` ceiling (750k tokens/mo band shared with Gemini coach); 8-min session cap; mint-time precheck | hard-capped; upsell path = raising the ledger ceiling as a priced add-on |
| Storage | MP3 `mp3_44100_128` (voice) / `mp3_44100_192` (beds); 14-day manifest prune; fragments immutable | pennies |

---

## 7 · File boundary map

**Net-new (no existing file is modified destructively):**

```
supabase/functions/bbf-premium-session-composer/index.ts
supabase/functions/bbf-bake-premium-inflections/index.ts
supabase/functions/bbf-premium-asset-sign/index.ts
supabase/functions/bbf-convai-session/index.ts
supabase/functions/bbf-convai-postcall/index.ts
supabase/functions/_shared/music-plan-builder.ts
supabase/functions/_shared/bbf-voice-tags.ts
supabase/functions/_shared/convai-agent-config.json
supabase/migrations/2026xxxx_bbf_premium_audio_engine.sql
frontend/src/lib/premiumSessionAudio.js
frontend/src/lib/premiumSessionApi.js
frontend/src/lib/convaiSession.js
frontend/src/components/vault/PremiumSessionPlayer.jsx
frontend/src/components/vault/LiveCheckinCoach.jsx
```

**Touched (additive edits only):**

```
supabase/functions/_shared/model-router.ts        // +3 use-cases
supabase/functions/_shared/entitlement-gate.ts    // +premium_audio, +mindset_live
frontend/src/lib/entitlements.js                  // lockstep mirror
frontend/src/components/vault/Program.jsx         // mount PremiumSessionPlayer (TierGated)
frontend/src/components/vault/ChampionMindset.jsx // mount LiveCheckinCoach (TierGated)
frontend/src/components/vault/Nutrition.jsx       // mount LiveCheckinCoach (TierGated)
frontend/public/sw.js                             // CACHE bump per frontend phase
frontend/package.json                             // +@elevenlabs/react (Phase 5)
```

---

## 8 · Prioritized development phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **P1-A · Foundations** (1 sprint) | Migration (tables, bucket, config keys); entitlement keys in both twins; router use-cases; `bbf-voice-tags.ts`; `bbf-premium-asset-sign` | Migration applied via `apply_migration`; signed-URL round-trip green; `get_advisors` clean |
| **P1-B · Narration pipeline** (1–2 sprints) | Composer fn (script → segment dedupe → manifest, NO music yet); inflection bake fn + library; tripwire trigger | A real athlete plan produces a playable voice-only manifest end-to-end; fragment cache hit-rate visible in logs |
| **P1-C · Music engine** (1 sprint) | `music-plan-builder.ts`; `/v1/music` integration; `bbf_music_beds` cache; loop directive | Bed generated + cached by signature; second user on same archetype = zero Music API calls |
| **P1-D · Client player + biometric governor** (1–2 sprints) | `premiumSessionAudio.js` two-layer engine; `PremiumSessionPlayer.jsx`; HR governor on Health Connect; fallback chain; SW bump | Full session plays locked-screen on Android + iOS PWA; HR band crossing injects variant at seam; no-wearable degrades silently; `lint`+`build` green |
| **P2-A · Live agent MVP** (1 sprint) | v3-PVC tag spike (gate, §3.7); agent configured (config-as-code mirror); `bbf-convai-session` mint w/ entitlement + precheck; `convaiSession.js` + `LiveCheckinCoach.jsx` (mindset mode) | Apex user completes a WebRTC check-in in the Akeem voice; non-Apex mint is refused server-side; interruption/turn-taking verified on-device |
| **P2-B · Settlement + accountability loop** (1 sprint) | Postcall webhook (HMAC); ledger commit; commitments memory into next session's dynamic variables; wellbeing escalation → OPUS path | Ledger drawdown matches session duration; commitment recall works across two sessions; flagged transcript reaches escalation log |
| **P3 · Monetization hardening** (ongoing) | Upsell overlays copy (trilingual); optional `sovereign_audio_addon` SKU activation; cost dashboards on `hit_count`/ledger; `/v1/music/detailed` beat-aligned cues (stretch) | Conversion + COGS per subscriber visible; add-on SKU launchable by config, not code |

Sequencing rationale: P1-B before P1-C so narration ships value standalone (music is an
enhancement layer, not a dependency); P2 is independent of P1 after Foundations and can run
in parallel if capacity allows; every phase is individually shippable and individually
revertible (feature-keyed, additive files only).

---

## 9 · Risks & pre-commitments

1. **PVC quality on `eleven_v3` / Flash** — the Akeem clone is tuned on `multilingual_v2`.
   Both new model surfaces get a listening-bar spike *before* their phase builds (P2-A gate;
   P1 intros/outros default to `multilingual_v2` and only adopt v3 tags if the spike passes).
2. **Music brand fit** — generated beds must never carry vocals or off-brand genre drift; the
   negative-styles contract + a curated style table + CEO listening sign-off on the first
   archetype batch (LOCKED-brand adjacent, so the sign-off is warranted) de-risk this.
3. **Composition-plan section limits** — 3–120 s per section, ≤10 min total: the builder
   clamps and splits deterministically; unit-test the mapper against extreme plans (30 s EMOM
   vs 5 min rest powerlifting).
4. **iOS background WebAudio** — the degradation mode (element-sequenced, timer gaps) is
   designed in from day one, not retrofitted; P1-D exit criteria test both modes.
5. **Ledger fairness** — P2 shares the live-voice ceiling with the Gemini coach by design
   (one pool, no double-dipping); if Apex users saturate it, the remedy is the priced
   ceiling-raise add-on, not a silent cap increase.
6. **Webhook trust** — postcall payloads are external input: HMAC verification + treating
   transcript content as untrusted (never executed, never echoed into prompts without the
   escalation path's own framing).

---

*Blueprint ends. Implementation begins at Phase P1-A on CEO green light.*
