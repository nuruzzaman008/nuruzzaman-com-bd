'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SignOutButton } from '@/features/auth/sign-out-button';
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
 *
 * The API requires a session for this route, so a visitor arriving without one
 * is sent to sign in and back again by the account layout, which keeps the
 * query string. Nothing is requested here until the session has settled.
 */
export function VerifyEmail() {
  const { t } = useLocale();
  const { user, isLoading: sessionLoading, refresh: refreshSession } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const target = params.get('target');

  // Decided during render rather than in the effect: a malformed link is known
  // from the URL alone, and settling it here avoids a first paint that claims
  // to be verifying something it has already rejected.
  const usable = Boolean(target && target.startsWith('/api/v1/auth/verify-email/'));

  /*
    Whether this link belongs to whoever is signed in.

    Laravel refuses a mismatch with 403, which is indistinguishable from an
    expired signature - and "send a new link" is no remedy for it, because the
    link was never the problem. Both values are known here, so the mismatch is
    recognised before anything is requested and answered with the instruction
    that actually works.
  */
  const linkUserId = usable && target ? (/\/verify-email\/(\d+)\//.exec(target)?.[1] ?? null) : null;
  const wrongAccount = Boolean(user && linkUserId && String(user.id) !== linkUserId);
  const alreadyVerified = Boolean(user?.email_verified);

  const [state, setState] = useState<State>(usable ? 'working' : 'failed');
  const [message, setMessage] = useState<string | null>(
    usable ? null : t.account.verifyLinkInvalid,
  );
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    // Nothing is spent on a request that is already known to fail, or on one
    // whose answer the session has given us.
    if (!usable || !target || sessionLoading || wrongAccount || alreadyVerified) {
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
  }, [
    usable,
    target,
    sessionLoading,
    wrongAccount,
    alreadyVerified,
    t,
    refreshSession,
    router,
  ]);

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

  if (usable && wrongAccount) {
    return (
      <div className="space-y-4">
        <Callout tone="danger" role="alert">
          {t.account.verifyWrongAccount}
        </Callout>

        <SignOutButton className="max-w-xs" />
      </div>
    );
  }

  if (state === 'verified') {
    return (
      <Callout tone="success" role="status">
        {t.account.verifySuccess}
      </Callout>
    );
  }

  // The session already knowing the address is verified is the same news as
  // the API saying so, and arrives without asking.
  if (state === 'already' || (state === 'working' && alreadyVerified)) {
    return (
      <Callout tone="success" role="status">
        {t.account.verifyAlready}
      </Callout>
    );
  }

  if (state === 'working') {
    return (
      <Callout tone="info" role="status">
        {t.account.verifyWorking}
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
