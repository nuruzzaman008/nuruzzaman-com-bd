import { isLocale, type Locale } from './locale';

/**
 * The language of the signed-in applications.
 *
 * The public site takes its language from the URL, because a Bengali and an
 * English page are two documents a search engine has to be able to tell apart.
 * The admin panel is nothing of the sort: it is not indexed, nobody shares a
 * link to it expecting a particular language, and an editor wants their own
 * choice to stick from one screen to the next. So it is a preference, not a URL.
 *
 * A cookie rather than localStorage, because the admin pages are server
 * components: they have to know the language before they render, and only a
 * cookie travels with the request. They are already dynamic - every one of them
 * reads the session - so this costs no caching.
 *
 * No `server-only` here: the switcher writes the same cookie from the browser,
 * so both sides need the name and the default to agree.
 */
export const ADMIN_LOCALE_COOKIE = 'nb_admin_locale';

/** English, as the owner asked for. */
export const DEFAULT_ADMIN_LOCALE: Locale = 'en';

/** Reads the preference from a cookie value, however it was obtained. */
export function adminLocaleFrom(value: string | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_ADMIN_LOCALE;
}
