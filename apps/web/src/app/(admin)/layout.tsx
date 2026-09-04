import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, type User } from '@nuruzzaman/contracts';

import { AdminLanguageSwitcher } from '@/components/layout/admin-language-switcher';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { sessionApi } from '@/lib/api/server';
import { ADMIN_LOCALE_COOKIE, adminLocaleFrom } from '@/lib/i18n/admin-locale';
import { pageDictionary } from '@/lib/i18n/page';
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

  const locale = adminLocaleFrom((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { t } = pageDictionary(locale);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface lg:flex-row">
      <aside className="border-b border-line bg-navy text-white lg:w-64 lg:border-e lg:border-b-0">
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
          <SignOutButton variant="inverse" className="mt-1" />
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1 p-5 sm:p-8">
        {children}
      </main>
    </div>
  );
}
