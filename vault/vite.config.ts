import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base '/vault/' so the compiled SPA is served at
// https://buildbelievefit.fitness/vault/ while the legacy bbf-app.html
// continues to resolve at the root for the 5 paying customers.
export default defineConfig({
  plugins: [react()],
  base: '/vault/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
