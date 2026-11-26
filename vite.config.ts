import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  server: {
    port: 3000,
    open: false,
    host: true
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2000
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});
