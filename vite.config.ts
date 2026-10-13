import { defineConfig } from 'vitest/config';

// base './' so the built game works from any subpath (GitHub Pages, itch.io).
export default defineConfig({
  base: './',
  test: { include: ['tests/**/*.test.ts'] },
});
