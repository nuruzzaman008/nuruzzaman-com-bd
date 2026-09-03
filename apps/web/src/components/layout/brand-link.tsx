'use client';

import Link from 'next/link';

import { localizePath } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/i18n/locale-provider';
import { brand } from '@/lib/site';

/**
 * The masthead link home.
 *
 * A client component so both its target and its accessible name follow the
 * active locale — an English page whose only landmark link announces itself in
 * Bengali is exactly the mixed-language interface the switcher exists to avoid.
 */
export function BrandLink() {
  const { locale, t } = useLocale();

  return (
    <Link
      href={localizePath('/', locale)}
      className="flex items-center gap-2 rounded-md text-navy hover:text-blue"
    >
      <span
        aria-hidden="true"
        className="font-latin grid size-9 shrink-0 place-items-center rounded-lg bg-navy text-sm font-bold text-white"
      >
        NB
      </span>
      <span className="sr-only">
        {t.nav.home} — {brand.owner}
      </span>
      {/* Hidden below 400px so the header actions always fit. */}
      <span className="hidden min-w-0 leading-tight min-[400px]:block">
        <span className="block truncate text-sm font-bold">Engr. Md. Nuruzzaman</span>
        <span className="font-latin block truncate text-[0.7rem] tracking-wide text-muted">
          {t.brand.role}
        </span>
      </span>
    </Link>
  );
}
