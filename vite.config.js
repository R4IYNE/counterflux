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
          if (id.includes('node_modules/alpinejs') || id.includes('node_modules/dexie') || id.includes('node_modules/navigo')) {
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
