import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Course } from '@nuruzzaman/contracts';

import { SeoEditor } from '@/features/dashboard/seo-editor';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.courseSeo);
}

export default async function CourseSeoPage(props: { params: Promise<{ id: string }> }) {
  const { t } = await adminDictionary();
  const { id } = await props.params;

  let course: Course;

  try {
    const response = await sessionApi<{ data: Course }>(
      `/admin/courses/${encodeURIComponent(id)}`,
    );
    course = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.isForbidden)) {
      notFound();
    }

    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.courses, path: '/dashboard/courses' },
          { name: course.title, path: `/dashboard/courses/${id}/seo` },
        ]}
      />

      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">
        SEO — {course.title}
      </h1>

      <div className="mt-6">
        <SeoEditor
          kind="course"
          endpoint={`/admin/courses/${id}`}
          title={course.title}
          slug={course.slug}
          // The analysis reads the course description, which the API returns as
          // HTML; the analyser strips tags, so this measures the prose itself.
          body={course.description_html ?? ''}
          excerpt={course.subtitle ?? ''}
          seo={course.seo ?? null}
        />
      </div>
    </div>
  );
}
