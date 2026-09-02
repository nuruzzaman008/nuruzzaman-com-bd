/**
 * Money helpers. Amounts cross the wire as integer minor units
 * (1 BDT = 100 poisha) and are only turned into text at the edge.
 */

export type MoneyLike = {
  currency: string;
  amount_minor: number;
  compare_at_minor?: number | null;
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let existing = FORMATTERS.get(key);

  if (!existing) {
    existing = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    });
    FORMATTERS.set(key, existing);
  }

  return existing;
}

/**
 * Formats an integer minor amount. `null` is a real state - the owner has not
 * published a price - so callers must render their own "contact for price"
 * copy rather than receiving a fabricated zero.
 */
export function formatMinor(
  amountMinor: number,
  currency = 'BDT',
  locale = 'bn-BD',
): string {
  return formatter(currency, locale).format(amountMinor / 100);
}

export function formatMoney(money: MoneyLike | null | undefined, locale = 'bn-BD'): string | null {
  if (!money) {
    return null;
  }

  return formatMinor(money.amount_minor, money.currency, locale);
}

export function hasDiscount(money: MoneyLike | null | undefined): boolean {
  return Boolean(money?.compare_at_minor && money.compare_at_minor > money.amount_minor);
}

export function discountPercent(money: MoneyLike): number | null {
  if (!hasDiscount(money) || !money.compare_at_minor) {
    return null;
  }

  return Math.round(((money.compare_at_minor - money.amount_minor) / money.compare_at_minor) * 100);
}
