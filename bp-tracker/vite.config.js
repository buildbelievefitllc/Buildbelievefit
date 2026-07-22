import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dedicated BP Tracker PWA. Separate, isolated Vite app from /frontend so the
// distraction-free surface never inherits the Command Center bundle. Deployed
// to Render as its own static site (see repo render.yaml: bbf-bp-tracker).
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
