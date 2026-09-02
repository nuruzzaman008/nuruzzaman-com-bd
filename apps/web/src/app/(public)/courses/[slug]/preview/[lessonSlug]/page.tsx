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
    title: `${lesson.title} — ফ্রি প্রিভিউ`,
    description: lesson.course.title ? `${lesson.course.title} কোর্সের ফ্রি প্রিভিউ লেসন।` : null,
    path: `/courses/${slug}/preview/${lessonSlug}`,
  });
}

export default async function PreviewLessonPage(props: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await props.params;
  const lesson = await loadPreview(slug, lessonSlug);

  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: 'হোম', path: '/' },
          { name: 'কোর্স', path: '/courses' },
          { name: lesson.course.title ?? 'কোর্স', path: `/courses/${slug}` },
          { name: lesson.title, path: `/courses/${slug}/preview/${lessonSlug}` },
        ]}
      />

      <header className="mt-6">
        <p className="text-sm font-semibold text-teal">ফ্রি প্রিভিউ</p>
        <h1 className="mt-2 text-[length:var(--step-h1)] font-bold text-navy">{lesson.title}</h1>
        {lesson.duration_seconds ? (
          <p className="mt-2 text-sm text-muted">{duration(lesson.duration_seconds)}</p>
        ) : null}
      </header>

      {lesson.playback && !lesson.playback.available ? (
        <Callout tone="info" className="mt-6">
          {lesson.playback.message ?? 'এই লেসনের ভিডিও এখনো যুক্ত করা হয়নি।'}
        </Callout>
      ) : null}

      {lesson.body_html ? <Prose html={lesson.body_html} className="mt-8" /> : null}

      <Callout tone="warning" className="mt-10">
        <p className="font-semibold">সম্পূর্ণ কোর্সে আরও কী আছে</p>
        <p className="mt-1">
          বাকি লেসন, অনুশীলন ফাইল, কুইজ ও সার্টিফিকেট পেতে কোর্সে ভর্তি হতে হবে।
        </p>
        <div className="mt-4">
          <ButtonLink href={`/courses/${slug}`}>কোর্সের বিস্তারিত দেখুন</ButtonLink>
        </div>
      </Callout>
    </Container>
  );
}
