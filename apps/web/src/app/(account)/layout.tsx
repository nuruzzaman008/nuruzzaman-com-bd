import type { SiteSettings, User } from '@nuruzzaman/contracts';
import { redirect } from 'next/navigation';
import { ApiError } from '@nuruzzaman/contracts';

import { AccountSidebar } from '@/components/layout/account-sidebar';
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
      redirect('/login?next=/account');
    }

    throw error;
  }

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
            <AccountSidebar user={user} />

            <div>{children}</div>
          </div>
        </Container>
      </main>

      <SiteFooter settings={settings?.data ?? null} />
    </>
  );
}
