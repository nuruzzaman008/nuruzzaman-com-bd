/**
 * Locale model and URL strategy.
 *
 * THE RULE: for public pages the URL is the single source of truth. Nothing
 * infers language from `Accept-Language`, a cookie or geography — a visitor who
 * arrives on a Bengali URL from search gets the Bengali page, every time.
 *
 *   Bengali (default) : /            /blog/        /courses/
 *   English           : /en/         /en/blog/     /en/courses/
 *
 * Bengali is unprefixed because it is what the site is written in and what its
 * existing URLs are; prefixing them with /bn/ would change every one at once.
 *
 * The signed-in applications (/account, /dashboard, /learn) are deliberately
 * outside this tree. They are not indexed, so a second set of URLs for them
 * would buy nothing and double the surface to keep working.
 */

export const LOCALES = ['bn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'bn';

/** `<html lang>` value. */
export const LOCALE_HTML_LANG: Record<Locale, string> = { bn: 'bn', en: 'en' };

/** Full BCP-47 tags, for hreflang. */
export const LOCALE_HREFLANG: Record<Locale, string> = { bn: 'bn-BD', en: 'en' };

/** Open Graph locale tags. */
export const LOCALE_OG: Record<Locale, string> = { bn: 'bn_BD', en: 'en_US' };

/** Each language named in its own language, so anyone can find their way out. */
export const LOCALE_LABEL: Record<Locale, string> = { bn: 'বাংলা', en: 'English' };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Reads the locale from a path. `/en/anything` is English; everything else is
 * Bengali. Deliberately dumb — no negotiation, no fallback chain.
 */
export function localeFromPath(path: string): Locale {
  return path.split('/').filter(Boolean)[0] === 'en' ? 'en' : 'bn';
}

/** The same page in the other language. `/blog` <-> `/en/blog`. */
export function localizePath(path: string, locale: Locale): string {
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'en') {
    segments.shift();
  }

  const bengali = segments.length === 0 ? '/' : `/${segments.join('/')}`;

  if (locale === 'bn') {
    return bengali;
  }

  return bengali === '/' ? '/en' : `/en${bengali}`;
}

/** Strips the `/en` prefix, giving the path as the Bengali site uses it. */
export function stripLocale(path: string): string {
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'en') {
    segments.shift();
  }

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

/**
 * Paths that are not part of the bilingual public tree.
 *
 * These are signed-in applications: not indexed, so there is nothing for a
 * second URL to earn, and the language switcher hides itself on them.
 */
const PRIVATE_PREFIXES = [
  '/account',
  '/dashboard',
  '/learn',
  '/checkout',
  '/cart',
  // The sign-in screens belong to the same application and have no English
  // URL either, so a link to one is left exactly as it is.
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

export function isPrivatePath(path: string): boolean {
  const clean = stripLocale(path);

  return PRIVATE_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}
