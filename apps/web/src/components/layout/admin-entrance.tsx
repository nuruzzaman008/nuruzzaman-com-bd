'use client';

import Link from 'next/link';

import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

/**
 * Footer entrance to the admin panel.
 *
 * Only rendered for a signed-in staff member. A customer or a passing visitor
 * has no use for it, and putting a permanent "admin" link in the footer of a
 * public site advertises the door to everyone who reads the page.
 *
 * Hiding it is presentation, not protection: `/dashboard` re-checks the role on
 * the server and every admin endpoint authorises separately.
 */
export function AdminEntrance() {
  const { isStaff } = useSession();
  const { t } = useLocale();

  if (!isStaff) {
    return null;
  }

  return (
    <Link
      href="/dashboard"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber px-4 py-2 text-sm font-bold text-navy transition-colors hover:bg-white"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
      {t.actions.adminPanel}
    </Link>
  );
}
