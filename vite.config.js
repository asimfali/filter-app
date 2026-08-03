import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    legacy({
      targets: ['chrome >= 49', 'firefox >= 52', 'edge >= 18'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    css: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // target: 'es2015',
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['lab'],
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8001',
        ws: true,
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})