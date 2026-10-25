/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const api = 'http://localhost:5080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Same-origin in development too, so the HttpOnly auth cookies just work
    proxy: { '/api': api, '/Uploads': api, '/sitemap.xml': api },
  },
  build: {
    // The API serves the built SPA from its wwwroot (one origin in production)
    outDir: '../JapaneseFood.Api/wwwroot',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
  },
})
