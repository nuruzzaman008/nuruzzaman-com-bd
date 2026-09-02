'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ErrorSummary, Field, Input, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';

export function ContactForm() {
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
        setMessage('বার্তা পাঠানো যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      }
    }
  }

  if (status === 'sent') {
    return (
      <Callout tone="success" title="বার্তা পৌঁছেছে" role="status">
        ধন্যবাদ। আপনার বার্তা গ্রহণ করা হয়েছে; উত্তর ইমেইলে পাঠানো হবে।
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

      <Field label="আপনার নাম" required error={errors.name?.[0]}>
        {(props) => <Input name="name" autoComplete="name" {...props} />}
      </Field>

      <Field label="ইমেইল" required error={errors.email?.[0]}>
        {(props) => <Input name="email" type="email" autoComplete="email" {...props} />}
      </Field>

      <Field label="বিষয়" required error={errors.subject?.[0]}>
        {(props) => <Input name="subject" {...props} />}
      </Field>

      <Field
        label="বার্তা"
        required
        hint="অর্ডার নম্বর বা AutoCAD ভার্সন উল্লেখ করলে উত্তর দ্রুত হয়।"
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
        {status === 'sending' ? 'পাঠানো হচ্ছে…' : 'বার্তা পাঠান'}
      </Button>
    </form>
  );
}
