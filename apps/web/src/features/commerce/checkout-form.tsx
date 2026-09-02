'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Cart, CheckoutResult, User } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, ErrorSummary, Field, Input } from '@/components/ui/form';
import { EmptyState, LoadingRegion } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api/browser';
import { price } from '@/lib/format';

/**
 * Checkout.
 *
 * Only billing details and the policy acceptances are submitted: the order
 * total is recalculated by the API from the stored cart. An Idempotency-Key is
 * generated once per attempt so a double submit or a retry after a dropped
 * connection cannot create two orders.
 */
export function CheckoutForm() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => `checkout-${crypto.randomUUID()}`);

  useEffect(() => {
    void (async () => {
      try {
        const [cartResponse, meResponse] = await Promise.all([
          api<{ data: Cart }>('/cart'),
          api<{ data: User }>('/me'),
        ]);

        setCart(cartResponse.data);
        setUser(meResponse.data);
      } catch (caught) {
        if (caught instanceof ApiError && caught.isUnauthenticated) {
          router.replace('/login?next=/checkout');

          return;
        }

        setMessage('চেকআউটের তথ্য লোড করা যায়নি।');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const response = await api<{ data: CheckoutResult }>('/checkout', {
        method: 'POST',
        idempotencyKey,
        body: {
          name: form.get('name'),
          email: form.get('email'),
          phone: form.get('phone') || null,
          accepts_terms: form.get('accepts_terms') === 'on',
          accepts_privacy: form.get('accepts_privacy') === 'on',
          accepts_refund_policy: form.get('accepts_refund_policy') === 'on',
          accepts_eula: form.get('accepts_eula') === 'on',
        },
      });

      // The gateway hosts the payment page; card details never touch this site.
      window.location.href = response.data.redirect_url;
    } catch (caught) {
      setBusy(false);

      if (caught instanceof ApiError) {
        setErrors(caught.fields);

        if (!caught.isValidation) {
          setMessage(caught.message);
        }
      } else {
        setMessage('চেকআউট শুরু করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      }
    }
  }

  if (loading) {
    return <LoadingRegion label="চেকআউট লোড হচ্ছে" />;
  }

  if (!cart || cart.lines.length === 0) {
    return <EmptyState title="কার্ট খালি" description="চেকআউটের আগে কার্টে কিছু যোগ করুন।" />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <ErrorSummary errors={errors} />

        {message ? (
          <Callout tone="danger" role="alert">
            {message}
          </Callout>
        ) : null}

        {!cart.is_purchasable ? (
          <Callout tone="warning" title="এই কার্ট এখন চেকআউট করা যাবে না" role="alert">
            <ul className="list-disc space-y-1 ps-5">
              {cart.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        <fieldset className="space-y-5">
          <legend className="text-lg font-bold text-navy">বিলিং তথ্য</legend>
          <p className="text-sm text-muted">
            সব পণ্য ডিজিটাল, তাই কোনো ঠিকানা বা শিপিং তথ্য নেওয়া হয় না।
          </p>

          <Field label="নাম" required error={errors.name?.[0]}>
            {(props) => (
              <Input name="name" defaultValue={user?.name ?? ''} autoComplete="name" {...props} />
            )}
          </Field>

          <Field label="ইমেইল" required error={errors.email?.[0]}>
            {(props) => (
              <Input
                name="email"
                type="email"
                defaultValue={user?.email ?? ''}
                autoComplete="email"
                {...props}
              />
            )}
          </Field>

          <Field label="ফোন (ঐচ্ছিক)" error={errors.phone?.[0]}>
            {(props) => (
              <Input name="phone" type="tel" defaultValue={user?.phone ?? ''} {...props} />
            )}
          </Field>
        </fieldset>

        <fieldset className="space-y-3 border-t border-line pt-5">
          <legend className="text-lg font-bold text-navy">সম্মতি</legend>

          <Checkbox
            name="accepts_terms"
            error={errors.accepts_terms?.[0]}
            label={
              <>
                আমি{' '}
                <Link href="/terms" className="text-blue underline">
                  ব্যবহারের শর্তাবলি
                </Link>{' '}
                মেনে নিচ্ছি।
              </>
            }
          />
          <Checkbox
            name="accepts_privacy"
            error={errors.accepts_privacy?.[0]}
            label={
              <>
                আমি{' '}
                <Link href="/privacy-policy" className="text-blue underline">
                  গোপনীয়তা নীতি
                </Link>{' '}
                পড়েছি।
              </>
            }
          />
          <Checkbox
            name="accepts_refund_policy"
            error={errors.accepts_refund_policy?.[0]}
            label={
              <>
                আমি{' '}
                <Link href="/refund-policy" className="text-blue underline">
                  রিফান্ড নীতি
                </Link>{' '}
                মেনে নিচ্ছি।
              </>
            }
          />
          <Checkbox
            name="accepts_eula"
            label={
              <>
                সফটওয়্যার কিনলে আমি{' '}
                <Link href="/software-eula" className="text-blue underline">
                  EULA
                </Link>{' '}
                মেনে নিচ্ছি।
              </>
            }
          />
        </fieldset>

        <Button type="submit" size="lg" disabled={busy || !cart.is_purchasable}>
          {busy ? 'পেমেন্ট পেজে নেওয়া হচ্ছে…' : 'পেমেন্টে যান'}
        </Button>
      </form>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-6">
          <h2 className="font-bold text-navy">অর্ডার সারসংক্ষেপ</h2>

          <ul className="mt-4 space-y-3 text-sm">
            {cart.lines.map((line) => (
              <li key={line.variant_id} className="flex justify-between gap-3">
                <span>
                  {line.product_name ?? line.variant_name}
                  <span className="block text-xs text-muted">
                    {line.variant_name} × {line.quantity}
                  </span>
                </span>
                <span className="shrink-0">{price(line.line_total_minor, cart.currency)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">সাবটোটাল</dt>
              <dd>{price(cart.subtotal_minor, cart.currency)}</dd>
            </div>
            {cart.discount_minor > 0 ? (
              <div className="flex justify-between text-success">
                <dt>ছাড়</dt>
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

          <p className="mt-5 text-xs text-muted">
            পেমেন্ট SSLCOMMERZ-এর hosted page-এ সম্পন্ন হয়। কার্ডের তথ্য এই সাইটে আসে না বা
            সংরক্ষণ করা হয় না।
          </p>
        </Card>
      </aside>
    </div>
  );
}
