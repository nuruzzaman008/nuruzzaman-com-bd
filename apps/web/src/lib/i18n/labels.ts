import type { Dictionary } from './dictionary';
import { DEFAULT_LOCALE, type Locale } from './locale';

/**
 * Names for values that arrive from the API as slugs.
 *
 * Course tracks and blog categories are a fixed taxonomy shared with the API,
 * so translating them here is safe in a way translating an article title would
 * not be. On the Bengali site the name the API sends wins - editing a category
 * in the admin must change what a reader sees. On the English site the API has
 * no English name to send, so the dictionary is what renders.
 */
export function taxonomyLabel(
  t: Dictionary,
  slug: string | null | undefined,
  apiName: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const translated = slug
    ? (t.taxonomy as Record<string, string | undefined>)[slug]
    : undefined;

  if (locale === DEFAULT_LOCALE) {
    return apiName ?? translated ?? slug ?? '';
  }

  return translated ?? apiName ?? slug ?? '';
}

/** Course difficulty. Unknown values fall through rather than render blank. */
export function levelLabel(t: Dictionary, level: string): string {
  return (t.level as Record<string, string | undefined>)[level] ?? level;
}

/** Product kind, as shown on a catalogue card. */
export function productTypeLabel(t: Dictionary, type: string): string {
  return (t.productType as Record<string, string | undefined>)[type] ?? type;
}
