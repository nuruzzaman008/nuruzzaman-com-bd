import Link from 'next/link';

import { breadcrumbSchema, jsonLd } from '@/lib/seo';

export type Crumb = { name: string; path: string };

/**
 * Renders the visible trail and the matching BreadcrumbList JSON-LD from the
 * same array, so the structured data can never disagree with the page.
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  if (trail.length === 0) {
    return null;
  }

  return (
    <>
      <nav aria-label="ব্রেডক্রাম্ব" className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
          {trail.map((crumb, index) => {
            const isLast = index === trail.length - 1;

            return (
              <li key={crumb.path} className="flex items-center gap-2">
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
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(trail)) }}
      />
    </>
  );
}
