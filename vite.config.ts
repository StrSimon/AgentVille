import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BRIDGE = `http://127.0.0.1:${process.env.AGENTVILLE_PORT || 4242}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Dev: the bridge (npm run bridge) serves the API; Vite proxies to it.
    proxy: {
      '/api': { target: BRIDGE, changeOrigin: true },
      '/events': { target: BRIDGE, changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
