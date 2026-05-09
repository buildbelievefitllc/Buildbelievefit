#!/usr/bin/env python3
"""
enhance_demo.py — BBF Demo Video Enhancement Pipeline (v1)

Cinematic enhancement of the raw demo screen recording per
CLAUDE_CODE_VIDEO_ENHANCEMENT_PROMPT_v2.md.

ARCHITECTURE (hybrid Pillow + ffmpeg):
  1. Pillow generates static overlay PNGs (CPT mask, callouts, cards).
  2. ffmpeg subprocess does ALL video work (trim, concat, overlay, mux,
     encode). This is ~10x faster than moviepy's per-frame Python
     compositor on multi-layer timelines and runs end-to-end inside
     the Bash 10-min budget for a ~99s 1080p H.264 output.

Brand non-negotiables (AI_DIRECTIVES.md):
    Purple #6a0dad  |  Gold #f5c800  |  Matte Black #090909 (surfaces)
    Bebas Neue (headers)  |  Barlow Condensed (body)
    Founder photo protected.

Run:
    python3 enhance_demo.py [--source bbf_source_v2_compressed.mp4]
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List

from PIL import Image, ImageDraw, ImageFont

# ------------------------------------------------------------
# Constants — brand palette + paths
# ------------------------------------------------------------
BBF_PURPLE = (106, 13, 173)
BBF_GOLD   = (245, 200, 0)
BBF_BLACK  = (9, 9, 9)
WHITE      = (255, 255, 255)

ROOT          = Path(__file__).resolve().parent
BUILD         = ROOT / "build"
FONTS         = BUILD / "fonts"
INTERMEDIATE  = BUILD / "intermediate"
VOICEOVER_DIR = ROOT / "voiceover"

BEBAS_PATH        = FONTS / "BebasNeue.ttf"
BARLOW_PATH       = FONTS / "BarlowCondensed-Regular.ttf"
BARLOW_BOLD_PATH  = FONTS / "BarlowCondensed-Bold.ttf"

OUT_W, OUT_H   = 1080, 1920
SRC_H          = 2340
FPS            = 30
OPEN_CARD_DUR  = 1.5
CLOSE_CARD_DUR = 3.0
GAP_BETWEEN_VO = 0.2

# Beat map: voiceover -> source segment + lower-third callout text
BEATS: List[dict] = [
    {"vo": "01_hook.mp3",             "src_in": 0,   "src_out": 8,
     "callout": "UNIVERSAL HUMAN PERFORMANCE"},
    {"vo": "02_credibility.mp3",      "src_in": 8,   "src_out": 18,
     "callout": "OT-INFORMED · EXERCISE SCIENCE"},
    {"vo": "03_sports_playbook.mp3",  "src_in": 35,  "src_out": 55,
     "callout": "POSITIONAL BLUEPRINTS · 5 SPORTS"},
    {"vo": "04_vault_transition.mp3", "src_in": 55,  "src_out": 70,
     "callout": "SOVEREIGN CLIENT PORTAL"},
    {"vo": "05_lab_biomechanics.mp3", "src_in": 70,  "src_out": 95,
     "callout": "CLINICAL-GRADE TRACKING"},
    {"vo": "06_nutrition.mp3",        "src_in": 95,  "src_out": 117,
     "callout": "TDEE-CALIBRATED PLANS"},
    {"vo": "07_trilingual_close.mp3", "src_in": 105, "src_out": 115,
     "callout": "EN · ES · PT"},
]


# ============================================================
# Helpers
# ============================================================
def run(cmd: List[str], desc: str) -> None:
    print(f"  $ {desc}")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:])
        raise SystemExit(f"[FATAL] ffmpeg failed: {desc}")


def ffprobe_duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip())


def _font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


# ============================================================
# Pillow overlay generators
# ============================================================
def make_cpt_mask(out_path: Path) -> None:
    # Sized to cover the middle "CERTIFIED CPT" column (shield icon
    # row + subtitle) of the source credentials strip. The mask
    # follows the strip via animated y in the overlay pass; H=160
    # is the actual strip height (~135px) plus a small fade margin
    # so motion is forgiving. Width 440 fits between the "2021" and
    # "100%" outer columns.
    W, H = 380, 180
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = 3
    draw.rounded_rectangle(
        (pad, pad, W - pad, H - pad), radius=12,
        fill=(*BBF_BLACK, 252), outline=(*BBF_PURPLE, 255), width=2,
    )
    f1 = _font(BEBAS_PATH, 48)
    line1 = "OT-INFORMED"
    bbox = draw.textbbox((0, 0), line1, font=f1)
    draw.text(((W - (bbox[2] - bbox[0])) / 2, 26), line1, font=f1, fill=WHITE)
    draw.rectangle((W // 2 - 70, 86, W // 2 + 70, 90), fill=(*BBF_GOLD, 255))
    f2 = _font(BEBAS_PATH, 36)
    line2 = "EXERCISE SCIENCE"
    bbox = draw.textbbox((0, 0), line2, font=f2)
    draw.text(((W - (bbox[2] - bbox[0])) / 2, 102), line2, font=f2, fill=BBF_GOLD)
    img.save(out_path)


def make_callout(text: str, out_path: Path) -> None:
    W, H = 920, 110
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((0, 0, W, H), radius=14, fill=(*BBF_PURPLE, 235))
    draw.rectangle((0, 0, 8, H), fill=(*BBF_GOLD, 255))
    size = 56
    while size > 24:
        f = _font(BEBAS_PATH, size)
        bbox = draw.textbbox((0, 0), text, font=f)
        if (bbox[2] - bbox[0]) <= W - 60 and (bbox[3] - bbox[1]) <= H - 30:
            break
        size -= 2
    f = _font(BEBAS_PATH, size)
    bbox = draw.textbbox((0, 0), text, font=f)
    draw.text((30, (H - (bbox[3] - bbox[1])) / 2 - 6), text, font=f, fill=WHITE)
    img.save(out_path)


def make_lang_pill(out_path: Path) -> None:
    W, H = 320, 90
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((0, 0, W, H), radius=H // 2, fill=(*BBF_GOLD, 245))
    f = _font(BEBAS_PATH, 52)
    text = "EN · ES · PT"
    bbox = draw.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((W - tw) / 2, (H - th) / 2 - 6), text, font=f, fill=BBF_BLACK)
    img.save(out_path)


def make_opening_card(out_path: Path) -> None:
    img = Image.new("RGB", (OUT_W, OUT_H), BBF_BLACK)
    draw = ImageDraw.Draw(img)
    f1 = _font(BEBAS_PATH, 130)
    line = "BUILD BELIEVE FIT"
    bbox = draw.textbbox((0, 0), line, font=f1)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    cx, cy = OUT_W // 2, OUT_H // 2
    draw.text((cx - tw / 2, cy - th / 2 - 30), line, font=f1, fill=WHITE)
    rule_w = 280
    draw.rectangle((cx - rule_w // 2, cy + 70, cx + rule_w // 2, cy + 76),
                   fill=BBF_GOLD)
    f2 = _font(BARLOW_PATH, 44)
    tag = "UNIVERSAL HUMAN PERFORMANCE"
    bbox2 = draw.textbbox((0, 0), tag, font=f2)
    tw2 = bbox2[2] - bbox2[0]
    draw.text((cx - tw2 / 2, cy + 100), tag, font=f2, fill=(200, 200, 200))
    img.save(out_path)


def make_closing_card(text_main: str, out_path: Path) -> None:
    img = Image.new("RGB", (OUT_W, OUT_H), BBF_PURPLE)
    draw = ImageDraw.Draw(img)
    f_logo = _font(BEBAS_PATH, 90)
    bbox = draw.textbbox((0, 0), "BBF", font=f_logo)
    tw = bbox[2] - bbox[0]
    draw.text(((OUT_W - tw) / 2, int(OUT_H * 0.22)), "BBF",
              font=f_logo, fill=BBF_GOLD)
    f_main = _font(BEBAS_PATH, 110)
    bbox = draw.textbbox((0, 0), text_main, font=f_main)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    cx, cy = OUT_W // 2, int(OUT_H * 0.48)
    draw.text((cx - tw / 2, cy - th / 2), text_main, font=f_main, fill=WHITE)
    rule_w = 320
    draw.rectangle((cx - rule_w // 2, cy + th // 2 + 24,
                    cx + rule_w // 2, cy + th // 2 + 30), fill=BBF_GOLD)
    f_dom = _font(BARLOW_PATH, 38)
    dom = "buildbelievefit.fitness"
    bbox = draw.textbbox((0, 0), dom, font=f_dom)
    tw = bbox[2] - bbox[0]
    draw.text(((OUT_W - tw) / 2, int(OUT_H * 0.85)), dom,
              font=f_dom, fill=(220, 220, 220))
    img.save(out_path)


# ============================================================
# ffmpeg pipeline stages
# ============================================================
def stage_master_audio(vo_files: List[Path], out_path: Path) -> List[float]:
    """
    Concat 7 voiceover MP3s with brief breathing room. Returns the list
    of cumulative VO start offsets (in seconds, from t=0 of the
    concatenated audio). Output is encoded as AAC for the final mux.
    """
    # Build a concat list with 0.2s silence padding between clips.
    # Use ffmpeg concat filter (re-encode) so we can intersperse silence.
    inputs = []
    for vo in vo_files:
        inputs += ["-i", str(vo)]
    # Generate the silence source
    silence_path = INTERMEDIATE / "_silence.mp3"
    if not silence_path.exists():
        run(
            ["ffmpeg", "-y", "-f", "lavfi", "-i",
             f"anullsrc=channel_layout=stereo:sample_rate=44100",
             "-t", str(GAP_BETWEEN_VO), "-q:a", "2",
             str(silence_path)],
            "render silence pad",
        )

    # Build concat sequence: vo1 + silence + vo2 + silence + ... + vo7
    concat_list = INTERMEDIATE / "_audio_concat.txt"
    with open(concat_list, "w") as f:
        for i, vo in enumerate(vo_files):
            f.write(f"file '{vo.resolve()}'\n")
            if i < len(vo_files) - 1:
                f.write(f"file '{silence_path.resolve()}'\n")

    run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list),
         "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
         str(out_path)],
        "concat voiceovers + silence pads -> master audio AAC",
    )

    # Compute cumulative offsets
    offsets = []
    cursor = 0.0
    for vo in vo_files:
        offsets.append(cursor)
        cursor += ffprobe_duration(vo) + GAP_BETWEEN_VO
    return offsets


def stage_body(src: Path, vo_files: List[Path], out_path: Path) -> float:
    """
    Build the cropped + trimmed body MP4 (1080x1920, no overlays, no
    audio) by trimming each beat's source segment to its voiceover
    duration and concatenating. Returns total body duration.
    """
    seg_files = []
    cumulative = 0.0
    for i, beat in enumerate(BEATS):
        vo_dur = ffprobe_duration(VOICEOVER_DIR / beat["vo"])
        seg_path = INTERMEDIATE / f"body_seg_{i:02d}.mp4"
        # Use -ss before -i for fast seek; -t for duration; vf for crop.
        # Crop 1080x2340 -> 1080x1920 center: y offset = (2340-1920)/2 = 210
        run(
            ["ffmpeg", "-y",
             "-ss", str(float(beat["src_in"])),
             "-i", str(src),
             "-t", f"{vo_dur:.3f}",
             "-vf", f"crop={OUT_W}:{OUT_H}:0:210,fps={FPS},format=yuv420p",
             "-an",
             "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
             "-pix_fmt", "yuv420p",
             str(seg_path)],
            f"trim+crop beat {i+1} ({beat['vo']})",
        )
        seg_files.append(seg_path)
        cumulative += vo_dur

    # Concat segments via concat demuxer
    concat_list = INTERMEDIATE / "_body_concat.txt"
    with open(concat_list, "w") as f:
        for s in seg_files:
            f.write(f"file '{s.resolve()}'\n")
    run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list),
         "-c:v", "copy", "-an", str(out_path)],
        "concat body segments -> body.mp4",
    )
    return cumulative


def stage_card_clip(image_path: Path, duration: float, out_path: Path,
                    fade_in: float = 0.4, fade_out: float = 0.4) -> None:
    """Turn a single PNG into a video clip with optional fade in/out."""
    fout_start = max(0.0, duration - fade_out)
    vf = (
        f"fps={FPS},format=yuv420p,"
        f"fade=t=in:st=0:d={fade_in},"
        f"fade=t=out:st={fout_start:.3f}:d={fade_out}"
    )
    run(
        ["ffmpeg", "-y",
         "-loop", "1", "-t", f"{duration:.3f}",
         "-i", str(image_path),
         "-vf", vf,
         "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
         "-pix_fmt", "yuv420p",
         "-an",
         str(out_path)],
        f"render card {image_path.name} -> {duration:.2f}s clip",
    )


def stage_closing_card_sequence(out_path: Path) -> float:
    """
    3-second closing card with trilingual wordmark micro-flash sequence:
      EN (1.0s)  -> ES (0.5s) -> PT (0.5s) -> EN (1.0s)
    Returns total duration.
    """
    flashes = [
        ("BUILD · BELIEVE · FIT",          1.0,  "close_en1"),
        ("CONSTRUYE · CREE · FORMA",       0.5,  "close_es"),
        ("CONSTRUA · ACREDITE · FORME",    0.5,  "close_pt"),
        ("BUILD · BELIEVE · FIT",          1.0,  "close_en2"),
    ]
    seg_files = []
    total = 0.0
    for text, dur, slug in flashes:
        png = INTERMEDIATE / f"{slug}.png"
        make_closing_card(text, png)
        seg = INTERMEDIATE / f"{slug}.mp4"
        # No fade between flashes (snap-cut for emphasis)
        run(
            ["ffmpeg", "-y", "-loop", "1", "-t", f"{dur:.3f}",
             "-i", str(png),
             "-vf", f"fps={FPS},format=yuv420p",
             "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
             "-pix_fmt", "yuv420p", "-an",
             str(seg)],
            f"closing flash {slug} ({dur:.2f}s)",
        )
        seg_files.append(seg)
        total += dur

    # Concat the four flashes, then add a fade-out on the tail
    raw = INTERMEDIATE / "_closing_raw.mp4"
    concat_list = INTERMEDIATE / "_closing_concat.txt"
    with open(concat_list, "w") as f:
        for s in seg_files:
            f.write(f"file '{s.resolve()}'\n")
    run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list), "-c:v", "copy", "-an", str(raw)],
        "concat closing flashes -> raw closing",
    )

    # Apply final fade-out
    run(
        ["ffmpeg", "-y", "-i", str(raw),
         "-vf", f"fade=t=out:st={total - 0.5:.3f}:d=0.5",
         "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
         "-pix_fmt", "yuv420p", "-an",
         str(out_path)],
        "closing fade-out tail",
    )
    return total


def stage_full_video_no_audio(
    opening: Path, body: Path, closing: Path, out_path: Path
) -> float:
    """Concat opening + body + closing into a single video (no audio)."""
    concat_list = INTERMEDIATE / "_full_concat.txt"
    with open(concat_list, "w") as f:
        for s in [opening, body, closing]:
            f.write(f"file '{s.resolve()}'\n")
    run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list),
         "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
         "-pix_fmt", "yuv420p",
         "-an", str(out_path)],
        "concat opening + body + closing",
    )
    return ffprobe_duration(out_path)


def stage_overlay_pass(
    base_video: Path,
    overlays: List[dict],
    audio_path: Path,
    audio_delay: float,
    out_path: Path,
) -> None:
    """
    Single ffmpeg invocation that:
      - Takes base_video + N overlay PNGs as inputs
      - Layers each overlay between specified [start, end] timestamps
        at specified (x, y) positions
      - Mixes in audio_path delayed by audio_delay
      - Encodes final H.264 1080x1920 30fps 8Mbps + AAC 192k.
    """
    inputs = ["-i", str(base_video)]
    for o in overlays:
        inputs += ["-i", str(o["png"])]
    inputs += ["-i", str(audio_path)]

    audio_idx = 1 + len(overlays)

    filter_parts = []
    last = "[0:v]"
    for i, o in enumerate(overlays, start=1):
        x = o.get("x", "(W-w)/2")
        y = o.get("y", "(H-h)/2")
        st = o["start"]
        en = o["end"]
        tag = f"[v{i}]"
        filter_parts.append(
            f"{last}[{i}:v]overlay=x={x}:y={y}:"
            f"enable='between(t,{st:.3f},{en:.3f})'{tag}"
        )
        last = tag
    # Final video stream
    filter_parts.append(f"{last}format=yuv420p[final_v]")

    # Audio: shift by audio_delay seconds
    delay_ms = int(audio_delay * 1000)
    filter_parts.append(
        f"[{audio_idx}:a]adelay={delay_ms}|{delay_ms}[final_a]"
    )

    fc = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", fc,
        "-map", "[final_v]", "-map", "[final_a]",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
        "-b:v", "6000k", "-maxrate", "8000k", "-bufsize", "12000k",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-r", str(FPS),
        "-shortest",
        str(out_path),
    ]
    run(cmd, f"overlay pass: {len(overlays)} layers + mux audio + encode")


# ============================================================
# Main pipeline
# ============================================================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source",
                        default=str(ROOT / "bbf_source_v2_compressed.mp4"))
    parser.add_argument("--output",
                        default=str(ROOT / "bbf_demo_enhanced_v1.mp4"))
    args = parser.parse_args()

    BUILD.mkdir(exist_ok=True)
    INTERMEDIATE.mkdir(exist_ok=True)
    src_path = Path(args.source).resolve()
    if not src_path.exists():
        sys.exit(f"[FATAL] Source video not found: {src_path}")

    vo_files = sorted(VOICEOVER_DIR.glob("0*.mp3"))
    if len(vo_files) != 7:
        sys.exit(f"[FATAL] Expected 7 voiceover MP3s, found {len(vo_files)}")
    print(f"[OK] Source: {src_path.name}")
    print(f"[OK] Voiceovers: {len(vo_files)}")

    # Stage 1 — overlays
    print("[1/6] Generating overlay PNGs...")
    cpt_png   = BUILD / "cpt_overlay.png"
    make_cpt_mask(cpt_png)
    shutil.copy(cpt_png, INTERMEDIATE / "cpt_overlay.png")
    callout_pngs = {}
    for beat in BEATS:
        if beat["callout"]:
            safe = beat["callout"].replace(" ", "_").replace("·", "DOT").replace("/", "_")
            png = INTERMEDIATE / f"callout_{safe}.png"
            make_callout(beat["callout"], png)
            callout_pngs[beat["callout"]] = png
    pill_png = INTERMEDIATE / "lang_pill.png"
    make_lang_pill(pill_png)
    open_png = INTERMEDIATE / "opening_card.png"
    make_opening_card(open_png)

    # Stage 2 — master audio
    print("[2/6] Building master audio (AAC)...")
    master_audio = INTERMEDIATE / "master_audio.m4a"
    vo_offsets = stage_master_audio(vo_files, master_audio)
    audio_dur = ffprobe_duration(master_audio)
    print(f"      Master audio: {audio_dur:.2f}s")
    print(f"      VO offsets: {[f'{s:.2f}' for s in vo_offsets]}")

    # Stage 3 — body video (no audio, no overlays)
    print("[3/6] Building cropped + trimmed body video...")
    body_path = INTERMEDIATE / "body.mp4"
    body_dur = stage_body(src_path, vo_files, body_path)
    print(f"      Body: {body_dur:.2f}s")

    # Stage 4 — opening + closing cards
    print("[4/6] Rendering opening + closing card sequence...")
    open_clip = INTERMEDIATE / "opening_clip.mp4"
    stage_card_clip(open_png, OPEN_CARD_DUR, open_clip,
                    fade_in=0.6, fade_out=0.4)

    close_clip = INTERMEDIATE / "closing_clip.mp4"
    close_dur = stage_closing_card_sequence(close_clip)
    print(f"      Closing card sequence: {close_dur:.2f}s")

    # Stage 5 — concat full video (no audio yet) for sanity-check duration
    print("[5/6] Concatenating opening + body + closing...")
    full_no_audio = INTERMEDIATE / "full_no_audio.mp4"
    full_dur = stage_full_video_no_audio(open_clip, body_path, close_clip,
                                         full_no_audio)
    print(f"      Full silent video: {full_dur:.2f}s")

    # Stage 6 — overlay pass (CPT mask + 7 callouts + lang pill) + mux audio
    print("[6/6] Applying overlays + muxing audio + encoding final...")
    overlays = []

    # CPT mask placement — the source recording scrolls the
    # credentials strip during beat 2, so a single static mask
    # cannot follow it. Frame-by-frame inspection of body.mp4
    # (see build/qa_frames/body_t*_zoom.png) shows two stable
    # phases:
    #   PHASE A — strip at LOWER position (body t=8.8-9.1):
    #     shield row absolute y=460-530, subtitle y=570-585.
    #     -> mask at y=450, H=150 covers cleanly.
    #   PHASE B — strip at UPPER position (body t=9.3-10.5):
    #     after the scroll snap, shield y=150-230, subtitle
    #     y=240-260. -> mask at y=140, H=150 covers cleanly.
    # Body t maps to final t via offset = OPEN_CARD_DUR + vo_offsets[1]
    # (beat 2 base). Both mask windows obscure the "CERTIFIED CPT"
    # middle column fully. Founder photo card edge starts at
    # absolute y~290 in PHASE B / y~600 in PHASE A — neither mask
    # touches it. The "2021 EST" and "100% CUSTOM" outer columns
    # remain visible (mask W=440 < column gutter spacing).
    beat2_base = OPEN_CARD_DUR + vo_offsets[1]
    # CPT mask placement — verified via row-brightness scan of clean
    # body frames (build/qa_frames/clean_t*.png) in middle column
    # band x=380-700. The shield row position over time:
    #   body 9.0 -> shield_top y=460 (subtitle 570) [STABLE]
    #   body 9.1 -> shield_top y=404 [SCROLL JUMP -56px in 0.1s]
    #   body 9.5 -> shield_top y=249
    #   body 10.5 -> shield_top y=145 (subtitle 255)
    # Two overlay entries handle the timeline:
    #   Segment 1: stable at y=450 during the body t=9.0 dwell
    #   Segment 2: animated y tracking the post-jump smooth scroll
    # Mask H=160 covers shield (~70px tall) + gap + subtitle + slack.
    # Mask x is offset from frame center because the shield/middle
    # column is centered at x=405 (not 540 = frame center). Brightness
    # scan of clean_t9.0.png at shield row y=490 shows shield icon
    # x=390-420, big "2021" x=90-180, big "100%" x=660-780.
    cpt_x = "(W-w)/2-135"
    s1_start = beat2_base + 1.75   # final t=10.50 (body 9.00)
    s1_end   = beat2_base + 1.85   # final t=10.60 (body 9.10)
    overlays.append({
        "png":   cpt_png,
        "start": s1_start,
        "end":   s1_end,
        "x":     cpt_x,
        "y":     440,
    })
    # Segment 2: post-jump smooth drift — y interpolates 390 -> 135
    # over body t=9.1->10.5 (final t=10.60->12.00).
    s2_start = beat2_base + 1.85
    s2_end   = beat2_base + 3.25
    overlays.append({
        "png":   cpt_png,
        "start": s2_start,
        "end":   s2_end,
        "x":     cpt_x,
        "y":     f"390-255*(t-{s2_start:.3f})/({s2_end - s2_start:.3f})",
    })

    # Callouts: lower-third, fired 0.5s after each VO begins, held for
    # min(VO_dur, 5.5s).
    for i, beat in enumerate(BEATS):
        if not beat["callout"]:
            continue
        vo_dur = ffprobe_duration(VOICEOVER_DIR / beat["vo"])
        co_start = OPEN_CARD_DUR + vo_offsets[i] + 0.5
        co_dur = min(vo_dur - 0.6, 5.5) if (vo_dur - 0.6) > 1 else (vo_dur - 0.2)
        overlays.append({
            "png":   callout_pngs[beat["callout"]],
            "start": co_start,
            "end":   co_start + co_dur,
            "x":     "(W-w)/2",
            "y":     int(OUT_H * 0.78),
        })

    # Trilingual gold pill — overlay during VO #7
    vo7_dur = ffprobe_duration(VOICEOVER_DIR / "07_trilingual_close.mp3")
    pill_start = OPEN_CARD_DUR + vo_offsets[6] + 0.6
    pill_dur = max(2.0, min(2.5, vo7_dur - 1.0))
    overlays.append({
        "png":   pill_png,
        "start": pill_start,
        "end":   pill_start + pill_dur,
        "x":     "(W-w)/2",
        "y":     int(OUT_H * 0.72),
    })

    # Audio is delayed by OPEN_CARD_DUR so it begins when opening card ends.
    out_path = Path(args.output).resolve()
    stage_overlay_pass(
        base_video=full_no_audio,
        overlays=overlays,
        audio_path=master_audio,
        audio_delay=OPEN_CARD_DUR,
        out_path=out_path,
    )

    final_dur = ffprobe_duration(out_path)
    print(f"\n[DONE] Final: {out_path}")
    print(f"       Duration: {final_dur:.2f}s")


if __name__ == "__main__":
    main()
