import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    css: false,
    // Les scénarios navigateur sont exécutés par Playwright.
    include: ['src/tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
})
