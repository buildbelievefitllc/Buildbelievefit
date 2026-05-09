# MASTER PROMPT v2: BBF DEMO VIDEO ENHANCEMENT PIPELINE
**For:** Claude Code
**Owner:** Akeem Brown / Build Believe Fit LLC
**Source video:** `bbf_source_v2_compressed.mp4` (1080x2340, 30fps, ~2 minutes)
**Output:** Enhanced cinematic demo video for paid social + organic distribution

---

## PRE-FLIGHT (MANDATORY — CONSTRAINT-FIRST PROTOCOL)
Before writing any code, follow the build-believe-work protocol:

1. Load `AI_DIRECTIVES.md` — universal non-negotiables
2. Load any relevant project MD
3. Acknowledge BBF brand constraints: Purple `#6a0dad`, Gold `#f5c800`, Matte Black `#090909` for surfaces only. Bebas Neue (headers), Barlow Condensed (body). Founder photo protected.

If any source file is missing, request it. Do not proceed on assumption.

---

## OBJECTIVE
Transform the raw mobile screen recording into a polished, premium-feel 60–90 second demo with:
1. **Compliance overlay** masking the "CERTIFIED CPT" credential
2. **Cinematic motion** — subtle zooms, smooth cross-fades
3. **AI voiceover** — confident, professional, on-brand narration
4. **Surgical text callouts** highlighting core features
5. **Trilingual emphasis** anchored on the EN/ES/PT toggle moments
6. **Branded open and close cards**
7. **Clean trim** of dead air at the tail

Tasteful and dynamic. Premium app demo, not TikTok hype.

---

## SOURCE VIDEO BEAT MAP (USE FOR TIMING REFERENCE)

| Source Time | Content | Use as |
|---|---|---|
| 0–8s | Hero "Build Believe Fit" + "Performance Architect / Sovereign Gold Standard" badge | Open beat |
| 8–14s | "Start My Path" CTA + portal entry cards | Setup |
| 14–18s | Credentials strip ("2021 EST · CERTIFIED CPT · 100% CUSTOM PLANS") + founder photo with "Elite Strength & Movement" gold callout | **CPT MASK ZONE** + founder reveal |
| 18–35s | Marketing site value props | Trim aggressively — keep only strongest 5–8s |
| 35–55s | Sports playbook — Football/Basketball/Soccer/Baseball/Volleyball with FW/MF/DEF/GK position chips, "Positional Blueprints" | Athlete differentiator beat |
| 55–70s | Vault entry → portal arrival, Ana's Lab tab opens | Transition + reveal |
| 70–90s | Biomechanical Health Matrix, Friction Score, Somatic Readiness 68% gauge | Clinical-grade proof |
| 90–110s | Nutrition tab — Ana's "Lean & Energized" plan, Day 5 meals (EN) | Personalization proof |
| 110–120s | Tail | Trim |

Final cut should be 60–90 seconds. Cut ruthlessly from the marketing intro section.

---

## STEP 1 — CPT CREDENTIAL MASK (NON-NEGOTIABLE)

The credentials strip appears around **14–18 seconds** in the source. The middle column shows a shield icon with "CERTIFIED CPT" text. Mask the **middle column only** — the "2021 · EST FOUNDED" and "100% CUSTOM PLANS" columns must remain visible.

### Mask Specification
- **Replacement text:** `OT-INFORMED` (line 1) / `EXERCISE SCIENCE` (line 2)
- **Font:** Bebas Neue, white primary text, BBF Gold `#f5c800` accent underline
- **Background:** transparent PNG sized to fully cover the original element including the shield icon
- **Sizing:** match the surrounding column widths visually — do not clip into the "2021" or "100%" columns
- **Animation:** fade in over 0.3s as the section enters frame, fade out as it leaves frame
- **Z-order:** above all video content, below the final closing card

Sample a frame at ~15s to detect the credentials strip Y-position before placing the overlay. Do not hardcode coordinates without verifying first.

---

## STEP 2 — CINEMATIC MOTION

### Subtle Zoom-ins (max 1.15× scale, 1.5–2.5s ease-in)
Apply at these beats:
- **"BUILD BELIEVE FIT" hero** at the open
- **Founder photo** when the "Elite Strength & Movement" gold callout appears
- **Sports playbook grid** — slow zoom into the Soccer/Position chip selection
- **Vault entry card** as user transitions from marketing to app
- **Somatic Readiness 68% gauge** — this is a strong visual; let it land
- **Day 5 meal plan** — slow drift down through the meals

### Transitions
- 0.4–0.6s cross-fades between major sections (marketing → sports → vault → portal interior)
- Avoid hard cuts within a single section
- No flashy effects (no whip pans, no glitch transitions, no radial wipes)

---

## STEP 3 — AI VOICEOVER

### Voice Profile
- **Tone:** Confident, warm, energetic but composed. Adult professional.
- **Pace:** Moderate. Let the visuals breathe.
- **Voice model:** ElevenLabs neutral-American male (e.g. "Adam"). If a custom Akeem voice clone is configured in `.env`, use that.

### Script Beats (write your own copy matching this structure)
1. **Hook (0–6s):** Open with the BBF positioning — "Universal Human Performance" / "Your schedule is the context. Your potential is the focus."
2. **Founder + credibility (6–14s):** Frame BBF as the OT-informed performance system *(do not mention CPT — that credential is masked)*
3. **Sports playbook (14–28s):** Athlete-tier differentiation — youth and collegiate, position-specific blueprints across five sports
4. **Vault transition (28–34s):** "This is where the real work begins."
5. **Lab + biomechanics (34–55s):** Clinical-grade tracking, biomechanical health matrix, somatic readiness — this is data-driven coaching, not generic templates
6. **Personalized nutrition (55–72s):** Plans calibrated to TDEE and training load. Every plan is the client's plan.
7. **Trilingual close (72–82s):** "English. Spanish. Portuguese. One platform. Build. Believe. Fit. Start your path."

### Output
- Generate to `/build/voiceover.mp3` at -16 LUFS for social platform compliance

---

## STEP 4 — TEXT CALLOUTS

Minimal lower-third labels in BBF Purple `#6a0dad` background with Gold `#f5c800` accent line. Bebas Neue 32–40pt. Fade in/out over 0.3s. Never more than two callouts on screen at once.

| Beat | Callout |
|---|---|
| Hero open | UNIVERSAL HUMAN PERFORMANCE |
| Founder reveal | OT-INFORMED · EXERCISE SCIENCE |
| Sports playbook | POSITIONAL BLUEPRINTS · 5 SPORTS |
| Vault entry | SOVEREIGN CLIENT PORTAL |
| Biomechanical matrix | CLINICAL-GRADE TRACKING |
| Somatic readiness | DAILY READINESS SYNC |
| Nutrition | TDEE-CALIBRATED PLANS |
| Trilingual close | EN · ES · PT |

---

## STEP 5 — TRILINGUAL EMPHASIS (REPOSITIONED)

The source recording does not show a live language toggle in action, so the trilingual moment is anchored on the **persistent EN/ES/PT toggle visible in the app header**.

Execute this on the strongest portal frames (Lab tab and Nutrition tab):
- Add a subtle BBF Gold ring pulse around the EN/ES/PT toggle in the header — pulses once, gently, ~0.6s
- Drop the "EN · ES · PT" gold pill callout in the lower third for ~2 seconds during the voiceover trilingual line
- On the closing card, the wordmark briefly rotates through three language micro-flashes: "Build · Believe · Fit" → "Construye · Cree · Forma" → "Construa · Acredite · Forme" → back to English. Quick. ~0.4s each. Subtle.

---

## STEP 6 — OPENING & CLOSING

### Cold open (0–1.5s)
- Fade from black with the BBF logomark centered
- Single light brand audio sting (deep tone, not a movie trailer hit)

### Closing card (final 3 seconds)
- Solid BBF Purple `#6a0dad` background
- BBF logomark centered top
- "Build · Believe · Fit" wordmark in the center, Gold accent underline
- "buildbelievefit.fitness" small in white at bottom
- Trilingual micro-flash sequence on the wordmark (per Step 5)
- Hold 2 seconds, fade to black at 0.5s

### Trim
- Cut all dead air at the tail of the source before applying the closing card

---

## TECH STACK
- **FFmpeg** for cuts, scaling, overlays, transitions, audio mixing
- **Python + MoviePy** for any complex compositing (multi-layer effects, animated callouts)
- **TTS:** ElevenLabs API primary, Azure Neural TTS or Coqui TTS fallback. API keys via `.env` only — never hardcoded.
- **Pillow / Cairo** for generating overlay graphics (CPT mask, callouts, closing card)

Build a single Python script (`enhance_demo.py`) that runs the pipeline end-to-end. Stage intermediates to `/build/` for QA.

---

## CONSTRAINTS (NON-NEGOTIABLE)
- Founder photo must remain visible and untouched in any frame it appears
- BBF Purple and Gold are the only brand colors. No new accent colors.
- Do not modify the original source — work from a copy
- Output filename: `bbf_demo_enhanced_v1.mp4`
- Output specs: 1080x1920 (vertical 9:16), H.264, 30fps, 8 Mbps target bitrate, AAC 192 kbps
- If reframing 1080x2340 → 1080x1920, center-crop without losing critical UI

---

## OUTPUT REQUIREMENTS
1. `enhance_demo.py` — full pipeline script, idempotent
2. `/build/voiceover.mp3` — generated voiceover
3. `/build/cpt_overlay.png` — generated mask graphic
4. `/build/intermediate/` — staged files from each step for QA
5. `bbf_demo_enhanced_v1.mp4` — final cut
6. `README_VIDEO_PIPELINE.md` — install steps, run instructions, voice model swap notes

---

## SELF-VALIDATION (PHASE 3 — BEFORE HANDOFF)
- [ ] "CERTIFIED CPT" is fully masked in every frame it appears
- [ ] No part of the founder photo is obscured by overlays
- [ ] Brand colors intact across all generated graphics
- [ ] Final runtime is 60–90 seconds
- [ ] Voiceover audio levels clean and consistent
- [ ] No dead air at the tail
- [ ] The trilingual close card flashes cleanly through the three languages
- [ ] Output plays correctly in QuickTime, VLC, and a browser

Once all checks pass, hand off to Antigravity for visual smoke test and CEO review.

---

## FAILURE MODES TO AVOID
- Do not auto-cut sections shorter than they need — premium pacing matters more than tight runtime
- Do not stack effects (no zoom + slide + fade simultaneously)
- Do not use stock music without a license cleared by CEO
- Do not add full-screen captions — overlays are surgical, not blanket subtitles
- Do not modify or restyle the founder photo

Build clean. Run end-to-end. Report any blockers immediately.
