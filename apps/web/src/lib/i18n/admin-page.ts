import 'server-only';

import { cookies } from 'next/headers';

import type { Dictionary } from './dictionary';
import { ADMIN_LOCALE_COOKIE, adminLocaleFrom } from './admin-locale';
import type { Locale } from './locale';
import { pageDictionary } from './page';

/**
 * The dictionary for an admin screen, in the language the editor chose.
 *
 * Every admin page is a server component that already reads the session, so it
 * is dynamic either way and reading a cookie here costs nothing. The public
 * pages must not use this: their language is the URL, and a cookie deciding it
 * would let one visitor's preference be cached and served to the next.
 */
export async function adminDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = adminLocaleFrom((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

  return pageDictionary(locale);
}
