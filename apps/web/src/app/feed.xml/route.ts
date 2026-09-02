import type { PostSummary } from '@nuruzzaman/contracts';

import { tryPublicApi } from '@/lib/api/server';
import { absoluteUrl } from '@/lib/env';
import { brand } from '@/lib/site';

/**
 * RSS 2.0 feed of published articles.
 *
 * Only the excerpt is syndicated, never the body: the worked calculations carry
 * assumptions and limitations that sit around them on the page, and an excerpt
 * in a reader cannot be mistaken for a complete method.
 */
export const revalidate = 900;

/** Escapes the five XML entities. Feed text comes from the CMS, not from users. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(): Promise<Response> {
  const feed = await tryPublicApi<{ data: PostSummary[] }>('/posts?per_page=30', {
    tags: ['posts'],
    revalidate: 900,
  });

  const posts = feed?.data ?? [];
  const updated = posts[0]?.published_at ?? new Date().toISOString();

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);

      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        post.published_at
          ? `      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>`
          : '',
        post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : '',
        post.author?.name ? `      <dc:creator>${escapeXml(post.author.name)}</dc:creator>` : '',
        ...(post.categories ?? []).map(
          (category) => `      <category>${escapeXml(category.name)}</category>`,
        ),
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(brand.owner)}</title>`,
    `    <link>${absoluteUrl('/blog')}</link>`,
    `    <description>${escapeXml(brand.heroSupport)}</description>`,
    '    <language>bn-BD</language>',
    `    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${absoluteUrl('/feed.xml')}" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
