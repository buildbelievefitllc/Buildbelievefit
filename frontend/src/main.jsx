import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LangProvider } from './context/LangContext.jsx';
import { ReadinessProvider } from './context/ReadinessContext.jsx';
import { AthleteProfileProvider } from './context/AthleteProfileContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider>
      <AuthProvider>
        <AthleteProfileProvider>
          <ReadinessProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ReadinessProvider>
        </AthleteProfileProvider>
      </AuthProvider>
    </LangProvider>
  </StrictMode>,
);

// Register the service worker so the app installs and runs as a true standalone
// PWA (offline shell + asset caching). Registered after load so it never blocks
// first paint; failures are non-fatal (the app works without it).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* SW optional */ });
  });
}
