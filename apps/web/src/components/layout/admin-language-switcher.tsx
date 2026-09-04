'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { cn } from '@/lib/cn';
import { ADMIN_LOCALE_COOKIE } from '@/lib/i18n/admin-locale';
import { LOCALE_LABEL, LOCALES, type Locale } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/i18n/locale-provider';

/*
  Writing the cookie lives outside the component: the React Compiler's rules
  treat assigning to a global inside one as a mutation to avoid, and it is
  clearer here anyway - this is a browser side effect, not render logic.
*/
function persistAdminLocale(option: Locale): void {
  document.cookie = `${ADMIN_LOCALE_COOKIE}=${option};path=/;max-age=31536000;samesite=lax`;
}

/**
 * Language switch for the signed-in applications.
 *
 * Unlike the public one this changes a preference rather than the URL: it
 * writes the cookie the layout reads, then refreshes so the server components
 * re-render in the chosen language. There is nothing to navigate to - the admin
 * has one URL per screen in either language.
 *
 * A year-long, lax cookie: it is a display preference, it should survive a
 * browser restart, and it carries nothing about the person.
 */
export function AdminLanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(option: Locale) {
    if (option === locale) {
      return;
    }

    persistAdminLocale(option);
    startTransition(() => router.refresh());
  }

  return (
    <div
      data-language-switcher="true"
      className={cn('flex items-center gap-1', className)}
      aria-busy={isPending}
    >
      <span className="sr-only" id="admin-language-label">
        {t.language.label}
      </span>

      <ul className="flex items-center gap-1" aria-labelledby="admin-language-label">
        {LOCALES.map((option) => {
          const isActive = option === locale;

          return (
            <li key={option}>
              <button
                type="button"
                lang={option}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => choose(option)}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-white/15 font-bold text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                {LOCALE_LABEL[option]}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
