import { describe, expect, it, vi } from 'vitest';

import robots from '@/app/robots';

// The sitemap reads the API; the fetch is stubbed so the test covers the URL
// policy rather than the network.
vi.mock('@/lib/api/server', () => ({
  tryPublicApi: async () => ({
    data: {
      posts: [{ slug: 'published-article', updated_at: '2026-08-01T00:00:00Z' }],
      pages: [{ slug: 'about', updated_at: '2026-08-01T00:00:00Z' }],
      products: [{ slug: 'nb-engineering-tools', updated_at: '2026-08-01T00:00:00Z' }],
      courses: [],
    },
  }),
  publicApi: async () => ({ data: [] }),
  sessionApi: async () => ({ data: null }),
}));

const PRIVATE_PATHS = ['/cart', '/checkout', '/account', '/dashboard', '/learn', '/search'];

describe('robots.txt', () => {
  it('disallows every private and query-shaped surface', () => {
    const result = robots();
    const disallow = (Array.isArray(result.rules) ? result.rules[0] : result.rules)?.disallow ?? [];

    for (const path of PRIVATE_PATHS) {
      expect(disallow).toContain(path);
    }
  });

  it('points at the sitemap', () => {
    expect(robots().sitemap).toContain('/sitemap.xml');
  });
});

describe('sitemap.xml', () => {
  it('lists published content and never a private route', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith('/blog/published-article'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/shop/nb-engineering-tools'))).toBe(true);

    for (const path of PRIVATE_PATHS) {
      expect(urls.some((url) => url.includes(path))).toBe(false);
    }
  });

  it('never lists the same URL twice', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    // A CMS page whose slug is also a static route used to appear twice with
    // two different lastModified values.
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('lists both languages for a page', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = (await sitemap()).map((entry) => entry.url);

    // Two different URLs, not a duplicate: the English route is a real page
    // with its own canonical, and omitting it would hide half the site.
    expect(urls.some((url) => url.endsWith('/about'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/en/about'))).toBe(true);
  });
});
