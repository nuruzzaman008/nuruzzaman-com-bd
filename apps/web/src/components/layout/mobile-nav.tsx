'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { navDescription, navLabel } from '@/components/layout/primary-nav';
import { localizePath } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/i18n/locale-provider';
import { primaryNav, supportNav } from '@/lib/site';

/**
 * False while rendering on the server, true once hydrated.
 *
 * A portal has nowhere to go until there is a document, and this says so
 * without a setState in an effect - which would run on every mount for a
 * value that is a constant per environment.
 */
const subscribeToNothing = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

export function MobileNav() {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  // Any navigation closes the panel, including a back/forward gesture. This is
  // an adjustment during render rather than an effect, so the panel never
  // flashes open on the new page.
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);

    // The panel covers the screen, so the page behind it must not scroll -
    // otherwise a swipe over the menu drags the article underneath instead.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  /*
    The panel is rendered into <body>, not where this component sits.

    The site header carries `backdrop-blur`, and a backdrop-filter makes an
    element the containing block for `position: fixed` descendants. Left inside
    the header, the panel resolved `top-16 bottom-0` against the header's own
    64px-tall box and collapsed to a ~49px strip with the whole menu scrolling
    inside it. Portalling it out is what makes `fixed` mean the viewport again.
  */
  const panel = (
    <div
      id="mobile-nav-panel"
      hidden={!open}
      className="fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto overscroll-contain border-t border-line bg-white px-4 py-6 lg:hidden"
    >
      <nav aria-label={t.nav.mobile}>
        <ul className="space-y-1">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <Link
                href={localizePath(item.href, locale)}
                className="block rounded-lg px-3 py-3 text-base font-semibold text-navy hover:bg-blue-soft hover:text-blue"
              >
                {navLabel(item, t)}
                {item.descriptionKey ? (
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {navDescription(item, t)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 px-3 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          {t.footer.help}
        </p>
        <ul className="mt-2 space-y-1">
          {supportNav.map((item) => (
            <li key={item.href}>
              <Link
                href={localizePath(item.href, locale)}
                className="block rounded-lg px-3 py-2.5 text-sm text-navy hover:bg-blue-soft hover:text-blue"
              >
                {navLabel(item, t)}
              </Link>
            </li>
          ))}
        </ul>

        {/*
          The header's switcher is hidden below md, so without this a reader on
          a phone has no way to change language at all.
        */}
        <div className="mt-6 border-t border-line px-1 pt-4">
          <LanguageSwitcher />
        </div>
      </nav>
    </div>
  );

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-lg border border-line text-navy hover:border-blue hover:text-blue"
      >
        <span className="sr-only">{open ? t.nav.closeMenu : t.nav.openMenu}</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {hydrated ? createPortal(panel, document.body) : null}
    </div>
  );
}
