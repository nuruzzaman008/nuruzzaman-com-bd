'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

/** Mirrors the Role enum on the API, which validates the list it is sent. */
const ROLES = [
  'super_admin',
  'admin',
  'editor',
  'instructor',
  'support',
  'student',
  'customer',
] as const;

/**
 * Changes which roles an account holds.
 *
 * Shown only to a super admin, and never on their own account - the same two
 * rules the API enforces in UserPolicy::assignRoles. What is drawn here is a
 * convenience; the refusal that matters happens on the server, so a hidden
 * control is not a control.
 *
 * The API asks for a password before it will accept the change, answering 423
 * until one is confirmed. That is deliberate: it means a borrowed session -
 * an unlocked laptop, a stolen cookie - cannot quietly grant itself more
 * access. The prompt below appears only when the API asks for it, and the
 * change is retried once it is given.
 */
export function RoleEditor({
  userId,
  userName,
  initialRoles,
}: {
  userId: number;
  userName: string;
  initialRoles: readonly string[];
}) {
  const { t } = useLocale();
  const { user: viewer } = useSession();

  const [roles, setRoles] = useState<string[]>([...initialRoles]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  const viewerIsSuperAdmin = Boolean(viewer?.roles.includes('super_admin'));
  const ownAccount = viewer?.id === userId;
  const targetIsSuperAdmin = initialRoles.includes('super_admin');

  if (!viewerIsSuperAdmin) {
    return null;
  }

  if (ownAccount) {
    return (
      <Callout tone="info" role="status">
        {t.admin.users.roleOwnAccount}
      </Callout>
    );
  }

  function toggle(role: string) {
    setSaved(false);
    setRoles((current) =>
      current.includes(role) ? current.filter((held) => held !== role) : [...current, role],
    );
  }

  async function save(confirmWith?: string) {
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      if (confirmWith) {
        await api('/me/confirm-password', { method: 'POST', body: { password: confirmWith } });
      }

      await api(`/admin/users/${userId}/roles`, { method: 'PUT', body: { roles } });

      setSaved(true);
      setNeedsPassword(false);
      setPassword('');
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : null;

      // 423 is the API asking for a password, not a failure.
      if (status === 423) {
        setNeedsPassword(true);
      } else if (status === 403) {
        setError(targetIsSuperAdmin ? t.admin.users.roleSuperAdminLocked : t.admin.users.roleNotAllowed);
      } else {
        setError(caught instanceof Error && caught.message ? caught.message : t.admin.users.roleFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-[--radius-card] border border-line bg-white p-6">
      <h2 className="text-lg font-bold text-navy">{t.admin.users.roleHeading}</h2>
      <p className="mt-1 text-sm text-muted">{userName}</p>

      {error ? (
        <Callout tone="danger" role="alert" className="mt-4">
          {error}
        </Callout>
      ) : null}

      {saved ? (
        <Callout tone="success" role="status" className="mt-4">
          {t.admin.users.roleSaved}
        </Callout>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {ROLES.map((role) => (
          <label key={role} className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={() => toggle(role)}
              disabled={busy}
            />
            <span className="font-latin">{role}</span>
          </label>
        ))}
      </div>

      {needsPassword ? (
        <div className="mt-5 rounded-lg border border-amber/40 bg-amber-soft p-4">
          <p className="text-sm text-navy">{t.admin.users.rolePasswordNeeded}</p>

          <label className="mt-3 block text-sm font-medium text-navy">
            {t.admin.users.rolePasswordLabel}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 block w-full max-w-xs rounded border border-line p-2.5"
            />
          </label>

          <Button
            type="button"
            className="mt-3"
            disabled={busy || password.length === 0}
            onClick={() => void save(password)}
          >
            {busy ? t.admin.users.roleSaving : t.admin.users.rolePasswordSubmit}
          </Button>
        </div>
      ) : (
        <Button type="button" className="mt-5" disabled={busy} onClick={() => void save()}>
          {busy ? t.admin.users.roleSaving : t.admin.users.roleSave}
        </Button>
      )}
    </section>
  );
}
