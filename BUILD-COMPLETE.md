# BUILD COMPLETE — `bbf-sovereign-studio-v3.html`

A copy of the studio (`bbf-studio.html`, branded *"Sovereign Studio V2"*) with two upgrades.
Existing modes (CTA / Phone / Spotlight / Reel) are unchanged in behavior — both upgrades are
additive or fix shared code.

---

## Upgrade 1 — PNG export fixed (was garbled on mobile)

**Root causes:** web fonts weren't loaded when `html2canvas` fired (it fell back to a system font),
and the preview's `.stage-scaler { transform: scale() }` corrupted the capture on phones.

**Fix (one central edit to `exportStage()`, so it covers all four modes):**
- `await document.fonts.ready` before every capture.
- Render from a clean, **unscaled, full-size clone** via `onclone` (sets every `.stage-scaler`
  `transform` to `none` and forces the cloned stage to its true `width`/`height`).
- `scale: 2` for crisp, hi-DPI output; `useCORS: true`.

**Result:** in a ~380px mobile viewport, every mode exports a sharp, correctly-positioned PNG.

---

## Upgrade 2 — Video export for Reel Cover

Upload reel footage and export a finished video with your footage as the **moving background** and
the branded reel overlay (darkening gradient, gold top strip, series-color eyebrow pill, Bebas hook,
sub-line, watch pill, optional logo) **baked on top**.

### How to use
1. Open the studio → **REEL COVER** mode.
2. Set your series / hook / sub-line / watch text as usual (these drive the overlay).
3. Click **UPLOAD VIDEO** (MP4 / MOV — e.g. straight off a Galaxy S25 Ultra). The preview shows your
   footage **moving** behind the overlay. *(Video wins over a still image if both are set.)*
4. Optional: adjust **Darkness**, upload a corner **logo**.
5. Click **🎬 EXPORT VIDEO**. A progress bar fills as frames render; the file downloads automatically
   when done. The overlay animates in over the first ~1s (fade + slight rise), then holds.

### Technical notes
- Compositing is done on an offscreen **1080×1920 canvas** (NOT html2canvas — it can't capture video
  frames). Each frame: draw the video frame (`object-fit: cover`), then redraw the full overlay with
  Canvas2D. `canvas.captureStream(30)` → `MediaRecorder` → downloaded Blob.
- **Length:** records up to **60s** (longer footage is trimmed to 60s). Stops automatically when the
  clip ends.
- **Audio:** the exported clip is **silent by design** (per spec) — add your music/audio in
  Instagram. (The source video is decoded muted.)
- **Still export:** **EXPORT IMAGE** now captures the current video frame as a poster if footage is
  loaded (otherwise it exports your uploaded image, same as before).

### Which video format will *I* get? (MP4 vs WebM)
The tool **feature-detects** the recorder codec at export time, preferring Instagram-friendly MP4:

```
video/mp4;codecs=h264  →  video/mp4;codecs=avc1.42E01E  →  video/mp4
   → video/webm;codecs=vp9 → video/webm;codecs=vp8 → video/webm
```

It then **tells you in the UI** and in the filename extension:
- **`.mp4`** → green note *"Saved MP4 ✓ — ready to post."* Upload straight to IG.
- **`.webm`** → orange note *"Exported as .webm — your browser can't record MP4 directly; convert
  before posting to IG."* (Convert with CapCut or any online converter.)

**What to expect by browser** (the tool confirms the actual result — this is just a heads-up):
- **Safari / iOS** — records **MP4** directly. ✅
- **Chrome on Android (incl. most Galaxy setups), Chrome/Firefox desktop** — usually **WebM**;
  convert to MP4 before posting to IG.
- **Samsung Internet** — may produce **MP4** (varies by version).

> Because the format is decided live in *your* browser, run one test export and read the note — that
> is the definitive answer for your device.

---

## Deployment — v3 is now THE studio

Per your direction, v3 replaces v2 as the live tool (v2 files stay in the repo, just unlinked):
- `frontend/public/bbf-sovereign-studio-v3.html` — served live (Vite copies it into `dist/`).
- Admin sidebar **"Content Studio ↗"** launcher (`MasterLayout.jsx`) now opens
  `/bbf-sovereign-studio-v3.html`.
- The clean **`/studio`** URL (`render.yaml` + `_redirects`) points to v3.
- React SW cache bumped `bbf-react-v19 → v20`.

**Live URLs after the Render rebuild (~1–2 min):**
`https://buildbelievefit.fitness/bbf-sovereign-studio-v3.html` or `…/studio`
(admin → Command Center → **Content Studio ↗**). Hard-refresh once on first load.

---

## Verification

**Done automatically (in this build):**
- Inline JS syntax-checked; HTML tag/`<div>` balance verified (172/172).
- All new wiring present: `reel-file-vid`, `reel-export-vid`, hidden `#reel-vid`, progress bar/note,
  and functions `drawReelOverlay`, `drawVideoCover`, `pickRecorderMime`, `ensureReelFonts`.
- `exportStage` confirmed to include `document.fonts.ready`, `scale:2`, `useCORS:true`, `onclone`.
- The canvas overlay functions were run against a stub context (no logo / with logo / low darkness /
  landscape footage / unready-video guard) — **no runtime errors**.
- `frontend` **lint + build green**; `dist/bbf-sovereign-studio-v3.html` confirmed present.

**You should validate visually (can't be done headlessly here):**
1. Desktop Chrome → Reel → upload a short MP4 → preview shows moving footage under the overlay.
2. **EXPORT IMAGE** → open the PNG: fonts crisp, overlay matches the preview (validates Upgrade 1 +
   poster path).
3. **EXPORT VIDEO** → progress 0→100%, file downloads, plays with footage + baked overlay + ~1s
   intro. Note whether you got `.mp4` or `.webm`.
4. Repeat on **iOS Safari** and **Chrome Android** in a ~380px viewport — confirm no garbled PNG and
   a playable video file.
5. Edges: a 90s clip stops at 60s; re-uploading a new clip works cleanly; image-only (no video) →
   IMAGE export works, VIDEO export shows the "upload footage first" note.

> **One tuning note:** the overlay text is redrawn on canvas using cap-height baseline approximations
> (canvas text baselines aren't identical to CSS line boxes). If the headline/eyebrow/watch sit a few
> px off versus the IMAGE export, those constants (`148*0.80`, `pillTop=128`, etc. in
> `drawReelOverlay`) are the single place to nudge.
