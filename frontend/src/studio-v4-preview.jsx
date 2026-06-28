// src/studio-v4-preview.jsx
// DEV/VERIFICATION-ONLY entry. Mounts the Sovereign Studio V4 component in
// isolation (no router, no AuthGuard, no supabaseClient) so it can be driven
// and screenshotted by Playwright/Chromium. This file is NOT imported by the
// production app — App.jsx routes the component through the Command Center.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SovereignStudioV4 from './components/SovereignStudioV4/index.jsx';

createRoot(document.getElementById('harness-root')).render(
  <StrictMode>
    <SovereignStudioV4 />
  </StrictMode>,
);
