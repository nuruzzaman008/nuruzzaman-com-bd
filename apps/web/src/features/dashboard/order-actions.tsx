'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Order } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { price } from '@/lib/format';

/**
 * Manual order actions.
 *
 * Both forms go through domain services on the server: the state machine
 * refuses an illegal transition, and a refund is requested here but must be
 * approved separately, so no single click moves money.
 */
export function OrderActions({ order }: { order: Order }) {
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
      setMessage(caught instanceof ApiError ? caught.message : 'অনুরোধটি সম্পন্ন হয়নি।');
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
        <h2 className="font-bold text-navy">অবস্থা পরিবর্তন</h2>
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
              'অবস্থা পরিবর্তন করা হয়েছে।',
            );
          }}
        >
          <Field label="নতুন অবস্থা" required>
            {(props) => (
              <Select name="status" {...props}>
                <option value="paid">paid</option>
                <option value="fulfilled">fulfilled</option>
                <option value="cancelled">cancelled</option>
                <option value="failed">failed</option>
              </Select>
            )}
          </Field>

          <Field label="কারণ" required hint="অডিট লগে সংরক্ষিত হবে">
            {(props) => <Input name="reason" {...props} />}
          </Field>

          <Button type="submit" variant="secondary" disabled={busy}>
            পরিবর্তন করুন
          </Button>
        </form>
      </Card>

      {remaining > 0 ? (
        <Card className="p-5">
          <h2 className="font-bold text-navy">রিফান্ড অনুরোধ</h2>
          <p className="mt-1 text-sm text-muted">
            সর্বোচ্চ {price(remaining, order.currency)} ফেরত দেওয়া যাবে। অনুমোদন আলাদা ধাপ।
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
                'রিফান্ড অনুরোধ তৈরি হয়েছে; অনুমোদনের অপেক্ষায়।',
              );
            }}
          >
            <Field label="পরিমাণ (minor unit)" required hint="১০০ = ১ টাকা">
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

            <Field label="কারণ" required>
              {(props) => <Textarea name="reason" {...props} />}
            </Field>

            <Field label="অ্যাক্সেস প্রত্যাহার করবেন?" required>
              {(props) => (
                <Select name="revoke_entitlements" defaultValue="yes" {...props}>
                  <option value="yes">হ্যাঁ, ডাউনলোড ও কোর্স প্রত্যাহার করুন</option>
                  <option value="no">না, অ্যাক্সেস রেখে দিন</option>
                </Select>
              )}
            </Field>

            <Button type="submit" variant="danger" disabled={busy}>
              রিফান্ড অনুরোধ করুন
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
