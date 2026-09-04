'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox, ErrorSummary, Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

export function RegisterForm() {
  const router = useRouter();
  const { t } = useLocale();
  const { refresh: refreshSession } = useSession();
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

      // The header and the cart badge read the shared session, fetched while
      // nobody was signed in; without this they keep offering to sign in the
      // person who has just registered. Not awaited, so the navigation is not
      // held up by it and cannot be turned into an error by it.
      void refreshSession();

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
        setMessage(t.auth.registerFailed);
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

      <Field label={t.auth.name} required error={errors.name?.[0]}>
        {(props) => <Input name="name" autoComplete="name" {...props} />}
      </Field>

      <Field label={t.auth.email} required error={errors.email?.[0]}>
        {(props) => <Input name="email" type="email" autoComplete="email" {...props} />}
      </Field>

      <Field label={t.auth.phoneOptional} error={errors.phone?.[0]}>
        {(props) => <Input name="phone" type="tel" autoComplete="tel" {...props} />}
      </Field>

      <Field
        label={t.auth.password}
        required
        hint={t.auth.passwordHint}
        error={errors.password?.[0]}
      >
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

      <Checkbox
        name="accepts_terms"
        error={errors.accepts_terms?.[0]}
        label={
          <>
            {t.auth.consentBefore}{' '}
            <Link href="/terms" className="text-blue underline">
              {t.auth.consentTerms}
            </Link>{' '}
            {t.auth.consentAnd}{' '}
            <Link href="/privacy-policy" className="text-blue underline">
              {t.auth.consentPrivacy}
            </Link>
            {t.auth.consentAfter}
          </>
        }
      />

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? t.auth.creating : t.auth.createAccount}
      </Button>
    </form>
  );
}
