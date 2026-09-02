import { expect, test } from '@playwright/test';

/**
 * The layout has to hold at the three widths the design targets, and the page
 * body must never scroll sideways.
 */
const WIDTHS = [360, 768, 1440];

test.describe('responsive layout', () => {
  for (const width of WIDTHS) {
    test(`home page has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('the mobile menu opens and closes with the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'মেনু খুলুন' });
    await toggle.click();

    await expect(page.getByRole('navigation', { name: 'মোবাইল নেভিগেশন' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'মোবাইল নেভিগেশন' })).toBeHidden();
  });
});
