import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const requestedBase = process.env.VITE_BASE_PATH ?? '/';
  const isE2E = mode === 'e2e';
  const isAbsoluteBase =
    requestedBase.startsWith('http://') || requestedBase.startsWith('https://');
  const basePath = isAbsoluteBase
    ? new URL(
        requestedBase.endsWith('/') ? requestedBase : `${requestedBase}/`,
      ).toString()
    : (() => {
        const normalizedBase = requestedBase.startsWith('/')
          ? requestedBase
          : `/${requestedBase}`;
        return normalizedBase.endsWith('/')
          ? normalizedBase
          : `${normalizedBase}/`;
      })();
  const serviceWorkerBasePath = isAbsoluteBase
    ? new URL(basePath).pathname
    : basePath;
  const escapedBasePath = serviceWorkerBasePath.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  const emitPages404 =
    !isE2E &&
    ({
      name: 'emit-pages-404-fallback',
      closeBundle() {
        const builtIndex = resolve(__dirname, 'dist/index.html');
        const built404 = resolve(__dirname, 'dist/404.html');

        if (existsSync(builtIndex)) {
          copyFileSync(builtIndex, built404);
        }
      },
    } satisfies import('vite').Plugin);

  return {
    base: basePath,
    build: {
      assetsInlineLimit: 0,
      rollupOptions: isE2E
        ? {
            input: {
              main: resolve(__dirname, 'index.html'),
              bootFallbackHarness: resolve(
                __dirname,
                'tests/harness/boot-fallback-harness.html',
              ),
              crashFallbackHarness: resolve(
                __dirname,
                'tests/harness/crash-fallback-harness.html',
              ),
            },
          }
        : undefined,
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: basePath,
          name: 'OpsNormal',
          short_name: 'OpsNormal',
          description:
            'Offline-first personal readiness tracker for daily balance across work or school, household, relationships, body, and rest.',
          start_url: basePath,
          scope: basePath,
          display: 'standalone',
          background_color: '#0a0f0d',
          theme_color: '#0a0f0d',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          globIgnores: [
            '**/boot-fallback-harness.html',
            '**/crash-fallback-harness.html',
            '**/assets/bootFallbackHarness-*.js',
            '**/assets/crashFallbackHarness-*.js',
          ],
          cleanupOutdatedCaches: true,
          skipWaiting: false,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [
            new RegExp(`^${escapedBasePath}boot-fallback-harness\\.html$`),
            new RegExp(`^${escapedBasePath}crash-fallback-harness\\.html$`),
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      ...(emitPages404 ? [emitPages404] : []),
    ],
  };
});
