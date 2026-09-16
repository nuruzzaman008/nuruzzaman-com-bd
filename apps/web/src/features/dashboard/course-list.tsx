'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { SeoScoreBadge, ViewLink } from '@/features/admin/seo-score-badge';
import { BulkToolbar, useBulkDelete } from '@/features/dashboard/bulk-delete';
import { number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';

/** The courses list, with selecting and deleting. Scores are computed on the server. */
export type CourseRow = {
  id: number;
  slug: string;
  title: string;
  level: string;
  lessons: number;
  seoScore: number | null;
  live: boolean;
};

export function CourseList({ rows, emptyTitle }: { rows: CourseRow[]; emptyTitle: string }) {
  const { locale, t } = useLocale();
  const bulk = useBulkDelete({
    rows,
    noun: 'course',
    path: (row) => `/admin/courses/${row.id}`,
  });

  return (
    <div className="mt-6">
      <BulkToolbar bulk={bulk} />

      <DataTable
        caption={t.admin.courses.caption}
        rows={rows}
        getRowKey={(row) => row.slug}
        empty={<EmptyState title={emptyTitle} />}
        columns={[
          ...bulk.column(),
          {
            key: 'title',
            header: t.admin.nav.courses,
            render: (row) => (
              <Link
                href={`/dashboard/courses/${row.id}`}
                data-authored="true"
                className="block font-medium text-blue hover:underline"
              >
                {row.title}
                <span className="font-latin block text-xs font-normal text-muted">/{row.slug}</span>
              </Link>
            ),
          },
          {
            key: 'level',
            header: t.admin.courses.level,
            render: (row) => row.level,
          },
          {
            key: 'seo',
            header: 'SEO',
            render: (row) => (
              <SeoScoreBadge
                score={row.seoScore}
                href={`/dashboard/courses/${row.id}/seo`}
                t={t}
                locale={locale}
              />
            ),
          },
          {
            key: 'view',
            header: t.admin.common.view,
            render: (row) => (
              <ViewLink
                href={row.live ? `/courses/${row.slug}` : null}
                label={t.admin.common.view}
                draftLabel={t.admin.courses.draft}
              />
            ),
          },
          {
            key: 'lessons',
            header: t.admin.courses.lessons,
            align: 'end',
            render: (row) => number(row.lessons, locale),
          },
          {
            key: 'published',
            header: t.admin.common.published,
            render: (row) =>
              row.live ? (
                <Badge tone="success">{t.admin.common.published}</Badge>
              ) : (
                <Badge tone="neutral">{t.admin.courses.draft}</Badge>
              ),
          },
        ]}
      />
    </div>
  );
}
