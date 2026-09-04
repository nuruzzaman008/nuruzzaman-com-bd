'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActivationRequest, Order } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Phase 1 activation request.
 *
 * The Machine ID is sent once and then never displayed again: the API encrypts
 * it at rest and only ever returns a masked form. Nothing here uploads a
 * recovery file - the API refuses those by design.
 */
export function ActivationRequestForm({ orders }: { orders: Order[] }) {
  const { t } = useLocale();
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
        setMessage(t.customer.activation.failed);
      }
    }
  }

  if (orders.length === 0) {
    return (
      <Callout tone="info" title={t.customer.activation.needsPaidOrder}>
        {t.customer.activation.needsPaidOrderBody}
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

      <Field label={t.customer.activation.orderLabel} required error={errors.order_number?.[0]}>
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

      <Field label={t.customer.activation.requestType} required error={errors.request_type?.[0]}>
        {(props) => (
          <Select name="request_type" defaultValue="activation" {...props}>
            <option value="activation">{t.customer.activation.typeActivation}</option>
            <option value="refill">{t.customer.activation.typeRefill}</option>
            <option value="recovery">{t.customer.activation.typeRecovery}</option>
          </Select>
        )}
      </Field>

      <Field
        label="Machine ID"
        required
        hint={t.customer.activation.machineIdHint}
        error={errors.machine_id?.[0]}
      >
        {(props) => <Input name="machine_id" className="font-latin" spellCheck={false} {...props} />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.customer.activation.autocadVersion} error={errors.autocad_version?.[0]}>
          {(props) => <Input name="autocad_version" placeholder="2025" {...props} />}
        </Field>

        <Field label={t.customer.activation.windowsVersion} error={errors.windows_version?.[0]}>
          {(props) => <Input name="windows_version" placeholder="Windows 11 Pro" {...props} />}
        </Field>
      </div>

      <Field label={t.customer.activation.note} error={errors.customer_note?.[0]}>
        {(props) => <Textarea name="customer_note" {...props} />}
      </Field>

      <Callout tone="warning">{t.customer.activation.neverAskWarning}</Callout>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? t.customer.activation.sending : t.customer.activation.send}
      </Button>
    </form>
  );
}
