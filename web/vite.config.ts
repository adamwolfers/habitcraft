/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Go server embeds the build and serves it beside the API, so the app and
// the API share an origin and the auth cookies need no CORS. `npm run dev`
// keeps that shape by proxying the API's paths to a Go server on :8080.
const API = process.env.HABITCRAFT_API_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Embedded by server/cmd/habitcraft/webapp.go.
    outDir: '../server/cmd/habitcraft/spa/dist',
    // Outside web/, so Vite asks before emptying it.
    emptyOutDir: true,
  },
  server: {
    port: 3200,
    proxy: { '/api': API, '/health': API },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      include: ['src/**'],
      exclude: ['src/**/*.generated.ts', 'src/main.tsx', 'src/test/**'],
    },
  },
});
