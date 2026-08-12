import { defineConfig } from 'vite';
import { resolve } from 'path';

// Dedicated content-script build:
// - single entry
// - no shared chunks
// - standalone executable output for MV3 content_scripts
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    publicDir: false,
    minify: true,
    rollupOptions: {
      input: {
        content: resolve(import.meta.dirname, 'src/content/content.ts'),
      },
      output: {
        format: 'iife',
        entryFileNames: 'content/content.js',
      },
    },
  },
});
