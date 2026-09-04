'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ErrorSummary, Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * The API answers a forgot-password request identically whether or not the
 * address exists, so this form shows the same confirmation either way and
 * cannot be used to discover which emails are registered.
 */
export function ForgotPasswordForm() {
  const { t } = useLocale();
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
      <Callout tone="success" title={t.auth.linkSent} role="status">
        {t.auth.linkSentBody}
      </Callout>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ErrorSummary errors={errors} />

      <Field label={t.auth.email} required error={errors.email?.[0]}>
        {(props) => <Input name="email" type="email" autoComplete="email" {...props} />}
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? t.auth.sending : t.auth.sendResetLink}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t } = useLocale();
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
        setMessage(t.auth.resetFailed);
      }
    }
  }

  if (!token || !email) {
    return (
      <Callout tone="warning" title={t.auth.linkIncomplete} role="alert">
        {t.auth.linkIncompleteBody}
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
        {t.auth.accountLabel}:{' '}
        <span className="font-latin font-medium text-navy">{email}</span>
      </p>

      <Field label={t.auth.newPassword} required error={errors.password?.[0]}>
        {(props) => (
          <Input name="password" type="password" autoComplete="new-password" {...props} />
        )}
      </Field>

      <Field label={t.auth.passwordAgain} required>
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
        {busy ? t.auth.saving : t.auth.changePassword}
      </Button>
    </form>
  );
}
