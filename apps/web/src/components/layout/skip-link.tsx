'use client';

import { useLocale } from '@/lib/i18n/locale-provider';

export function SkipLink() {
  const { t } = useLocale();

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-navy focus:px-4 focus:font-semibold focus:text-white"
    >
      {t.nav.skipToContent}
    </a>
  );
}
