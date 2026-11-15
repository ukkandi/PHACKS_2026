import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable + fully offline: the whole app (code, fonts, icons) is precached on first visit.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lantern — the Hollow wellbeing network',
        short_name: 'Lantern',
        description: 'One check-in a day. Offline-first, community-owned wellbeing network for the Hollow.',
        start_url: '/resident',
        scope: '/',
        display: 'standalone',
        background_color: '#14110F',
        theme_color: '#14110F',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Any route (/ledger, /resident?…) works offline: serve the app shell.
        navigateFallback: '/index.html',
      },
    }),
  ],
})
