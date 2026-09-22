import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import type { SitemapFeed } from '@nuruzzaman/contracts';

import { tryPublicApi } from '@/lib/api/server';
import { absoluteUrl } from '@/lib/env';
import { localizePath } from '@/lib/i18n/locale';
import { isSitePage, pagePathForSlug } from '@/lib/site';

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
const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/courses', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/products', priority: 0.8, changeFrequency: 'weekly' },
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
  /*
    Built when a crawler asks, never during `next build`. The build calls the
    API from GitHub's servers, which the API's per-address limit refuses after
    120 requests a minute; the refused sitemap call was frozen into the deploy
    with only the static routes below, and it was never rebuilt on the server.
    The API response itself is still cached for 15 minutes, and a publish
    refreshes it through the 'sitemap' tag.
  */
  await connection();

  const feed = await tryPublicApi<{ data: SitemapFeed }>('/site/sitemap', {
    tags: ['sitemap'],
    revalidate: 900,
  });

  const now = new Date();

  // Both languages are listed. The English routes are real, indexable pages
  // with their own canonical, so leaving them out would hide half the site.
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) => [
    {
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    },
    {
      url: absoluteUrl(localizePath(route.path, 'en')),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      // Slightly below the Bengali original: the site is written in Bengali and
      // the English pages share its interface rather than its articles.
      priority: Math.max(0.1, route.priority - 0.1),
    },
  ]);

  if (!feed) {
    // The API is unreachable: publish the static routes rather than an empty
    // sitemap, which would tell crawlers the site has nothing in it.
    return entries;
  }

  const dynamic: [
    keyof SitemapFeed,
    string,
    number,
    MetadataRoute.Sitemap[number]['changeFrequency'],
  ][] = [
    ['posts', '/blog', 0.8, 'monthly'],
    ['products', '/products', 0.8, 'weekly'],
    ['courses', '/courses', 0.8, 'weekly'],
    // Attachment pages the owner has not left out; the slug is the file id.
    ['attachments', '/attachment', 0.3, 'yearly'],
  ];

  // A CMS page whose slug is already a static route above would otherwise be
  // listed twice with two different lastModified values.
  const listed = new Set(entries.map((entry) => entry.url));

  for (const page of feed.data.pages ?? []) {
    /*
      One of the site's own pages only moves the date of the fixed route that
      shows it. A nested route has a flat slug (/support/installation reads
      'support-installation'), so the slug itself is not the URL.
    */
    const path = pagePathForSlug(page.slug);

    if (isSitePage(page.slug)) {
      for (const entry of entries) {
        if (
          page.updated_at &&
          (entry.url === absoluteUrl(path) || entry.url === absoluteUrl(localizePath(path, 'en')))
        ) {
          entry.lastModified = new Date(page.updated_at);
        }
      }

      continue;
    }

    // A page the owner added in the dashboard, served at /{slug}.
    const lastModified = page.updated_at ? new Date(page.updated_at) : now;
    entries.push(
      { url: absoluteUrl(path), lastModified, changeFrequency: 'monthly', priority: 0.6 },
      {
        url: absoluteUrl(localizePath(path, 'en')),
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.5,
      },
    );
    listed.add(absoluteUrl(path));
  }

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

      entries.push({
        url: absoluteUrl(localizePath(`${prefix}/${item.slug}`, 'en')),
        lastModified: item.updated_at ? new Date(item.updated_at) : now,
        changeFrequency,
        priority: Math.max(0.1, priority - 0.1),
      });
    }
  }

  return entries;
}
