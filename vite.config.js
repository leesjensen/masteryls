import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import istanbul from 'vite-plugin-istanbul';
import { VitePWA } from 'vite-plugin-pwa';

// During Playwright e2e (MLS_TEST_CONFIG set by playwright.config.ts's webServer) the app's
// `config` import is redirected to a committed, deterministic fixture instead of the ambient,
// environment-specific /config.js. Keeps test behavior independent of whatever config is on disk.
const testConfigAlias = process.env.MLS_TEST_CONFIG
  ? [{ find: /^\.\.\/\.\.\/config(\.js)?$/, replacement: fileURLToPath(new URL('./tests/fixtures/config.js', import.meta.url)) }]
  : [];

export default defineConfig({
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: testConfigAlias,
  },
  plugins: [
    tailwindcss(),
    istanbul({
      include: ['src/**/*'],
      exclude: ['node_modules'],
      requireEnv: false,
    }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        name: 'Mastery LS',
        short_name: 'MasteryLS',
        description: 'Mastery-focused learning with interactive course content, AI feedback, and progress tracking.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#20508b',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,avif,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image' || request.destination === 'style' || request.destination === 'script',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets',
            },
          },
        ],
      },
    }),
  ],
});
