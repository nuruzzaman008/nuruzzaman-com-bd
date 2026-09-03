'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLocale } from '@/lib/i18n/locale-provider';
import { LOCALE_LABEL, LOCALES, isPrivatePath, localizePath } from '@/lib/i18n/locale';
import { cn } from '@/lib/cn';

/**
 * বাংলা / English switcher.
 *
 *  - Shows both languages with the active one marked, rather than a single
 *    toggle whose state you have to infer.
 *  - Opens the equivalent page, not the homepage.
 *  - Text, never flags: a flag is a country, not a language.
 *  - Each language is written in its own name, so a reader who cannot read the
 *    current interface can still find their way out.
 *
 * Hidden inside the signed-in applications, which are not part of the
 * bilingual URL tree.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname() || '/';
  const { locale, t } = useLocale();

  if (isPrivatePath(pathname)) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="sr-only" id="language-switcher-label">
        {t.language.label}
      </span>

      <ul className="flex items-center gap-1" aria-labelledby="language-switcher-label">
        {LOCALES.map((option) => {
          const isActive = option === locale;

          return (
            <li key={option}>
              {isActive ? (
                <span
                  aria-current="true"
                  lang={option}
                  className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-bold text-navy"
                >
                  {LOCALE_LABEL[option]}
                </span>
              ) : (
                <Link
                  href={localizePath(pathname, option)}
                  lang={option}
                  hrefLang={option}
                  className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-muted hover:bg-blue-soft hover:text-blue"
                >
                  {LOCALE_LABEL[option]}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
