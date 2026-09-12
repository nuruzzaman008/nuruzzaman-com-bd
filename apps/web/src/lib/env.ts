/**
 * Public configuration. Everything here is inlined into the browser bundle, so
 * only values that are genuinely public may live in this file.
 */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nuruzzaman.com.bd',
  /** Same-origin in production; Nginx routes /api to Laravel. */
  apiBasePath: process.env.NEXT_PUBLIC_API_BASE ?? '/api/v1',
  ga4Id: process.env.NEXT_PUBLIC_GA4_ID ?? null,
  /*
    Whether to offer Google sign-in. Off unless set, so the button is never
    drawn against an API that has no credentials and would 404 the redirect.
    Baked at build time, like every NEXT_PUBLIC value: turning it on means a
    deploy, not a restart.
  */
  googleLogin: process.env.NEXT_PUBLIC_GOOGLE_LOGIN === '1',
} as const;

export function absoluteUrl(path = '/'): string {
  return new URL(path, publicEnv.siteUrl).toString();
}
