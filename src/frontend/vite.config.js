import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single source of truth for the version shown in the UI: package.json.
// Hardcoding it in a component is how "v3.0" survived two releases.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// GitHub Pages serves the app from /AgroData_Engine/, local dev from /.
const base = process.env.VITE_BASE ?? '/AgroData_Engine/'

// The dev server proxies /api to the .NET API so the browser never needs CORS
// or a hardcoded backend URL.
const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:5072'

// Extra hosts allowed to reach the dev server (tunnels, cloud previews).
// Comma separated, e.g. VITE_ALLOWED_HOSTS=.e2b.app,.ngrok-free.app
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react()],
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    target: 'es2022',
    reportCompressedSize: true,
  },
})
