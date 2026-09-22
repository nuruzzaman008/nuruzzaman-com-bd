import type { Dictionary } from '@/lib/i18n/dictionary';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "5 min ago" for the bell and the notification page; a date after a week. */
export function relativeTime(
  iso: string | null | undefined,
  t: Dictionary['notifications'],
  locale: string,
  now: number,
): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';

  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return t.justNow;
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} ${t.minutesAgo}`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} ${t.hoursAgo}`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} ${t.daysAgo}`;

  return fullTime(iso, locale);
}

/** Always in Bangladesh time, whatever the browser is set to. */
export function fullTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'bn-BD', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
