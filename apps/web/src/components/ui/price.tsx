import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { price as formatPrice } from '@/lib/format';

export type PriceValue = {
  currency: string;
  amount_minor: number;
  compare_at_minor?: number | null;
} | null;

/**
 * Prices come from the API in integer minor units. A `null` price is a real
 * state - the owner has not published one - and renders as an honest
 * "contact for price" line rather than a zero.
 */
export function PriceTag({
  value,
  size = 'md',
  unavailableLabel = 'দাম জানতে যোগাযোগ করুন',
  className,
}: {
  value: PriceValue;
  size?: 'sm' | 'md' | 'lg';
  unavailableLabel?: string;
  className?: string;
}) {
  if (!value) {
    return (
      <span className={cn('text-sm font-medium text-muted', className)}>{unavailableLabel}</span>
    );
  }

  const current = formatPrice(value.amount_minor, value.currency);
  const compare =
    value.compare_at_minor && value.compare_at_minor > value.amount_minor
      ? formatPrice(value.compare_at_minor, value.currency)
      : null;

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-2', className)}>
      <span
        className={cn(
          'font-bold text-navy',
          size === 'sm' && 'text-base',
          size === 'md' && 'text-xl',
          size === 'lg' && 'text-2xl',
        )}
      >
        {current}
      </span>
      {compare ? (
        <>
          <span className="text-sm text-muted line-through">{compare}</span>
          <Badge tone="warning">ছাড়</Badge>
        </>
      ) : null}
    </span>
  );
}
