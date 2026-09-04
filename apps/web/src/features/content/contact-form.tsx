'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ErrorSummary, Field, Input, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

export function ContactForm() {
  const { t } = useLocale();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      await api('/contact', {
        method: 'POST',
        body: {
          name: form.get('name'),
          email: form.get('email'),
          subject: form.get('subject'),
          message: form.get('message'),
        },
      });

      setStatus('sent');
      event.currentTarget.reset();
    } catch (caught) {
      setStatus('idle');

      if (caught instanceof ApiError) {
        setErrors(caught.fields);
        setMessage(caught.isValidation ? null : caught.message);
      } else {
        setMessage(t.contact.failed);
      }
    }
  }

  if (status === 'sent') {
    return (
      <Callout tone="success" title={t.contact.sentTitle} role="status">
        {t.contact.sentBody}
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

      <Field label={t.contact.name} required error={errors.name?.[0]}>
        {(props) => <Input name="name" autoComplete="name" {...props} />}
      </Field>

      <Field label={t.contact.email} required error={errors.email?.[0]}>
        {(props) => <Input name="email" type="email" autoComplete="email" {...props} />}
      </Field>

      <Field label={t.contact.subject} required error={errors.subject?.[0]}>
        {(props) => <Input name="subject" {...props} />}
      </Field>

      <Field
        label={t.contact.message}
        required
        hint={t.contact.messageHint}
        error={errors.message?.[0]}
      >
        {(props) => <Textarea name="message" {...props} />}
      </Field>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" size="lg" disabled={status === 'sending'}>
        {status === 'sending' ? t.contact.sending : t.contact.send}
      </Button>
    </form>
  );
}
