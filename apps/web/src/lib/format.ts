import { formatMinor } from '@nuruzzaman/contracts';

import { getDictionary } from '@/lib/i18n/dictionary';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';

/**
 * Number, date and money formatting.
 *
 * Every function takes the locale as its last argument and defaults to Bengali,
 * so the Bengali site keeps Bengali digits and month names while `/en` gets
 * Latin digits and English months. The default is what keeps the signed-in
 * applications - which are Bengali-only by design - unchanged.
 */
const INTL_LOCALE: Record<Locale, string> = { bn: 'bn-BD', en: 'en-US' };

/**
 * A count with its unit word, singular or plural.
 *
 * Bengali uses one form for both, so this only ever changes anything in
 * English - where getting it wrong ("1 minutes read") is immediately visible.
 */
export function counted(
  value: number,
  unit: 'minute' | 'hour' | 'lesson',
  locale: Locale = DEFAULT_LOCALE,
): string {
  const units = getDictionary(locale).units;
  const word = Math.abs(value) === 1 ? units[unit] : units[`${unit}s` as const];

  return `${number(value, locale)} ${word}`;
}

const TIME_ZONE = 'Asia/Dhaka';

/**
 * Prices are stored as integer minor units. A `null` amount is a real state -
 * the owner has not published a price - so it renders as a caller-supplied
 * fallback rather than a fabricated zero.
 */
export function price(
  amountMinor: number | null | undefined,
  currency = 'BDT',
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (amountMinor === null || amountMinor === undefined) {
    return null;
  }

  return formatMinor(amountMinor, currency, INTL_LOCALE[locale]);
}

/** Timestamps are stored in UTC and always displayed in Asia/Dhaka. */
export function date(
  value: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: 'long',
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function dateTime(
  value: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

/** ISO-8601 for <time dateTime> and JSON-LD, which must not be localised. */
export function isoDate(value: string | null | undefined): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function duration(
  seconds: number | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    const tail = mins > 0 ? counted(mins, 'minute', locale) : '';

    return `${counted(hours, 'hour', locale)} ${tail}`.trim();
  }

  return counted(Math.max(1, mins), 'minute', locale);
}

export function minutes(
  value: number | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  return value ? counted(value, 'minute', locale) : null;
}

export function number(value: number, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/**
 * A number with a fixed number of decimals, in the reader's own digits.
 *
 * `toFixed` would print 4.5 as Latin digits on a page whose every other figure
 * is Bengali, which reads as a bug rather than as a rating.
 */
export function decimal(
  value: number,
  digits: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function fileSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) {
    return null;
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
