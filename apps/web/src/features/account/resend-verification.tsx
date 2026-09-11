'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * The way out of the "email not verified" notice.
 *
 * Without this the notice states a problem and offers nothing: downloads and
 * activation stay blocked, and the only remedy is an email that may have been
 * lost, filtered or never sent.
 */
export function ResendVerification({ className }: { className?: string }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function resend() {
    setBusy(true);
    setFailed(false);

    try {
      await api('/auth/verify-email/resend', { method: 'POST' });
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className={className} role="status">
        {t.account.verifySent}
      </p>
    );
  }

  return (
    <div className={className}>
      <Button type="button" variant="secondary" size="sm" onClick={resend} disabled={busy}>
        {busy ? t.account.verifySending : t.account.verifyResend}
      </Button>
      {failed ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {t.account.verifyResendFailed}
        </p>
      ) : null}
    </div>
  );
}
