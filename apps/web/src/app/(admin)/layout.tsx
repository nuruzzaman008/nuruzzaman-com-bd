import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError, type User } from '@nuruzzaman/contracts';

import { sessionApi } from '@/lib/api/server';
import { dashboardNav } from '@/lib/site';

const STAFF_ROLES = ['super_admin', 'admin', 'editor', 'instructor', 'support'];

/**
 * Admin shell.
 *
 * The role check here decides what to render; it is not the security boundary.
 * Every admin endpoint re-checks the caller's permissions in a policy at the
 * data source, so hiding a link never grants or withholds access on its own.
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
            <span className="text-sm font-bold">অ্যাডমিন</span>
          </Link>

          <p className="mt-4 text-xs text-white/60">
            {user.name}
            <span className="font-latin mt-0.5 block">{user.roles.join(', ')}</span>
          </p>
        </div>

        <nav aria-label="ড্যাশবোর্ড নেভিগেশন" className="px-3 pb-6">
          {dashboardNav.map((group) => (
            <div key={group.heading} className="mb-5">
              <p className="px-2 text-[0.65rem] font-semibold tracking-[0.15em] text-white/50 uppercase">
                {group.heading}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main id="main" className="min-w-0 flex-1 p-5 sm:p-8">
        {children}
      </main>
    </div>
  );
}
