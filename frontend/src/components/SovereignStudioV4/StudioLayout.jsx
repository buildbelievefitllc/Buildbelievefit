// src/components/SovereignStudioV4/StudioLayout.jsx
// Main UI grid: controls sidebar (left) + preview (right)

import { useRef, useState } from 'react';
import VibeSelector from './VibeSelector';
import ReelPreviewEngine from './ReelPreviewEngine';
import StageScaler from './StageScaler';
import { renderMarkup } from './markup.jsx';

export default function StudioLayout({
  mode,
  ctaData,
  handleCtaChange,
  spinCard,
  phoneData,
  handlePhoneChange,
  reelData,
  handleReelChange,
}) {
  // Ref to the active export stage (the un-scaled 1080-wide node). The preview
  // shows it visually shrunk via StageScaler's transform; for export we briefly
  // neutralize that transform so html2canvas captures at full export resolution.
  const stageRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const exportPNG = async (slug) => {
    const node = stageRef.current;
    if (!node || exporting) return;
    setExporting(true);
    const scaler = node.closest('.stage-scaler-inner');
    const prevTransform = scaler ? scaler.style.transform : null;
    if (scaler) scaler.style.transform = 'none';
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(node, {
        backgroundColor: '#0a0a0a',
        scale: 1,
        useCORS: true,
        imageTimeout: 4000, // never hang indefinitely on a slow/blocked asset
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
      // Blob + object URL is far more reliable for download than a giant data: URL.
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bbf-${slug}-${canvas.width}x${canvas.height}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      /* export failures are non-fatal — surface nothing rather than crash the UI */
      console.error('[StudioV4] PNG export failed:', e);
    } finally {
      if (scaler) scaler.style.transform = prevTransform || '';
      setExporting(false);
    }
  };

  return (
    <div className="layout-v4">
      <div className="controls-v4">
        {mode === 'cta' && (
          <div className="panel-v4 active">
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">⚡ Catalog — pick a vibe, spin</label>
              <select
                value={ctaData.lane}
                onChange={(e) => handleCtaChange('lane', e.target.value)}
                className="select-v4"
              >
                <option value="all">ALL LANES (full shuffle)</option>
                <option value="fence">FEAR & THE FENCE</option>
                <option value="identity">IDENTITY & LEGACY</option>
                <option value="parent">THE WORKING PARENT</option>
                <option value="responder">FIRST RESPONDER</option>
                <option value="vision">VISION & MANIFESTATION</option>
                <option value="comeback">THE COMEBACK</option>
              </select>
            </div>

            <div className="ctl-group-v4">
              <button className="spin-btn-v4" onClick={spinCard}>
                🎰 SPIN A CARD
              </button>
              <div className="hint-v4">Pulls a headline, body &amp; CTA from the selected lane (or shuffles all). Everything stays editable.</div>
            </div>

            <div className="divider-v4"></div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Format</label>
              <div className="seg-v4">
                <button
                  className={ctaData.format === 'feed' ? 'active' : ''}
                  onClick={() => handleCtaChange('format', 'feed')}
                >
                  FEED 4:5
                </button>
                <button
                  className={ctaData.format === 'story' ? 'active' : ''}
                  onClick={() => handleCtaChange('format', 'story')}
                >
                  STORY 9:16
                </button>
              </div>
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Eyebrow</label>
              <input
                type="text"
                value={ctaData.eyebrow}
                onChange={(e) => handleCtaChange('eyebrow', e.target.value)}
                className="input-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Headline — *stars* = highlight</label>
              <textarea
                value={ctaData.headline}
                onChange={(e) => handleCtaChange('headline', e.target.value)}
                className="textarea-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Body — **double stars** = bold white</label>
              <textarea
                value={ctaData.body}
                onChange={(e) => handleCtaChange('body', e.target.value)}
                className="textarea-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">CTA Button</label>
              <input
                type="text"
                value={ctaData.buttonText}
                onChange={(e) => handleCtaChange('buttonText', e.target.value)}
                className="input-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">🎨 Raw Accent Override</label>
              <div className="color-row-v4">
                <div className="color-cell-v4">
                  <input
                    type="color"
                    value={ctaData.primaryColor}
                    onChange={(e) => handleCtaChange('primaryColor', e.target.value)}
                    className="color-input-v4"
                  />
                  <div className="cc-meta-v4">
                    <span className="cc-k-v4">Primary</span>
                    <span className="cc-v-v4">{ctaData.primaryColor}</span>
                  </div>
                </div>
                <div className="color-cell-v4">
                  <input
                    type="color"
                    value={ctaData.secondaryColor}
                    onChange={(e) => handleCtaChange('secondaryColor', e.target.value)}
                    className="color-input-v4"
                  />
                  <div className="cc-meta-v4">
                    <span className="cc-k-v4">Secondary</span>
                    <span className="cc-v-v4">{ctaData.secondaryColor}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ctl-group-v4">
              <button className="export-btn-v4" onClick={() => exportPNG('cta')} disabled={exporting}>
                {exporting ? '… RENDERING' : '⬇ EXPORT PNG'}
              </button>
              <button className="queue-btn-v4" disabled title="Auto-post pipeline ships in V4.1">
                📡 QUEUE → IG/FB · SOON
              </button>
            </div>
          </div>
        )}

        {mode === 'phone' && (
          <div className="panel-v4 active">
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Layout</label>
              <div className="seg-v4">
                <button
                  className={phoneData.layout === 'single' ? 'active' : ''}
                  onClick={() => handlePhoneChange('layout', 'single')}
                >
                  SINGLE
                </button>
                <button
                  className={phoneData.layout === 'dual' ? 'active' : ''}
                  onClick={() => handlePhoneChange('layout', 'dual')}
                >
                  DUAL
                </button>
              </div>
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Device Frame Style</label>
              <select
                value={phoneData.frame}
                onChange={(e) => handlePhoneChange('frame', e.target.value)}
                className="select-v4"
              >
                <option value="sleek">Sleek Modern</option>
                <option value="gold">Sovereign Gold</option>
                <option value="carbon">Matte Black Carbon</option>
              </select>
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Eyebrow</label>
              <input
                type="text"
                value={phoneData.eyebrow}
                onChange={(e) => handlePhoneChange('eyebrow', e.target.value)}
                className="input-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Headline</label>
              <textarea
                value={phoneData.headline}
                onChange={(e) => handlePhoneChange('headline', e.target.value)}
                className="textarea-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Benefit</label>
              <textarea
                value={phoneData.benefit}
                onChange={(e) => handlePhoneChange('benefit', e.target.value)}
                className="textarea-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <button className="export-btn-v4" onClick={() => exportPNG('phone')} disabled={exporting}>
                {exporting ? '… RENDERING' : '⬇ EXPORT 1080×1350'}
              </button>
            </div>
          </div>
        )}

        {mode === 'reel' && (
          <div className="panel-v4 active">
            <VibeSelector
              reelData={reelData}
              handleReelChange={handleReelChange}
            />
          </div>
        )}
      </div>

      <div className="preview-wrap-v4">
        {mode === 'cta' && (
          <div className="stage-host-v4 active">
            <StageScaler designWidth={1080} designHeight={ctaData.format === 'story' ? 1920 : 1350}>
              <div
                ref={stageRef}
                className={`stage-cta-v4 ${ctaData.format === 'story' ? 'story' : ''}`}
                style={{
                  '--primary-color': ctaData.primaryColor,
                  '--secondary-color': ctaData.secondaryColor,
                }}
              >
                {/* on-brand accent bar + ambient glow (v3 parity) */}
                <div className="cta-tbar-v4" />
                <div className="cta-glow-v4" />
                <div className="cta-z-v4">
                  <div className="cta-eye-v4">{ctaData.eyebrow}</div>
                  <div className="cta-hl-v4">{renderMarkup(ctaData.headline, ctaData.primaryColor)}</div>
                </div>
                <div className="cta-z-v4">
                  <div className="cta-rule-v4" />
                  <div className="cta-body-v4">{renderMarkup(ctaData.body, ctaData.primaryColor)}</div>
                  <div className="cta-foot-v4">
                    <span className="cta-brand-v4">BUILD<span>BELIEVE</span>FIT</span>
                    <span className="cta-btn-v4">{ctaData.buttonText}</span>
                  </div>
                </div>
              </div>
            </StageScaler>
          </div>
        )}

        {mode === 'phone' && (
          <div className="stage-host-v4 active">
            <StageScaler designWidth={1080} designHeight={1350}>
              <div className="stage-phone-v4" ref={stageRef}>
                <div className="phone-strip-v4" />
                <div className="phone-text-v4">
                  <div className="phone-eye-v4">{phoneData.eyebrow}</div>
                  <div className="phone-hl-v4">{phoneData.headline}</div>
                  <div className="phone-benefit-v4">{phoneData.benefit}</div>
                </div>
                <div className={`phone-frame-v4 frame-${phoneData.frame} layout-${phoneData.layout}`}>
                  <div className="phone-notch-v4" />
                  <div className="phone-screen-v4">
                    <div className="phone-screen-ph-v4">SCREENSHOT</div>
                  </div>
                </div>
              </div>
            </StageScaler>
          </div>
        )}

        {mode === 'reel' && (
          <div className="stage-host-v4 active">
            <StageScaler designWidth={1080} designHeight={1920}>
              <ReelPreviewEngine reelData={reelData} handleReelChange={handleReelChange} />
            </StageScaler>
          </div>
        )}
      </div>
    </div>
  );
}
