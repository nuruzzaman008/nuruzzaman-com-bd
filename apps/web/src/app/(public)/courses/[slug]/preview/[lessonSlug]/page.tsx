import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Lesson } from '@nuruzzaman/contracts';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Container } from '@/components/ui/container';
import { Prose } from '@/components/ui/prose';
import { publicApi } from '@/lib/api/server';
import { duration } from '@/lib/format';
import { getDictionary } from '@/lib/i18n/dictionary';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { buildMetadata } from '@/lib/seo';

/**
 * A free preview lesson. The API only serves lessons explicitly flagged as a
 * preview here; everything else needs an enrolment and goes through /learn.
 */
async function loadPreview(courseSlug: string, lessonSlug: string): Promise<Lesson> {
  try {
    const response = await publicApi<{ data: Lesson }>(
      `/courses/${encodeURIComponent(courseSlug)}/preview/${encodeURIComponent(lessonSlug)}`,
      { tags: ['courses', `course:${courseSlug}`] },
    );

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}): Promise<Metadata> {
  const { slug, lessonSlug } = await props.params;
  const lesson = await loadPreview(slug, lessonSlug);

  return buildMetadata({
    title: `${lesson.title} — ${getDictionary('bn').course.previewMetaSuffix}`,
    description: lesson.course.title
      ? `${lesson.course.title}: ${getDictionary('bn').course.previewMetaDescription}`
      : null,
    path: `/courses/${slug}/preview/${lessonSlug}`,
  });
}

export default async function PreviewLessonPage(
  props: LocalizedPageProps & { params: Promise<{ slug: string; lessonSlug: string }> },
) {
  const { locale, t } = pageDictionary(props.locale);
  const { slug, lessonSlug } = await props.params;
  const lesson = await loadPreview(slug, lessonSlug);

  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: t.common.home, path: '/' },
          { name: t.nav.courses, path: '/courses' },
          {
            name: lesson.course.title ?? t.nav.courses,
            path: `/courses/${slug}`,
            authored: true,
          },
          {
            name: lesson.title,
            path: `/courses/${slug}/preview/${lessonSlug}`,
            authored: true,
          },
        ]}
      />

      <header className="mt-6">
        <p className="text-sm font-semibold text-teal">{t.course.freePreview}</p>
        <h1 className="mt-2 text-[length:var(--step-h1)] font-bold text-navy">{lesson.title}</h1>
        {lesson.duration_seconds ? (
          <p className="mt-2 text-sm text-muted">{duration(lesson.duration_seconds, locale)}</p>
        ) : null}
      </header>

      {lesson.playback && !lesson.playback.available ? (
        <Callout tone="info" className="mt-6">
          {lesson.playback.message ?? t.course.previewNoVideo}
        </Callout>
      ) : null}

      {lesson.body_html ? <Prose html={lesson.body_html} className="mt-8" /> : null}

      <Callout tone="warning" className="mt-10">
        <p className="font-semibold">{t.course.previewMoreHeading}</p>
        <p className="mt-1">{t.course.previewMoreBody}</p>
        <div className="mt-4">
          <ButtonLink href={`/courses/${slug}`}>{t.course.previewSeeCourse}</ButtonLink>
        </div>
      </Callout>
    </Container>
  );
}
