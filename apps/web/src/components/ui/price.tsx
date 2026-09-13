'use client';

import { useSyncExternalStore } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { dateTime, number, price as formatPrice } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/dictionary';
import type { Locale } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/i18n/locale-provider';

export type PriceValue = {
  currency: string;
  amount_minor: number;
  compare_at_minor?: number | null;
  /** When a discounted price stops applying. */
  offer_ends_at?: string | null;
} | null;

/*
  A clock for the offer countdown. It only runs where there is an offer to
  count down - every card on a catalogue page would otherwise tick - and has
  no value on the server, so the server renders the price without a
  countdown and the browser adds it.
*/
const tickEverySecond = (onChange: () => void) => {
  const timer = setInterval(onChange, 1000);

  return () => clearInterval(timer);
};
const noClock = () => () => {};
const nowToTheSecond = () => Math.floor(Date.now() / 1000) * 1000;
const noTimeOnTheServer = () => null;

const INTL_LOCALE: Record<Locale, string> = { bn: 'bn-BD', en: 'en-US' };

function countdown(ms: number, locale: Locale, words: Dictionary['ui']): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const two = new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const clock = [Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((part) => two.format(part))
    .join(':');

  if (days === 0) {
    return clock;
  }

  return `${(days === 1 ? words.offerDayOne : words.offerDays).replace('{count}', number(days, locale))} ${clock}`;
}

/**
 * Prices come from the API in integer minor units. A `null` price is a real
 * state - the owner has not published one - and renders as an honest
 * "contact for price" line rather than a zero. A zero price is a free course
 * and says so in words.
 *
 * An offer that ends counts down to its end, and once it is over the regular
 * price is shown: public pages are cached for a few minutes, and a visitor
 * must never be shown an offer the cart would no longer honour.
 */
export function PriceTag({
  value,
  size = 'md',
  unavailableLabel,
  className,
}: {
  value: PriceValue;
  size?: 'sm' | 'md' | 'lg';
  unavailableLabel?: string;
  className?: string;
}) {
  const { locale, t } = useLocale();

  const endsAt = value?.offer_ends_at ? Date.parse(value.offer_ends_at) : null;
  const discounted = Boolean(
    value?.compare_at_minor && value.compare_at_minor > value.amount_minor,
  );
  const running = discounted && endsAt !== null && !Number.isNaN(endsAt);
  const now = useSyncExternalStore(
    running ? tickEverySecond : noClock,
    nowToTheSecond,
    noTimeOnTheServer,
  );

  if (!value) {
    return (
      <span className={cn('text-sm font-medium text-muted', className)}>
        {unavailableLabel ?? t.ui.priceOnRequest}
      </span>
    );
  }

  const over = running && now !== null && now >= (endsAt as number);
  const amount = over ? (value.compare_at_minor as number) : value.amount_minor;
  const compareMinor = discounted && !over ? (value.compare_at_minor as number) : null;
  const sizeClass = cn(
    size === 'sm' && 'text-base',
    size === 'md' && 'text-xl',
    size === 'lg' && 'text-2xl',
  );

  if (amount === 0) {
    return (
      <span className={cn('inline-flex items-baseline gap-2', className)}>
        <span className={cn('font-bold text-success', sizeClass)}>{t.ui.free}</span>
      </span>
    );
  }

  const percent = compareMinor ? Math.round((1 - amount / compareMinor) * 100) : 0;

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-2', className)}>
      <span className={cn('font-bold text-navy', sizeClass)}>
        {formatPrice(amount, value.currency, locale)}
      </span>
      {compareMinor ? (
        <>
          <span className="text-sm text-muted line-through">
            {formatPrice(compareMinor, value.currency, locale)}
          </span>
          <Badge tone="warning">
            {percent > 0
              ? t.ui.percentOff.replace('{percent}', number(percent, locale))
              : t.ui.discount}
          </Badge>
          {running && now !== null ? (
            <span
              role="timer"
              title={dateTime(value.offer_ends_at, locale) ?? undefined}
              className="basis-full text-sm font-semibold text-danger"
            >
              {t.ui.offerEndsIn.replace(
                '{time}',
                countdown((endsAt as number) - now, locale, t.ui),
              )}
            </span>
          ) : null}
        </>
      ) : null}
    </span>
  );
}
