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

    await expect(page.getByRole('navigation', { name: 'মোবাইল মেনু' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'মোবাইল মেনু' })).toBeHidden();
  });

  test('the open mobile menu fills the screen', async ({ page }) => {
    /*
      The panel used to live inside the site header, which carries
      `backdrop-blur`. A backdrop-filter makes an element the containing block
      for `position: fixed` descendants, so `top-16 bottom-0` resolved against
      the header's own 64px box: the menu opened as a ~49px strip with every
      link scrolling inside it. It was valid markup and every link was present,
      which is exactly why only a measurement catches it.
    */
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');

    await page.getByRole('button', { name: 'মেনু খুলুন' }).click();

    const panel = page.locator('#mobile-nav-panel');
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.width).toBe(360);
    // Everything below the 64px header.
    expect(box!.height).toBeGreaterThan(700);

    // And the article behind it must not scroll while it is open.
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('hidden');

    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .not.toBe('hidden');
  });
});
