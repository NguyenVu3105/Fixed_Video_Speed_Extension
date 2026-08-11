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
        // Background service worker
        background: resolve(import.meta.dirname, 'src/background/background.ts'),
        // Content script
        content: resolve(import.meta.dirname, 'src/content/content.ts'),
      },
      output: {
        // Route each entry to its correct folder in dist/
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background/background.js';
          if (chunk.name === 'content') return 'content/content.js';
          return 'popup/[name]-[hash].js';
        },
        chunkFileNames: 'popup/chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
