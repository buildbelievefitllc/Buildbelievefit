import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bake the CI release version (BBF_VERSION_NAME = 1.0.<run#>, computed in
  // android-deploy.yml BEFORE this build) into the bundle so the in-app version
  // stamp (src/version.js) matches the Android versionName gradle stamps. Absent
  // locally / on web-only deploys → src/version.js falls back to 'dev'.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.BBF_VERSION_NAME || ''),
  },
})
