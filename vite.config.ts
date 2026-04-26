import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// IMPORTANT: When deploying to GitHub Pages at https://<user>.github.io/<repo>/
// the `base` MUST match `/<repo>/` exactly (with leading + trailing slash).
// Mismatch = every asset 404s on first load. Set this once you confirm the repo name.
// Set to match your GitHub repo name exactly.
// Repo: github.com/LiamTestApps/RecipeApp  →  base must be '/RecipeApp/'
const GITHUB_REPO_NAME = 'RecipeApp';

export default defineConfig({
  base: `/${GITHUB_REPO_NAME}/`,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' = show the user an "Update available — reload" toast.
      // Spec 4.2 requires this behaviour.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'My Recipe Book',
        short_name: 'Recipes',
        description: 'A personal recipe book that works offline.',
        theme_color: '#5b6a4d', // sage-700-ish
        background_color: '#fafaf9', // stone-50
        display: 'standalone',
        orientation: 'portrait',
        // start_url is relative so the app installs correctly on any base path
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        // Cache-First for static assets (JS, CSS, fonts, images).
        // Network-First fallback for navigation handled by navigateFallback.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Spec 4.2: Gemini API call is never cached.
            urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*$/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
