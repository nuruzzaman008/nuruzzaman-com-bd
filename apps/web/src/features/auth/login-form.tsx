'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox, ErrorSummary, Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';
import { loginDestination } from '@/lib/account-routing';

/**
 * Sign-in against the first-party cookie session. No token is returned or
 * stored; the browser simply receives an HttpOnly session cookie.
 */

export function LoginForm({ defaultNext }: { defaultNext?: string } = {}) {
  const router = useRouter();
  const { t } = useLocale();
  const { refresh: refreshSession } = useSession();
  const searchParams = useSearchParams();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // An account with two-step verification is not signed in by its password:
  // the API answers "code needed", and this form asks for it. Google sign-in
  // lands here with ?mfa=1 for the same reason.
  const [codeNeeded, setCodeNeeded] = useState(searchParams.get('mfa') === '1');
  // The phone is not to hand: one of the recovery codes instead.
  const [useRecovery, setUseRecovery] = useState(false);

  // The staff entrance has a destination of its own, so arriving there
  // without one still means the dashboard rather than the customer account.
  const next = searchParams.get('next') ?? defaultNext ?? null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const signedIn = codeNeeded
        ? await api<{ data: User }>('/auth/mfa', {
            method: 'POST',
            body: useRecovery
              ? { recovery_code: form.get('recovery_code') }
              : { code: form.get('code') },
          })
        : await api<{ data: User | { mfa_required: true } }>('/auth/login', {
            method: 'POST',
            body: {
              email: form.get('email'),
              password: form.get('password'),
              remember: form.get('remember') === 'on',
            },
          });

      if ('mfa_required' in signedIn.data) {
        setBusy(false);
        setCodeNeeded(true);

        return;
      }

      const destination = loginDestination(signedIn.data.roles, next);

      // The header, the cart badge and the footer's staff entrance all read
      // the shared session, which was fetched while nobody was signed in.
      // Without this they keep offering "sign in" to someone who just did.
      // Not awaited: the navigation should not wait on it, and a failure here
      // must not turn a successful sign-in into an error message.
      void refreshSession();

      router.replace(destination);
      router.refresh();
    } catch (caught) {
      setBusy(false);

      if (caught instanceof ApiError) {
        setErrors(caught.fields);

        if (caught.isNetworkError) {
          // Nothing they typed was wrong, so saying "could not sign in" would
          // send them off checking their password for no reason.
          setMessage(t.auth.offline);
        } else if (!caught.isValidation) {
          setMessage(caught.message);
        }
      } else {
        setMessage(t.auth.signInFailed);
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

      {codeNeeded ? (
        <>
          <Callout tone="info">{useRecovery ? t.auth.recoveryPrompt : t.auth.mfaPrompt}</Callout>

          {useRecovery ? (
            <Field label={t.auth.recoveryCode} required error={errors.recovery_code?.[0]}>
              {(props) => (
                <Input
                  name="recovery_code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={40}
                  autoFocus
                  {...props}
                />
              )}
            </Field>
          ) : (
            <Field label={t.auth.mfaCode} required error={errors.code?.[0]}>
              {(props) => (
                <Input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={10}
                  autoFocus
                  {...props}
                />
              )}
            </Field>
          )}

          <button
            type="button"
            className="text-sm text-blue hover:underline"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setErrors({});
              setMessage(null);
            }}
          >
            {useRecovery ? t.auth.mfaUseApp : t.auth.mfaUseRecovery}
          </button>
        </>
      ) : (
        <>
          <Field label={t.auth.email} required error={errors.email?.[0]}>
            {(props) => <Input name="email" type="email" autoComplete="email" {...props} />}
          </Field>

          <Field label={t.auth.password} required error={errors.password?.[0]}>
            {(props) => (
              <Input name="password" type="password" autoComplete="current-password" {...props} />
            )}
          </Field>

          <Checkbox name="remember" label={t.auth.remember} />
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? t.auth.signingIn : codeNeeded ? t.auth.mfaVerify : t.auth.signInTitle}
      </Button>

      <p className="text-center text-sm text-muted">
        {codeNeeded ? (
          // The half-finished sign-in lasts five minutes; after that, or on a
          // second device, the way on is the password again.
          <button
            type="button"
            className="text-blue hover:underline"
            onClick={() => {
              setCodeNeeded(false);
              setUseRecovery(false);
              setErrors({});
              setMessage(null);
            }}
          >
            {t.auth.mfaStartOver}
          </button>
        ) : (
          <Link href="/forgot-password" className="text-blue hover:underline">
            {t.auth.forgotPassword}
          </Link>
        )}
      </p>
    </form>
  );
}
