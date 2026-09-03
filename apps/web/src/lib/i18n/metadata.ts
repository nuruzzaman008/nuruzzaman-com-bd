import type { Metadata } from 'next';

import { absoluteUrl } from '@/lib/env';
import { LOCALE_HREFLANG, LOCALE_OG, localizePath, stripLocale } from './locale';

/**
 * Rewrites Bengali page metadata for its English URL.
 *
 * The English routes reuse the Bengali page implementations, so without this
 * every English page would declare the Bengali URL as its canonical — telling
 * search engines the English page is a duplicate that should not be indexed,
 * which is the opposite of the point of publishing it.
 *
 * It also declares both languages as alternates in each direction, so a
 * crawler that finds one finds the other.
 */
export function englishMetadata(base: Metadata, bengaliPath: string): Metadata {
  const englishPath = localizePath(bengaliPath, 'en');
  const bnPath = stripLocale(bengaliPath);

  return {
    ...base,
    alternates: {
      ...base.alternates,
      canonical: absoluteUrl(englishPath),
      languages: {
        [LOCALE_HREFLANG.bn]: absoluteUrl(bnPath),
        [LOCALE_HREFLANG.en]: absoluteUrl(englishPath),
      },
    },
    openGraph: base.openGraph
      ? { ...base.openGraph, url: absoluteUrl(englishPath), locale: LOCALE_OG.en }
      : undefined,
  };
}

/** The same, for a Bengali page: declares the English alternate beside it. */
export function bengaliAlternates(path: string): Metadata['alternates'] {
  const bnPath = stripLocale(path);

  return {
    canonical: absoluteUrl(bnPath),
    languages: {
      [LOCALE_HREFLANG.bn]: absoluteUrl(bnPath),
      [LOCALE_HREFLANG.en]: absoluteUrl(localizePath(bnPath, 'en')),
    },
  };
}
