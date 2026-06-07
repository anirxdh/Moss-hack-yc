import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests for the 1040 endpoint logic, upload logic, and API route handlers.
// Node environment (server code + fetch orchestration, not React rendering).
// E2E flows live in Playwright (see playwright.config.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'app/api/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
});
