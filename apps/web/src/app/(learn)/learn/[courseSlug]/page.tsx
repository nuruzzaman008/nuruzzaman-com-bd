import { notFound, redirect } from 'next/navigation';
import { ApiError, type CourseOutline } from '@nuruzzaman/contracts';

import { sessionApi } from '@/lib/api/server';

/**
 * Entry point for the player: sends the learner to wherever they left off, or
 * to the first unlocked lesson.
 */
export default async function LearnCourseEntryPage(props: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await props.params;

  let outline: CourseOutline;

  try {
    const response = await sessionApi<{ data: CourseOutline }>(
      `/learn/${encodeURIComponent(courseSlug)}/outline`,
    );
    outline = response.data;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) {
      redirect(`/login?next=/learn/${courseSlug}`);
    }

    if (error instanceof ApiError && (error.isForbidden || error.status === 404)) {
      notFound();
    }

    throw error;
  }

  const lessons = outline.sections.flatMap((section) => section.lessons);
  const target = lessons.find((lesson) => lesson.is_unlocked && !lesson.is_completed) ?? lessons[0];

  if (!target) {
    notFound();
  }

  redirect(`/learn/${courseSlug}/${target.slug}`);
}
