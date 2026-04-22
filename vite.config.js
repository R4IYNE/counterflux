import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      '/api/edhrec': {
        target: 'https://json.edhrec.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/edhrec/, ''),
      },
      '/api/spellbook': {
        target: 'https://backend.commanderspellbook.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spellbook/, ''),
      },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Phase 13 Plan 5 (D-10) — bundle splitting.
          // Third-party CSS that costs the most in main bundle:
          //   - mana-font (~99 KB raw, ~20 KB gz)   → only needed when mana symbols render
          //   - keyrune (set-icon CSS)              → only needed on set/printing pickers
          //   - material-symbols (Google icons)     → used broadly but still separable
          // Splitting these into dedicated chunks:
          //   (a) shrinks the critical-path main CSS
          //   (b) gives per-lib cache granularity (user-agnostic churn)
          //   (c) pairs with Task 2's vite:preloadError handler + Pitfall 15
          //       so stale-chunk sessions recover on the next dynamic import.
          if (id.includes('node_modules/mana-font')) return 'mana-font';
          if (id.includes('node_modules/keyrune')) return 'keyrune';
          if (id.includes('node_modules/material-symbols')) return 'material-symbols';
          if (
            id.includes('node_modules/alpinejs') ||
            id.includes('node_modules/dexie') ||
            id.includes('node_modules/navigo')
          ) {
            return 'vendor';
          }
        }
      }
    }
  },
  worker: {
    format: 'es'
  }
});
