/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// docker-compose.yml overrides these so Vite listens inside its container and reaches
// the server container by name. Running `npm run dev` on the host uses the defaults.
const env = process.env;

export default defineConfig({
  plugins: [react()],
  server: {
    host: env.VITE_HOST ?? '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001',
    },
    // File-change events don't reach containers from a Windows folder, so poll there.
    watch: env.VITE_POLL === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
