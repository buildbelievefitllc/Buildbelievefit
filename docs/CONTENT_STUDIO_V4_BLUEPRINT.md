# BBF Content Studio V4 — Architectural Blueprint
## WebCodecs Batch Foundry · Creator Cosmetics Engine · Trilingual Auto-Post Pipeline · Directed Play

**Date:** 2026-07-02
**Status:** Architectural blueprint — ready for Opus execution. No deployable code in this
document; it is the spec.
**Scope:** Pure architectural logic, UI state models, memory-management schemas, and queue
management trees.
**Companions:** BBF Lab Architectural Dossier · Workload/Recovery, Fueling, and Cardio/
Stitching blueprints (the gram-native ledgers and the Sovereign fragment library this
studio consumes).

**Grounded against the live code:** `SovereignFoundry.js` (client WebCodecs seek-and-mux
engine, "Isolation Protocol" — zero React in the encode path), `SovereignStudioV4/*`
(StudioLayout, ReelPreviewEngine, StageScaler, VibeSelector, QueueMonitor),
`bbf-studio-queue` (signed-upload + queue write path), `bbf-reel-distributor` /
`bbf-card-distributor` (Meta Graph posting, TikTok switch retained-disabled),
`sovereign_audio_fragments` (baked ElevenLabs playlist library). V4 extends these seams;
it does not replace them.

---

## 0 · GOVERNING DOCTRINE

### 0.1 The Gram Standard (CRITICAL SYSTEM CONSTRAINT)

Every data overlay rendered onto the canvas that expresses mass **displays integer grams,
read verbatim from the gram-native ledgers** — `athlete_workload_daily.tonnage_g`,
`athlete_nutrition_targets_daily.protein_g/carbs_g/fat_g`,
`bbf_cardio_prescription.rehydration_g/sweat_loss_g_est`, `bbf_sets.load_g`. No kilogram
conversion exists anywhere in the overlay pipeline:

```
stat binding contract:  { source: '<table.column_g>', format: 'int_grams' }
render rule:            value = BIGINT from ledger → locale-grouped integer + ' g'
  en: "143,335 g" · es: "143.335 g" · pt: "143.335 g"     (grouping per locale, unit fixed)
FORBIDDEN: /kg|kilo/ in any overlay formatter — CI grep on the studio bundle asserts it.
```

### 0.2 Trilingual Ecosystem (CRITICAL SYSTEM CONSTRAINT)

Every dynamic text layer and every auto-generated caption is fully localized en/es/pt.
Localization is **structural**: text layers carry per-locale content (or a copy-table key);
a render job has exactly one `locale`, resolved from the **target** — the athlete's
`preferred_language` for Directed Play, the CEO's channel choice for social. Fonts are
subset to cover es/pt diacritics in both brand faces (Bebas Neue headers, Barlow Condensed
body — LOCKED, §2 brand law; the cosmetics engine offers toggles *between* the two, never
beyond them).

### 0.3 Mobile-First Processing & Exporting (CRITICAL SYSTEM CONSTRAINT)

The current Foundry fails on mobile for three compounding reasons, each solved
architecturally in Part 0.5:

1. **RAM-resident muxing:** `fastStart: 'in-memory'` + `ArrayBufferTarget` holds the whole
   MP4 (plus encoder queues, plus decoded audio) in tab memory — a 60 s 1080×1920 reel can
   exceed a mobile tab's working budget mid-finalize. → chunked `StreamTarget` into OPFS.
2. **WebKit capability gap:** `isSupported()` requires `window.VideoEncoder`; iOS Safari
   ships VideoEncoder (16.4+) but `AudioEncoder` support is unreliable → the export path
   must fork per capability, not fail. → the Export Path Router (three lanes).
3. **No camera-roll path:** a `Blob` + `<a download>` lands in Downloads on Android and
   nowhere useful on iOS. → the Save Router (§0.5.D) with Web Share Level 2 as the
   camera-roll bridge.

### 0.4 Inherited constraints (binding)

- **Isolation Protocol (CEO order, preserved):** the encode engine stays a plain ES6
  class outside React; the batch queue (Part 4) is likewise React-free — React renders
  *views of* queue state, never owns encode lifecycle.
- **Zero-API discipline, scoped correctly:** the *athlete daily check-in* path remains
  zero-API (stitching blueprint §0.2). Studio V4 is a **CEO-time creator surface** — a
  single Haiku call per caption batch (§3) is authorized spend, routed and logged through
  the model router like every Claude call (§4 of CLAUDE.md). Voice audio is never
  synthesized here: Studio consumes the already-baked `sovereign_audio_fragments`.
- **Security model unchanged:** the browser holds only the 24 h admin session; signed
  upload URLs + queue writes stay behind `bbf-studio-queue`. Service role never ships.
- **RLS service-role-only** on every new table; **brand law** (§2) on every default.

---

## PART 0.5 · THE EXPORT SUBSTRATE (capability router + memory schema)

Everything in Parts 1–4 renders through this substrate. It is the mobile-failure fix.

### 0.5.A Capability probe (once per session, cached)

```
probe = {
  videoEncoder:  typeof window.VideoEncoder === 'function'
                 AND await VideoEncoder.isConfigSupported(avc1_ladder[0..n]) any-pass,
  audioEncoder:  typeof window.AudioEncoder === 'function'
                 AND isConfigSupported({codec:'mp4a.40.2', …}),
  mediaRecorderAAC: MediaRecorder.isTypeSupported('audio/mp4')      -- WebKit AAC escape hatch
                    OR isTypeSupported('audio/mp4;codecs=mp4a.40.2'),
  opfs:          navigator.storage?.getDirectory available (origin-private file system),
  shareFiles:    navigator.canShare?.({ files:[probe.mp4File] }),   -- Web Share Level 2
  deviceClass:   navigator.deviceMemory ≥ 6 ? 'high' : deviceMemory ≥ 3 ? 'mid' : 'low',
  secureContext: required (WebCodecs precondition — already enforced)
}
```

### 0.5.B The Export Path Router (three lanes, decided per job)

```
LANE A · FULL CLIENT (Chromium desktop/Android, capable WebKit):
  videoEncoder ✓ AND audioEncoder ✓
  → existing seek-and-mux pipeline + Part 1 mixer → AAC via AudioEncoder → mp4-muxer.

LANE B · SPLIT-CODEC CLIENT (WebKit with VideoEncoder but no AudioEncoder):
  videoEncoder ✓ AND audioEncoder ✗ AND mediaRecorderAAC ✓
  → video frames encode exactly as Lane A;
  → the MIXED master bus (Part 1, rendered by OfflineAudioContext) plays through a
    MediaStreamAudioDestinationNode into MediaRecorder('audio/mp4') → AAC-in-MP4 blob
    → demux the mdat AAC frames client-side → hand to mp4-muxer as pre-encoded chunks.
  Same output contract as Lane A; ~realtime audio encode cost (audio only — acceptable).

LANE C · DEGRADED CAPTURE (no VideoEncoder at all — old WebKit/WebViews):
  → canvas.captureStream(fps) + mixed-audio MediaStream → MediaRecorder (mp4/webm,
    whatever isTypeSupported passes) → single realtime-recorded file.
  Quality ceiling acknowledged (VBR, realtime); the job is TAGGED lane:'C' and the
  Creator UI shows a "compatibility export" badge. NEVER blocked, always something.

Router rule: lane is computed per job from the probe; a mid-batch lane change is
forbidden (probe is session-stable) — one batch, one lane, predictable memory shape.
```

### 0.5.C The memory schema (hard budgets, not hopes)

```
RESOLUTION LADDER (decided by deviceClass, before encode):
  high  → 1080×1920 @ target bitrate 8 Mbps
  mid   → 1080×1920 @ 6 Mbps, encoder latencyMode 'quality'
  low   → 720×1280  @ 3.5 Mbps            -- ~2.25× fewer pixels/frame end-to-end

MUX TARGET (the in-memory fix):
  desktop/high:  ArrayBufferTarget + fastStart:'in-memory'      (unchanged — it works)
  mid/low/any-mobile: StreamTarget(chunked) → OPFS file writer, fastStart:false
    · MP4 bytes leave JS heap as they are produced; peak heap ≈ encoder queues only
    · faststart is a social-upload nicety, not a requirement — the distributor
      re-hosts the file; moov-at-end is fine for upload lanes
    · final blob is materialized FROM OPFS only at save/upload moment, then released

BACKPRESSURE (encoder queue watermark):
  while (venc.encodeQueueSize > 8) await nextDequeueEvent
  -- seeking is paused until the encoder drains; RAM cannot balloon on slow hardware
  (extends the Foundry's existing hardware-H.264 note into a hard rule)

DECODED-ASSET DISCIPLINE:
  · music AudioBuffer + fragment AudioBuffers: decoded once per BATCH, shared read-only
    across jobs (they are immutable), released at batch end — not per job
  · footage <video>: ONE private element reused across all jobs (src swap), never N
  · canvas: ONE reusable 2D canvas; between jobs → ctx.clearRect(0,0,W,H) AND
    canvas.width = canvas.width (drops the backing store) AND re-set dims for next job
```

### 0.5.D The Save Router (camera-roll path)

```
ON export complete (blob or OPFS handle):
├─ probe.shareFiles ✓ (iOS Safari 15+, Android Chrome 89+)
│   → navigator.share({ files:[ new File([blob], name, {type:'video/mp4'}) ] })
│     iOS: share sheet → "Save Video" lands in CAMERA ROLL (the only web path there)
│     Android: share sheet → Photos/Drive/etc.
│     · MUST be called from a user-gesture handler → the queue NEVER auto-shares;
│       it surfaces a "Save to device" button per finished job (gesture = the tap)
├─ share unavailable/declined → <a download> object-URL (Android → Downloads;
│     desktop → file save), revokeObjectURL immediately after click dispatch
└─ both unavailable (rare WebViews) → blob persists in OPFS 'exports/' with a
      retry list in the UI — the render is never lost to a failed save

UPLOAD is independent of SAVE: the auto-post path (Part 3) uploads via the existing
bbf-studio-queue signed URL regardless of whether the CEO also saved locally.
```

---

## PART 1 · THE MULTI-TRACK AUDIO MIXER

### 1.1 Sources (three, exactly)

```
TRACK 1 · VOCAL — the baked Sovereign fragment playlist (zero synthesis):
  input: a sovereign_brief_playlists row OR an ad-hoc fragment selection
  → fetch N fragment MP3s → decodeAudioData → AudioBuffer[]
  → schedule sequentially on the vocal bus at their playlist offsets:
      t(0)=0 · t(i) = t(i−1) + duration(i−1) + gap_after_ms(i−1)/1000
  vocal_duration = Σ durations + Σ gaps        -- the GOLD: defines reel duration
                                               -- (footage loops beneath, never cut —
                                               --  existing Foundry rule, preserved)

TRACK 2 · MUSIC — creator-uploaded bed:
  input: <input type="file" accept="audio/*"> (mobile file picker / Files app)
  → decodeAudioData → musicBuffer
  → trimmed/looped to vocal_duration + tail: loop if shorter, hard-trim if longer
  → automatic fade-in 0.5 s, fade-out 1.5 s at reel end (linearRamp on the music gain)

TRACK 3 · MASTER — the sum bus (not a source, but the third fader)
```

### 1.2 The routing graph (Web Audio, rendered OFFLINE)

Mixing happens in an **OfflineAudioContext** (length = vocal_duration × sampleRate) —
deterministic, faster than realtime, zero playback glitches, and the identical graph is
mirrored to a live AudioContext for the preview player:

```
fragmentSource[i] ─┐
fragmentSource[…] ─┼─► vocalGain ──────────────┐
fragmentSource[n] ─┘        ▲                  │
                            │                  ├─► masterGain ─► destination
musicSource ─► musicLoop/trim ─► duckGain ─► musicGain
                                    ▲
                     DUCKING AUTOMATION (deterministic, no live analysis):
                     for each fragment window [t_start, t_end]:
                       duckGain: ramp to duck_level over 0.15 s at t_start − 0.15,
                                 ramp back to 1.0 over 0.40 s at t_end
                     -- music breathes under Akeem's voice; playlist timing IS the
                     -- sidechain, so ducking is sample-deterministic and replayable
```

### 1.3 The mixer state model (UI-facing)

```
mixerState = {
  master: { db: 0,   muted: false },      // −60…+6 dB fader
  vocal:  { db: 0,   muted: false },
  music:  { db: −12, muted: false },      // default bed level: voice-first
  ducking: { enabled: true, duck_db: −9 },
  music_asset: { name, duration_s, sha256 } | null,
  solo: 'vocal' | 'music' | null          // preview-only affordance
}

gain math (the only conversion):  linearGain = muted ? 0 : 10^(db/20)
render rule: mixerState is FROZEN into the job at enqueue time (job.audio_mix) —
             fader moves after enqueue affect the next job, never a rendering one.
```

### 1.4 Handoff to the encoder (per lane)

```
OfflineAudioContext.startRendering() → mixedBuffer (stereo, 44.1/48 kHz)
├─ LANE A: mixedBuffer → AudioEncoder('mp4a.40.2') → muxer.addAudioChunk (existing
│          _encodeVoiceover path, now fed the MIX instead of the raw VO)
├─ LANE B: mixedBuffer → live replay through MediaStreamDestination → MediaRecorder
│          ('audio/mp4') → AAC extraction → muxer pre-encoded chunks
└─ LANE C: mixedBuffer → MediaStreamDestination merged with canvas.captureStream —
           the mix rides the realtime recording

mixedBuffer is released (nulled) the moment the audio encode completes — before video
seeking begins. Peak audio memory never overlaps peak video memory.
```

---

## PART 2 · THE TYPOGRAPHY & COSMETICS ENGINE

### 2.1 The layer model (exact React state shape)

Creator cosmetics are a **layer list** rendered identically by the preview
(ReelPreviewEngine, via StageScaler) and the export compositor (SovereignFoundry overlay
pass). One state, two consumers — preview is always render-truth:

```jsonc
overlayState = {
  canvas_basis: { w: 1080, h: 1920 },        // ALL sizes/positions are in basis units;
                                             // StageScaler maps to preview px, the
                                             // Foundry maps 1:1 (or 2/3 for 720p ladder)
  locale: 'es',                              // ONE locale per render job (§0.2)
  layers: [
    {
      id: 'hook_1', type: 'text', z: 3, visible: true,
      content: { en: 'PROTECT THE ENGINE', es: 'PROTEGE EL MOTOR', pt: 'PROTEJA O MOTOR' },
      // — POSITION (the anti-guesswork block) —
      pos: { x: 0.50, y: 0.18, anchor: 'center' },   // FRACTIONS of basis, drag + nudge
      max_width_frac: 0.86,                          // wrap box; text never touches edges
      // — TYPOGRAPHY (precise, mobile-tunable) —
      font: 'bebas' | 'barlow',                      // brand-locked toggle (§2 LOCKED)
      size_px: 96,                                   // in basis px; slider 24–160 step 2
      letter_spacing_px: 2.5,                        // slider −2…+12 step 0.5
      line_height: 1.08,                             // slider 0.9–1.6 step 0.02
      weight: 700, transform: 'uppercase'|'none',
      auto_fit: { enabled: true, min_px: 40 },       // §2.2 shrink-wrap
      // — COSMETICS —
      fill: '#f5c800',                               // palette-first: purple/gold/white
      stroke:  { enabled: true,  color: '#090909', width_px: 6 },
      shadow:  { enabled: true,  color: 'rgba(9,9,9,.55)', blur_px: 18, dy_px: 4 },
      plate:   { enabled: false, color: '#090909', opacity: 0.55,
                 pad_px: 24, radius_px: 12 },        // the anti-blotch scrim (§2.2)
      color_overlay_scope: 'layer'                   // vs 'global' (§2.3)
    },
    {
      id: 'stat_1', type: 'stat_badge', z: 2, visible: true,
      binding: { source: 'workload.tonnage_g', format: 'int_grams' },   // §0.1 — grams only
      label:   { en: 'MOVED TODAY', es: 'MOVIDO HOY', pt: 'MOVIDO HOJE' },
      pos: { x: 0.50, y: 0.82, anchor: 'center' },
      style_ref: 'badge_gold'                        // preset token, overridable per-field
    },
    { id: 'brand', type: 'logo', z: 1, locked: true, /* founder asset — never removable,
         position presets only (§2 brand law) */ }
  ],
  global_grade: {                                    // whole-frame color overlay
    tint: { color: '#6a0dad', opacity: 0.00 },       // 0–0.35 slider (brand purple wash)
    vignette: { opacity: 0.20 },
    footage_dim: 0.00                                // 0–0.5 darken-under-text master
  },
  preset_id: 'uuid | null'                           // §2.4
}
```

**Mobile UI law:** every numeric above binds to a slider/stepper (thumb-sized), never a
keyboard field; position is drag-on-preview plus 4-way nudge arrows (1 basis-px per tap,
8 with hold). The full state round-trips through `JSON.stringify` — no functions, no refs —
so presets, batch templates, and Directed Play jobs serialize for free.

### 2.2 The anti-blotch doctrine (why text stops disappearing)

"Blotched out" = brand-gold text over bright/busy footage with no separation. Four layered
defenses, all deterministic:

```
D1 · CONTRAST PROBE (per layer, cheap):
  at compose time, sample the canvas region under the layer's wrap box on frame 0 and
  the loop midpoint frame → mean luminance L̄ (0–1)
  contrast_ok = |L(fill) − L̄| ≥ 0.35
  if NOT contrast_ok AND plate.enabled === false:
    → auto-enable plate at opacity 0.45 (creator sees a "legibility shield added" chip,
      can override — the system defaults to readable, the human keeps final say)

D2 · STROKE + SHADOW DEFAULTS: every new text layer is born with the #090909 stroke
  and soft shadow ON (matte black is an approved surface — never a brand mark, §2 law).

D3 · AUTO-FIT SHRINK-WRAP (no more edge-clipped headlines):
  binary-search size_px downward from the set value until the wrapped text fits
  max_width_frac AND total block height ≤ 0.30 × basis height; floor at auto_fit.min_px;
  below the floor → wrap to +1 line instead. Locale-aware: runs PER LOCALE (Spanish
  and Portuguese run ~15–25% longer than English — the same layer may auto-fit to
  different sizes per language; that is correct behavior, not drift).

D4 · SAFE-AREA GRID: pos snapping (toggleable) to a 9-zone grid inset 6% from edges;
  platform chrome zones (IG UI ~ bottom 18%, right 12%) rendered as translucent
  keep-out overlays in the preview so text isn't buried under like/share buttons.
```

### 2.3 Gram-native stat badges (the data channel on canvas)

`stat_badge` layers resolve their `binding.source` at **job-freeze time** against the
target context: Directed Play jobs resolve against the *target athlete's* ledger rows for
the job's `day`; generic social jobs resolve against CEO-picked demo values flagged
`demo:true` (never a real athlete's data on a public reel without the Directed flag —
privacy boundary, enforced in the composer). Formatting is §0.1: integer grams, locale
grouping, unit ` g`, no exceptions.

### 2.4 Presets — customize once, reuse forever

```sql
CREATE TABLE IF NOT EXISTS public.studio_overlay_presets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  overlay_json JSONB NOT NULL,        -- full overlayState minus locale + bindings' values
  created_by   UUID REFERENCES public.bbf_users(id),
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.studio_overlay_presets ENABLE ROW LEVEL SECURITY;
```

---

## PART 3 · THE SOCIAL CAPTION & AUTO-POST PIPELINE

### 3.1 Placement — extend the queue that already posts

`bbf-studio-queue` (sign → upload → confirm → queue row) and `bbf-reel-distributor`
(Meta Graph: IG Reels + FB, TikTok switch retained-disabled) stay the transport. V4 adds a
**caption brain** between "render finished" and "confirm", and widens the queue row:

```sql
ALTER TABLE public.bbf_reels_batch_v1
  ADD COLUMN IF NOT EXISTS caption_en       TEXT,
  ADD COLUMN IF NOT EXISTS caption_es       TEXT,
  ADD COLUMN IF NOT EXISTS caption_pt       TEXT,
  ADD COLUMN IF NOT EXISTS hashtags         TEXT[],            -- merged, deduped, ≤ 8
  ADD COLUMN IF NOT EXISTS target_channels  TEXT[] DEFAULT '{instagram,facebook}',
  ADD COLUMN IF NOT EXISTS channel_locales  JSONB,             -- { instagram:'en', facebook:'es', … }
  ADD COLUMN IF NOT EXISTS caption_context  JSONB;             -- the generation inputs (audit)
```

### 3.2 Caption generation (one Haiku call, CEO-time, router-logged)

```
TRIGGER: render job completes → caption composer fires ONCE per video (not per locale)

CONTEXT ASSEMBLY (deterministic, from the job itself — no fishing):
  {
    hook_text: overlay hook layer content (all 3 locales),
    vibe: VibeSelector token, exercise/sport tags: ExerciseCombobox selection,
    stat_facts: rendered gram badges (e.g. "tonnage 143,335 g"),
    cardio_context: tier/beat tokens if the video wraps a Sovereign brief,
    audience: 'social' | 'directed'                    -- directed skips hashtags/CTA
  }

MODEL: routeAndLog('bbf-studio-caption', 'social_caption') → HAIKU tier
  (marketing copy = low-stakes narration/i18n — exactly Haiku's lane; add
  'social_caption' to the UseCase map, never inline a model string)

ONE CALL, ONE JSON OUT: { caption: {en, es, pt}, suggested_tags: [...] }
  · 3 native captions (never translations of each other — same rule as the voice)
  · ≤ 500 chars each (IG limit is 2200; short wins), hook-first, one CTA,
    AI_DIRECTIVES §7: zero backend/internals vocabulary — physiology + brand voice only

HASHTAG ASSEMBLY (deterministic — the model only *suggests*):
  final_tags = dedupe( BRAND_BASE ∪ sport_tags[sport] ∪ locale_tags[primary_locale]
                       ∪ (suggested_tags ∩ ALLOWLIST) ).slice(0, 8)
  · BRAND_BASE + sport/locale sets live in bbf_app_config 'studio_hashtag_sets_v1'
  · ALLOWLIST filter means the model can never inject an off-brand or banned tag
  · the distributor's existing LOCAL_TAGS block still appends at post time (unchanged)

FAILURE POSTURE: Haiku unreachable → template captions from the hook layer's own
trilingual text + BRAND_BASE tags. The queue never blocks on the caption brain.
```

### 3.3 Channel routing at post time

```
Per queue row, per channel in target_channels:
  locale  = channel_locales[channel] || primary_locale
  caption = caption_{locale} + '\n\n' + hashtags.join(' ')       (then LOCAL_TAGS, existing)
  instagram → existing postInstagram (REELS, share_to_feed)      unchanged transport
  facebook  → existing postFacebook (page video)                 unchanged transport
  tiktok    → switch stays present, stays disabled until the app review lands;
              rows carry the channel so the backlog posts the day it flips on

ONE-CLICK: the existing confirm{now:true} path IS the one-click auto-post — V4's UI
button "Render → Caption → Post" chains: upload → caption composer → confirm(now:true).
DRIP: rows without now:true post on the daily distributor drip (existing behavior).
```

---

## PART 4 · BATCH ORCHESTRATION & DIRECTED ROUTING

### 4.1 The batch queue state machine (client-side, React-free)

One plain ES6 `FoundryBatchController` owns the queue (Isolation Protocol extended);
React's QueueMonitor renders snapshots via a subscribe callback:

```
job = {
  id, kind: 'reel' | 'audio_brief_card',
  status: 'queued' → 'preparing' → 'mixing' → 'encoding' → 'finalizing'
          → 'saving' | 'uploading' → 'done'   (terminal)
          ↘ 'failed(reason, retryable)' ↘ 'cancelled'
  lane: 'A'|'B'|'C',                      // frozen at enqueue from the session probe
  ladder: { w, h, bitrate },              // frozen from deviceClass (§0.5.C)
  overlay_json, audio_mix, locale,        // FROZEN copies — edits affect later jobs only
  binding_snapshot: { …resolved gram values… },   // stat badges resolve at freeze, not
                                                  // at render — a queue that waits 10 min
                                                  // must not silently pick up new ledger rows
  progress: { phase, frames_done, frames_total, pct },
  retries: 0
}

SCHEDULING LAW: STRICTLY SERIAL. One VideoEncoder alive in the tab, ever. Parallel
encodes on mobile are the crash, not a speedup (encoder queues + canvases + buffers
multiply). The queue is FIFO with pause/resume/cancel/reorder on 'queued' jobs only.
```

### 4.2 The inter-job memory-clear protocol (the crash killer)

Executed in order between EVERY job — this sequence is the answer to "batch 5 videos
without the tab dying":

```
TEARDOWN(job N) — all steps unconditional, error-swallowing, ordered:
 1. await venc.flush()  → venc.close()          -- drain THEN close; close() alone drops
    await aenc?.flush() → aenc?.close()            queued frames and corrupts the tail
 2. muxer.finalize() → capture output reference → null the muxer, null the target
    (StreamTarget lane: close the OPFS writable — bytes are already on disk, not heap)
 3. per-frame VideoFrame.close() is ALREADY per-frame (existing discipline — keep);
    assert frame ledger: frames_created === frames_closed, log any leak count
 4. canvas: ctx.clearRect(0,0,W,H); canvas.width = canvas.width   -- clearRect resets
    pixels; the width self-assignment drops the GPU backing store; then re-dim for N+1
 5. video element: pause() → removeAttribute('src') → load()      -- releases the
    decoder pipeline; the ELEMENT itself is reused (one <video> per session, §0.5.C)
 6. URL.revokeObjectURL(every object URL minted for job N)         -- footage, music,
    preview, download links; a revoke ledger is kept per job so none is orphaned
 7. null all job-scoped refs (mixedBuffer already nulled post-audio, §1.4);
    keep ONLY batch-scoped shared assets (decoded fragments/music — immutable, §0.5.C)
 8. GC WINDOW: await double-rAF, then await setTimeout(300)        -- yields long enough
    for Chromium's GC + Safari's decoder teardown to actually run between jobs
 9. WATERMARK CHECK (Chromium): performance.memory.usedJSHeapSize > 0.65 × jsHeapSizeLimit
    → hold the queue in 'paused(memory)' and re-check each 2 s until < 0.50 — the queue
      waits out pressure instead of charging into an OOM kill
    (WebKit: no heap API → the fixed 300 ms window + serial law is the protection)
10. UPLOAD-THEN-RELEASE: job N's blob uploads (or saves) BEFORE job N+1 starts encoding;
    at most ONE finished artifact is ever materialized in heap. OPFS-lane artifacts stay
    on disk and stream to upload — heap holds only the in-flight chunk.

RETRY-ON-PRESSURE: a job failing with encoder-error/quota inside 'encoding' retries
ONCE, automatically, one ladder rung down (1080→720, bitrate −40%) with lane preserved.
Second failure → 'failed(retryable:false)' with the phase + probe attached for triage.
```

### 4.3 Directed Play — routing a render to one athlete

The CEO override lane: any rendered reel or stitched audio brief, aimed at a single
athlete instead of (or in addition to) the social queue.

```sql
CREATE TABLE IF NOT EXISTS public.studio_directed_deliveries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_kind     TEXT NOT NULL CHECK (asset_kind IN ('reel','audio_brief','card')),
  storage_bucket TEXT NOT NULL,
  storage_path   TEXT NOT NULL,                  -- server-generated (studio-queue pattern)
  athlete_id     UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  locale         TEXT NOT NULL CHECK (locale IN ('en','es','pt')),
  note           TEXT,                           -- CEO's one-liner, shown with the tile
  overlay_json   JSONB,                          -- provenance: what was rendered
  status         TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','delivered','viewed','expired')),
  created_by     UUID REFERENCES public.bbf_users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at   TIMESTAMPTZ, viewed_at TIMESTAMPTZ
);
ALTER TABLE public.studio_directed_deliveries ENABLE ROW LEVEL SECURITY;
```

```
DIRECTED PLAY SELECTOR (UI state + consequences):
├─ roster picker: search over bbf-admin-roster (existing admin surface) → athlete
├─ ON SELECT (the important part — targeting is not just an address):
│   · locale LOCKS to athlete.preferred_language (overlay + caption + fragment locale
│     all follow; the selector shows the lock: "Renders in Spanish — Marco's language")
│   · stat bindings re-resolve against THAT athlete's ledgers for the chosen day
│     (binding_snapshot refreezes; demo values are replaced by real gram rows)
│   · audience = 'directed' → caption composer skips hashtags/CTA; social channels
│     default OFF (can be re-enabled deliberately — never accidental publication of
│     an athlete's data: the privacy boundary of §2.3 enforced at the selector)
├─ DELIVERY: upload via bbf-studio-queue sign/confirm (kind routes to a private
│   'directed-v1' bucket — NOT the public reels bucket) → directed_deliveries row
└─ ATHLETE SIDE: next Vault Hub open → "From Coach Akeem" tile (existing hub tile
    pattern) → signed READ URL minted by the serving edge function on view →
    status walks queued → delivered → viewed (read receipts for the CEO's QueueMonitor)
```

### 4.4 Server-side batch mirror (QueueMonitor persistence)

The client queue is authoritative during a session; a lightweight mirror row per job lets
QueueMonitor survive reloads and gives the CEO cross-device visibility:

```sql
CREATE TABLE IF NOT EXISTS public.studio_render_jobs (
  id            UUID PRIMARY KEY,                -- client-minted job id
  kind          TEXT NOT NULL, lane TEXT, ladder JSONB,
  status        TEXT NOT NULL, progress_pct SMALLINT,
  fail_reason   TEXT,
  created_by    UUID REFERENCES public.bbf_users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.studio_render_jobs ENABLE ROW LEVEL SECURITY;
-- best-effort upserts through bbf-studio-queue (new 'job_status' action);
-- write failures never block rendering (telemetry posture, same as bbf_agent_runs)
```

---

## PART 5 · EXECUTION MANIFEST (for Opus)

| # | Deliverable | Type | Depends on |
|---|---|---|---|
| 1 | Migration: `studio_overlay_presets`, `studio_directed_deliveries`, `studio_render_jobs`, `bbf_reels_batch_v1` ALTER (§3.1); private `directed-v1` bucket | `apply_migration` | — |
| 2 | Config seeds: `studio_hashtag_sets_v1`, `studio_ladder_v1` (deviceClass → resolution/bitrate), safe-area zone constants | migration | — |
| 3 | Foundry v2: capability probe + Export Path Router (lanes A/B/C) + StreamTarget/OPFS mux lane + backpressure watermark + Save Router | client lib | — |
| 4 | Multi-track mixer: OfflineAudioContext graph, ducking automation, mixer state, per-lane audio handoff | client lib | 3 |
| 5 | Cosmetics engine: layer model, anti-blotch D1–D4, gram stat bindings, preset save/load; preview↔export parity harness | client lib + UI | 3 |
| 6 | `FoundryBatchController`: serial queue, inter-job teardown protocol §4.2, retry-on-pressure, job mirror upserts | client lib | 3, 4, 5 |
| 7 | Caption composer edge path: `social_caption` UseCase in model-router, one-call trilingual JSON, deterministic hashtag assembly, template fallback | edge fn | 1, 2 |
| 8 | `bbf-studio-queue` v2: widened confirm payload (captions/channels), `job_status` action, directed-delivery sign/confirm lane | edge fn | 1 |
| 9 | `bbf-reel-distributor` v2: per-channel locale caption resolution (transport unchanged; TikTok switch untouched) | edge fn | 8 |
| 10 | Directed Play UI: roster selector with locale-lock + binding-refreeze + social-default-off; athlete "From Coach Akeem" hub tile + read receipts | frontend | 1, 6, 8 |
| 11 | Tests: lane-router truth table per probe permutation; memory soak (5-job batch on 3 GB-class device profile, heap watermark asserts); teardown ledger (frames created==closed, URLs revoked); auto-fit locale matrix (en/es/pt lengths); gram-formatter goldens + `/kg|kilo/` CI grep; caption fallback; directed privacy gate (social OFF + private bucket on directed jobs) | tests | all |

**Non-goals:** server-side rendering farm (client-first by design; revisit only if Lane C
share exceeds tolerance), per-athlete voice synthesis (stitching blueprint owns voice),
TikTok posting enablement (switch exists; blocked on platform app review, not architecture),
video editing beyond overlay/mix (cuts/transitions are a V5 conversation).

---
*One canvas, one encoder, one job at a time — torn down clean between every render.
The CEO taps once; the reel posts in three languages, the athlete hears their name,
and the tab never dies.*
