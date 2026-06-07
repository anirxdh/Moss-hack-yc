import { expect, test } from '@playwright/test';

// The auth gate is security-critical: every app route must require sign-in,
// and the landing page must stay public so visitors can get in. Runnable
// without any Clerk credentials.
test.describe('auth gate', () => {
  test('landing page is public', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });

  for (const path of ['/upload', '/call', '/return']) {
    test(`${path} redirects to sign-in when signed out`, async ({ page }) => {
      await page.goto(path);
      // Middleware redirectToSignIn() sends us to /sign-in with a return url.
      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page).toHaveURL(new RegExp(`redirect_url=.*${encodeURIComponent(path)}`));
    });
  }
});
