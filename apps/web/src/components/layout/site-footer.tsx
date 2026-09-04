'use client';

/*
 * A client component so its labels and link targets follow the active
 * locale, which comes from the URL. `settings` is plain serialisable data
 * fetched by the layout, so nothing server-only crosses the boundary.
 */
import Link from 'next/link';

import { AdminEntrance } from '@/components/layout/admin-entrance';
import type { SiteSettings } from '@nuruzzaman/contracts';

import { Container } from '@/components/ui/container';
import { navLabel } from '@/components/layout/primary-nav';
import { localizePath } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/i18n/locale-provider';
import { brand, legalNav, primaryNav, supportNav } from '@/lib/site';

/**
 * Contact details render only when the owner has configured them, so the footer
 * never shows a placeholder address or an invented phone number.
 */
export function SiteFooter({ settings }: { settings: SiteSettings | null }) {
  const { locale, t } = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-line bg-navy text-white">
      <Container size="wide" className="py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-base font-bold">{settings?.name ?? brand.owner}</p>
            <p className="mt-3 text-sm text-white/75">{t.brand.statement}</p>
            {settings?.legal_entity ? (
              <p className="mt-3 text-xs text-white/60">{settings.legal_entity}</p>
            ) : null}
          </div>

          <nav aria-labelledby="footer-explore">
            <p id="footer-explore" className="text-sm font-semibold text-amber">
              {t.footer.explore}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {primaryNav.slice(1).map((item) => (
                <li key={item.href}>
                  <Link href={localizePath(item.href, locale)} className="text-white/80 hover:text-white hover:underline">
                    {navLabel(item, t)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-support">
            <p id="footer-support" className="text-sm font-semibold text-amber">
              {t.footer.help}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {supportNav.map((item) => (
                <li key={item.href}>
                  <Link href={localizePath(item.href, locale)} className="text-white/80 hover:text-white hover:underline">
                    {navLabel(item, t)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-sm font-semibold text-amber">{t.footer.contact}</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              {settings?.support_email ? (
                <li>
                  <a href={`mailto:${settings.support_email}`} className="hover:text-white hover:underline">
                    {settings.support_email}
                  </a>
                </li>
              ) : null}
              {settings?.phone ? <li>{settings.phone}</li> : null}
              {settings?.support_hours ? (
                <li className="text-white/60">{settings.support_hours}</li>
              ) : null}
              {settings?.business_address ? (
                <li className="text-white/60">{settings.business_address}</li>
              ) : null}
              {!settings?.support_email && !settings?.phone ? (
                <li className="text-white/60">
                  <Link
                    href={localizePath('/contact', locale)}
                    className="hover:text-white hover:underline"
                  >
                    {t.footer.useContactForm}
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/15 pt-6">
          {/* Rendered only for signed-in staff; see AdminEntrance. */}
          <AdminEntrance />

          <nav aria-label={t.footer.legal} className="mt-6">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
              {legalNav.map((item) => (
                <li key={item.href}>
                  <Link href={localizePath(item.href, locale)} className="text-white/70 hover:text-white hover:underline">
                    {navLabel(item, t)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="mt-4 text-xs text-white/55">
            &copy; {year} {settings?.name ?? brand.owner}. {t.footer.disclaimer}
          </p>
        </div>
      </Container>
    </footer>
  );
}
