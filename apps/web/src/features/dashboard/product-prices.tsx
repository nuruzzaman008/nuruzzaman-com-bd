'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form';
import { PriceTag } from '@/components/ui/price';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

export type PricedVariant = {
  id: number;
  sku: string;
  name: string;
  credit_amount: number | null;
  device_limit: number | null;
  is_active: boolean;
  price: {
    currency: string;
    amount_minor: number;
    compare_at_minor: number | null;
    offer_ends_at?: string | null;
  } | null;
};

/**
 * Prices for a product's variants - a licence's PC packs, the NB Credit packs -
 * set from the dashboard.
 *
 * A new price never overwrites the old one: the API closes the current price
 * and opens a new row, so every order keeps pointing at what it was charged,
 * and the site shows the change at once. An optional regular price is shown
 * struck through beside it as the price before the discount.
 */
export function ProductPrices({
  productId,
  variants,
}: {
  productId: number;
  variants: PricedVariant[];
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl font-bold text-navy">{bn ? 'দাম' : 'Prices'}</h2>
      <p className="mt-1 text-sm text-muted">
        {bn
          ? 'প্রতিটি licence বা credit pack-এর দাম এখান থেকে বদলান। সংরক্ষণ করলেই সাইটে নতুন দাম দেখায়; পুরোনো দাম মুছে যায় না, history থাকে। নিয়মিত দাম দিলে সেটি কেটে দেখানো হয় (ছাড়)।'
          : 'Change the price of each licence or credit pack here. The site shows a new price as soon as it is saved; the old price is kept as history. A regular price, if given, is shown struck through as a discount.'}
      </p>
      <ul className="mt-4 divide-y divide-line">
        {variants.map((variant) => (
          <PriceRow key={variant.id} productId={productId} variant={variant} bn={bn} />
        ))}
      </ul>
    </Card>
  );
}

const taka = (minor: number | null | undefined) => (minor ? String(minor / 100) : '');

function PriceRow({
  productId,
  variant,
  bn,
}: {
  productId: number;
  variant: PricedVariant;
  bn: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(taka(variant.price?.amount_minor));
  const [regular, setRegular] = useState(taka(variant.price?.compare_at_minor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const detail = variant.credit_amount
    ? `${variant.credit_amount.toLocaleString(bn ? 'bn-BD' : 'en-BD')} NB Credits`
    : variant.device_limit
      ? bn
        ? `${variant.device_limit.toLocaleString('bn-BD')}টি PC`
        : `${variant.device_limit} PC${variant.device_limit === 1 ? '' : 's'}`
      : null;

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await work();
      setNotice(done);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? [
              caught.message,
              ...Object.values(
                (caught as { fields?: Record<string, string[]> }).fields ?? {},
              ).flat(),
            ].join(' ')
          : bn
            ? 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'
            : 'Could not save. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(amount);
    const compare = regular.trim() === '' ? null : Number(regular);

    if (!Number.isInteger(price) || price < 1) {
      setNotice(null);
      setError(
        bn
          ? 'দাম ১ টাকা বা তার বেশি, পূর্ণ সংখ্যায় দিন।'
          : 'Enter the price as a whole number of taka, 1 or more.',
      );

      return;
    }

    if (compare !== null && (!Number.isInteger(compare) || compare <= price)) {
      setNotice(null);
      setError(
        bn
          ? 'নিয়মিত দাম অবশ্যই দামের চেয়ে বেশি হতে হবে।'
          : 'The regular price has to be higher than the price.',
      );

      return;
    }

    void run(
      () =>
        api(`/admin/products/${productId}/variants/${variant.id}/prices`, {
          method: 'POST',
          body: {
            amount_minor: price * 100,
            compare_at_minor: compare === null ? null : compare * 100,
          },
        }),
      bn
        ? 'নতুন দাম সংরক্ষিত হয়েছে — সাইটে এখনই দেখাবে।'
        : 'Saved - the site shows the new price now.',
    );
  }

  function toggle() {
    void run(
      () =>
        api(`/admin/products/${productId}/variants/${variant.id}`, {
          method: 'PATCH',
          body: { is_active: !variant.is_active },
        }),
      variant.is_active
        ? bn
          ? 'বিক্রি বন্ধ করা হয়েছে।'
          : 'Taken off sale.'
        : bn
          ? 'আবার বিক্রি চালু করা হয়েছে।'
          : 'Back on sale.',
    );
  }

  return (
    <li className="py-4" data-sku={variant.sku}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            {variant.name}{' '}
            <span className="font-latin text-xs font-normal text-muted">{variant.sku}</span>
          </p>
          {detail ? <p className="text-sm text-muted">{detail}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <PriceTag
              value={variant.price}
              size="sm"
              unavailableLabel={bn ? 'দাম দেওয়া নেই' : 'No price yet'}
            />
            <Badge tone={variant.is_active ? 'success' : 'neutral'}>
              {variant.is_active
                ? bn
                  ? 'বিক্রি চালু'
                  : 'On sale'
                : bn
                  ? 'বিক্রি বন্ধ'
                  : 'Off sale'}
            </Badge>
          </div>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={toggle}>
          {variant.is_active
            ? bn
              ? 'বিক্রি বন্ধ করুন'
              : 'Take off sale'
            : bn
              ? 'বিক্রি চালু করুন'
              : 'Put on sale'}
        </Button>
      </div>

      <form onSubmit={savePrice} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-navy">
          {bn ? 'দাম (৳)' : 'Price (৳)'}
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={amount}
            disabled={busy}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-36"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          {bn ? 'নিয়মিত দাম (৳, ঐচ্ছিক)' : 'Regular price (৳, optional)'}
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={regular}
            disabled={busy}
            onChange={(event) => setRegular(event.target.value)}
            className="mt-1 w-36"
          />
        </label>
        <Button type="submit" size="sm" disabled={busy}>
          {bn ? 'দাম সংরক্ষণ' : 'Save price'}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-sm text-success">
          {notice}
        </p>
      ) : null}
    </li>
  );
}
