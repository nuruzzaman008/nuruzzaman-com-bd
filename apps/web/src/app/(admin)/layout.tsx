import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, type User } from '@nuruzzaman/contracts';

import { AdminLanguageSwitcher } from '@/components/layout/admin-language-switcher';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { PendingPaymentAlert } from '@/features/dashboard/pending-payment-alert';
import { MfaStepUp } from '@/features/dashboard/mfa-step-up';
import { ResendVerification } from '@/features/account/resend-verification';
import { sessionApi } from '@/lib/api/server';
import { ADMIN_SIDEBAR_COOKIE, sidebarCollapsedFrom } from '@/lib/admin-sidebar';
import { ADMIN_LOCALE_COOKIE, adminLocaleFrom } from '@/lib/i18n/admin-locale';
import { pageDictionary } from '@/lib/i18n/page';
import { PATHNAME_HEADER } from '@/lib/request-path';
import { dashboardNavLabel, dashboardNav } from '@/lib/site';

const STAFF_ROLES = ['super_admin', 'admin', 'editor', 'instructor', 'support'];

/**
 * Admin shell.
 *
 * The role check here decides what to render; it is not the security boundary.
 * Every admin endpoint re-checks the caller's permissions in a policy at the
 * data source, so hiding a link never grants or withholds access on its own.
 *
 * The language comes from a cookie rather than the URL - see lib/i18n/
 * admin-locale.ts. The root layout reads the same cookie for its own
 * LocaleProvider, so the client components in here and the shell around them
 * agree without a second provider.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user: User;

  try {
    const response = await sessionApi<{ data: User }>('/me');
    user = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.isUnauthenticated || error.isForbidden)) {
      redirect('/login?next=/dashboard');
    }

    throw error;
  }

  if (!user.roles.some((role) => STAFF_ROLES.includes(role))) {
    redirect('/account');
  }

  const cookieStore = await cookies();
  const locale = adminLocaleFrom(cookieStore.get(ADMIN_LOCALE_COOKIE)?.value);
  // Read on the server, like the language, so a collapsed menu renders
  // collapsed from the first byte instead of flashing open and then closing.
  const sidebarCollapsed = sidebarCollapsedFrom(cookieStore.get(ADMIN_SIDEBAR_COOKIE)?.value);
  const { t } = pageDictionary(locale);

  /*
    Every admin endpoint carries the 'verified' middleware (routes/api_admin.php),
    so without a verified address each page fetches, is refused with 403, and
    renders a bare "This page couldn't load" with an error digest and nothing
    else. The shell says what is wrong and offers the way out instead, because
    the admin shell has no verification notice of its own - that lives in the
    customer sidebar, which staff never see.
  */
  if (!user.email_verified) {
    return (
      <main id="main" className="flex min-h-dvh flex-1 items-center justify-center bg-surface p-6">
        <div className="max-w-md rounded-xl border border-amber/40 bg-amber-soft p-6 text-navy">
          <h1 className="text-lg font-bold">{t.admin.verifyRequiredTitle}</h1>
          <p className="mt-2 text-sm">{t.admin.verifyRequired}</p>
          <ResendVerification className="mt-4" />
        </div>
      </main>
    );
  }

  /*
    The API refuses everything under /admin to a staff account without two-step
    verification (RequireStaffMfa), so the shell says so and offers the way to
    set it up, rather than letting every page fail with an error digest. The
    security page itself stays reachable, because that is where they go.
  */
  const pathname = (await headers()).get(PATHNAME_HEADER);

  if (!user.mfa_enabled && pathname !== '/dashboard/security') {
    return (
      <main id="main" className="flex min-h-dvh flex-1 items-center justify-center bg-surface p-6">
        <div className="max-w-md rounded-xl border border-amber/40 bg-amber-soft p-6 text-navy">
          <h1 className="text-lg font-bold">{t.admin.security.required}</h1>
          <p className="mt-2 text-sm">{t.admin.security.intro}</p>
          <Link
            href="/dashboard/security"
            className="mt-4 inline-block rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-soft"
          >
            {t.admin.security.setUpNow}
          </Link>
        </div>
      </main>
    );
  }

  /*
    Set up is not the same as typed into this session. A staff session that
    came in through Google or a remember-me cookie has not seen a code, and the
    API refuses it the admin endpoints until it has - the security page
    included, since turning the second step off is exactly what a borrowed
    session would want.
  */
  if (user.mfa_enabled && !user.mfa_session_verified) {
    return (
      <main id="main" className="flex min-h-dvh flex-1 items-center justify-center bg-surface p-6">
        <div className="w-full max-w-md rounded-xl border border-amber/40 bg-amber-soft p-6 text-navy">
          <h1 className="text-lg font-bold">{t.admin.security.stepUpTitle}</h1>
          <p className="mt-2 text-sm">{t.admin.security.stepUpIntro}</p>
          <MfaStepUp className="mt-4" />
          <SignOutButton className="mt-3" />
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface lg:flex-row">
      <AdminSidebar
        initialCollapsed={sidebarCollapsed}
        collapseLabel={t.admin.sidebarCollapse}
        expandLabel={t.admin.sidebarExpand}
      >
        <div className="p-5">
          <Link href="/" className="flex items-center gap-2 text-white hover:text-amber">
            <span
              aria-hidden="true"
              className="font-latin grid size-8 place-items-center rounded-lg bg-amber text-xs font-bold text-navy"
            >
              NB
            </span>
            <span className="text-sm font-bold">{t.admin.shellTitle}</span>
          </Link>

          <p className="mt-4 text-xs text-white/60">
            {user.name}
            <span className="font-latin mt-0.5 block">{user.roles.join(', ')}</span>
          </p>

          <AdminLanguageSwitcher className="mt-3 -ms-2.5" />
        </div>

        <nav aria-label={t.admin.navLabel} className="px-3 pb-6">
          {dashboardNav.map((group) => (
            <div key={group.headingKey} className="mb-5">
              <p className="px-2 text-[0.65rem] font-semibold tracking-[0.15em] text-white/50 uppercase">
                {t.admin.group[group.headingKey]}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white"
                    >
                      {dashboardNavLabel(item, t)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Leaving the admin panel: back to the customer-facing account, or out
              altogether. Both are here because the admin shell has no site header
              or footer to fall back on. */}
        <div className="border-t border-white/15 px-3 py-4">
          <Link
            href="/account"
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
          >
            {t.actions.myAccount}
          </Link>
          {user.roles.some(role => ['admin', 'super_admin'].includes(role)) && <Link href="/dashboard/payments" className="mb-3 block rounded px-3 py-2 text-sm hover:bg-white/10">{locale === 'en' ? 'Payment verification' : 'Payment যাচাই'}</Link>}
          <SignOutButton variant="inverse" className="mt-1" />
        </div>
      </AdminSidebar>

      <main id="main" className="min-w-0 flex-1 p-5 sm:p-8">
        {user.roles.some(role => ['admin', 'super_admin'].includes(role)) && <PendingPaymentAlert />}
        {children}
      </main>
    </div>
  );
}
