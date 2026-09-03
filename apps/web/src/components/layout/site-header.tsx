
import { BrandLink } from '@/components/layout/brand-link';
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
            <BrandLink />
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
