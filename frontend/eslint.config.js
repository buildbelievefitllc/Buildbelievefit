import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `android/` and `ios/` hold the Capacitor projects — `npx cap sync` copies the
  // minified dist bundle into their assets, which is build output, never lintable
  // source.
  globalIgnores(['dist', 'android', 'ios', 'public/draco']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Dev/test-only tooling (Playwright config + the component harness). These never
  // ship in the production bundle; allow Node globals and the harness's inline
  // component definitions (Fast-Refresh isolation is irrelevant to a one-shot mount).
  {
    files: ['playwright.config.js', 'vite.config.js', 'e2e/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
