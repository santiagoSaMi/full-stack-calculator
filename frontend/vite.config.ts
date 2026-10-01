import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Backend that the dev and preview servers forward /api requests to. Proxying
// keeps browser requests same-origin, so the backend needs no CORS setup.
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    coverage: {
      provider: 'v8',
      // "text" prints a table in the terminal; "html" writes coverage/index.html.
      reporter: ['text', 'html'],
      // Measure every source file, including ones no test imports.
      include: ['src/**/*.{ts,tsx}'],
      // Not application code: the tests themselves, test helpers, and type declarations.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts', 'src/types/**'],
      // Fail the run if coverage drops below these percentages.
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
})
