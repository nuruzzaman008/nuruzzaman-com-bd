'use client';

import Link from 'next/link';

import { number } from '@/lib/format';
import { localizeHref } from '@/components/ui/locale-link';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

/**
 * Search, cart and account controls.
 *
 * These are the only parts of the header that depend on the visitor, so they
 * hydrate on the client and let every public page stay statically cacheable.
 * The session itself is fetched once by SessionProvider and shared, so the
 * footer's admin entrance does not repeat the same request.
 */
export function HeaderActions() {
  const { user, cartCount: itemCount } = useSession();
  const { locale, t } = useLocale();

  return (
    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
      <Link
        href={localizeHref('/search', locale)}
        className="inline-flex size-11 items-center justify-center rounded-lg text-navy hover:bg-blue-soft hover:text-blue"
      >
        <span className="sr-only">{t.actions.search}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </Link>

      <Link
        href="/cart"
        className="relative inline-flex size-11 items-center justify-center rounded-lg text-navy hover:bg-blue-soft hover:text-blue"
      >
        <span className="sr-only">
          {t.actions.cart}
          {itemCount ? ` (${number(itemCount)})` : ''}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 5h2l2 10h9l2-7H7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9.5" cy="19" r="1.4" />
          <circle cx="17" cy="19" r="1.4" />
        </svg>
        {itemCount && itemCount > 0 ? (
          <span
            aria-hidden="true"
            className="font-latin absolute end-1 top-1 grid min-w-5 place-items-center rounded-full bg-amber px-1 text-[0.65rem] font-bold text-navy"
          >
            {itemCount}
          </span>
        ) : null}
      </Link>

      <Link
        href={user ? '/account' : '/login'}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-navy hover:bg-blue-soft hover:text-blue"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">{user ? t.actions.account : t.actions.signIn}</span>
        <span className="sr-only sm:hidden">{user ? t.actions.account : t.actions.signIn}</span>
      </Link>
    </div>
  );
}
