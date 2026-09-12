'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

type Coupon = {
  id: number;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  minimum_subtotal_minor: number | null;
  max_redemptions: number | null;
  is_active: boolean;
  ends_at: string | null;
  redemptions_count?: number;
};

const field = 'mt-1 block w-full rounded border border-line p-2.5 text-sm';

/**
 * One BDT is a hundred poisha, and the API stores money in poisha - see
 * Money::minor and PricingService, which subtracts discount_value directly
 * when the type is fixed. A percentage is a plain number and must not be
 * multiplied by anything.
 *
 * Getting this backwards is the whole risk of the form: a coupon meant to
 * take 2,000 taka off would take 20 taka off, and nobody would notice until a
 * customer complained.
 */
const POISHA_PER_TAKA = 100;

/** Unambiguous in print: no O/0, no I/1. */
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `NB-${code}`;
}

export function CouponManager() {
  const { locale, t } = useLocale();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [code, setCode] = useState(generateCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api<{ data: { data: Coupon[] } }>('/admin/coupons');
      setCoupons(response.data.data ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.admin.coupons.failed);
    }
  }, [t]);

  useEffect(() => {
    // Awaited inside, so the state lands in a later task rather than during
    // the effect itself - the same shape the support ticket list uses.
    void (async () => {
      await load();
    })();
  }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setError(null);
    setCreated(null);

    const amount = Number(form.get('value'));
    const minimum = Number(form.get('minimum') || 0);
    const maxTotal = String(form.get('max_redemptions') || '').trim();
    const ends = String(form.get('ends_at') || '').trim();

    try {
      await api('/admin/coupons', {
        method: 'POST',
        body: {
          code: String(form.get('code')).toUpperCase(),
          description: String(form.get('description') || '') || null,
          discount_type: type,
          // Percent goes as typed; taka becomes poisha.
          discount_value: type === 'percent' ? amount : Math.round(amount * POISHA_PER_TAKA),
          minimum_subtotal_minor: Math.round(minimum * POISHA_PER_TAKA),
          max_redemptions: maxTotal ? Number(maxTotal) : null,
          max_redemptions_per_user: Number(form.get('max_per_user') || 1),
          ...(ends ? { ends_at: ends } : {}),
          is_active: true,
        },
      });

      setCreated(String(form.get('code')).toUpperCase());
      setCode(generateCode());
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.admin.coupons.failed);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(coupon: Coupon) {
    setError(null);

    try {
      await api(`/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        body: { is_active: !coupon.is_active },
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.admin.coupons.failed);
    }
  }

  function describe(coupon: Coupon): string {
    return coupon.discount_type === 'percent'
      ? `${coupon.discount_value}%`
      : `BDT ${(coupon.discount_value / POISHA_PER_TAKA).toLocaleString(locale)}`;
  }

  return (
    <div className="space-y-8">
      <p className="text-muted">{t.admin.coupons.intro}</p>

      {error ? (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      ) : null}

      {created ? (
        <Callout tone="success" role="status">
          {t.admin.coupons.created} <span className="font-latin font-bold">{created}</span>
        </Callout>
      ) : null}

      <Card className="p-6">
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-navy">
            {t.admin.coupons.code}
            <div className="mt-1 flex gap-2">
              <input
                name="code"
                required
                pattern="[A-Za-z0-9_-]+"
                maxLength={48}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="font-latin block w-full rounded border border-line p-2.5 text-sm"
              />
              <Button type="button" variant="secondary" onClick={() => setCode(generateCode())}>
                {t.admin.coupons.generate}
              </Button>
            </div>
          </label>

          <label className="text-sm font-medium text-navy">
            {t.admin.coupons.description}
            <input name="description" maxLength={255} className={field} />
          </label>

          <label className="text-sm font-medium text-navy">
            {t.admin.coupons.type}
            <select
              name="discount_type"
              value={type}
              onChange={(event) => setType(event.target.value as 'percent' | 'fixed')}
              className={field}
            >
              <option value="percent">{t.admin.coupons.percent}</option>
              <option value="fixed">{t.admin.coupons.fixed}</option>
            </select>
          </label>

          <label className="text-sm font-medium text-navy">
            {type === 'percent' ? t.admin.coupons.percentValue : t.admin.coupons.fixedValue}
            <input
              name="value"
              type="number"
              required
              min={1}
              max={type === 'percent' ? 100 : undefined}
              step={1}
              defaultValue={type === 'percent' ? 10 : 500}
              key={type}
              className={field}
            />
          </label>

          <label className="text-sm font-medium text-navy">
            {t.admin.coupons.minimum}
            <input name="minimum" type="number" min={0} step={1} defaultValue={0} className={field} />
          </label>

          <label className="text-sm font-medium text-navy">
            {t.admin.coupons.maxTotal}
            <input name="max_redemptions" type="number" min={1} step={1} className={field} />
          </label>

          <label className="text-sm font-medium text-navy">
            {t.admin.coupons.maxPerUser}
            <input
              name="max_per_user"
              type="number"
              min={1}
              max={100}
              step={1}
              defaultValue={1}
              className={field}
            />
          </label>

          <label className="text-sm font-medium text-navy">
            {t.admin.coupons.endsAt}
            <input name="ends_at" type="date" className={field} />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? t.admin.coupons.creating : t.admin.coupons.create}
            </Button>
          </div>
        </form>
      </Card>

      <section>
        <h2 className="text-lg font-bold text-navy">{t.admin.coupons.existing}</h2>

        {coupons.length === 0 ? (
          <p className="mt-2 text-muted">{t.admin.coupons.none}</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {coupons.map((coupon) => (
              <Card
                key={coupon.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-latin font-bold text-navy">{coupon.code}</p>
                  <p className="text-sm text-muted">
                    {[
                      describe(coupon),
                      coupon.minimum_subtotal_minor
                        ? `${t.admin.coupons.minimumShort} BDT ${(coupon.minimum_subtotal_minor / POISHA_PER_TAKA).toLocaleString(locale)}`
                        : null,
                      `${coupon.redemptions_count ?? 0}${coupon.max_redemptions ? `/${coupon.max_redemptions}` : ''} ${t.admin.coupons.uses}`,
                      coupon.is_active ? t.admin.coupons.active : t.admin.coupons.inactive,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {coupon.description ? (
                    <p className="mt-1 text-sm">{coupon.description}</p>
                  ) : null}
                </div>

                <Button type="button" variant="secondary" onClick={() => void toggle(coupon)}>
                  {coupon.is_active ? t.admin.coupons.deactivate : t.admin.coupons.activate}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
