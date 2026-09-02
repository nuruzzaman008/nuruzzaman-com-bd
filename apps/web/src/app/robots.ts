import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/env';

/**
 * Anything that is private, per-visitor, or a query-shaped duplicate of content
 * that is already indexed on its own page is disallowed here as well as being
 * marked noindex in its own metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/cart',
          '/checkout',
          '/account',
          '/dashboard',
          '/learn',
          '/login',
          '/register',
          '/reset-password',
          '/search',
          '/api/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
