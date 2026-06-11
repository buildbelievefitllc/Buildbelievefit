import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wrapper for the BBF React PWA. The Vite build emits `dist/`, which
// `npx cap sync` copies into the native Android project. This file is read only by
// the Capacitor CLI — it is NOT part of the Vite/ESLint web build graph, so it adds
// no runtime dependency to the shipped bundle.
const config: CapacitorConfig = {
  appId: 'fitness.buildbelievefit.app',
  appName: 'Build Believe Fit',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
