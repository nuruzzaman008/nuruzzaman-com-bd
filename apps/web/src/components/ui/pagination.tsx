import Link from 'next/link';

import { cn } from '@/lib/cn';
import { number } from '@/lib/format';

export type PageMeta = {
  current_page?: number;
  last_page?: number;
};

/**
 * Server-rendered pagination. Links carry the existing query string so filters
 * survive a page change, and rel=prev/next helps crawlers follow the sequence.
 */
export function Pagination({
  meta,
  basePath,
  searchParams = {},
}: {
  meta: PageMeta | undefined;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const current = meta?.current_page ?? 1;
  const last = meta?.last_page ?? 1;

  if (last <= 1) {
    return null;
  }

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') {
        params.set(key, value);
      }
    }

    if (page > 1) {
      params.set('page', String(page));
    }

    const qs = params.toString();

    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkClass =
    'inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-navy hover:border-blue hover:text-blue';

  return (
    <nav aria-label="পেজিনেশন" className="mt-10 flex items-center justify-between gap-4">
      {current > 1 ? (
        <Link href={hrefFor(current - 1)} rel="prev" className={linkClass}>
          আগের পাতা
        </Link>
      ) : (
        <span className={cn(linkClass, 'pointer-events-none opacity-40')} aria-hidden="true">
          আগের পাতা
        </span>
      )}

      <p className="text-sm text-muted">
        পাতা {number(current)} / {number(last)}
      </p>

      {current < last ? (
        <Link href={hrefFor(current + 1)} rel="next" className={linkClass}>
          পরের পাতা
        </Link>
      ) : (
        <span className={cn(linkClass, 'pointer-events-none opacity-40')} aria-hidden="true">
          পরের পাতা
        </span>
      )}
    </nav>
  );
}
