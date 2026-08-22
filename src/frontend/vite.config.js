import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const backendPort = process.env.ASSET_MANAGER_BACKEND_PORT || '8000';
const frontendPort = process.env.ASSET_MANAGER_FRONTEND_PORT || '5173';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(frontendPort),
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
    },
  },
  test: {
    environment: 'happy-dom',
    environmentMatchGlobs: [
      ['src/services/**', 'node'],
      ['src/utils/**', 'node'],
    ],
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    pool: 'forks',
  },
})
