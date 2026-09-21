import type { Metadata } from 'next';
import type { User } from '@nuruzzaman/contracts';

import { MfaStepUp } from '@/features/dashboard/mfa-step-up';
import { TwoFactorSetup } from '@/features/dashboard/two-factor-setup';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { afterTwoStep } from '@/lib/two-step';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.security.twoStepTitle);
}

/**
 * The page before the dashboard. The admin layout sends every staff session
 * here until it has two-step verification set up and has typed a code, and
 * draws it without the dashboard around it (see (admin)/layout.tsx).
 *
 * Not set up yet: Google Authenticator setup, started at once, then the
 * recovery codes. Set up: the 6-digit code, or a recovery code. Either way the
 * dashboard page that was asked for opens afterwards.
 */
export default async function TwoStepPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { t } = await adminDictionary();
  const me = await sessionApi<{ data: User }>('/me');
  const { next } = await searchParams;
  const destination = afterTwoStep(next);
  const copy = t.admin.security;

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{copy.twoStepTitle}</h1>

      {me.data.mfa_enabled ? (
        <div className="mt-5 rounded-xl border border-line bg-white p-6">
          <h2 className="font-bold text-navy">{copy.stepUpTitle}</h2>
          <p className="mt-2 text-sm text-ink">{t.auth.mfaPrompt}</p>
          <p className="mt-1 text-sm text-muted">{copy.stepUpIntro}</p>
          <MfaStepUp className="mt-4" nextHref={destination} />
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">{copy.required}</p>
          <div className="mt-5">
            <TwoFactorSetup enabled={false} autoStart completeHref={destination} />
          </div>
        </>
      )}
    </div>
  );
}
