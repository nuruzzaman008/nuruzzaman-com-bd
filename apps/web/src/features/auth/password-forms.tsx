'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ErrorSummary, Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';

/**
 * The API answers a forgot-password request identically whether or not the
 * address exists, so this form shows the same confirmation either way and
 * cannot be used to discover which emails are registered.
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});

    const form = new FormData(event.currentTarget);

    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: form.get('email') },
      });

      setSent(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fields);
      }
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Callout tone="success" title="লিংক পাঠানো হয়েছে" role="status">
        ইমেইলটি নিবন্ধিত থাকলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। ইনবক্স এবং স্প্যাম ফোল্ডার
        দেখে নিন।
      </Callout>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ErrorSummary errors={errors} />

      <Field label="ইমেইল" required error={errors.email?.[0]}>
        {(props) => <Input name="email" type="email" autoComplete="email" {...props} />}
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'পাঠানো হচ্ছে…' : 'রিসেট লিংক পাঠান'}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);

  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: {
          token,
          email,
          password: form.get('password'),
          password_confirmation: form.get('password_confirmation'),
        },
      });

      router.replace('/login?reset=1');
    } catch (caught) {
      setBusy(false);

      if (caught instanceof ApiError) {
        setErrors(caught.fields);

        if (!caught.isValidation) {
          setMessage(caught.message);
        }
      } else {
        setMessage('পাসওয়ার্ড বদলানো যায়নি। লিংকটি মেয়াদোত্তীর্ণ হতে পারে।');
      }
    }
  }

  if (!token || !email) {
    return (
      <Callout tone="warning" title="লিংকটি অসম্পূর্ণ" role="alert">
        রিসেট লিংকটি সম্পূর্ণ নয়। ইমেইল থেকে লিংকটি আবার খুলুন, অথবা নতুন করে অনুরোধ করুন।
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

      <p className="text-sm text-muted">
        অ্যাকাউন্ট: <span className="font-latin font-medium text-navy">{email}</span>
      </p>

      <Field label="নতুন পাসওয়ার্ড" required error={errors.password?.[0]}>
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

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'সংরক্ষণ হচ্ছে…' : 'পাসওয়ার্ড বদলান'}
      </Button>
    </form>
  );
}
