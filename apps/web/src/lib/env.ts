/**
 * Public configuration. Everything here is inlined into the browser bundle, so
 * only values that are genuinely public may live in this file.
 */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nuruzzaman.com.bd',
  /** Same-origin in production; Nginx routes /api to Laravel. */
  apiBasePath: process.env.NEXT_PUBLIC_API_BASE ?? '/api/v1',
  ga4Id: process.env.NEXT_PUBLIC_GA4_ID ?? null,
} as const;

export function absoluteUrl(path = '/'): string {
  return new URL(path, publicEnv.siteUrl).toString();
}
