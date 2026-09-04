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

/**
 * Sign-in against the first-party cookie session. No token is returned or
 * stored; the browser simply receives an HttpOnly session cookie.
 */
/** Roles that belong in the admin panel rather than the customer account. */
const STAFF_ROLES = ['super_admin', 'admin', 'editor', 'instructor', 'support'];

export function LoginForm() {
  const router = useRouter();
  const { t } = useLocale();
  const { refresh: refreshSession } = useSession();
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
      const signedIn = await api<{ data: User }>('/auth/login', {
        method: 'POST',
        body: {
          email: form.get('email'),
          password: form.get('password'),
          remember: form.get('remember') === 'on',
        },
      });

      // Staff go to the admin panel, customers to their account. An explicit
      // `next` always wins, so a deep link the visitor was sent to still works.
      const isStaff = signedIn.data.roles.some((role) => STAFF_ROLES.includes(role));
      const destination = next ? safeNext : isStaff ? '/dashboard' : '/account';

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

      <Field label={t.auth.email} required error={errors.email?.[0]}>
        {(props) => <Input name="email" type="email" autoComplete="email" {...props} />}
      </Field>

      <Field label={t.auth.password} required error={errors.password?.[0]}>
        {(props) => (
          <Input name="password" type="password" autoComplete="current-password" {...props} />
        )}
      </Field>

      <Checkbox name="remember" label={t.auth.remember} />

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? t.auth.signingIn : t.auth.signInTitle}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/forgot-password" className="text-blue hover:underline">
          {t.auth.forgotPassword}
        </Link>
      </p>
    </form>
  );
}
