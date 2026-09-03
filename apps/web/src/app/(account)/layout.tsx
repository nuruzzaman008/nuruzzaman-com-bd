import Link from 'next/link';
import type { SiteSettings, User } from '@nuruzzaman/contracts';
import { redirect } from 'next/navigation';
import { ApiError } from '@nuruzzaman/contracts';

import { SignOutButton } from '@/features/auth/sign-out-button';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Container } from '@/components/ui/container';
import { sessionApi, tryPublicApi } from '@/lib/api/server';
import { accountNav } from '@/lib/site';

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
            <aside>
              <p className="text-sm text-muted">সাইন ইন করেছেন</p>
              <p className="font-bold text-navy">{user.name}</p>
              <p className="font-latin text-xs break-all text-muted">{user.email}</p>

              {!user.email_verified ? (
                <p className="mt-3 rounded-lg border border-amber/40 bg-amber-soft p-3 text-xs text-navy">
                  ইমেইল যাচাই করা হয়নি। ডাউনলোড ও অ্যাক্টিভেশনের জন্য যাচাই করা প্রয়োজন।
                </p>
              ) : null}

              <nav aria-label="অ্যাকাউন্ট নেভিগেশন" className="mt-5">
                <ul className="space-y-1">
                  {accountNav.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block rounded-lg px-3 py-2.5 text-sm font-medium text-navy hover:bg-blue-soft hover:text-blue"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* The admin panel is a separate application, reached from the
                  footer's staff-only entrance rather than from inside the
                  customer account. Mixing the two made one look like a section
                  of the other. */}
              <SignOutButton className="mt-4 border-t border-line pt-4" />
            </aside>

            <div>{children}</div>
          </div>
        </Container>
      </main>

      <SiteFooter settings={settings?.data ?? null} />
    </>
  );
}
