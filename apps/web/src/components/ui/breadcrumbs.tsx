'use client';

import Link from 'next/link';

import { localizeHref } from '@/components/ui/locale-link';
import { useLocale } from '@/lib/i18n/locale-provider';
import { breadcrumbSchema, jsonLd } from '@/lib/seo';

export type Crumb = {
  name: string;
  path: string;
  /** The name is authored content, so it stays in the language it was written in. */
  authored?: boolean;
};

/**
 * Renders the visible trail and the matching BreadcrumbList JSON-LD from the
 * same array, so the structured data can never disagree with the page. The
 * paths are localised first, so the English page's structured data points at
 * English URLs rather than at their Bengali originals.
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const { locale, t } = useLocale();

  if (trail.length === 0) {
    return null;
  }

  const localised = trail.map((crumb) => ({
    ...crumb,
    path: localizeHref(crumb.path, locale),
  }));

  return (
    <>
      <nav aria-label={t.ui.breadcrumb} className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
          {localised.map((crumb, index) => {
            const isLast = index === localised.length - 1;

            return (
              <li
                key={crumb.path}
                data-authored={crumb.authored ? 'true' : undefined}
                className="flex items-center gap-2"
              >
                {isLast ? (
                  <span aria-current="page" className="font-medium text-navy">
                    {crumb.name}
                  </span>
                ) : (
                  <Link href={crumb.path} className="hover:text-blue hover:underline">
                    {crumb.name}
                  </Link>
                )}
                {isLast ? null : (
                  <span aria-hidden="true" className="text-line">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(localised)) }}
      />
    </>
  );
}
