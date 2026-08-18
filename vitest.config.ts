import { defineConfig } from 'vitest/config';

// Unit tests cover the pure logic modules (site matching, speed
// resolution, statistics helpers, import validators/merge). Chrome APIs are
// not needed — the tested modules never touch chrome.* directly.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
