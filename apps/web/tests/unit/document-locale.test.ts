import { describe, expect, it } from 'vitest';

import {
  LOCALE_HTML_LANG,
  documentLocale,
  isPrivatePath,
  localeFromPath,
} from '@/lib/i18n/locale';

/*
 * `<html lang>` for the first server render.
 *
 * The root layout renders the only <html> on the site and had no way to see
 * the path, so it declared `bn` on English pages too. These lock the rule it
 * now uses, and that the rule is the same one LocaleProvider applies on the
 * client - if the two ever diverge, the attribute would change on the first
 * navigation for no reason a reader could see.
 */
describe('documentLocale', () => {
  it.each([
    ['/', 'bn'],
    ['/blog', 'bn'],
    ['/courses/foundation-geotechnical', 'bn'],
    ['/en', 'en'],
    ['/en/blog', 'en'],
    ['/en/courses/foundation-geotechnical', 'en'],
  ])('takes %s from the URL, giving %s', (path, expected) => {
    // The admin preference is deliberately the opposite of the answer, to show
    // a stale cookie cannot decide a public page's language.
    expect(documentLocale(path, expected === 'en' ? 'bn' : 'en')).toBe(expected);
  });

  it.each([
    ['/account', 'en'],
    ['/account/courses', 'en'],
    ['/dashboard', 'bn'],
    ['/learn/some-course', 'bn'],
    ['/login', 'en'],
    ['/nb-staff', 'en'],
    ['/nb-staff', 'bn'],
    ['/checkout', 'bn'],
  ])('takes %s from the signed-in preference, giving %s', (path, preference) => {
    expect(documentLocale(path, preference as 'bn' | 'en')).toBe(preference);
  });

  it('agrees with the rule LocaleProvider applies on the client', () => {
    const paths = [
      '/',
      '/blog',
      '/en',
      '/en/blog',
      '/account',
      '/account/courses',
      '/dashboard',
      '/login',
      '/en/account',
    ];

    for (const path of paths) {
      for (const preference of ['bn', 'en'] as const) {
        // Copied from locale-provider.tsx, which computes it from usePathname.
        const clientSide = preference && isPrivatePath(path) ? preference : localeFromPath(path);

        expect(documentLocale(path, preference), path).toBe(clientSide);
      }
    }
  });

  it('falls back to Bengali when no path reaches the layout', () => {
    // The layout defaults to '/' when the proxy header is absent, so a request
    // that somehow bypasses proxy.ts renders the site's own language rather
    // than throwing.
    expect(documentLocale('/', 'bn')).toBe('bn');
    expect(LOCALE_HTML_LANG[documentLocale('/', 'bn')]).toBe('bn');
  });

  it('maps both locales to a lang attribute value', () => {
    expect(LOCALE_HTML_LANG[documentLocale('/en', 'bn')]).toBe('en');
    expect(LOCALE_HTML_LANG[documentLocale('/', 'en')]).toBe('bn');
  });
});
