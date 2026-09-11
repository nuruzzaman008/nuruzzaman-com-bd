'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

type State = 'working' | 'verified' | 'already' | 'failed';

/**
 * The page the verification email links to.
 *
 * The link carries `target`: the signed API path the mail was built around.
 * It is used as given rather than reassembled here, because the signature
 * covers the exact path and query - rebuilding it from parts would invalidate
 * it for no gain.
 *
 * Only same-origin API paths are followed. The value arrives from a URL, and a
 * page that will fetch whatever a query parameter names is a page that can be
 * pointed at someone else's server.
 */
export function VerifyEmail() {
  const { t } = useLocale();
  const { refresh: refreshSession } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const target = params.get('target');

  // Decided during render rather than in the effect: a malformed link is known
  // from the URL alone, and settling it here avoids a first paint that claims
  // to be verifying something it has already rejected.
  const usable = Boolean(target && target.startsWith('/api/v1/auth/verify-email/'));

  const [state, setState] = useState<State>(usable ? 'working' : 'failed');
  const [message, setMessage] = useState<string | null>(
    usable ? null : t.account.verifyLinkInvalid,
  );
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!usable || !target) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await api<{ message: string }>(target.replace('/api/v1', ''), {
          method: 'GET',
        });

        if (cancelled) {
          return;
        }

        setState(/already/i.test(response.message) ? 'already' : 'verified');
        await refreshSession();
        router.refresh();
      } catch (caught) {
        if (cancelled) {
          return;
        }

        setState('failed');
        // An expired link is the common case and has its own remedy, so it is
        // named rather than folded into a generic failure.
        setMessage(
          caught instanceof ApiError && (caught.status === 403 || caught.status === 401)
            ? t.account.verifyLinkExpired
            : t.account.verifyFailed,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [usable, target, t, refreshSession, router]);

  async function resend() {
    setResending(true);

    try {
      await api('/auth/verify-email/resend', { method: 'POST' });
      setResent(true);
    } catch {
      setMessage(t.account.verifyResendFailed);
    } finally {
      setResending(false);
    }
  }

  if (state === 'working') {
    return (
      <Callout tone="info" role="status">
        {t.account.verifyWorking}
      </Callout>
    );
  }

  if (state === 'verified' || state === 'already') {
    return (
      <Callout tone="success" role="status">
        {state === 'verified' ? t.account.verifySuccess : t.account.verifyAlready}
      </Callout>
    );
  }

  return (
    <div className="space-y-4">
      <Callout tone="danger" role="alert">
        {message ?? t.account.verifyFailed}
      </Callout>

      {resent ? (
        <Callout tone="success" role="status">
          {t.account.verifySent}
        </Callout>
      ) : (
        <Button type="button" onClick={resend} disabled={resending}>
          {resending ? t.account.verifySending : t.account.verifyResend}
        </Button>
      )}
    </div>
  );
}
