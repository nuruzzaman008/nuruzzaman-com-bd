import { expect, test } from '@playwright/test';

/**
 * Reader comments and star ratings on an article.
 *
 * The point being defended here is the honest one: a signed-out reader is told
 * plainly that commenting needs an account rather than being given a form that
 * will fail, and nothing unapproved reaches the page - not the list, not the
 * count, and not the structured data a search engine reads.
 */
const ARTICLE = '/blog/bnbc-load-combination-notes';

test.describe('article comments', () => {
  test('a signed-out reader is asked to sign in rather than given a dead form', async ({
    page,
  }) => {
    await page.goto(ARTICLE);

    const comments = page.getByRole('region', { name: /পাঠকের মন্তব্য|Reader comments/ });
    await expect(comments).toBeVisible();

    await expect(
      comments.getByText(/মন্তব্য করতে সাইন ইন করুন|Sign in to comment/),
    ).toBeVisible();
    await expect(comments.locator('textarea[name="body"]')).toHaveCount(0);
  });

  test('the comment count and rating on the page match the structured data', async ({ page }) => {
    await page.goto(ARTICLE);

    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const article = scripts
      .map((raw) => JSON.parse(raw) as Record<string, unknown>)
      .find((entry) => entry['@type'] === 'BlogPosting');

    expect(article).toBeTruthy();

    const rendered = await page.locator('#comments-heading + * , #comments-heading').count();
    expect(rendered).toBeGreaterThan(0);

    const listed = await page
      .getByRole('region', { name: /পাঠকের মন্তব্য|Reader comments/ })
      .locator('ul > li')
      .count();

    // `commentCount` is absent rather than zero when there are none, so that the
    // markup never asserts something the page does not show.
    expect(article?.commentCount ?? 0).toBe(listed);

    // Google does not support review snippets on an Article, so a rating is
    // shown to readers but never claimed in the markup.
    expect(article).not.toHaveProperty('aggregateRating');
  });

  test('every rating on the page is readable as a number, not only as shapes', async ({ page }) => {
    await page.goto(ARTICLE);

    // Five outlines and three fills is not something a screen reader conveys,
    // so each star group carries an accessible sentence beside it. One per
    // group, always - a group without one would be a rating nobody could read.
    const groups = await page.locator('[data-star-rating]').count();
    const readable = await page.getByText(/৫-এর মধ্যে|out of 5/).count();

    expect(readable).toBe(groups);
  });
});
