import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND } from './brand';
import { ensureFonts, FONT_BODY, FONT_DISPLAY } from './fonts';

// Register the brand fonts before the first frame rasterizes.
ensureFonts();

export type CtaCardProps = {
  eyebrow: string;
  headline: string;
  /** 0-based word index; words at this index and after render in gold. */
  goldWordFrom: number;
  body: string;
  cta: string;
};

// Timeline (30fps, 150 frames = 5.0s):
//   Phase 1  0-60   (0-2s)  eyebrow fades in, then holds
//   Phase 2  60-120 (2-4s)  headline punches in word by word
//   Phase 3  120-150 (4-5s) gold rule draws + body & CTA fade in
const HEAD_START = 60;
const WORD_STAGGER = 12;

const fadeIn = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const CtaCard: React.FC<CtaCardProps> = ({
  eyebrow,
  headline,
  goldWordFrom,
  body,
  cta,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Phase 1 · eyebrow: fade + rise + letter-spacing settle ────────────────
  const eyebrowOpacity = fadeIn(frame, 0, 22);
  const eyebrowY = interpolate(frame, [0, 26], [22, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const eyebrowTrack = interpolate(frame, [0, 34], [0.62, 0.4], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ── Phase 2 · headline word-by-word punch ─────────────────────────────────
  const words = headline.split(/\s+/).filter(Boolean);

  // ── Phase 3 · rule + body + CTA ───────────────────────────────────────────
  const ruleWidth = interpolate(frame, [118, 138], [0, 76], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const bodyOpacity = fadeIn(frame, 122, 145);
  const bodyY = interpolate(frame, [122, 145], [18, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const ctaProgress = spring({
    frame: frame - 128,
    fps,
    config: { damping: 13, stiffness: 170, mass: 0.7 },
    durationInFrames: 22,
  });
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.84, 1]);
  const ctaOpacity = fadeIn(frame, 128, 144);

  const footOpacity = interpolate(frame, [126, 148], [0, 0.55], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.purple }}>
      {/* Depth: violet bloom behind the headline + bottom vignette.
          Keeps #6a0dad as the base while adding premium dimensionality. */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(115% 78% at 50% 30%, rgba(176,92,246,0.40) 0%, rgba(106,13,173,0) 46%),' +
            'radial-gradient(140% 120% at 50% 116%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 52%)',
        }}
      />

      {/* Top gold signature bar (brand lockup echo of the calling cards). */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          background: `linear-gradient(90deg, rgba(245,200,0,0) 0%, rgba(245,200,0,0.12) 38%, ${BRAND.gold} 100%)`,
        }}
      />

      {/* Centered content stack */}
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
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 33,
            color: BRAND.gold,
            textTransform: 'uppercase',
            letterSpacing: `${eyebrowTrack}em`,
            paddingLeft: `${eyebrowTrack}em`, // compensate trailing track for centering
            opacity: eyebrowOpacity,
            transform: `translateY(${eyebrowY}px)`,
            marginBottom: 30,
          }}
        >
          {eyebrow}
        </div>

        {/* Headline — each word punches in on its own spring */}
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
            const startF = HEAD_START + i * WORD_STAGGER;
            const local = frame - startF;
            const s = spring({
              frame: local,
              fps,
              config: { damping: 12, stiffness: 200, mass: 0.85 },
              durationInFrames: 24,
            });
            const scale = interpolate(s, [0, 1], [1.32, 1]);
            const opacity = interpolate(local, [0, 7], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const isGold = i >= goldWordFrom;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  margin: '0 0.16em',
                  color: isGold ? BRAND.gold : BRAND.ink,
                  opacity,
                  transform: `scale(${scale})`,
                  transformOrigin: 'center bottom',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Gold rule */}
        <div
          style={{
            width: ruleWidth,
            height: 6,
            backgroundColor: BRAND.gold,
            borderRadius: 3,
            marginTop: 40,
            marginBottom: 36,
          }}
        />

        {/* Body */}
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: 40,
            lineHeight: 1.3,
            color: BRAND.body,
            maxWidth: 760,
            opacity: bodyOpacity,
            transform: `translateY(${bodyY}px)`,
          }}
        >
          {body}
        </div>

        {/* CTA button — gold pill, purple label (pure brand lockup) */}
        <div
          style={{
            marginTop: 54,
            opacity: ctaOpacity,
            transform: `scale(${ctaScale})`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 38,
              color: BRAND.purple,
              backgroundColor: BRAND.gold,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              padding: '24px 66px 22px',
              paddingLeft: 'calc(66px + 0.2em)', // compensate trailing track
              borderRadius: 999,
              boxShadow: `0 18px 50px rgba(0,0,0,0.35), 0 0 ${40 + 40 * ctaOpacity}px rgba(245,200,0,${0.18 + 0.42 * ctaOpacity})`,
            }}
          >
            {cta}
          </div>
        </div>
      </AbsoluteFill>

      {/* Footer wordmark — subtle brand signature */}
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
        Build <span style={{ color: BRAND.gold }}>Believe</span> Fit
      </div>
    </AbsoluteFill>
  );
};
