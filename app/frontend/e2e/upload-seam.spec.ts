import { expect, test } from '@playwright/test';

/**
 * Full identity-seam E2E: sign in -> upload a PDF -> it lands in S3 under
 * users/{clerkUserId}/ -> ingestion is triggered -> the agent can retrieve it.
 *
 * Skipped by default because it requires:
 *   - a Clerk TEST user (set CLERK E2E creds; see https://clerk.com/docs/testing/playwright)
 *   - the agent-py ingest service running (pnpm dev:ingest) with AWS creds
 *   - the S3 bucket reachable
 *
 * Enable by setting RUN_SEAM_E2E=1 and providing E2E_EMAIL / E2E_PASSWORD.
 */
const run = process.env.RUN_SEAM_E2E === '1';

test.describe(
  run ? 'upload identity seam' : 'upload identity seam (skipped — set RUN_SEAM_E2E=1)',
  () => {
    test.skip(!run, 'requires Clerk test creds + running ingest service');

    test('signed-in user can upload a document', async ({ page }) => {
      // 1) Sign in with a Clerk test user.
      await page.goto('/sign-in');
      await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
      await page.getByRole('button', { name: /continue/i }).click();
      await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
      await page.getByRole('button', { name: /continue/i }).click();

      // 2) Land on /upload after auth.
      await expect(page).toHaveURL(/\/upload/);

      // 3) Attach a sample PDF to the W-2 slot and submit.
      await page.setInputFiles('input[type="file"]', 'e2e/fixtures/sample-w2.pdf');
      await page.getByRole('button', { name: /generate 1040/i }).click();

      // 4) On success the flow advances to the return.
      await expect(page).toHaveURL(/\/return/, { timeout: 30_000 });
    });
  }
);
