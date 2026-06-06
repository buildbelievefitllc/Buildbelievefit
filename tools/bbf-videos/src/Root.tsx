import { Composition } from 'remotion';
import { CtaCard } from './CtaCard';
import { BRAND, VIDEO } from './brand';

// Everything a variant needs — copy, colors, timing, audio, background — lives
// here as props. Re-render variants by editing defaultProps only; never touch
// the composition.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CtaCard"
      component={CtaCard}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{
        copy: {
          eyebrow: 'I AM CAPABLE',
          headline: 'Your limits are borrowed',
          // 0-based word index at/after which words render gold.
          // "Your(0) limits(1) are(2) borrowed(3)" -> only "borrowed" is gold.
          goldWordFrom: 3,
          bodyLines: [
            'The doubt isn’t yours.',
            'You inherited it.',
            'Reclaim what’s yours.',
          ],
          cta: 'AWAKEN',
          wordmark: ['Build', 'Believe', 'Fit'], // middle word renders gold
        },
        colors: {
          bgTop: BRAND.bgTop,
          bgBottom: BRAND.bgBottom,
          purple: BRAND.purple,
          gold: BRAND.gold,
          ink: BRAND.ink,
          body: BRAND.body,
        },
        // Frame timeline (30fps, 180 frames = 6.0s). Phases intentionally overlap.
        timing: {
          topBarEnd: 20, // top bar wipe completes
          eyebrowEnd: 35, // eyebrow fade-up + letter-spacing settle complete
          eyebrowLsFrom: 14, // px
          eyebrowLsTo: 7, // px
          headlineStart: 25, // first word enters
          headlineStagger: 14, // frames between word entrances
          wordDur: 20, // per-word spring settle length
          ruleStart: 80,
          ruleEnd: 108,
          bodyStart: 86,
          bodyLineStagger: 6,
          ctaStart: 110,
          ctaDur: 22,
          wordmarkStart: 118,
          holdStart: 150, // full composition holds, background keeps breathing
        },
        audio: {
          enabled: true,
          whooshLead: 8, // whoosh begins this many frames before headlineStart
          whooshVolume: 0.5,
          subBassOffset: 0, // fine-tune sub-bass vs "BORROWED" landing (frames)
          subBassVolume: 0.9,
        },
        background: {
          glowOpacity: 0.35, // purple radial bloom
          grainOpacity: 0.06, // film grain (~6%)
          breatheTo: 1.06, // bloom breathing peak scale
        },
      }}
    />
  );
};
