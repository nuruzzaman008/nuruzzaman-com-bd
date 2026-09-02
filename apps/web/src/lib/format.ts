import { formatMinor } from '@nuruzzaman/contracts';

const LOCALE = 'bn-BD';
const TIME_ZONE = 'Asia/Dhaka';

/**
 * Prices are stored as integer minor units. A `null` amount is a real state -
 * the owner has not published a price - so it renders as a caller-supplied
 * fallback rather than a fabricated zero.
 */
export function price(amountMinor: number | null | undefined, currency = 'BDT'): string | null {
  if (amountMinor === null || amountMinor === undefined) {
    return null;
  }

  return formatMinor(amountMinor, currency, LOCALE);
}

/** Timestamps are stored in UTC and always displayed in Asia/Dhaka. */
export function date(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'long',
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function dateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

/** ISO-8601 for <time dateTime> and JSON-LD, which must not be localised. */
export function isoDate(value: string | null | undefined): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function duration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${number(hours)} ঘণ্টা ${minutes > 0 ? `${number(minutes)} মিনিট` : ''}`.trim();
  }

  return `${number(Math.max(1, minutes))} মিনিট`;
}

export function minutes(value: number | null | undefined): string | null {
  return value ? `${number(value)} মিনিট` : null;
}

export function number(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
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
