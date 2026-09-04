'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Order } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { price } from '@/lib/format';

/**
 * Manual order actions.
 *
 * Both forms go through domain services on the server: the state machine
 * refuses an illegal transition, and a refund is requested here but must be
 * approved separately, so no single click moves money.
 */
export function OrderActions({ order }: { order: Order }) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'danger'>('success');

  const remaining = order.total_minor - order.refunded_minor;

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);

    try {
      await fn();
      setTone('success');
      setMessage(success);
      router.refresh();
    } catch (caught) {
      setTone('danger');
      setMessage(
        caught instanceof ApiError ? caught.message : t.admin.orderActions.failed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <Callout tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
          {message}
        </Callout>
      ) : null}

      <Card className="p-5">
        <h2 className="font-bold text-navy">{t.admin.orderActions.changeStatus}</h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);

            void run(
              () =>
                api(`/admin/orders/${order.number}/transition`, {
                  method: 'POST',
                  body: { status: form.get('status'), reason: form.get('reason') },
                }),
              t.admin.orderActions.statusChanged,
            );
          }}
        >
          <Field label={t.admin.orderActions.newStatus} required>
            {(props) => (
              <Select name="status" {...props}>
                <option value="paid">paid</option>
                <option value="fulfilled">fulfilled</option>
                <option value="cancelled">cancelled</option>
                <option value="failed">failed</option>
              </Select>
            )}
          </Field>

          <Field
            label={t.admin.orderActions.reason}
            required
            hint={t.admin.orderActions.reasonHint}
          >
            {(props) => <Input name="reason" {...props} />}
          </Field>

          <Button type="submit" variant="secondary" disabled={busy}>
            {t.admin.orderActions.change}
          </Button>
        </form>
      </Card>

      {remaining > 0 ? (
        <Card className="p-5">
          <h2 className="font-bold text-navy">{t.admin.orderActions.refundRequest}</h2>
          <p className="mt-1 text-sm text-muted">
            {t.admin.orderActions.refundCeiling.replace(
              '{amount}',
              price(remaining, order.currency, locale) ?? '',
            )}
          </p>

          <form
            className="mt-3 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);

              void run(
                () =>
                  api(`/admin/orders/${order.number}/refunds`, {
                    method: 'POST',
                    body: {
                      amount_minor: Number(form.get('amount_minor')),
                      reason: form.get('reason'),
                      revoke_entitlements: form.get('revoke_entitlements') === 'yes',
                    },
                  }),
                t.admin.orderActions.refundCreated,
              );
            }}
          >
            <Field
              label={t.admin.orderActions.amountLabel}
              required
              hint={t.admin.orderActions.amountHint}
            >
              {(props) => (
                <Input
                  name="amount_minor"
                  type="number"
                  min={1}
                  max={remaining}
                  defaultValue={remaining}
                  className="font-latin"
                  {...props}
                />
              )}
            </Field>

            <Field label={t.admin.orderActions.reason} required>
              {(props) => <Textarea name="reason" {...props} />}
            </Field>

            <Field label={t.admin.orderActions.revokeLabel} required>
              {(props) => (
                <Select name="revoke_entitlements" defaultValue="yes" {...props}>
                  <option value="yes">{t.admin.orderActions.revokeYes}</option>
                  <option value="no">{t.admin.orderActions.revokeNo}</option>
                </Select>
              )}
            </Field>

            <Button type="submit" variant="danger" disabled={busy}>
              {t.admin.orderActions.requestRefund}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
