import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LangProvider } from './context/LangContext.jsx';
import { ReadinessProvider } from './context/ReadinessContext.jsx';
import { AthleteProfileProvider } from './context/AthleteProfileContext.jsx';
import { isNativePlatform } from './native/platform.js';

// Root error boundary (App Store 2.1): without it, any uncaught render error —
// a failed lazy chunk, a null access in a page component — unmounts the tree to
// a blank WebView, the classic app-review rejection. This is the last line of
// defense: branded recovery card + reload, never a white screen. Styles are
// inline because index.css may not have applied if the crash happened early.
class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          background: '#090909', color: '#fff', textAlign: 'center',
          padding: '24px', fontFamily: '"Barlow Condensed", sans-serif',
        }}
      >
        <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '1.6rem', letterSpacing: '2px', color: '#f5c800' }}>
          BUILD BELIEVE FIT
        </div>
        <div style={{ maxWidth: 360, opacity: 0.85, lineHeight: 1.4 }}>
          Something went wrong loading this screen. Reload to continue — your data is safe.
        </div>
        <button
          type="button"
          onClick={() => window.location.replace('/')}
          style={{
            fontFamily: '"Bebas Neue", sans-serif', fontSize: '1rem', letterSpacing: '2px',
            padding: '12px 28px', borderRadius: 10, cursor: 'pointer',
            color: '#fff', background: '#6a0dad', border: '1px solid #6a0dad',
          }}
        >
          RELOAD
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
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
    </RootErrorBoundary>
  </StrictMode>,
);

// Register the service worker so the app installs and runs as a true standalone
// PWA (offline shell + asset caching). Registered after load so it never blocks
// first paint; failures are non-fatal (the app works without it). Skipped inside
// the native (Capacitor) shell: assets already load from local disk there, and
// the SW's network-first navigation handler would only add a wasted round-trip
// (WKWebView SW support is unreliable anyway).
if (!isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* SW optional */ });
  });
}
