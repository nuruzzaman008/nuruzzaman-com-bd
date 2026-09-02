'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActivationRequest } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, Field, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';

/**
 * Support-side review of a Phase 1 activation request.
 *
 * The vendor response is free text the customer will read. It must never carry
 * a token, key or recovery blob: the offline vendor process issues those, and
 * this website is deliberately not able to store them.
 */
const NEXT_STATES: Record<string, { value: string; label: string }[]> = {
  submitted: [
    { value: 'under_review', label: 'রিভিউ শুরু করুন' },
    { value: 'needs_info', label: 'আরও তথ্য দরকার' },
    { value: 'rejected', label: 'বাতিল করুন' },
  ],
  under_review: [
    { value: 'approved', label: 'অনুমোদন করুন' },
    { value: 'needs_info', label: 'আরও তথ্য দরকার' },
    { value: 'rejected', label: 'বাতিল করুন' },
  ],
  needs_info: [
    { value: 'under_review', label: 'রিভিউতে ফেরত' },
    { value: 'rejected', label: 'বাতিল করুন' },
  ],
  approved: [
    { value: 'completed', label: 'সম্পন্ন হিসেবে চিহ্নিত করুন' },
    { value: 'rejected', label: 'বাতিল করুন' },
  ],
  completed: [],
  rejected: [],
};

export function ActivationReview({ request }: { request: ActivationRequest }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'danger'>('success');

  const options = NEXT_STATES[request.status] ?? [];

  if (options.length === 0) {
    return (
      <Callout tone="info">
        এই রিকোয়েস্টটি চূড়ান্ত অবস্থায় আছে; আর কোনো পরিবর্তন করা যাবে না।
      </Callout>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      await api(`/admin/activation-requests/${request.reference}/transition`, {
        method: 'POST',
        body: {
          status: form.get('status'),
          note: form.get('note') || null,
          vendor_response: form.get('vendor_response') || null,
          internal_note: form.get('internal_note') || null,
          notify: form.get('notify') === 'on',
        },
      });

      setTone('success');
      setMessage('রিকোয়েস্ট হালনাগাদ করা হয়েছে।');
      router.refresh();
    } catch (caught) {
      setTone('danger');
      setMessage(caught instanceof ApiError ? caught.message : 'হালনাগাদ করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-bold text-navy">রিভিউ</h2>

      {message ? (
        <Callout tone={tone} className="mt-3" role={tone === 'danger' ? 'alert' : 'status'}>
          {message}
        </Callout>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field label="নতুন অবস্থা" required>
          {(props) => (
            <Select name="status" {...props}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="অভ্যন্তরীণ নোট" hint="শুধু স্টাফ দেখতে পাবে">
          {(props) => <Textarea name="internal_note" {...props} />}
        </Field>

        <Field
          label="গ্রাহকের জন্য রেসপন্স"
          hint="কখনো token, key বা recovery ফাইল এখানে লিখবেন না।"
        >
          {(props) => <Textarea name="vendor_response" {...props} />}
        </Field>

        <Field label="ইতিহাসে নোট">
          {(props) => <Textarea name="note" {...props} />}
        </Field>

        <Checkbox name="notify" defaultChecked label="গ্রাহককে ইমেইলে জানান" />

        <Button type="submit" disabled={busy}>
          {busy ? 'সংরক্ষণ হচ্ছে…' : 'হালনাগাদ করুন'}
        </Button>
      </form>
    </Card>
  );
}
