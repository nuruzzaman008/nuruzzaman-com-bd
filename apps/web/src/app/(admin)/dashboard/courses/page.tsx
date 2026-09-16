import type { Metadata } from 'next';
import Link from 'next/link';
import type { Course } from '@nuruzzaman/contracts';

import { AdminSearchForm } from '@/features/admin/admin-search-form';
import { seoScoreOf } from '@/features/admin/seo-score';
import { CourseList, type CourseRow } from '@/features/dashboard/course-list';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { levelLabel } from '@/lib/i18n/labels';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.courses);
}

export default async function DashboardCoursesPage(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const bn = locale === 'bn';
  const q = (await props.searchParams).q?.trim() || undefined;
  const courses = await sessionApi<{ data: Course[]; meta?: { total?: number } }>(
    '/admin/courses',
    { query: { q } },
  );

  const rows: CourseRow[] = courses.data
    // A course with no id is one this user may not open, so it is not listed.
    .filter((course) => typeof course.id === 'number')
    .map((course) => ({
      id: course.id as number,
      slug: course.slug,
      title: course.title,
      level: levelLabel(t, course.level),
      lessons: course.lesson_count ?? 0,
      live: Boolean(course.published_at),
      seoScore: seoScoreOf(
        {
          kind: 'course',
          title: course.title,
          slug: course.slug,
          content: course.description_html,
          excerpt: course.subtitle ?? undefined,
          metaTitle: course.seo?.meta_title ?? '',
          metaDescription: course.seo?.meta_description ?? '',
          focusKeyword: course.seo?.focus_keyword ?? '',
          featuredImage: course.cover_url ? { alt: null } : null,
        },
        t,
      ),
    }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.courses}</h1>
        <Link
          href="/dashboard/courses/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-blue px-5 font-semibold text-white hover:bg-navy"
        >
          {bn ? '+ নতুন কোর্স' : '+ New course'}
        </Link>
      </div>
      <p className="mt-2 text-muted">{t.admin.courses.publishRule}</p>

      <AdminSearchForm
        id="course-search"
        basePath="/dashboard/courses"
        value={q}
        total={courses.meta?.total ?? courses.data.length}
        label={bn ? 'কোর্স খুঁজুন' : 'Search courses'}
        placeholder={bn ? 'কোর্সের নাম বা URL slug…' : 'Course title or URL slug…'}
        searchLabel={t.admin.common.search}
        locale={locale}
      />

      <CourseList
        rows={rows}
        emptyTitle={
          q
            ? bn
              ? `“${q}” নামে বা slug-এ কোনো কোর্স পাওয়া যায়নি`
              : `No course matches “${q}”`
            : t.admin.courses.empty
        }
      />
    </div>
  );
}
