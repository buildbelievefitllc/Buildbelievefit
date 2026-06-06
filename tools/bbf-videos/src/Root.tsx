import { Composition } from 'remotion';
import { CtaCard } from './CtaCard';
import { VIDEO } from './brand';

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
        eyebrow: 'I AM CAPABLE',
        headline: 'Your limits are borrowed',
        // 0-based word index at/after which headline words render in gold.
        // "Your(0) limits(1) are(2) borrowed(3)" -> only "borrowed" is gold.
        goldWordFrom: 3,
        body: 'The doubt isn’t yours. You inherited it. Reclaim what’s yours.',
        cta: 'AWAKEN',
      }}
    />
  );
};
