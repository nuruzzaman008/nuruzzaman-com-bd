'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Cart, ProductVariant } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { PriceTag } from '@/components/ui/price';
import { ApiError, api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Variant picker and add-to-cart control.
 *
 * The button only submits a variant id; every price, discount and total is
 * recalculated by the API, so nothing here can influence what is charged.
 */
export function AddToCart({ variants }: { variants: ProductVariant[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<number | null>(
    variants.find((variant) => variant.is_purchasable)?.id ?? variants[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const selected = variants.find((variant) => variant.id === selectedId) ?? null;

  async function addToCart() {
    if (!selected) {
      return;
    }

    setError(null);
    setAdded(false);

    try {
      await api<{ data: Cart }>('/cart/items', {
        method: 'POST',
        body: { variant_id: selected.id, quantity: 1 },
      });

      setAdded(true);
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : t.shop.addFailed,
      );
    }
  }

  if (variants.length === 0) {
    return (
      <Callout tone="info">{t.shop.noVariants}</Callout>
    );
  }

  return (
    <div className="space-y-4">
      {variants.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-semibold text-navy">{t.shop.chooseVariant}</legend>
          <div className="mt-3 space-y-2">
            {variants.map((variant) => (
              <label
                key={variant.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-[--radius-card] border p-3',
                  variant.id === selectedId ? 'border-blue bg-blue-soft' : 'border-line bg-white',
                  !variant.is_purchasable && 'opacity-70',
                )}
              >
                <input
                  type="radio"
                  name="variant"
                  value={variant.id}
                  checked={variant.id === selectedId}
                  onChange={() => setSelectedId(variant.id)}
                  className="mt-1 size-4 text-blue focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue"
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-navy">{variant.name}</span>
                  {variant.description ? (
                    <span className="mt-0.5 block text-xs text-muted">{variant.description}</span>
                  ) : null}
                  <span className="mt-1.5 block">
                    <PriceTag value={variant.price ?? null} size="sm" />
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <PriceTag value={selected?.price ?? null} size="lg" />
      )}

      {selected?.is_purchasable ? (
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={addToCart}
          disabled={isPending}
        >
          {isPending ? t.shop.adding : t.shop.addToCart}
        </Button>
      ) : (
        <Callout tone="info">{t.shop.variantUnpriced}</Callout>
      )}

      <div aria-live="polite">
        {added ? (
          <Callout tone="success" role="status">
            {t.shop.added}{' '}
            <a href="/cart" className="font-semibold underline">
              {t.shop.viewCart}
            </a>
          </Callout>
        ) : null}
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
      </div>
    </div>
  );
}
