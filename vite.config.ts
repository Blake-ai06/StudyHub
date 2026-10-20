import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new version waits until the user taps Reload, so a refresh never wipes what they are typing.
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'StudyHub',
        short_name: 'StudyHub',
        description: 'Notes, groupmates, deadlines, and study rooms, all synced in one hub.',
        theme_color: '#052d60',
        background_color: '#052d60',
        display: 'standalone',
        orientation: 'any',
        id: '/',
        categories: ['education', 'social'],
        shortcuts: [
          { name: 'Feed', url: '/app' },
          { name: 'Classes', url: '/app/classes' },
          { name: 'Messages', url: '/app/messages' },
        ],
        start_url: '/app',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache ONLY the app shell (JS, CSS, HTML, fonts, images bundled with the app).
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Deliberately NO runtimeCaching: Supabase API calls, auth tokens, and signed file URLs
        // are never stored by the service worker. Private data is cached per-user in IndexedDB instead
        // (and wiped on log out).
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    // Never inline assets as data: URLs. It keeps the Content-Security-Policy strict (font-src 'self') and lets the service worker cache each file.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Separate rarely-changing libraries so app updates do not force users to re-download them.
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], supabase: ['@supabase/supabase-js'], data: ['dexie', 'zod', 'react-hook-form'] },
      },
    },
  },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts', css: false },
})
