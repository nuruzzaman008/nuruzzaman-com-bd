'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo } from 'react';

import { getDictionary, type Dictionary } from './dictionary';
import {
  DEFAULT_LOCALE,
  LOCALE_HTML_LANG,
  isPrivatePath,
  localeFromPath,
  type Locale,
} from './locale';

/**
 * Locale context for client components.
 *
 * TWO RULES, because there are two applications here.
 *
 * On the public site the locale comes from `usePathname()` rather than a prop.
 * That matters: the App Router root layout is a persistent shell and does not
 * re-render on client-side navigation, so a locale computed there would be
 * correct exactly once — on the first server render — and stale from the next
 * link click onward. `usePathname()` is reactive, so the header, footer and
 * every other consumer follow the URL.
 *
 * Inside the signed-in applications there is no language in the URL, because
 * they are not indexed and a second set of URLs for them would buy nothing.
 * There the language is a preference the layout reads from a cookie and passes
 * down, so an editor's choice sticks from one screen to the next.
 */

type LocaleContextValue = { locale: Locale; t: Dictionary };

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: getDictionary(DEFAULT_LOCALE),
});

export function LocaleProvider({
  children,
  /** Set by the signed-in layouts, which read the preference server-side. */
  locale: override,
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  const pathname = usePathname() || '/';

  // The override only applies where it makes sense. A stale cookie must never
  // decide the language of a public page, whose URL is the whole point.
  const locale = override && isPrivatePath(pathname) ? override : localeFromPath(pathname);

  const value = useMemo(() => ({ locale, t: getDictionary(locale) }), [locale]);

  /*
    Keep <html lang> in step.

    The root layout renders the right `lang` for the first request, which is
    what a crawler and the first paint see. But that element lives in the
    persistent shell, so a client-side language switch cannot re-render it —
    this effect is the only thing that can correct it without a full reload.

    It only ever writes on a later navigation, so it cannot cause a hydration
    mismatch.
  */
  useEffect(() => {
    const next = LOCALE_HTML_LANG[locale];

    if (document.documentElement.lang !== next) {
      document.documentElement.lang = next;
    }
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** The active locale and its dictionary, inside a client component. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
