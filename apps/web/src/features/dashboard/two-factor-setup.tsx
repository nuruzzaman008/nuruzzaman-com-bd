'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

/**
 * Setting up Google Authenticator (or any TOTP app), and looking after it
 * afterwards: recovery codes, a new set of them, turning it off.
 *
 * The QR code is drawn here in the browser from the otpauth:// address the API
 * returned, so the secret is never sent to anyone else to render. The secret
 * and the recovery codes live only in this component's state: nothing is kept
 * in storage, and neither can be fetched again once the screen moves on.
 */
export function TwoFactorSetup({
  enabled,
  recoveryCodesRemaining = null,
  autoStart = false,
}: {
  enabled: boolean;
  recoveryCodesRemaining?: number | null;
  /** Arriving from "Set it up now": begin at once rather than show a second button. */
  autoStart?: boolean;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const { refresh } = useSession();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'danger'>('success');
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  // Both password forms send `password`; this says whose error it is.
  const [failedForm, setFailedForm] = useState<'regenerate' | 'disable' | null>(null);
  const autoStarted = useRef(false);

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

  // Started once, not on every render: each start makes a new secret, which
  // would invalidate a QR code the person may already have scanned.
  useEffect(() => {
    if (autoStart && !enabled && !autoStarted.current) {
      autoStarted.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start is stable in effect: it only sets state
  }, [autoStart, enabled]);

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const confirmed = await api<{ data: { mfa_enabled: boolean; recovery_codes: string[] } }>(
        '/me/mfa/confirm',
        { method: 'POST', body: { code: form.get('code') } },
      );

      setSecret(null);
      setUri(null);
      setRecoveryCodes(confirmed.data.recovery_codes);
      setTone('success');
      setMessage(copy.enabled);
    } catch (caught) {
      report(caught, copy.failed);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const made = await api<{ data: { recovery_codes: string[] } }>('/me/mfa/recovery-codes', {
        method: 'POST',
        body: { password: form.get('password') },
      });

      formElement.reset();
      setFailedForm(null);
      setRecoveryCodes(made.data.recovery_codes);
    } catch (caught) {
      setFailedForm('regenerate');
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
      setFailedForm(null);
      setMessage(copy.disabled);
      void refresh();
      router.refresh();
    } catch (caught) {
      setFailedForm('disable');
      report(caught, copy.failed);
    } finally {
      setBusy(false);
    }
  }

  /** The codes are saved: forget them here and let the dashboard open. */
  function recoveryCodesSaved() {
    setRecoveryCodes(null);
    setMessage(null);
    void refresh();
    router.refresh();
  }

  async function copyKey() {
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(secret);
      setCopiedKey(true);
    } catch {
      // Clipboard refused (permissions, an old browser): the key is on screen.
    }
  }

  const showingSetup = !enabled && !recoveryCodes;

  return (
    <Card className="p-5">
      <h2 className="font-bold text-navy">{showingSetup ? copy.setupTitle : copy.title}</h2>
      <p className="mt-2 text-sm text-muted">{copy.intro}</p>

      {message ? (
        <Callout tone={tone} className="mt-3" role={tone === 'danger' ? 'alert' : 'status'}>
          {message}
        </Callout>
      ) : null}

      {recoveryCodes ? (
        <RecoveryCodes codes={recoveryCodes} onSaved={recoveryCodesSaved} />
      ) : enabled ? (
        <div className="mt-4 space-y-6">
          <div className="space-y-2">
            <Callout tone="success">{copy.alreadyOn}</Callout>
            {recoveryCodesRemaining !== null ? (
              <p className="text-sm text-ink">
                {copy.recoveryRemaining.replace('{count}', number(recoveryCodesRemaining, locale))}
              </p>
            ) : null}
            {recoveryCodesRemaining !== null && recoveryCodesRemaining <= 2 ? (
              <Callout tone="warning">{copy.recoveryLow}</Callout>
            ) : null}
          </div>

          <form onSubmit={regenerate} className="space-y-3 border-t border-line pt-4">
            <h3 className="font-semibold text-navy">{copy.regenerateTitle}</h3>
            <p className="text-sm text-muted">{copy.regenerateIntro}</p>
            <Field
              label={copy.passwordToRegenerate}
              required
              error={failedForm === 'regenerate' ? errors.password?.[0] : undefined}
            >
              {(props) => (
                <Input name="password" type="password" autoComplete="current-password" {...props} />
              )}
            </Field>
            <Button type="submit" variant="secondary" disabled={busy}>
              {copy.regenerate}
            </Button>
          </form>

          <form onSubmit={disable} className="space-y-3 border-t border-line pt-4">
            <h3 className="font-semibold text-navy">{copy.turnOffTitle}</h3>
            <p className="text-sm text-muted">{copy.turnOffIntro}</p>
            <Field
              label={copy.passwordToTurnOff}
              required
              error={failedForm === 'disable' ? errors.password?.[0] : undefined}
            >
              {(props) => (
                <Input name="password" type="password" autoComplete="current-password" {...props} />
              )}
            </Field>
            <Button type="submit" variant="ghost" disabled={busy}>
              {copy.turnOff}
            </Button>
          </form>
        </div>
      ) : secret && uri ? (
        <form onSubmit={confirm} className="mt-4 space-y-4">
          <ol className="list-decimal space-y-4 pl-5 text-sm text-ink">
            <li>{copy.stepApp}</li>
            <li>
              {copy.stepScan}
              {/* White whatever the theme: a QR code needs the contrast. */}
              <div className="mt-3 inline-block rounded-lg border border-line bg-white p-3">
                <QRCodeSVG
                  value={uri}
                  size={200}
                  level="M"
                  marginSize={1}
                  title={copy.qrLabel}
                  role="img"
                  aria-label={copy.qrLabel}
                />
              </div>
            </li>
            <li>
              {copy.stepSecret}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="font-latin rounded-lg bg-surface p-3 text-sm tracking-widest break-all">
                  {secret.match(/.{1,4}/g)?.join(' ')}
                </code>
                <Button type="button" variant="secondary" size="sm" onClick={copyKey}>
                  {copiedKey ? copy.copied : copy.copyKey}
                </Button>
              </div>
            </li>
            <li>{copy.stepCode}</li>
          </ol>

          <Field label={copy.code} required error={errors.code?.[0]}>
            {(props) => (
              <Input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                {...props}
              />
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

/** Shown once, right after they are made. */
function RecoveryCodes({ codes, onSaved }: { codes: string[]; onSaved: () => void }) {
  const { t } = useLocale();
  const copy = t.admin.security;
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
    } catch {
      // The codes are on screen and can be written down.
    }
  }

  function download() {
    const text = [
      'nuruzzaman.com.bd - two-step verification recovery codes',
      'Each code works once, in place of a code from the authenticator app.',
      '',
      ...codes,
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nuruzzaman-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-4 space-y-3" aria-labelledby="recovery-codes-title">
      <h3 id="recovery-codes-title" className="font-semibold text-navy">
        {copy.recoveryTitle}
      </h3>
      <Callout tone="warning">{copy.recoveryIntro}</Callout>
      <ul className="font-latin grid grid-cols-1 gap-2 rounded-lg bg-surface p-4 text-sm tracking-wider sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={copyAll}>
          {copied ? copy.copied : copy.recoveryCopy}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={download}>
          {copy.recoveryDownload}
        </Button>
      </div>
      <Button type="button" onClick={onSaved}>
        {copy.recoverySaved}
      </Button>
    </section>
  );
}
