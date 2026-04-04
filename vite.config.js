import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
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
