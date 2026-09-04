'use client';

import Link from 'next/link';

import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

const ICON = (
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
);

/**
 * Footer entrance to the admin panel.
 *
 * Staff go straight to the dashboard. Everyone else gets the sign-in door,
 * carrying `next=/dashboard` so signing in lands on the panel rather than on
 * the account page.
 *
 * The sign-in link is deliberately quiet - a bordered link on the navy footer,
 * not the amber button staff get. It is a door the owner asked to be able to
 * find, not something to advertise to every reader.
 *
 * Showing it is presentation, never protection: /dashboard re-checks the role
 * on the server, and every admin endpoint authorises separately. A visitor who
 * follows this link and is not staff simply cannot get in.
 */
export function AdminEntrance() {
  const { isStaff, isLoading } = useSession();
  const { t } = useLocale();

  // While /me is still in flight, showing the sign-in link to a staff member
  // for a moment and then swapping it would flicker. Waiting costs nothing:
  // this sits at the bottom of the page.
  if (isLoading) {
    return null;
  }

  if (isStaff) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber px-4 py-2 text-sm font-bold text-navy transition-colors hover:bg-white"
      >
        {ICON}
        {t.actions.adminPanel}
      </Link>
    );
  }

  return (
    <Link
      href="/login?next=%2Fdashboard"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-white hover:bg-white/10 hover:text-white"
    >
      {ICON}
      {t.actions.adminSignIn}
    </Link>
  );
}
