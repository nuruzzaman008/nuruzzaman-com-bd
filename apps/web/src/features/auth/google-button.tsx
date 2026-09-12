'use client';

import { useSearchParams } from 'next/navigation';

import { Callout } from '@/components/ui/callout';
import { publicEnv } from '@/lib/env';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Sign in with Google, for customers.
 *
 * A plain link, not a fetch: this begins a redirect to Google and comes back to
 * a callback that has to arrive at this origin, so that the session cookie the
 * API sets is one the browser will send back here. Going through the site's own
 * /api rewrite is what makes that true.
 *
 * Deliberately not on /nb-staff. Staff sign in with a password, and the API
 * refuses a staff account that arrives this way whether or not a button exists
 * to send it - hiding this is tidiness, not the control.
 */
export function GoogleButton() {
  const { t } = useLocale();
  const params = useSearchParams();
  const error = params.get('error');

  const reasons: Record<string, string> = {
    staff_password_only: t.auth.googleStaffRefused,
    google_unverified: t.auth.googleUnverified,
    google_cancelled: t.auth.googleCancelled,
    account_inactive: t.auth.googleInactive,
    google_failed: t.auth.googleFailed,
  };

  return (
    <div className="space-y-4">
      {error && reasons[error] ? (
        <Callout tone="danger" role="alert">
          {reasons[error]}
        </Callout>
      ) : null}

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t.auth.orSeparator}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <a
        href={`${publicEnv.apiBasePath}/auth/google/redirect`}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-surface"
      >
        <svg viewBox="0 0 18 18" aria-hidden="true" className="size-5 shrink-0">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        {t.auth.googleContinue}
      </a>
    </div>
  );
}
