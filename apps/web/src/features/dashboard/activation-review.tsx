'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActivationRequest } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, Field, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import type { Dictionary } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Support-side review of a Phase 1 activation request.
 *
 * The vendor response is free text the customer will read. It must never carry
 * a token, key or recovery blob: the offline vendor process issues those, and
 * this website is deliberately not able to store them.
 */
type Transition = keyof Dictionary['admin']['activationReview'];

/** Which transitions each status allows. The API enforces the same rules. */
const NEXT_STATES: Record<string, { value: string; label: Transition }[]> = {
  submitted: [
    { value: 'under_review', label: 'startReview' },
    { value: 'needs_info', label: 'needsInfo' },
    { value: 'rejected', label: 'reject' },
  ],
  under_review: [
    { value: 'approved', label: 'approve' },
    { value: 'needs_info', label: 'needsInfo' },
    { value: 'rejected', label: 'reject' },
  ],
  needs_info: [
    { value: 'under_review', label: 'backToReview' },
    { value: 'rejected', label: 'reject' },
  ],
  approved: [
    { value: 'completed', label: 'markComplete' },
    { value: 'rejected', label: 'reject' },
  ],
  // Completing binds the machine to the licence; deactivating gives the seat
  // back so another machine can be activated, and the same machine can return.
  completed: [{ value: 'deactivated', label: 'deactivate' }],
  deactivated: [{ value: 'completed', label: 'reactivate' }],
  rejected: [],
};

export function ActivationReview({ request }: { request: ActivationRequest }) {
  const { t } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'danger'>('success');

  const options = NEXT_STATES[request.status] ?? [];

  if (options.length === 0) {
    return (
      <Callout tone="info">
        {t.admin.activationReview.finalState}
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
          override_device_limit: form.get('override_device_limit') === 'on',
        },
      });

      setTone('success');
      setMessage(t.admin.activationReview.updated);
      router.refresh();
    } catch (caught) {
      setTone('danger');
      setMessage(
        caught instanceof ApiError ? caught.message : t.admin.activationReview.failed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-bold text-navy">{t.admin.activationReview.heading}</h2>

      {message ? (
        <Callout tone={tone} className="mt-3" role={tone === 'danger' ? 'alert' : 'status'}>
          {message}
        </Callout>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field label={t.admin.activationReview.newStatus} required>
          {(props) => (
            <Select name="status" {...props}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {t.admin.activationReview[option.label]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label={t.admin.activationReview.internalNote}
          hint={t.admin.activationReview.internalHint}
        >
          {(props) => <Textarea name="internal_note" {...props} />}
        </Field>

        <Field
          label={t.admin.activationReview.customerResponse}
          hint={t.admin.activationReview.customerHint}
        >
          {(props) => <Textarea name="vendor_response" {...props} />}
        </Field>

        <Field label={t.admin.activationReview.historyNote}>
          {(props) => <Textarea name="note" {...props} />}
        </Field>

        <Checkbox
          name="notify"
          defaultChecked
          label={t.admin.activationReview.notifyCustomer}
        />

        {/*
          The server refuses to activate one machine more than the licence
          allows. This is how a reviewer goes past it on purpose, and the
          request's history and the audit log both record that they did.
        */}
        <div>
          <Checkbox
            name="override_device_limit"
            label={t.admin.activationReview.overrideDeviceLimit}
          />
          <p className="mt-1 text-xs text-muted">
            {t.admin.activationReview.overrideDeviceLimitHint}
          </p>
        </div>

        <Button type="submit" disabled={busy}>
          {busy ? t.admin.common.saving : t.admin.activationReview.update}
        </Button>
      </form>
    </Card>
  );
}
