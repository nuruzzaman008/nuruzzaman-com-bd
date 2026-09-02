import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The public reading journey, plus the accessibility and SEO guarantees that
 * are easiest to regress silently.
 */
test.describe('public pages', () => {
  test('home page renders the brand promise and the primary navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('প্রকৌশল শিখুন');
    await expect(page.getByRole('link', { name: 'ব্লগ' }).first()).toBeVisible();
  });

  test('a visitor can reach an article from the blog index', async ({ page }) => {
    await page.goto('/blog');

    const firstArticle = page.getByRole('heading', { level: 3 }).first();
    await expect(firstArticle).toBeVisible();

    await firstArticle.getByRole('link').click();
    await expect(page).toHaveURL(/\/blog\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('an article carries BlogPosting structured data that matches the page', async ({ page }) => {
    await page.goto('/blog');

    // Load the article directly rather than following the link: a crawler sees
    // the server-rendered document, not a client-side navigation.
    const href = await page
      .getByRole('heading', { level: 3 })
      .first()
      .getByRole('link')
      .getAttribute('href');

    expect(href).toBeTruthy();
    await page.goto(href as string);

    const heading = await page.getByRole('heading', { level: 1 }).textContent();
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const blogPosting = scripts
      .map((raw) => JSON.parse(raw) as Record<string, unknown>)
      .find((entry) => entry['@type'] === 'BlogPosting');

    expect(blogPosting).toBeTruthy();
    expect(blogPosting?.headline).toBe(heading?.trim());
  });

  test('a product without a published price never shows a zero price', async ({ page }) => {
    await page.goto('/engineering-tools');

    await expect(page.getByText('দাম জানতে যোগাযোগ করুন').first()).toBeVisible();
    await expect(page.getByText('০.০০৳')).toHaveCount(0);
  });

  test('a legal page shows the draft notice until it has been reviewed', async ({ page }) => {
    await page.goto('/terms');

    await expect(page.getByText('DRAFT — PROFESSIONAL REVIEW REQUIRED')).toBeVisible();
  });

  test('the skip link is the first focusable control', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    await expect(page.getByRole('link', { name: 'মূল কনটেন্টে যান' })).toBeFocused();
  });

  test('the home page has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('robots.txt keeps private areas out of the index', async ({ request }) => {
    const response = await request.get('/robots.txt');
    const body = await response.text();

    for (const path of ['/cart', '/checkout', '/account', '/dashboard', '/learn', '/search']) {
      expect(body).toContain(`Disallow: ${path}`);
    }
  });

  test('the sitemap lists published content only', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    const body = await response.text();

    expect(body).toContain('<loc>');
    expect(body).not.toContain('/account');
    expect(body).not.toContain('/dashboard');
  });
});
