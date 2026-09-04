'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/i18n/locale-provider';
import { localizePath } from '@/lib/i18n/locale';
import { navItemLabel, primaryNav, type NavItem } from '@/lib/site';

/**
 * The desktop primary navigation.
 *
 * A client component because both the label and the href depend on the active
 * locale, which comes from the URL. Rendering it on the server would freeze
 * whichever language the shell first rendered — the header would keep its
 * original labels after a language switch, since the root layout does not
 * re-render on client navigation.
 */
export function navLabel(item: NavItem, t: ReturnType<typeof useLocale>['t']): string {
  return navItemLabel(item, t);
}

/** The mobile menu's one-line blurb, for the items that carry one. */
export function navDescription(
  item: NavItem,
  t: ReturnType<typeof useLocale>['t'],
): string | undefined {
  return item.descriptionKey ? t.navDescription[item.descriptionKey] : undefined;
}

export function PrimaryNav() {
  const { locale, t } = useLocale();

  return (
    <nav aria-label={t.nav.primary} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {primaryNav.slice(1).map((item) => (
          <li key={item.href}>
            <Link
              href={localizePath(item.href, locale)}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-navy hover:bg-blue-soft hover:text-blue"
            >
              {navLabel(item, t)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
