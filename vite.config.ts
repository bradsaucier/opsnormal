import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE_PATH ?? '/';
  const isE2E = mode === 'e2e';

  return {
    base,
    build: {
      assetsInlineLimit: 0,
      rollupOptions: isE2E
        ? {
            input: {
              main: resolve(__dirname, 'index.html'),
              bootFallbackHarness: resolve(__dirname, 'boot-fallback-harness.html')
            }
          }
        : undefined
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'OpsNormal',
          short_name: 'OpsNormal',
          description:
            'Offline-first personal readiness tracker for daily balance across work or school, household, relationships, body, and rest.',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#0a0f0d',
          theme_color: '#0a0f0d',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          navigateFallback: 'index.html'
        },
        devOptions: {
          enabled: false
        }
      })
    ]
  };
});
