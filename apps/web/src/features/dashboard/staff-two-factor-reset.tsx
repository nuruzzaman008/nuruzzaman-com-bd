'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

const STAFF_ROLES = ['super_admin', 'admin', 'editor', 'instructor', 'support'];

/**
 * Clearing another staff member's two-step verification, for a lost phone.
 *
 * Drawn under the same rules the API enforces in UserPolicy::resetTwoFactor:
 * super admins and admins, never on their own account, only for staff, and a
 * super admin's account only for another super admin. Hiding it is a
 * convenience; the server refuses the rest regardless.
 *
 * The person doing it confirms with their own current code from their own
 * authenticator app, typed here each time.
 */
export function StaffTwoFactorReset({
  userId,
  userName,
  targetRoles,
  initialEnabled,
}: {
  userId: number;
  userName: string;
  targetRoles: readonly string[];
  initialEnabled: boolean;
}) {
  const { t } = useLocale();
  const { user: viewer } = useSession();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const copy = t.admin.users;
  const viewerIsSuperAdmin = Boolean(viewer?.roles.includes('super_admin'));
  const viewerIsAdmin = Boolean(viewer?.roles.includes('admin'));
  const targetIsStaff = targetRoles.some((role) => STAFF_ROLES.includes(role));

  if (!viewer || viewer.id === userId || !targetIsStaff) return null;
  if (!viewerIsSuperAdmin && !viewerIsAdmin) return null;
  if (targetRoles.includes('super_admin') && !viewerIsSuperAdmin) return null;

  async function reset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError(null);

    const form = new FormData(event.currentTarget);

    try {
      await api(`/admin/users/${userId}/mfa/reset`, {
        method: 'POST',
        body: { code: form.get('code') },
      });

      setEnabled(false);
      setConfirming(false);
      setDone(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isValidation) {
        setFieldError(caught.fields.code?.[0] ?? copy.mfaResetFailed);
      } else if (caught instanceof ApiError && caught.status === 403) {
        setError(copy.mfaResetNotAllowed);
      } else {
        setError(caught instanceof Error && caught.message ? caught.message : copy.mfaResetFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-[--radius-card] border border-line bg-white p-6">
      <h2 className="text-lg font-bold text-navy">{copy.mfaHeading}</h2>
      <p className="mt-1 text-sm text-muted">{userName}</p>

      <p className="mt-3 text-sm text-ink">{enabled ? copy.mfaOn : copy.mfaOff}</p>

      {done ? (
        <Callout tone="success" role="status" className="mt-4">
          {copy.mfaResetDone.replace('{name}', userName)}
        </Callout>
      ) : null}

      {error ? (
        <Callout tone="danger" role="alert" className="mt-4">
          {error}
        </Callout>
      ) : null}

      {enabled && !confirming ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => setConfirming(true)}
        >
          {copy.mfaReset}
        </Button>
      ) : null}

      {enabled && confirming ? (
        <form
          onSubmit={reset}
          noValidate
          className="mt-4 space-y-3 rounded-lg border border-amber/40 bg-amber-soft p-4"
        >
          <p className="text-sm text-navy">{copy.mfaResetIntro.replace('{name}', userName)}</p>

          <Field label={copy.mfaResetCode} required error={fieldError ?? undefined}>
            {(props) => (
              <Input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                autoFocus
                className="max-w-xs"
                {...props}
              />
            )}
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={busy}>
              {copy.mfaResetConfirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setFieldError(null);
                setError(null);
              }}
            >
              {copy.mfaResetCancel}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
