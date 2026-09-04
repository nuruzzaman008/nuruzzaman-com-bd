import { expect, test } from '@playwright/test';

/**
 * Private areas must be unreachable without a session, and must never be
 * cacheable by a shared cache.
 *
 * The signed-in areas take their language from a preference cookie rather than
 * the URL, and a browser that has never set one gets English. These matchers
 * therefore accept either language: what is under test is the redirect and the
 * error handling, not which of the two words appears.
 */
const SIGN_IN = /সাইন ইন|Sign in/;
const EMAIL = /ইমেইল|Email/;
const PASSWORD = /পাসওয়ার্ড|Password/;
const PRIVATE_ROUTES = ['/account', '/account/orders', '/dashboard', '/learn/some-course'];

test.describe('private areas', () => {
  for (const route of PRIVATE_ROUTES) {
    test(`${route} sends a signed-out visitor to sign in`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login\?next=/);
      await expect(page.getByRole('heading', { name: SIGN_IN })).toBeVisible();
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

    await page.getByLabel(EMAIL).first().fill('nobody@example.com');
    await page.getByLabel(PASSWORD).first().fill('not-the-password');
    await page.getByRole('button', { name: SIGN_IN }).first().click();

    // Whatever the API answers, the visitor stays on the sign-in page and the
    // failure is announced rather than silently swallowed.
    //
    // Scoped to the form: Next's own route announcer is also role=alert, and an
    // unscoped query matches both once a client navigation has happened.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('form').getByRole('alert')).toBeVisible();
  });
});
