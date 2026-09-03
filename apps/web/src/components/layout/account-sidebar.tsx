'use client';

import Link from 'next/link';
import type { User } from '@nuruzzaman/contracts';

import { SignOutButton } from '@/features/auth/sign-out-button';
import { useLocale } from '@/lib/i18n/locale-provider';
import { accountNav } from '@/lib/site';

/**
 * The customer account sidebar.
 *
 * A client component so its labels follow the interface language. The account
 * pages themselves are not part of the bilingual URL tree — they are not
 * indexed — so the language here follows whatever the visitor last chose on the
 * public site.
 */
export function AccountSidebar({ user }: { user: User }) {
  const { t } = useLocale();

  return (
    <aside>
      <p className="text-sm text-muted">{t.account.signedInAs}</p>
      <p className="font-bold text-navy">{user.name}</p>
      <p className="font-latin text-xs break-all text-muted">{user.email}</p>

      {!user.email_verified ? (
        <p className="mt-3 rounded-lg border border-amber/40 bg-amber-soft p-3 text-xs text-navy">
          {t.account.emailUnverified}
        </p>
      ) : null}

      <nav aria-label={t.account.navigation} className="mt-5">
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

      {/* The admin panel is a separate application, reached from the footer's
          staff-only entrance rather than from inside the customer account.
          Mixing the two made one look like a section of the other. */}
      <SignOutButton className="mt-4 border-t border-line pt-4" />
    </aside>
  );
}
