'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox, ErrorSummary, Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      await api<{ data: User }>('/auth/register', {
        method: 'POST',
        body: {
          name: form.get('name'),
          email: form.get('email'),
          phone: form.get('phone') || null,
          password: form.get('password'),
          password_confirmation: form.get('password_confirmation'),
          accepts_terms: form.get('accepts_terms') === 'on',
        },
      });

      router.replace('/account');
      router.refresh();
    } catch (caught) {
      setBusy(false);

      if (caught instanceof ApiError) {
        setErrors(caught.fields);

        if (!caught.isValidation) {
          setMessage(caught.message);
        }
      } else {
        setMessage('অ্যাকাউন্ট তৈরি করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      }
    }
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

      <Field label="ফোন (ঐচ্ছিক)" error={errors.phone?.[0]}>
        {(props) => <Input name="phone" type="tel" autoComplete="tel" {...props} />}
      </Field>

      <Field
        label="পাসওয়ার্ড"
        required
        hint="অন্তত ১০ অক্ষর, অক্ষর ও সংখ্যা মিলিয়ে।"
        error={errors.password?.[0]}
      >
        {(props) => (
          <Input name="password" type="password" autoComplete="new-password" {...props} />
        )}
      </Field>

      <Field label="পাসওয়ার্ড আবার লিখুন" required>
        {(props) => (
          <Input
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            {...props}
          />
        )}
      </Field>

      <Checkbox
        name="accepts_terms"
        error={errors.accepts_terms?.[0]}
        label={
          <>
            আমি{' '}
            <Link href="/terms" className="text-blue underline">
              ব্যবহারের শর্তাবলি
            </Link>{' '}
            এবং{' '}
            <Link href="/privacy-policy" className="text-blue underline">
              গোপনীয়তা নীতি
            </Link>{' '}
            মেনে নিচ্ছি।
          </>
        }
      />

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'তৈরি হচ্ছে…' : 'অ্যাকাউন্ট তৈরি করুন'}
      </Button>
    </form>
  );
}
