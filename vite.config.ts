import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Popup HTML entry — outputs to dist/popup/index.html (matches manifest)
        popup: resolve(import.meta.dirname, 'popup/index.html'),
      },
      output: {
        entryFileNames: 'popup/[name]-[hash].js',
        chunkFileNames: 'popup/chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
