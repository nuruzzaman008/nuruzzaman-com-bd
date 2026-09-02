'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Cart } from '@nuruzzaman/contracts';

import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { EmptyState, LoadingRegion } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api/browser';
import { price } from '@/lib/format';

/**
 * The cart is authoritative on the server: this view only sends variant ids and
 * quantities, then re-renders whatever totals the API returns.
 */
export function CartView() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await api<{ data: Cart }>('/cart');

        if (!cancelled) {
          setCart(response.data);
        }
      } catch {
        if (!cancelled) {
          setError('কার্ট লোড করা যায়নি।');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function mutate(fn: () => Promise<{ data: Cart }>) {
    setBusy(true);
    setError(null);

    try {
      const response = await fn();
      setCart(response.data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'পরিবর্তন সংরক্ষণ করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingRegion label="কার্ট লোড হচ্ছে" />;
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <EmptyState
        title="আপনার কার্ট খালি"
        description="শপ থেকে একটি পণ্য বা কোর্স যোগ করুন।"
        action={<ButtonLink href="/shop">শপে যান</ButtonLink>}
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}

        {cart.blockers.length > 0 ? (
          <Callout tone="warning" title="চেকআউটের আগে ঠিক করতে হবে" role="alert">
            <ul className="list-disc space-y-1 ps-5">
              {cart.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        <ul className="space-y-4">
          {cart.lines.map((line) => (
            <li key={line.variant_id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-bold text-navy">
                      {line.product_slug ? (
                        <Link href={`/shop/${line.product_slug}`} className="hover:text-blue">
                          {line.product_name ?? line.variant_name}
                        </Link>
                      ) : (
                        (line.product_name ?? line.variant_name)
                      )}
                    </h2>
                    <p className="mt-1 text-sm text-muted">{line.variant_name}</p>
                    <p className="font-latin mt-1 text-xs text-muted">{line.sku}</p>

                    {line.unavailable_reason ? (
                      <p className="mt-2 text-sm font-medium text-danger">
                        {line.unavailable_reason}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-end">
                    <p className="font-bold text-navy">
                      {price(line.line_total_minor, cart.currency)}
                    </p>
                    {line.unit_price_minor !== null && line.quantity > 1 ? (
                      <p className="text-xs text-muted">
                        {price(line.unit_price_minor, cart.currency)} × {line.quantity}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-sm text-muted" htmlFor={`qty-${line.variant_id}`}>
                    পরিমাণ
                  </label>
                  <input
                    id={`qty-${line.variant_id}`}
                    type="number"
                    min={1}
                    max={99}
                    defaultValue={line.quantity}
                    disabled={busy}
                    onBlur={(event) => {
                      const quantity = Number(event.target.value);

                      if (quantity !== line.quantity) {
                        void mutate(() =>
                          api<{ data: Cart }>(`/cart/items/${line.variant_id}`, {
                            method: 'PATCH',
                            body: { quantity },
                          }),
                        );
                      }
                    }}
                    className="h-11 w-20 rounded-lg border border-line px-3 text-sm"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void mutate(() =>
                        api<{ data: Cart }>(`/cart/items/${line.variant_id}`, {
                          method: 'DELETE',
                        }),
                      )
                    }
                  >
                    সরান
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-6">
          <h2 className="font-bold text-navy">সারসংক্ষেপ</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">সাবটোটাল</dt>
              <dd>{price(cart.subtotal_minor, cart.currency)}</dd>
            </div>
            {cart.discount_minor > 0 ? (
              <div className="flex justify-between text-success">
                <dt>ছাড়{cart.coupon_code ? ` (${cart.coupon_code})` : ''}</dt>
                <dd>-{price(cart.discount_minor, cart.currency)}</dd>
              </div>
            ) : null}
            {cart.tax_minor > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">কর</dt>
                <dd>{price(cart.tax_minor, cart.currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold text-navy">
              <dt>সর্বমোট</dt>
              <dd>{price(cart.total_minor, cart.currency)}</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-line pt-5">
            <label htmlFor="coupon" className="text-sm font-semibold text-navy">
              কুপন কোড
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="coupon"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                className="h-11 w-full rounded-lg border border-line px-3 text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!couponCode || busy}
                onClick={() =>
                  void mutate(() =>
                    api<{ data: Cart }>('/cart/coupon', {
                      method: 'POST',
                      body: { code: couponCode },
                    }),
                  )
                }
              >
                প্রয়োগ
              </Button>
            </div>
            {cart.coupon_error ? (
              <p className="mt-2 text-sm text-danger">{cart.coupon_error}</p>
            ) : null}
          </div>

          <div className="mt-6">
            <ButtonLink
              href="/checkout"
              size="lg"
              className={cart.is_purchasable ? 'w-full' : 'pointer-events-none w-full opacity-50'}
              aria-disabled={!cart.is_purchasable}
            >
              চেকআউটে যান
            </ButtonLink>
          </div>
        </Card>
      </aside>
    </div>
  );
}
