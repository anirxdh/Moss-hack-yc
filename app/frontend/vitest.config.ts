import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests for upload logic + API route handlers. Node environment (these
// exercise server code + fetch orchestration, not React rendering). E2E flows
// live in Playwright (see playwright.config.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
});
