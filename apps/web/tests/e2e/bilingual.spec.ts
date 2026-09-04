import { expect, test } from '@playwright/test';

/**
 * The English site has to actually be in English.
 *
 * The first version of /en reused the Bengali page components and translated
 * only the header and the footer, so a reader who chose English got an English
 * menu above a Bengali page. These tests hold the line on three things that
 * broke then: the interface text, the links, and the metadata.
 *
 * Article titles and course names stay in the language they were written in and
 * are marked `data-authored`, so they are excluded here rather than asserted
 * against.
 */
const BENGALI = /[ঀ-৿]/;

/** Visible interface text, with authored content and the switcher removed. */
async function interfaceText(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const bengali = /[ঀ-৿]/;
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      const el = node.parentElement;

      if (!text || !bengali.test(text) || !el || el.offsetParent === null) {
        continue;
      }

      if (el.closest('[data-authored]') || el.closest('[data-language-switcher]')) {
        continue;
      }

      found.add(text.slice(0, 60));
    }

    return [...found];
  });
}

const ENGLISH_ROUTES = ['/en', '/en/blog', '/en/courses', '/en/engineering-tools', '/en/shop'];

test.describe('the English site', () => {
  for (const route of ENGLISH_ROUTES) {
    test(`${route} renders its interface in English`, async ({ page }) => {
      await page.goto(route);

      expect(await interfaceText(page)).toEqual([]);
    });
  }

  test('declares itself as English and links to the Bengali original', async ({ page }) => {
    await page.goto('/en/blog');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/blog$/);
    await expect(page.locator('link[hreflang="bn-BD"]')).toHaveAttribute('href', /\/blog$/);
  });

  test('keeps the reader in English when they follow a link', async ({ page }) => {
    await page.goto('/en');

    // Every in-site link on an English page belongs to the English tree, except
    // the signed-in applications, which have no English URLs.
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );

    const strays = hrefs.filter(
      (href) =>
        href !== '/' &&
        !href.startsWith('/en') &&
        !/^\/(account|dashboard|learn|cart|checkout|login|register|forgot-password|reset-password)(\/|$)/.test(
          href,
        ),
    );

    expect(strays).toEqual([]);
  });

  test('the language switcher goes to the same page, not the home page', async ({ page }) => {
    await page.goto('/en/courses');

    // Below md the switcher lives in the mobile menu, so open it if it is there.
    const menuToggle = page.getByRole('button', { name: 'Open menu' });

    if (await menuToggle.isVisible()) {
      await menuToggle.click();
    }

    // At tablet width both the header and the open mobile menu carry one;
    // they point at the same URL, which is what this asserts.
    await page.getByRole('link', { name: 'বাংলা' }).first().click();

    await expect(page).toHaveURL(/\/courses$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  });

  test('the Bengali site is still Bengali', async ({ page }) => {
    await page.goto('/blog');

    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    expect(BENGALI.test(await page.locator('body').innerText())).toBe(true);
  });
});
