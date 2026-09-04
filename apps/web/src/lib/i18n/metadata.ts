import type { Metadata } from 'next';

import { absoluteUrl } from '@/lib/env';
import { getDictionary, type Dictionary } from './dictionary';
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
/**
 * Routes whose title is interface text rather than authored content, so the
 * dictionary entry for the section applies to every URL under it.
 *
 * Deliberately short. On /blog/<slug> and /courses/<slug> the title IS the
 * article or course name, and replacing that with the section's name would
 * make every English article page claim to be the blog index.
 */
const SECTION_META_PATHS = ['/verify'];

function metaPath(bnPath: string): string {
  return SECTION_META_PATHS.find((prefix) => bnPath.startsWith(`${prefix}/`)) ?? bnPath;
}

export function englishMetadata(base: Metadata, bengaliPath: string): Metadata {
  const englishPath = localizePath(bengaliPath, 'en');
  const bnPath = stripLocale(bengaliPath);

  // Without this the English page would carry the Bengali title into search
  // results. A path with no entry keeps the page's own metadata rather than
  // having a title invented for it.
  const override = getDictionary('en').meta[metaPath(bnPath) as keyof Dictionary['meta']];

  return {
    ...base,
    // Only the page part of the title: the root layout's title template
    // appends the owner's name, and prefixing it here as well put the name
    // at both ends of every English tab.
    ...(override ? { title: override.title, description: override.description } : {}),
    alternates: {
      ...base.alternates,
      canonical: absoluteUrl(englishPath),
      languages: {
        [LOCALE_HREFLANG.bn]: absoluteUrl(bnPath),
        [LOCALE_HREFLANG.en]: absoluteUrl(englishPath),
      },
    },
    openGraph: base.openGraph
      ? {
          ...base.openGraph,
          ...(override ? { title: override.title, description: override.description } : {}),
          url: absoluteUrl(englishPath),
          locale: LOCALE_OG.en,
        }
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
