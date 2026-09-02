import type { MetadataRoute } from 'next';
import type { SitemapFeed } from '@nuruzzaman/contracts';

import { tryPublicApi } from '@/lib/api/server';
import { absoluteUrl } from '@/lib/env';

/**
 * Only genuinely indexable URLs are listed. The API decides what is publishable
 * (a draft article, an unpriced product or a course with no lessons never
 * reaches this feed), so the sitemap cannot advertise a page that 404s or that
 * carries a noindex tag.
 *
 * CMS pages used to be skipped entirely rather than de-duplicated, so any page
 * the owner published that was not also hard-coded in STATIC_ROUTES below never
 * reached the sitemap at all.
 */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/courses', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/engineering-tools', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/shop', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/blog', priority: 0.9, changeFrequency: 'daily' },
  { path: '/resources', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/support', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/support/installation', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/support/activation', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/support/license-recovery', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/support/release-notes', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/support/system-requirements', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/privacy-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/software-eula', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/course-terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/engineering-disclaimer', priority: 0.4, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const feed = await tryPublicApi<{ data: SitemapFeed }>('/site/sitemap', {
    tags: ['sitemap'],
    revalidate: 900,
  });

  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  if (!feed) {
    // The API is unreachable: publish the static routes rather than an empty
    // sitemap, which would tell crawlers the site has nothing in it.
    return entries;
  }

  const dynamic: [keyof SitemapFeed, string, number, MetadataRoute.Sitemap[number]['changeFrequency']][] = [
    ['posts', '/blog', 0.8, 'monthly'],
    ['pages', '', 0.5, 'monthly'],
    ['products', '/shop', 0.8, 'weekly'],
    ['courses', '/courses', 0.8, 'weekly'],
  ];

  // A CMS page whose slug is already a static route above would otherwise be
  // listed twice with two different lastModified values.
  const listed = new Set(entries.map((entry) => entry.url));

  for (const [key, prefix, priority, changeFrequency] of dynamic) {
    for (const item of feed.data[key] ?? []) {
      const url = absoluteUrl(`${prefix}/${item.slug}`);

      if (listed.has(url)) {
        continue;
      }

      listed.add(url);

      entries.push({
        url,
        lastModified: item.updated_at ? new Date(item.updated_at) : now,
        changeFrequency,
        priority,
      });
    }
  }

  return entries;
}
