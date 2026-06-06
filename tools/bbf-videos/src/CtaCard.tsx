import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ensureFonts, FONT_BODY, FONT_DISPLAY } from './fonts';

// Register the brand fonts before the first frame rasterizes.
ensureFonts();

// The single non-linear ease for every fade: cubic-bezier(0.16, 1, 0.3, 1).
// Entrances use springs; nothing uses linear easing.
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const TAU = Math.PI * 2;

export type CtaCopy = {
  eyebrow: string;
  headline: string;
  /** 0-based index; words at/after this render in gold. */
  goldWordFrom: number;
  bodyLines: string[];
  cta: string;
  /** [build, believe, fit] — index 1 renders gold. */
  wordmark: string[];
};

export type CtaColors = {
  bgTop: string;
  bgBottom: string;
  purple: string;
  gold: string;
  ink: string;
  body: string;
};

export type CtaTiming = {
  topBarEnd: number;
  eyebrowEnd: number;
  eyebrowLsFrom: number;
  eyebrowLsTo: number;
  headlineStart: number;
  headlineStagger: number;
  wordDur: number;
  ruleStart: number;
  ruleEnd: number;
  bodyStart: number;
  bodyLineStagger: number;
  ctaStart: number;
  ctaDur: number;
  wordmarkStart: number;
  holdStart: number;
};

export type CtaAudio = {
  enabled: boolean;
  whooshLead: number;
  whooshVolume: number;
  subBassOffset: number;
  subBassVolume: number;
};

export type CtaBackground = {
  glowOpacity: number;
  grainOpacity: number;
  breatheTo: number;
};

export type CtaCardProps = {
  copy: CtaCopy;
  colors: CtaColors;
  timing: CtaTiming;
  audio: CtaAudio;
  background: CtaBackground;
};

// Eased, clamped fade. `out` defaults to opacity 0->1.
const fade = (
  frame: number,
  range: [number, number],
  out: [number, number] = [0, 1],
) =>
  interpolate(frame, range, out, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });

export const CtaCard: React.FC<CtaCardProps> = ({
  copy,
  colors,
  timing: T,
  audio: A,
  background: BG,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();

  const words = copy.headline.split(/\s+/).filter(Boolean);
  const lastIdx = words.length - 1;

  // ── Background: breathing (1.0 -> breatheTo -> 1.0 over the whole clip) +
  //    slow positional drift so the frame is never static. ───────────────────
  const breathe =
    1 + (BG.breatheTo - 1) * (0.5 - 0.5 * Math.cos(TAU * (frame / durationInFrames)));
  const driftX = Math.sin(TAU * (frame / 220)) * 24;
  const driftY = Math.cos(TAU * (frame / 270)) * 18;

  // ── Top bar wipe (left -> right) ──────────────────────────────────────────
  const topBarW = fade(frame, [0, T.topBarEnd], [0, width]);

  // ── Eyebrow: fade up + letter-spacing settle (14px -> 7px) ────────────────
  const eyebrowOpacity = fade(frame, [0, Math.round(T.eyebrowEnd * 0.62)]);
  const eyebrowY = fade(frame, [0, T.eyebrowEnd], [26, 0]);
  const eyebrowLs = fade(frame, [0, T.eyebrowEnd], [T.eyebrowLsFrom, T.eyebrowLsTo]);

  // ── "BORROWED" landing frame (drives gold glow + sub-bass sync) ───────────
  const lastStart = T.headlineStart + lastIdx * T.headlineStagger;
  const borrowedLand = lastStart + Math.round(T.wordDur * 0.55);

  // gold glow on the final word: a sharp pulse on landing, then a gentle idle
  // breathing so it stays subtly alive through the hold.
  const goldGlow = (() => {
    const t = frame - borrowedLand;
    if (t < 0) return 0;
    const pulse = Math.exp(-t / 9);
    const idle = 0.28 + 0.12 * Math.sin(TAU * (t / 54));
    return Math.min(1, 0.72 * pulse + idle);
  })();

  // ── Gold rule draw ────────────────────────────────────────────────────────
  const ruleW = fade(frame, [T.ruleStart, T.ruleEnd], [0, 80]);

  // ── CTA: spring pop + perpetual slow glow pulse (idle = alive) ────────────
  const ctaSpring = spring({
    frame: frame - T.ctaStart,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.8 },
    durationInFrames: T.ctaDur,
  });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.8, 1]);
  const ctaIntro = fade(frame, [T.ctaStart, T.ctaStart + 16]);
  const ctaPulse = 0.5 + 0.5 * Math.sin(TAU * (frame / 50));
  const ctaGlow = ctaIntro * (0.55 + 0.45 * ctaPulse);

  // ── Wordmark ──────────────────────────────────────────────────────────────
  const footOpacity = fade(frame, [T.wordmarkStart, T.wordmarkStart + 28], [0, 0.55]);

  // ── Audio cue frames (derived from timing so variants stay in sync) ───────
  const whooshFrame = Math.max(0, T.headlineStart - A.whooshLead);
  const subBassFrame = Math.max(0, Math.round(borrowedLand + A.subBassOffset));

  // film grain: tiled noise PNG, position jumps per frame -> shimmer (cheap)
  const grainX = (frame * 71) % 256;
  const grainY = (frame * 113) % 256;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgBottom }}>
      {/* 1 · base vertical gradient #0d0118 -> #060606 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${colors.bgTop} 0%, ${colors.bgBottom} 100%)`,
        }}
      />

      {/* 2 · purple radial bloom in the lower third — breathes + drifts */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '72%',
          width: 1500,
          height: 1500,
          marginLeft: -750,
          marginTop: -750,
          opacity: BG.glowOpacity,
          filter: 'blur(28px)',
          background: `radial-gradient(circle at 50% 50%, ${colors.purple} 0%, rgba(106,13,173,0.55) 26%, rgba(106,13,173,0) 66%)`,
          transform: `translate(${driftX}px, ${driftY}px) scale(${breathe})`,
          willChange: 'transform',
        }}
      />

      {/* 3 · vignette (darker corners) */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(125% 100% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* top signature bar — 10px #6a0dad -> #f5c800, wipes left -> right */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 10,
          width: topBarW,
          background: `linear-gradient(90deg, ${colors.purple} 0%, ${colors.gold} 100%)`,
          backgroundSize: `${width}px 10px`,
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* content stack */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 84px',
          textAlign: 'center',
        }}
      >
        {/* eyebrow */}
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 33,
            color: colors.gold,
            textTransform: 'uppercase',
            letterSpacing: `${eyebrowLs}px`,
            paddingLeft: `${eyebrowLs}px`, // compensate trailing track for centering
            opacity: eyebrowOpacity,
            transform: `translateY(${eyebrowY}px)`,
            marginBottom: 34,
          }}
        >
          {copy.eyebrow}
        </div>

        {/* headline — per-word overdamped spring + 4px blur resolve */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: 134,
            lineHeight: 0.92,
            textTransform: 'uppercase',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 912,
          }}
        >
          {words.map((word, i) => {
            const wStart = T.headlineStart + i * T.headlineStagger;
            const local = frame - wStart;
            // damping 200 vs stiffness 120 -> heavily overdamped: smooth, no overshoot
            const prog = spring({
              frame: local,
              fps,
              config: { damping: 200, stiffness: 120, mass: 1 },
              durationInFrames: T.wordDur,
            });
            const ty = interpolate(prog, [0, 1], [30, 0]);
            const blurPx = interpolate(prog, [0, 1], [4, 0]);
            const opacity = fade(local, [0, 9]);
            const isLast = i === lastIdx;
            const isGold = i >= copy.goldWordFrom;
            const scale = isLast ? interpolate(prog, [0, 1], [1.08, 1]) : 1; // BORROWED settle
            const glow = isLast ? goldGlow : 0;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  margin: '0 0.16em',
                  color: isGold ? colors.gold : colors.ink,
                  opacity,
                  filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
                  transform: `translateY(${ty}px) scale(${scale})`,
                  transformOrigin: 'center bottom',
                  textShadow:
                    glow > 0
                      ? `0 0 ${18 + 46 * glow}px rgba(245,200,0,${0.25 + 0.55 * glow})`
                      : undefined,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* gold rule */}
        <div
          style={{
            width: ruleW,
            height: 6,
            backgroundColor: colors.gold,
            borderRadius: 3,
            marginTop: 40,
            marginBottom: 36,
          }}
        />

        {/* body — line by line, staggered eased fade-up */}
        <div style={{ maxWidth: 800 }}>
          {copy.bodyLines.map((line, j) => {
            const lStart = T.bodyStart + j * T.bodyLineStagger;
            const op = fade(frame, [lStart, lStart + 18]);
            const ty = fade(frame, [lStart, lStart + 18], [18, 0]);
            return (
              <div
                key={j}
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 500,
                  fontSize: 40,
                  lineHeight: 1.34,
                  color: colors.body,
                  opacity: op,
                  transform: `translateY(${ty}px)`,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>

        {/* CTA pill — gold fill, purple label (pure brand lockup) */}
        <div
          style={{
            marginTop: 56,
            opacity: ctaIntro,
            transform: `scale(${ctaScale})`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 38,
              color: colors.purple,
              backgroundColor: colors.gold,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              padding: '24px 66px 22px',
              paddingLeft: 'calc(66px + 0.2em)', // compensate trailing track
              borderRadius: 999,
              boxShadow: `0 18px 50px rgba(0,0,0,0.45), 0 0 ${30 + 55 * ctaGlow}px rgba(245,200,0,${0.18 + 0.42 * ctaGlow})`,
            }}
          >
            {copy.cta}
          </div>
        </div>
      </AbsoluteFill>

      {/* footer wordmark — subtle brand signature */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: 30,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          opacity: footOpacity,
        }}
      >
        {copy.wordmark[0]}{' '}
        <span style={{ color: colors.gold }}>{copy.wordmark[1]}</span>{' '}
        {copy.wordmark[2]}
      </div>

      {/* film grain — topmost; tiled noise PNG, per-frame position jump =
          shimmer. Cheap to composite (no per-frame SVG filter). */}
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('img/grain.png')})`,
          backgroundRepeat: 'repeat',
          backgroundPosition: `${grainX}px ${grainY}px`,
          mixBlendMode: 'overlay',
          opacity: BG.grainOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* audio — synthesized, royalty-free (see scripts/gen-sfx.mjs) */}
      {A.enabled && (
        <>
          <Sequence from={whooshFrame} name="whoosh">
            <Audio src={staticFile('sfx/whoosh.wav')} volume={A.whooshVolume} />
          </Sequence>
          <Sequence from={subBassFrame} name="sub-bass">
            <Audio src={staticFile('sfx/sub-bass-hit.wav')} volume={A.subBassVolume} />
          </Sequence>
        </>
      )}
    </AbsoluteFill>
  );
};
