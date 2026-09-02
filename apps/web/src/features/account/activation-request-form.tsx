'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActivationRequest, Order } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';

/**
 * Phase 1 activation request.
 *
 * The Machine ID is sent once and then never displayed again: the API encrypts
 * it at rest and only ever returns a masked form. Nothing here uploads a
 * recovery file - the API refuses those by design.
 */
export function ActivationRequestForm({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const response = await api<{ data: ActivationRequest }>('/account/activation-requests', {
        method: 'POST',
        body: {
          order_number: form.get('order_number'),
          machine_id: form.get('machine_id'),
          request_type: form.get('request_type'),
          autocad_version: form.get('autocad_version') || null,
          windows_version: form.get('windows_version') || null,
          customer_note: form.get('customer_note') || null,
        },
      });

      router.push(`/account/activation-requests/${response.data.reference}`);
      router.refresh();
    } catch (caught) {
      setBusy(false);

      if (caught instanceof ApiError) {
        setErrors(caught.fields);

        if (!caught.isValidation) {
          setMessage(caught.message);
        }
      } else {
        setMessage('রিকোয়েস্ট পাঠানো যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      }
    }
  }

  if (orders.length === 0) {
    return (
      <Callout tone="info" title="পরিশোধিত অর্ডার প্রয়োজন">
        অ্যাক্টিভেশন রিকোয়েস্ট পাঠাতে একটি পরিশোধিত অর্ডার থাকতে হবে।
      </Callout>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ErrorSummary errors={errors} />

      {message ? (
        <Callout tone="danger" role="alert">
          {message}
        </Callout>
      ) : null}

      <Field label="কোন অর্ডারের জন্য" required error={errors.order_number?.[0]}>
        {(props) => (
          <Select name="order_number" {...props}>
            {orders.map((order) => (
              <option key={order.number} value={order.number}>
                {order.number}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="অনুরোধের ধরন" required error={errors.request_type?.[0]}>
        {(props) => (
          <Select name="request_type" defaultValue="activation" {...props}>
            <option value="activation">নতুন অ্যাক্টিভেশন</option>
            <option value="refill">ক্রেডিট রিফিল</option>
            <option value="recovery">লাইসেন্স রিকভারি</option>
          </Select>
        )}
      </Field>

      <Field
        label="Machine ID"
        required
        hint="সফটওয়্যারের License & System টুল থেকে কপি করুন। এটি এনক্রিপ্ট করে রাখা হয় এবং কখনো সম্পূর্ণ আকারে দেখানো হয় না।"
        error={errors.machine_id?.[0]}
      >
        {(props) => <Input name="machine_id" className="font-latin" spellCheck={false} {...props} />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="AutoCAD ভার্সন" error={errors.autocad_version?.[0]}>
          {(props) => <Input name="autocad_version" placeholder="2025" {...props} />}
        </Field>

        <Field label="Windows ভার্সন" error={errors.windows_version?.[0]}>
          {(props) => <Input name="windows_version" placeholder="Windows 11 Pro" {...props} />}
        </Field>
      </div>

      <Field label="অতিরিক্ত তথ্য" error={errors.customer_note?.[0]}>
        {(props) => <Textarea name="customer_note" {...props} />}
      </Field>

      <Callout tone="warning">
        কোনো recovery ফাইল, `.nbk`/`.nbrk` ফাইল বা private key আপলোড করতে বলা হবে না। কেউ
        চাইলে সেটি আমাদের পক্ষ থেকে নয়।
      </Callout>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? 'পাঠানো হচ্ছে…' : 'রিকোয়েস্ট পাঠান'}
      </Button>
    </form>
  );
}
