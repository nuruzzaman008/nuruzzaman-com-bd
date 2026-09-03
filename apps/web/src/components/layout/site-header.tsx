import Link from 'next/link';

import { HeaderActions } from '@/components/layout/header-actions';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { PrimaryNav } from '@/components/layout/primary-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Container } from '@/components/ui/container';

/**
 * The header is a Server Component so public pages stay cacheable. The two
 * pieces that depend on the visitor - the cart count and the account link -
 * are small Client Components that fill themselves in after hydration.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <Container size="wide">
        <div className="flex min-h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav />
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md text-navy hover:text-blue"
            >
              <span
                aria-hidden="true"
                className="font-latin grid size-9 shrink-0 place-items-center rounded-lg bg-navy text-sm font-bold text-white"
              >
                NB
              </span>
              <span className="sr-only">হোম — Engr. Md. Nuruzzaman, RSE</span>
              {/* Hidden below 400px so the header actions always fit. */}
              <span className="hidden min-w-0 leading-tight min-[400px]:block">
                <span className="block truncate text-sm font-bold">Engr. Md. Nuruzzaman</span>
                <span className="font-latin block truncate text-[0.7rem] tracking-wide text-muted">
                  RSE · nuruzzaman.com.bd
                </span>
              </span>
            </Link>
          </div>

          <PrimaryNav />


          <div className="flex items-center gap-1">
            <LanguageSwitcher className="hidden md:flex" />
            <HeaderActions />
          </div>
        </div>
      </Container>
    </header>
  );
}
