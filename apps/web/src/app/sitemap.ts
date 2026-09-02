import type { MetadataRoute } from 'next';
import type { SitemapFeed } from '@nuruzzaman/contracts';

import { tryPublicApi } from '@/lib/api/server';
import { absoluteUrl } from '@/lib/env';

/**
 * Only genuinely indexable URLs are listed. The API decides what is publishable
 * (a draft article, an unpriced product or a course with no lessons never
 * reaches this feed), so the sitemap cannot advertise a page that 404s or that
 * carries a noindex tag.
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

  const dynamic: [keyof SitemapFeed, string, number][] = [
    ['posts', '/blog', 0.8],
    ['pages', '', 0.5],
    ['products', '/shop', 0.8],
    ['courses', '/courses', 0.8],
  ];

  for (const [key, prefix, priority] of dynamic) {
    for (const item of feed.data[key] ?? []) {
      // CMS pages already appear as static routes above; skip the duplicates.
      if (key === 'pages') {
        continue;
      }

      entries.push({
        url: absoluteUrl(`${prefix}/${item.slug}`),
        lastModified: item.updated_at ? new Date(item.updated_at) : now,
        changeFrequency: key === 'posts' ? 'monthly' : 'weekly',
        priority,
      });
    }
  }

  return entries;
}
