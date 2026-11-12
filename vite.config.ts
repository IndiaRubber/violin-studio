import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: null,
    includeManifestIcons: false,
    manifest: {
      name: 'Violin Studio', short_name: 'Violin Studio',
      description: 'Local violin practice and instrument tuning',
      start_url: '/', scope: '/', display: 'standalone',
      background_color: '#f6f3ed', theme_color: '#a34b29',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,ttf,otf,webmanifest}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallback: '/index.html',
      cleanupOutdatedCaches: true,
      skipWaiting: false,
      clientsClaim: true,
    },
  })],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
