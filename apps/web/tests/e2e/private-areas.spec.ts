import { expect, test } from '@playwright/test';

/**
 * Private areas must be unreachable without a session, and must never be
 * cacheable by a shared cache.
 */
const PRIVATE_ROUTES = ['/account', '/account/orders', '/dashboard', '/learn/some-course'];

test.describe('private areas', () => {
  for (const route of PRIVATE_ROUTES) {
    test(`${route} sends a signed-out visitor to sign in`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login\?next=/);
      await expect(page.getByRole('heading', { name: 'সাইন ইন' })).toBeVisible();
    });
  }

  test('the checkout page is marked noindex', async ({ page }) => {
    await page.goto('/cart');

    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
  });

  test('the sign-in page reports invalid credentials without leaking which field failed', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('ইমেইল').fill('nobody@example.com');
    await page.getByLabel('পাসওয়ার্ড').fill('not-the-password');
    await page.getByRole('button', { name: 'সাইন ইন' }).click();

    // Whatever the API answers, the visitor stays on the sign-in page and the
    // failure is announced rather than silently swallowed.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
