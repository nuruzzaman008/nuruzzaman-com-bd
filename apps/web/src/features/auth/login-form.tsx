'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox, ErrorSummary, Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';

/**
 * Sign-in against the first-party cookie session. No token is returned or
 * stored; the browser simply receives an HttpOnly session cookie.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      await api<{ data: User }>('/auth/login', {
        method: 'POST',
        body: {
          email: form.get('email'),
          password: form.get('password'),
          remember: form.get('remember') === 'on',
        },
      });

      router.replace(safeNext);
      router.refresh();
    } catch (caught) {
      setBusy(false);

      if (caught instanceof ApiError) {
        setErrors(caught.fields);

        if (caught.isNetworkError) {
          // Nothing they typed was wrong, so saying "could not sign in" would
          // send them off checking their password for no reason.
          setMessage(
            'সার্ভারের সঙ্গে সংযোগ করা যায়নি। ইন্টারনেট সংযোগ দেখুন, অথবা সার্ভার চালু আছে কি না নিশ্চিত করুন।',
          );
        } else if (!caught.isValidation) {
          setMessage(caught.message);
        }
      } else {
        setMessage('সাইন ইন করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
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

      <Field label="ইমেইল" required error={errors.email?.[0]}>
        {(props) => <Input name="email" type="email" autoComplete="email" {...props} />}
      </Field>

      <Field label="পাসওয়ার্ড" required error={errors.password?.[0]}>
        {(props) => (
          <Input name="password" type="password" autoComplete="current-password" {...props} />
        )}
      </Field>

      <Checkbox name="remember" label="এই ডিভাইসে মনে রাখুন" />

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'সাইন ইন হচ্ছে…' : 'সাইন ইন'}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/forgot-password" className="text-blue hover:underline">
          পাসওয়ার্ড ভুলে গেছেন?
        </Link>
      </p>
    </form>
  );
}
