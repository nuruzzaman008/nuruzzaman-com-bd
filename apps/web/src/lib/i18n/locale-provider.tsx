'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo } from 'react';

import { getDictionary, type Dictionary } from './dictionary';
import { DEFAULT_LOCALE, LOCALE_HTML_LANG, localeFromPath, type Locale } from './locale';

/**
 * Locale context for client components.
 *
 * The locale is derived from `usePathname()` rather than passed in as a prop.
 * That matters: the App Router root layout is a persistent shell and does not
 * re-render on client-side navigation, so a locale computed there would be
 * correct exactly once — on the first server render — and stale from the next
 * link click onward. `usePathname()` is reactive, so the header, footer and
 * every other consumer follow the URL.
 */

type LocaleContextValue = { locale: Locale; t: Dictionary };

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: getDictionary(DEFAULT_LOCALE),
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const locale = localeFromPath(pathname);

  const value = useMemo(() => ({ locale, t: getDictionary(locale) }), [locale]);

  /*
    Keep <html lang> in step with the URL.

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
