import { getDictionary } from '@/lib/i18n/dictionary';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';

/**
 * Labels for the status values the API returns.
 *
 * The API sends the machine value (`fulfilled`, `in_review`), which is right for
 * a contract but wrong to show a reader: a page that suddenly prints an English
 * enum name reads as a bug. Every status a reader can actually see is named
 * here, in both languages, and anything unmapped falls back to the raw value
 * rather than to an empty badge.
 */
export type StatusGroup = 'order' | 'enrollment' | 'ticket' | 'activation' | 'content';

/**
 * Looks a status up, falling back to the raw value so nothing renders blank.
 *
 * The raw value is the honest fallback: an unrecognised status is a gap between
 * the front end and the API, and showing it is how that gets noticed.
 */
export function statusLabel(
  group: StatusGroup,
  status: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!status) {
    return '';
  }

  const labels = getDictionary(locale).status[group] as Record<string, string | undefined>;

  return labels[status] ?? status;
}
