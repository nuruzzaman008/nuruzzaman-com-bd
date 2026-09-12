import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/login-form';
import { LoadingRegion } from '@/components/ui/states';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

/**
 * The staff entrance.
 *
 * A separate address, not a separate door: it posts to the same endpoint and
 * is protected by the same things /login is. What it is not is advertised -
 * the footer no longer links to it, robots.txt disallows it and the metadata
 * is noindex - so the address is not handed to every scanner that walks the
 * site looking for /admin and /wp-admin.
 *
 * That is obscurity, and obscurity is not security. What actually keeps people
 * out sits elsewhere and is unaffected by this page: registration can only ever
 * grant the customer role, the admin API refuses anyone without a staff role on
 * every request, and roles can be changed only from the server's command line
 * or by an administrator who already has the permission.
 *
 * There is deliberately no "create an account" link here. The customer page
 * has one; staff accounts are not self-service and never have been.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.auth.staffSignInTitle);
}

export default async function StaffLoginPage() {
  const { t } = await adminDictionary();

  return (
    <>
      <h1 className="text-2xl font-bold text-navy">{t.auth.staffSignInTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.auth.staffSignInIntro}</p>

      <div className="mt-6">
        {/* useSearchParams needs a Suspense boundary in the App Router. */}
        <Suspense fallback={<LoadingRegion label={t.auth.formLoading} />}>
          {/* Arriving here without a destination still means the dashboard. */}
          <LoginForm defaultNext="/dashboard" />
        </Suspense>
      </div>
    </>
  );
}
