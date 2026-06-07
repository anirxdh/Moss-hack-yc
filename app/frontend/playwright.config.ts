import { defineConfig, devices } from '@playwright/test';

// E2E tests for the auth gate and the document-upload identity seam.
// Point at a running dev server; override with PLAYWRIGHT_BASE_URL (the dev
// server may land on :3001 if :3000 is taken).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
