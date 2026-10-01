import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
})
