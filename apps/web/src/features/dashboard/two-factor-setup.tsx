'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

/**
 * Setting up, and turning off, the authenticator app.
 *
 * The secret is shown once, while it is being set up, and is typed into the
 * app by hand or scanned from the link. It is worth nothing until a code from
 * the app confirms it, so an interrupted setup leaves the account exactly as
 * it was.
 */
export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const { refresh } = useSession();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'danger'>('success');
  const [busy, setBusy] = useState(false);

  const copy = t.admin.security;

  function report(caught: unknown, fallback: string) {
    setTone('danger');

    if (caught instanceof ApiError) {
      setErrors(caught.fields);
      setMessage(caught.isValidation ? null : caught.message);

      return;
    }

    setMessage(fallback);
  }

  async function start() {
    setBusy(true);
    setErrors({});
    setMessage(null);

    try {
      const started = await api<{ data: { secret: string; otpauth_uri: string } }>('/me/mfa', {
        method: 'POST',
      });

      setSecret(started.data.secret);
      setUri(started.data.otpauth_uri);
    } catch (caught) {
      report(caught, copy.failed);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      await api('/me/mfa/confirm', { method: 'POST', body: { code: form.get('code') } });

      setSecret(null);
      setUri(null);
      setTone('success');
      setMessage(copy.enabled);
      void refresh();
      router.refresh();
    } catch (caught) {
      report(caught, copy.failed);
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      await api('/me/mfa', { method: 'DELETE', body: { password: form.get('password') } });

      setTone('success');
      setMessage(copy.disabled);
      void refresh();
      router.refresh();
    } catch (caught) {
      report(caught, copy.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-bold text-navy">{copy.title}</h2>
      <p className="mt-2 text-sm text-muted">{copy.intro}</p>

      {message ? (
        <Callout tone={tone} className="mt-3" role={tone === 'danger' ? 'alert' : 'status'}>
          {message}
        </Callout>
      ) : null}

      {enabled ? (
        <form onSubmit={disable} className="mt-4 space-y-4">
          <Callout tone="success">{copy.alreadyOn}</Callout>

          <Field label={copy.passwordToTurnOff} required error={errors.password?.[0]}>
            {(props) => <Input name="password" type="password" autoComplete="current-password" {...props} />}
          </Field>

          <Button type="submit" variant="ghost" disabled={busy}>
            {copy.turnOff}
          </Button>
        </form>
      ) : secret ? (
        <form onSubmit={confirm} className="mt-4 space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
            <li>{copy.stepApp}</li>
            <li>
              {copy.stepSecret}
              <code className="font-latin mt-2 block rounded-lg bg-surface p-3 text-sm tracking-widest break-all">
                {secret}
              </code>
            </li>
            <li>{copy.stepCode}</li>
          </ol>

          {uri ? (
            <p className="text-xs text-muted">
              <a className="font-latin text-blue break-all hover:underline" href={uri}>
                {copy.openInApp}
              </a>
            </p>
          ) : null}

          <Field label={copy.code} required error={errors.code?.[0]}>
            {(props) => (
              <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} {...props} />
            )}
          </Field>

          <Button type="submit" disabled={busy}>
            {busy ? t.admin.common.saving : copy.confirm}
          </Button>
        </form>
      ) : (
        <div className="mt-4">
          <Button onClick={start} disabled={busy}>
            {busy ? t.admin.common.saving : copy.start}
          </Button>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">{copy.lostPhone}</p>
    </Card>
  );
}
