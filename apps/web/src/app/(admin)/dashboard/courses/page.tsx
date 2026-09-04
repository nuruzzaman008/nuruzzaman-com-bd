import type { Metadata } from 'next';
import Link from 'next/link';
import type { Course } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { number } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { levelLabel } from '@/lib/i18n/labels';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.courses);
}

export default async function DashboardCoursesPage() {
  const { locale, t } = await adminDictionary();
  const courses = await sessionApi<{ data: Course[] }>('/admin/courses');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.courses}</h1>
      <p className="mt-2 text-muted">{t.admin.courses.publishRule}</p>

      <div className="mt-6">
        <DataTable
          caption={t.admin.courses.caption}
          rows={courses.data}
          getRowKey={(course) => course.slug}
          empty={<EmptyState title={t.admin.courses.empty} />}
          columns={[
            {
              key: 'title',
              header: t.admin.nav.courses,
              render: (course) => (
                <span>
                  <Link
                    href={`/courses/${course.slug}`}
                    data-authored="true"
                    className="block font-medium text-blue hover:underline"
                  >
                    {course.title}
                  </Link>
                  <span className="font-latin block text-xs text-muted">/{course.slug}</span>
                </span>
              ),
            },
            {
              key: 'level',
              header: t.admin.courses.level,
              render: (course) => levelLabel(t, course.level),
            },
            {
              key: 'seo',
              header: 'SEO',
              render: (course) =>
                course.id ? (
                  <Link
                    href={`/dashboard/courses/${course.id}/seo`}
                    className="text-blue hover:underline"
                  >
                    {t.admin.courses.analysis}
                  </Link>
                ) : null,
            },
            {
              key: 'lessons',
              header: t.admin.courses.lessons,
              align: 'end',
              render: (course) => number(course.lesson_count ?? 0, locale),
            },
            {
              key: 'published',
              header: t.admin.common.published,
              render: (course) =>
                course.published_at ? (
                  <Badge tone="success">{t.admin.common.published}</Badge>
                ) : (
                  <Badge tone="neutral">{t.admin.courses.draft}</Badge>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
