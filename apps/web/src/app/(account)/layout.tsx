import type { SiteSettings, User } from '@nuruzzaman/contracts';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError } from '@nuruzzaman/contracts';

import { PATHNAME_HEADER, REQUEST_PATH_HEADER, loginRedirect } from '@/lib/request-path';

import { AccountSidebar } from '@/components/layout/account-sidebar';
import { isAdministrator } from '@/lib/account-routing';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Container } from '@/components/ui/container';
import { sessionApi, tryPublicApi } from '@/lib/api/server';

/**
 * The account shell.
 *
 * The session is resolved here so a signed-out visitor is redirected once,
 * rather than every child page discovering it separately. Authorisation still
 * happens in the API for every read and write.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  let user: User;

  try {
    const response = await sessionApi<{ data: User }>('/me');
    user = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.isUnauthenticated || error.isForbidden)) {
      /*
        Back to the URL that was asked for, not a fixed `/account`. The
        verification link is the case that made this matter: its whole payload
        is the query string, so signing in and landing on the account home
        threw the verification away, and the visitor was left with the same
        "not verified" notice that sent them to their email in the first place.
      */
      redirect(loginRedirect((await headers()).get(REQUEST_PATH_HEADER), '/account'));
    }

    throw error;
  }

  /*
    Staff belong in /dashboard, with one exception: the page their own
    verification email links to. There is no verification page in the admin
    shell, so bouncing them made that link a dead end they could never get
    past - resend, click, bounce, repeat.
  */
  const isVerifying = (await headers()).get(PATHNAME_HEADER) === '/account/verify-email';

  if (isAdministrator(user.roles) && !isVerifying) redirect('/dashboard');

  const settings = await tryPublicApi<{ data: SiteSettings }>('/site/settings', {
    tags: ['settings'],
    revalidate: 600,
  });

  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <Container className="py-10">
          <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
            {/* Staff are only ever here to verify an address, and the customer
                navigation would be no use to them. */}
            {isAdministrator(user.roles) ? <div /> : <AccountSidebar user={user} />}

            <div>{children}</div>
          </div>
        </Container>
      </main>

      <SiteFooter settings={settings?.data ?? null} />
    </>
  );
}
