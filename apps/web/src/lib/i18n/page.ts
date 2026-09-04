import { getDictionary, type Dictionary } from './dictionary';
import { DEFAULT_LOCALE, type Locale } from './locale';

/**
 * Locale plumbing for server-rendered pages.
 *
 * Server components cannot read the URL the way `useLocale()` does, and reading
 * a request header instead would opt every public page out of static rendering
 * — a real cost for pages that are otherwise prerendered.
 *
 * So the locale is passed in explicitly: the English routes under /en render the
 * same page component with `locale="en"`, and everything else gets the default.
 * The page stays static in both languages.
 */
export type LocalizedPageProps = {
  /** Set by the /en wrapper; absent on the Bengali routes. */
  locale?: Locale;
};

/** The dictionary for a page, defaulting to Bengali. */
export function pageDictionary(locale: Locale | undefined): {
  locale: Locale;
  t: Dictionary;
} {
  const active = locale ?? DEFAULT_LOCALE;

  return { locale: active, t: getDictionary(active) };
}
