'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { primaryNav, supportNav } from '@/lib/site';

export function MobileNav() {
  const [open, setOpen] = useState(false);
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

    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-lg border border-line text-navy hover:border-blue hover:text-blue"
      >
        <span className="sr-only">{open ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          )}
        </svg>
      </button>

      <div
        id="mobile-nav-panel"
        hidden={!open}
        className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto border-t border-line bg-white px-4 py-6"
      >
        <nav aria-label="মোবাইল নেভিগেশন">
          <ul className="space-y-1">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-lg px-3 py-3 text-base font-semibold text-navy hover:bg-blue-soft hover:text-blue"
                >
                  {item.label}
                  {item.description ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted">
                      {item.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 px-3 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            সহায়তা
          </p>
          <ul className="mt-2 space-y-1">
            {supportNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 text-sm text-navy hover:bg-blue-soft hover:text-blue"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
