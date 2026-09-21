'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

/**
 * Asks a signed-in staff session for the authenticator code when it got in
 * without one: through Google, or on a remember-me cookie. The API keeps the
 * dashboard shut until it has seen one (RequireStaffMfa), so this is the way
 * through, not the lock itself.
 */
export function MfaStepUp({ className }: { className?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const { refresh } = useSession();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  const copy = t.admin.security;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      await api('/me/mfa/verify', {
        method: 'POST',
        body: useRecovery
          ? { recovery_code: form.get('recovery_code') }
          : { code: form.get('code') },
      });

      void refresh();
      router.refresh();
    } catch (caught) {
      setBusy(false);

      if (caught instanceof ApiError) {
        setErrors(caught.fields);
        setMessage(caught.isValidation ? null : caught.message);

        return;
      }

      setMessage(copy.failed);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={className}>
      {message ? (
        <Callout tone="danger" role="alert" className="mb-3">
          {message}
        </Callout>
      ) : null}

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
        className="mt-2 block text-sm text-blue hover:underline"
        onClick={() => {
          setUseRecovery(!useRecovery);
          setErrors({});
          setMessage(null);
        }}
      >
        {useRecovery ? t.auth.mfaUseApp : t.auth.mfaUseRecovery}
      </button>

      <Button type="submit" className="mt-4" disabled={busy}>
        {copy.stepUpVerify}
      </Button>
    </form>
  );
}
