import type { Metadata } from 'next';
import type { MediaItem } from '@nuruzzaman/contracts';

import { mediaFiltersFrom, mediaHref } from '@/features/dashboard/media-filters';
import { MediaLibrary } from '@/features/dashboard/media-library';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.media);
}

export default async function DashboardMediaPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await adminDictionary();
  const { filters, page } = mediaFiltersFrom(await props.searchParams);

  const media = await sessionApi<{
    data: MediaItem[];
    meta?: { current_page: number; last_page: number; total: number };
    filters?: { months: string[] };
  }>('/admin/media', {
    query: {
      q: filters.q,
      type: filters.type,
      month: filters.month,
      page: page > 1 ? page : undefined,
    },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.media}</h1>
      <p className="mt-2 text-muted">{t.admin.media.altAdvice}</p>

      {/* Keyed by the address, so a new search or filter starts with nothing selected. */}
      <MediaLibrary
        key={mediaHref(filters, page)}
        items={media.data}
        months={media.filters?.months ?? []}
        filters={filters}
        page={{
          current: media.meta?.current_page ?? 1,
          last: media.meta?.last_page ?? 1,
          total: media.meta?.total ?? media.data.length,
        }}
      />
    </div>
  );
}
