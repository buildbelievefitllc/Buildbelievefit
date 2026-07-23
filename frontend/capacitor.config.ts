import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wrapper for the BBF React PWA. The Vite build emits `dist/`, which
// `npx cap sync` copies into the native Android project. This file is read only by
// the Capacitor CLI — it is NOT part of the Vite/ESLint web build graph, so it adds
// no runtime dependency to the shipped bundle.
// NOTE on app identity: `appId` below is the ANDROID identity — it matches the
// live Play Console package (`fitness.buildbelievefit.twa`, a legacy TWA-era name
// that is immutable on Play) and the android/ project's applicationId. The iOS
// project deliberately does NOT inherit it: its PRODUCT_BUNDLE_IDENTIFIER is the
// clean `fitness.buildbelievefit.app` (set in ios/App/App.xcodeproj), chosen
// before the first App Store Connect upload locks it forever. `cap sync` never
// rewrites either native id — only `cap add` reads appId, at generation time.
const config: CapacitorConfig = {
  appId: 'fitness.buildbelievefit.twa',
  appName: 'BBF Lab',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
